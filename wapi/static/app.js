// ============================================
// GLOBAL STATE
// ============================================
let currentUser = null;
let currentStationId = null;
let chartInstance = null;
let detailRefreshInterval = null;
let stationsRefreshInterval = null; // Interval for auto-refreshing station list
let currentStationTab = "owned"; // Track which tab is active
const AUTO_REFRESH_INTERVAL = 5000; // Refresh every 5 seconds

const API_BASE = "";

// ============================================
// HELPER FUNCTIONS
// ============================================
/**
 * Determines if a station is connected based on last_updated timestamp.
 * A station is considered "connected" if data was received within the last 2 hours.
 * @param {string} lastUpdated - ISO timestamp of last data update
 * @returns {Object} { isConnected: boolean, status: string, badgeClass: string }
 */
function getConnectionStatus(lastUpdated) {
  // Treat null/undefined/empty as never connected
  if (lastUpdated == null || lastUpdated === "") {
    return {
      isConnected: false,
      status: "Never Connected",
      badgeClass: "badge-disconnected"
    };
  }

  // Parse the timestamp defensively. If parsing fails, treat as never connected.
  const lastUpdate = new Date(lastUpdated);
  if (isNaN(lastUpdate.getTime())) {
    return {
      isConnected: false,
      status: "Never Connected",
      badgeClass: "badge-disconnected"
    };
  }

  const now = new Date();
  const minutesAgo = (now - lastUpdate) / (1000 * 60);

  const isConnected = minutesAgo <= 120; // 2 hours = 120 minutes
  return {
    isConnected,
    status: isConnected ? "last updated" : "Disconnected",
    badgeClass: isConnected ? "badge-connected" : "badge-disconnected"
  };
}

/**
 * Formats station name to include owner, location, and ID for uniqueness.
 * Format: "Owner - Location (ID)"
 * @param {string} owner - Station owner username
 * @param {string} location - Station location
 * @param {number} stationId - Station ID
 * @returns {string} Formatted station name
 */
function formatStationName(owner, location, stationId) {
  return `${owner} - ${location} (${stationId})`;
}

/**
 * Formats relative time from ISO timestamp
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Human-readable relative time (e.g., "12m ago", "3h ago")
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return "Never";
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Masks API key for display (show first 6 + last 4)
 * @param {string} apiKey - Full API key
 * @returns {string} Masked API key
 */
function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 10) return "***hidden***";
  return apiKey.slice(0, 6) + "..." + apiKey.slice(-4);
}

/**
 * Formats metric values with appropriate units and decimals
 * @param {string} metric - Metric name
 * @param {number} value - Metric value
 * @returns {string} Formatted value with unit
 */
function formatMetric(metric, value) {
  const units = {
    temperature: "°C",
    humidity: "%",
    pressure: "hPa",
    wind_speed: "m/s",
    uv_index: "",
  };
  const unit = units[metric] || "";
  const decimal = metric === "wind_speed" ? 1 : metric === "uv_index" ? 1 : metric === "temperature" ? 1 : 0;
  const formatted = parseFloat(value).toFixed(decimal);
  return `${formatted}${unit}`;
}

/**
 * Adjusts the font size of station name headers to fit within their containers.
 * Reduces font size progressively until the title fits on a single line.
 */
function adjustStationNames() {
  const h3Elements = document.querySelectorAll(".station-header h3");
  const minFontPx = 12; // Minimum font size in pixels

  h3Elements.forEach(h3 => {
    const containerWidth = h3.parentElement.clientWidth - 20; // Account for padding
    
    // Reset to default font size
    h3.style.fontSize = '';
    
    // Get computed font size in pixels
    const computed = window.getComputedStyle(h3);
    let fontSize = parseFloat(computed.fontSize);

    // Reduce font size until it fits or we hit the minimum
    while (h3.scrollWidth > containerWidth && fontSize > minFontPx) {
      fontSize -= 1;
      h3.style.fontSize = fontSize + 'px';
    }
  });
}

/**
 * Returns a trend arrow (▲/▼/▬) and color for temperature based on last two readings
 * @param {number} stationId
 * @returns {Promise<{arrow: string, color: string}>}
 */
async function getTemperatureTrendArrow(stationId) {
  try {
    const res = await fetch(`${API_BASE}/stations/${stationId}/latest_metrics`);
    if (!res.ok) return { arrow: '', color: '' };
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return { arrow: '▬', color: '#64748b' };
    const [latest, previous] = data;
    if (latest.temperature > previous.temperature) return { arrow: '▲', color: '#10b981' };
    if (latest.temperature < previous.temperature) return { arrow: '▼', color: '#ef4444' };
    return { arrow: '▬', color: '#64748b' };
  } catch {
    return { arrow: '', color: '' };
  }
}

/**
 * Returns trend arrow and color for any metric
 * @param {number} stationId
 * @param {string} metric
 * @returns {Promise<{arrow: string, color: string}>}
 */
async function getMetricTrendArrow(stationId, metric) {
  try {
    const res = await fetch(`${API_BASE}/stations/${stationId}/latest_metrics`);
    if (!res.ok) return { arrow: '', color: '' };
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return { arrow: '▬', color: '#64748b' };
    const [latest, previous] = data;
    if (latest[metric] > previous[metric]) return { arrow: '▲', color: '#10b981' };
    if (latest[metric] < previous[metric]) return { arrow: '▼', color: '#ef4444' };
    return { arrow: '▬', color: '#64748b' };
  } catch {
    return { arrow: '', color: '' };
  }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (token) {
    // Hide public stations and hero for authenticated users
    document.getElementById("public-stations-section").classList.add("hidden");
    document.getElementById("hero-section").classList.add("hidden");
    loadUserSession();
  } else {
    // Show public stations and hero for unauthenticated users
    document.getElementById("public-stations-section").classList.remove("hidden");
    document.getElementById("hero-section").classList.remove("hidden");
    initializePublicView();
  }
});

// ============================================
// PUBLIC VIEW (Landing Page)
// ============================================
function initializePublicView() {
  showHeroSection();
  renderPublicStations();
  updateNavBar();
  // Start auto-refresh for public view when unauthenticated
  startStationsAutoRefresh();
}

function showHeroSection() {
  document.getElementById("hero-section").classList.remove("hidden");
  document.getElementById("user-dashboard").classList.add("hidden");
  document.getElementById("user-stations-section").classList.add("hidden");
}

function renderPublicStations() {
  fetch(`${API_BASE}/stations/public`)
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch public stations");
      return res.json();
    })
    .then(stations => {
      const container = document.getElementById("public-stations-grid");
      const countElement = document.getElementById("station-count");

      if (stations.length === 0) {
        container.innerHTML = "<p class='no-data'>No public stations available yet.</p>";
        countElement.textContent = "No stations";
        return;
      }

      countElement.textContent = `${stations.length} station${stations.length !== 1 ? 's' : ''} available`;
      container.innerHTML = "";

      stations.forEach(station => {
        const connectionStatus = getConnectionStatus(station.last_updated);
        const displayName = station.station_name ? `${station.station_name} (${station.location})` : station.location;
        const relativeTime = formatRelativeTime(station.last_updated);
        const card = document.createElement("div");
        card.className = "station-card";
        card.setAttribute("data-station-id", station.station_id);
        card.innerHTML = `
          <div class="station-header">
            <div class="station-title">
              <h3 title="${station.station_name || station.location}">📍 ${station.station_name || station.location}</h3>
              <span class="station-code">#${station.unique_code}</span>
            </div>
            <p class="station-subtitle">${station.location} · Owner: ${station.owner}</p>
            <div class="badge-group">
              <span class="badge badge-public">Public</span>
              <span class="badge ${connectionStatus.badgeClass}" data-metric="connection-status">${connectionStatus.status} · ${relativeTime}</span>
            </div>
          </div>
          <div class="station-primary-metric">
            <div class="temp-display" data-metric="temperature">
              <span class="temp-value">${formatMetric('temperature', station.temperature)} <span class="trend-arrow" id="trend-${station.station_id}"></span></span>
            </div>
          </div>
          <div class="station-data">
            <div class="data-row">
              <span class="label">💧 Humidity:</span>
              <span class="value" data-metric="humidity">${formatMetric('humidity', station.humidity)}</span>
            </div>
            <div class="data-row">
              <span class="label">📊 Pressure:</span>
              <span class="value" data-metric="pressure">${formatMetric('pressure', station.pressure)}</span>
            </div>
            <div class="data-row">
              <span class="label">💨 Wind:</span>
              <span class="value" data-metric="wind_speed">${formatMetric('wind_speed', station.wind_speed)}</span>
            </div>
            <div class="data-row">
              <span class="label">🌧️ Raining:</span>
              <span class="value" data-metric="is_raining">${station.is_raining ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-block" onclick="viewPublicStationDetail(${station.station_id})">View Details</button>
        `;
        container.appendChild(card);
      });
      // Ensure long station titles fit on a single line
      adjustStationNames();

      // Set trend arrows for temperature
      stations.forEach(async station => {
        const trend = await getTemperatureTrendArrow(station.station_id);
        const arrowEl = document.getElementById(`trend-${station.station_id}`);
        if (arrowEl) {
          arrowEl.textContent = trend.arrow;
          arrowEl.style.color = trend.color;
          arrowEl.style.fontWeight = 'bold';
          arrowEl.style.marginLeft = '4px';
        }
      });
    })
    .catch(err => {
      console.error("Error fetching public stations:", err);
      document.getElementById("public-stations-grid").innerHTML = "<p class='error'>Failed to load public stations.</p>";
    });
}

function viewPublicStationDetail(stationId) {
  currentStationId = stationId;
  fetchStationDetail(false);
  openStationDetailModal();
}

// ============================================
// AUTHENTICATION
// ============================================
function openAuthModal() {
  document.getElementById("auth-modal").classList.remove("hidden");
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.add("hidden");
}

function switchAuthTab(tab) {
  // Hide all forms
  document.getElementById("signin-form").classList.remove("active");
  document.getElementById("signup-form").classList.remove("active");

  // Hide all tab buttons
  document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));

  // Show selected form and activate button
  if (tab === "signin") {
    document.getElementById("signin-form").classList.add("active");
    document.querySelectorAll(".tab-button")[0].classList.add("active");
  } else {
    document.getElementById("signup-form").classList.add("active");
    document.querySelectorAll(".tab-button")[1].classList.add("active");
  }
}

function handleSignIn(event) {
  event.preventDefault();
  const username = document.getElementById("signin-username").value;
  const password = document.getElementById("signin-password").value;

  fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(res => {
      if (!res.ok) throw new Error("Invalid credentials");
      return res.json();
    })
    .then(data => {
      localStorage.setItem("token", data.access_token);
      loadUserSession();
      closeAuthModal();
    })
    .catch(err => {
      alert("Sign in failed: " + err.message);
    });
}

function handleSignUp(event) {
  event.preventDefault();
  const username = document.getElementById("signup-username").value;
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-password-confirm").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  fetch(`${API_BASE}/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(res => {
      if (!res.ok) throw new Error("Sign up failed");
      return res.json();
    })
    .then(() => {
      alert("Account created successfully! Please sign in.");
      switchAuthTab("signin");
      document.getElementById("signin-username").value = username;
    })
    .catch(err => {
      alert("Sign up failed: " + err.message);
    });
}

function loadUserSession() {
  const token = localStorage.getItem("token");
  fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => {
      if (!res.ok) throw new Error("Session invalid");
      return res.json();
    })
    .then(user => {
      currentUser = user;
      showUserDashboard(user);
      updateNavBar();
    })
    .catch(err => {
      console.error("Session error:", err);
      logout();
    });
}

function showUserDashboard(user) {
  // Hide public sections
  document.getElementById("hero-section").classList.add("hidden");

  // Show user sections
  document.getElementById("user-dashboard").classList.remove("hidden");
  document.getElementById("user-stations-section").classList.remove("hidden");

  // Render profile card
  const profileCard = document.getElementById("user-profile-card");
  profileCard.innerHTML = `
    <div class="profile-info">
      <div class="info-row">
        <span class="label">👤 Username:</span>
        <span class="value">${user.username}</span>
      </div>
      <div class="info-row">
        <span class="label">⭐ Account Type:</span>
        <span class="value">${user.is_admin ? "Administrator" : "Standard User"}</span>
      </div>
      <div class="info-row">
        <span class="label">📡 Stations Owned:</span>
        <span class="value">${user.stations}</span>
      </div>
      <div class="info-row">
        <span class="label">📅 Member Since:</span>
        <span class="value">${new Date(user.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  `;

  // Initialize tabs - show owned stations by default
  currentStationTab = "owned";
  switchStationTab("owned");
  
  // Start auto-refresh of station data
  startStationsAutoRefresh();
}

/**
 * Start auto-refresh of station data.
 * Periodically fetches latest station data and updates the UI without full re-render.
 */
function startStationsAutoRefresh() {
  // Clear existing interval if any
  if (stationsRefreshInterval) {
    clearInterval(stationsRefreshInterval);
  }

  // Fetch and update every AUTO_REFRESH_INTERVAL milliseconds
  stationsRefreshInterval = setInterval(async () => {
    // Always refresh public stations (works for unauthenticated and authenticated views)
    fetch(`${API_BASE}/stations/public`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(publicStations => {
        if (!publicStations || !Array.isArray(publicStations)) return;
        publicStations.forEach(async station => {
          const card = document.querySelector(`[data-station-id="${station.station_id}"]`);
          if (!card) return;
          const tempValue = card.querySelector('[data-metric="temperature"]');
          if (tempValue) tempValue.textContent = formatMetric('temperature', station.temperature);
          const humidityValue = card.querySelector('[data-metric="humidity"]');
          if (humidityValue) humidityValue.textContent = formatMetric('humidity', station.humidity);
          const pressureValue = card.querySelector('[data-metric="pressure"]');
          if (pressureValue) pressureValue.textContent = formatMetric('pressure', station.pressure);
          const windSpeedValue = card.querySelector('[data-metric="wind_speed"]');
          if (windSpeedValue) windSpeedValue.textContent = formatMetric('wind_speed', station.wind_speed);
          const rainingValue = card.querySelector('[data-metric="is_raining"]');
          if (rainingValue) rainingValue.textContent = station.is_raining ? 'Yes' : 'No';
          const connectionBadge = card.querySelector('[data-metric="connection-status"]');
          if (connectionBadge) {
            const status = getConnectionStatus(station.last_updated);
            const relativeTime = formatRelativeTime(station.last_updated);
            connectionBadge.textContent = `${status.status} · ${relativeTime}`;
            connectionBadge.className = `badge ${status.badgeClass}`;
          }
          // Update trend arrow and colors
          const metrics = ['temperature', 'humidity', 'pressure', 'wind_speed'];
          for (const metric of metrics) {
            const trend = await getMetricTrendArrow(station.station_id, metric);
            const valueEl = card.querySelector(`[data-metric="${metric}"]`);
            if (valueEl) {
              valueEl.style.color = trend.color;
            }
            // Update temperature trend arrow
            if (metric === 'temperature') {
              const arrowEl = document.getElementById(`trend-${station.station_id}`);
              if (arrowEl) {
                arrowEl.textContent = trend.arrow;
                arrowEl.style.color = trend.color;
              }
            }
          }
        });
      })
      .catch(err => {
        console.debug('Auto-refresh public stations error:', err);
      });

    // If authenticated, also refresh the user's stations
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${API_BASE}/stations/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) return null;
          return res.json();
        })
        .then(stations => {
          if (!stations || !Array.isArray(stations)) return;
          stations.forEach(async station => {
            const card = document.querySelector(`[data-station-id="${station.station_id}"]`);
            if (!card) return;
            const tempValue = card.querySelector('[data-metric="temperature"]');
            if (tempValue) tempValue.textContent = formatMetric('temperature', station.temperature);
            const humidityValue = card.querySelector('[data-metric="humidity"]');
            if (humidityValue) humidityValue.textContent = formatMetric('humidity', station.humidity);
            const pressureValue = card.querySelector('[data-metric="pressure"]');
            if (pressureValue) pressureValue.textContent = formatMetric('pressure', station.pressure);
            const windSpeedValue = card.querySelector('[data-metric="wind_speed"]');
            if (windSpeedValue) windSpeedValue.textContent = formatMetric('wind_speed', station.wind_speed);
            const rainingValue = card.querySelector('[data-metric="is_raining"]');
            if (rainingValue) rainingValue.textContent = station.is_raining ? 'Yes' : 'No';
            const connectionBadge = card.querySelector('[data-metric="connection-status"]');
            if (connectionBadge) {
              const status = getConnectionStatus(station.last_updated);
              const relativeTime = formatRelativeTime(station.last_updated);
              connectionBadge.textContent = `${status.status} · ${relativeTime}`;
              connectionBadge.className = `badge ${status.badgeClass}`;
            }
            // Update trend arrow and colors
            const metrics = ['temperature', 'humidity', 'pressure', 'wind_speed'];
            for (const metric of metrics) {
              const trend = await getMetricTrendArrow(station.station_id, metric);
              const valueEl = card.querySelector(`[data-metric="${metric}"]`);
              if (valueEl) {
                valueEl.style.color = trend.color;
              }
              // Update temperature trend arrow
              if (metric === 'temperature') {
                const arrowEl = document.getElementById(`trend-${station.station_id}`);
                if (arrowEl) {
                  arrowEl.textContent = trend.arrow;
                  arrowEl.style.color = trend.color;
                }
              }
            }
          });
        })
        .catch(err => {
          console.debug('Auto-refresh user stations error:', err);
        });
    }
  }, AUTO_REFRESH_INTERVAL);
}

/**
 * Stop auto-refresh of station data.
 */
function stopStationsAutoRefresh() {
  if (stationsRefreshInterval) {
    clearInterval(stationsRefreshInterval);
    stationsRefreshInterval = null;
  }
}

/**
 * Switch between owned and public stations tabs for authenticated users.
 * @param {string} tab - Either "owned" or "public"
 */
function switchStationTab(tab) {
  currentStationTab = tab;

  // Update tab button styles
  const tabButtons = document.querySelectorAll(".station-tab-button");
  tabButtons.forEach((btn, index) => {
    if ((tab === "owned" && index === 0) || (tab === "public" && index === 1)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Show/hide appropriate views
  const ownedView = document.getElementById("owned-stations-view");
  const publicView = document.getElementById("public-stations-view");

  if (tab === "owned") {
    ownedView.classList.add("active");
    publicView.classList.remove("active");
    renderUserStations();
  } else {
    ownedView.classList.remove("active");
    publicView.classList.add("active");
    renderAuthenticatedPublicStations();
  }
}

/**
 * Render public stations for authenticated users (in the public stations tab).
 * Uses the auth-public-stations-grid container.
 */
function renderAuthenticatedPublicStations() {
  const token = localStorage.getItem("token");
  fetch(`${API_BASE}/stations/public`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch public stations");
      return res.json();
    })
    .then(stations => {
      const container = document.getElementById("auth-public-stations-grid");

      if (stations.length === 0) {
        container.innerHTML = "<p class='no-data'>No public stations available.</p>";
        return;
      }

      container.innerHTML = "";

      stations.forEach(station => {
        const connectionStatus = getConnectionStatus(station.last_updated);
        const displayName = station.station_name ? `${station.station_name} (${station.location})` : station.location;
        const relativeTime = formatRelativeTime(station.last_updated);
        const card = document.createElement("div");
        card.className = "station-card";
        card.setAttribute("data-station-id", station.station_id);
        card.innerHTML = `
          <div class="station-header">
            <div class="station-title">
              <h3 title="${station.station_name || station.location}">📍 ${station.station_name || station.location}</h3>
              <span class="station-code">#${station.unique_code}</span>
            </div>
            <p class="station-subtitle">${station.location} · Owner: ${station.owner}</p>
            <div class="badge-group">
              <span class="badge badge-public">Public</span>
              <span class="badge ${connectionStatus.badgeClass}" data-metric="connection-status">${connectionStatus.status} · ${relativeTime}</span>
            </div>
          </div>
          <div class="station-primary-metric">
            <div class="temp-display" data-metric="temperature">
              <span class="temp-value">${formatMetric('temperature', station.temperature)} <span class="trend-arrow" id="trend-${station.station_id}"></span></span>
            </div>
          </div>
          <div class="station-data">
            <div class="data-row">
              <span class="label">💧 Humidity:</span>
              <span class="value" data-metric="humidity">${formatMetric('humidity', station.humidity)}</span>
            </div>
            <div class="data-row">
              <span class="label">📊 Pressure:</span>
              <span class="value" data-metric="pressure">${formatMetric('pressure', station.pressure)}</span>
            </div>
            <div class="data-row">
              <span class="label">💨 Wind:</span>
              <span class="value" data-metric="wind_speed">${formatMetric('wind_speed', station.wind_speed)}</span>
            </div>
            <div class="data-row">
              <span class="label">🌧️ Raining:</span>
              <span class="value" data-metric="is_raining">${station.is_raining ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-block" onclick="viewPublicStationDetail(${station.station_id})">View Details</button>
        `;
        container.appendChild(card);
      });
      // Ensure long station titles fit on a single line in this grid
      adjustStationNames();

      // Set trend arrows for temperature
      stations.forEach(async station => {
        const trend = await getTemperatureTrendArrow(station.station_id);
        const arrowEl = document.getElementById(`trend-${station.station_id}`);
        if (arrowEl) {
          arrowEl.textContent = trend.arrow;
          arrowEl.style.color = trend.color;
          arrowEl.style.fontWeight = 'bold';
          arrowEl.style.marginLeft = '4px';
        }
      });
    })
    .catch(err => {
      console.error("Error fetching public stations:", err);
      document.getElementById("auth-public-stations-grid").innerHTML = "<p class='error'>Failed to load public stations.</p>";
    });
}

function renderUserStations() {
  const token = localStorage.getItem("token");
  fetch(`${API_BASE}/stations/all`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch stations");
      return res.json();
    })
    .then(stations => {
      const container = document.getElementById("user-stations-grid");

      if (stations.length === 0) {
        container.innerHTML = "<p class='no-data'>You haven't created any stations yet. Click 'Add New Station' to get started!</p>";
        return;
      }

      container.innerHTML = "";

      stations.forEach(station => {
        const connectionStatus = getConnectionStatus(station.last_updated);
        const displayName = station.station_name ? `${station.station_name} (${station.location})` : station.location;
        const relativeTime = formatRelativeTime(station.last_updated);
        const maskedKey = maskApiKey(station.api_access_key);
        const card = document.createElement("div");
        card.className = "station-card user-station";
        card.setAttribute("data-station-id", station.station_id);
        card.innerHTML = `
          <div class="station-header">
            <div class="station-title">
              <h3 title="${station.station_name || station.location}">📍 ${station.station_name || station.location}</h3>
              <span class="station-code">#${station.unique_code}</span>
            </div>
            <p class="station-subtitle">${station.location} · ${currentUser?.username}</p>
            <div class="badge-group">
              <span class="badge ${station.is_public ? 'badge-public' : 'badge-private'}">
                ${station.is_public ? 'Public' : 'Private'}
              </span>
              <span class="badge ${connectionStatus.badgeClass}" data-metric="connection-status">${connectionStatus.status} · ${relativeTime}</span>
            </div>
          </div>
          <div class="station-primary-metric">
            <div class="temp-display" data-metric="temperature">
              <span class="temp-value">${formatMetric('temperature', station.temperature)} <span class="trend-arrow" id="trend-${station.station_id}"></span></span>
            </div>
          </div>
          <div class="station-data">
            <div class="data-row">
              <span class="label">💧 Humidity:</span>
              <span class="value" data-metric="humidity">${formatMetric('humidity', station.humidity)}</span>
            </div>
            <div class="data-row">
              <span class="label">📊 Pressure:</span>
              <span class="value" data-metric="pressure">${formatMetric('pressure', station.pressure)}</span>
            </div>
            <div class="data-row">
              <span class="label">💨 Wind:</span>
              <span class="value" data-metric="wind_speed">${formatMetric('wind_speed', station.wind_speed)}</span>
            </div>
            <div class="data-row">
              <span class="label">🌐 API Key:</span>
              <span class="value api-key-masked" id="key-${station.station_id}" data-full-key="${station.api_access_key}" onclick="revealApiKey(${station.station_id})" style="cursor:pointer; font-weight:bold;">${maskedKey}</span>
              <button class="btn btn-sm btn-copy" onclick="copyToClipboard('key-${station.station_id}', '${station.api_access_key}')">Copy</button>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary" onclick="viewStationDetail(${station.station_id})">Details</button>
            <button class="btn btn-secondary" onclick="openEditStationModal(${station.station_id}, '${station.location}', ${station.is_public})">Edit</button>
          </div>
        `;
        container.appendChild(card);
      });
      // Ensure long station titles fit on a single line in the user grid
      adjustStationNames();

      // Set trend arrows for temperature
      stations.forEach(async station => {
        const trend = await getTemperatureTrendArrow(station.station_id);
        const arrowEl = document.getElementById(`trend-${station.station_id}`);
        if (arrowEl) {
          arrowEl.textContent = trend.arrow;
          arrowEl.style.color = trend.color;
          arrowEl.style.fontWeight = 'bold';
          arrowEl.style.marginLeft = '4px';
        }
      });
    })
    .catch(err => {
      console.error("Error fetching stations:", err);
      document.getElementById("user-stations-grid").innerHTML = "<p class='error'>Failed to load stations.</p>";
    });
}

// ============================================
// STATION MANAGEMENT
// ============================================
function openAddStationModal() {
  document.getElementById("add-station-modal").classList.remove("hidden");
  document.getElementById("station-location").value = "";
}

function closeAddStationModal() {
  document.getElementById("add-station-modal").classList.add("hidden");
}

function handleAddStation(event) {
  event.preventDefault();
  const location = document.getElementById("station-location").value;
  const station_name = document.getElementById("station-name").value || null;

  fetch(`${API_BASE}/stations/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ location, station_name })
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to create station");
      return res.json();
    })
    .then(() => {
      alert("Station created successfully!");
      closeAddStationModal();
      renderUserStations();
    })
    .catch(err => {
      alert("Error: " + err.message);
    });
}

function openEditStationModal(stationId, location, isPublic) {
  document.getElementById("edit-station-id").value = stationId;
  document.getElementById("edit-location").value = location;
  document.getElementById("edit-is-public").checked = isPublic;
  document.getElementById("delete-station-btn").style.display = "inline-block";
  document.getElementById("edit-station-modal").classList.remove("hidden");
}

function closeEditStationModal() {
  document.getElementById("edit-station-modal").classList.add("hidden");
}

function handleEditStation(event) {
  event.preventDefault();
  const stationId = document.getElementById("edit-station-id").value;
  const location = document.getElementById("edit-location").value;
  const isPublic = document.getElementById("edit-is-public").checked;

  fetch(`${API_BASE}/stations/${stationId}/location`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ location, is_public: isPublic })
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to update station");
      return res.json();
    })
    .then(() => {
      alert("Station updated successfully!");
      closeEditStationModal();
      renderUserStations();
    })
    .catch(err => {
      alert("Error: " + err.message);
    });
}

function handleDeleteStation() {
  if (!confirm("Are you sure you want to delete this station? This action cannot be undone.")) {
    return;
  }

  const stationId = document.getElementById("edit-station-id").value;

  fetch(`${API_BASE}/stations/${stationId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to delete station");
    })
    .then(() => {
      alert("Station deleted successfully!");
      closeEditStationModal();
      renderUserStations();
    })
    .catch(err => {
      alert("Error: " + err.message);
    });
}

// ============================================
// STATION DETAIL VIEW
// ============================================
function viewStationDetail(stationId) {
  currentStationId = stationId;
  document.getElementById("edit-station-btn").style.display = "inline-block";
  fetchStationDetail(true);
  openStationDetailModal();
}

function fetchStationDetail(isUserStation = false) {
  const token = localStorage.getItem("token");
  const headers = (isUserStation && token) ? { Authorization: `Bearer ${token}` } : {};
  console.debug('fetchStationDetail: headers=', headers, 'isUserStation=', isUserStation, 'currentStationId=', currentStationId);

  // Attempt to fetch station details. If we receive 401 and this was not
  // explicitly a user-station request, retry once without any Authorization
  // header (handles cases where a stale/invalid token is stored).
  async function doFetch(withHeaders) {
    const opts = withHeaders ? { headers } : {};
    const res = await fetch(`${API_BASE}/stations/${currentStationId}/details`, opts);
    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>');
      const err = new Error(`Failed to fetch station details (status ${res.status}): ${body}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  }

  doFetch(Boolean(Object.keys(headers).length))
    .catch(async err => {
      // If unauthorized (likely a stale token), retry unauthenticated once.
      // The endpoint supports both authenticated and public access, so a 401 
      // should trigger a fallback to unauthenticated if the station is public.
      if (err && err.status === 401) {
        console.debug('fetchStationDetail: received 401, retrying without Authorization header');
        try {
          return await doFetch(false);
        } catch (err2) {
          throw err2;
        }
      }
      throw err;
    })
    .then(station => {
      const detailInfo = document.getElementById("detail-info");
      const maskedKey = maskApiKey(station.api_access_key);
      const createdDate = new Date(station.created_at).toLocaleDateString();
      const lastUpdatedText = station.last_updated ? formatRelativeTime(station.last_updated) : "Never";
      
      const metadataRows = `
        <div class="metadata-grid">
          <div class="metadata-row">
            <span class="metadata-label">Station Name:</span>
            <span class="metadata-value">${station.station_name || '(Not set)'}</span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">Code:</span>
            <span class="metadata-value">#${station.unique_code}</span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">Location:</span>
            <span class="metadata-value">${station.location}</span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">Station ID:</span>
            <span class="metadata-value">${station.station_id}</span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">Owner:</span>
            <span class="metadata-value">${station.owner}</span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">Created:</span>
            <span class="metadata-value">${createdDate}</span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">Last Updated:</span>
            <span class="metadata-value">${lastUpdatedText}</span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">Visibility:</span>
            <span class="metadata-value ${station.is_public ? 'text-public' : 'text-private'}">
              ${station.is_public ? '🌐 Public' : '🔒 Private'}
            </span>
          </div>
          <div class="metadata-row">
            <span class="metadata-label">API Key:</span>
            <span class="metadata-value api-key-masked" id="detail-key-${station.station_id}" data-full-key="${station.api_access_key}" onclick="revealApiKey('detail-key-${station.station_id}')" style="cursor:pointer; font-weight:bold;">${maskedKey}</span>
          </div>
        </div>
      `;
      
      const currentMetrics = `
        <div class="detail-metrics">
          <h4>Current Readings</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <div class="metric-label">Temperature</div>
              <div class="metric-value" data-metric="temperature">${formatMetric('temperature', station.temperature)}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Humidity</div>
              <div class="metric-value" data-metric="humidity">${formatMetric('humidity', station.humidity)}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Pressure</div>
              <div class="metric-value" data-metric="pressure">${formatMetric('pressure', station.pressure)}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Wind Speed</div>
              <div class="metric-value" data-metric="wind_speed">${formatMetric('wind_speed', station.wind_speed)}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">UV Index</div>
              <div class="metric-value" data-metric="uv_index">${formatMetric('uv_index', station.uv_index)}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Raining</div>
              <div class="metric-value" data-metric="is_raining">${station.is_raining ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>
      `;
      
      detailInfo.innerHTML = metadataRows + currentMetrics;

      const metrics = ['temperature', 'humidity', 'pressure', 'wind_speed', 'uv_index'];
      metrics.forEach(async metric => {
        const trend = await getMetricTrendArrow(station.station_id, metric);
        const metricItem = detailInfo.querySelector(`.metric-value[data-metric="${metric}"]`);
        if (metricItem) {
          metricItem.insertAdjacentHTML('beforeend', ` <span class="trend-arrow" style="color:${trend.color};font-weight:bold;">${trend.arrow}</span>`);
          metricItem.style.color = trend.color;
        }
      });
    })
    .catch(err => {
      console.error("Error fetching station details:", err);
      const msg = err && err.message ? err.message : 'Failed to load station details.';
      document.getElementById("detail-info").innerHTML = `<p class='error'>Failed to load station details. ${msg}</p>`;
    });
}

function openStationDetailModal() {
  document.getElementById("station-detail-modal").classList.remove("hidden");
}

function closeStationDetailModal() {
  document.getElementById("station-detail-modal").classList.add("hidden");
  if (detailRefreshInterval) {
    clearInterval(detailRefreshInterval);
  }
}

// ============================================
// HISTORICAL DATA & CHARTS
// ============================================
function showHistoricalChart() {
  document.getElementById("historical-chart-modal").classList.remove("hidden");
  updateChart();
}

function closeHistoricalChartModal() {
  document.getElementById("historical-chart-modal").classList.add("hidden");
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function updateChart() {
  const token = localStorage.getItem("token");
  const selectedFields = Array.from(
    document.querySelectorAll("#chart-controls input[type='checkbox']")
  )
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  if (selectedFields.length === 0) {
    alert("Please select at least one metric to display");
    return;
  }

  fetch(`${API_BASE}/stations/${currentStationId}/historical_data`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch historical data: ${res.status}`);
      return res.json();
    })
    .then(dataList => {
      if (!Array.isArray(dataList) || dataList.length === 0) {
        alert("No historical data available");
        return;
      }

      const labels = dataList.map(entry => new Date(entry.created_at).toLocaleTimeString());
      const datasets = selectedFields.map(field => ({
        label: formatFieldName(field),
        data: dataList.map(entry => entry[field]),
        borderColor: getRandomColor(),
        backgroundColor: getRandomColor() + "1a",
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }));

      if (chartInstance) {
        chartInstance.destroy();
      }

      const ctx = document.getElementById("historical-chart");
      if (!ctx) {
        console.error("Chart canvas element not found");
        alert("Chart container not found");
        return;
      }

      try {
        chartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: datasets
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top'
              },
              title: {
                display: true,
                text: 'Weather Station Data Over Time'
              },
              tooltip: {
                callbacks: {
                  title: function(context) {
                    return 'Time: ' + context[0].label;
                  },
                  label: function(context) {
                    let label = context.dataset.label || '';
                    let value = context.parsed.y;
                    return `${label}: ${value}`;
                  }
                }
              },
              zoom: {
                pan: {
                  enabled: true,
                  mode: 'x',
                  threshold: 10
                },
                zoom: {
                  wheel: {
                    enabled: true
                  },
                  pinch: {
                    enabled: true
                  },
                  mode: 'x'
                }
              }
            },
            scales: {
              y: {
                beginAtZero: false
              }
            }
          }
        });
        console.log("Chart created successfully");
        
        // Attach Reset Zoom button
        const resetBtn = document.getElementById('reset-zoom-btn');
        if (resetBtn) {
          resetBtn.onclick = () => {
            if (chartInstance && chartInstance.resetZoom) chartInstance.resetZoom();
          };
        }
      } catch (chartError) {
        console.error("Error creating Chart.js instance:", chartError);
        alert("Failed to render chart: " + chartError.message);
      }
    })
    .catch(err => {
      console.error("Error loading chart data:", err);
      alert("Failed to load historical data: " + err.message);
    });
}

function formatFieldName(field) {
  const names = {
    temperature: "Temperature (°C)",
    humidity: "Humidity (%)",
    pressure: "Pressure (hPa)",
    wind_speed: "Wind Speed (m/s)",
    uv_index: "UV Index",
    wind_direction: "Wind Direction"
  };
  return names[field] || field;
}

function getRandomColor() {
  const colors = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
    "#FF6384", "#C9CBCF", "#4BC0C0", "#FF6384"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================
// NAVIGATION & UTILITIES
// ============================================
function updateNavBar() {
  const navActions = document.getElementById("nav-actions");

  if (currentUser) {
    navActions.innerHTML = `
      <div class="nav-user-info">
        <span>Welcome, <strong>${currentUser.username}</strong></span>
      </div>
      <button class="btn btn-secondary" onclick="logout()">Logout</button>
    `;
  } else {
    navActions.innerHTML = `
      <button class="btn btn-primary" onclick="openAuthModal()">Sign In / Sign Up</button>
    `;
  }
}

function logout() {
  if (!confirm("Are you sure you want to log out?")) {
    return;
  }

  localStorage.removeItem("token");
  currentUser = null;
  currentStationId = null;

  // Stop auto-refresh
  stopStationsAutoRefresh();

  // Reset view
  document.getElementById("user-dashboard").classList.add("hidden");
  document.getElementById("user-stations-section").classList.add("hidden");
  document.getElementById("station-detail-modal").classList.add("hidden");
  document.getElementById("historical-chart-modal").classList.add("hidden");

  // Clear forms
  document.getElementById("signin-form").reset();
  document.getElementById("signup-form").reset();

  // Show public view
  initializePublicView();
}

function copyToClipboard(elementId, directText) {
  const text = directText || document.getElementById(elementId)?.textContent || "";

  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "✓ Copied!";
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy:", err);
  });
}

function revealApiKey(stationId) {
  const keyElement = document.getElementById(`key-${stationId}`);
  if (keyElement.classList.contains('revealed')) {
    keyElement.classList.remove('revealed');
    keyElement.textContent = maskApiKey(keyElement.dataset.fullKey);
  } else {
    keyElement.classList.add('revealed');
    keyElement.textContent = keyElement.dataset.fullKey;
  }
}

function showEditStationModal() {
  const stationId = currentStationId;
  fetch(`${API_BASE}/stations/${stationId}/details`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  })
    .then(res => res.json())
    .then(station => {
      openEditStationModal(stationId, station.location, station.is_public);
    });
}
