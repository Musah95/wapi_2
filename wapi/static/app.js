// ============================================
// GLOBAL STATE
// ============================================
let currentUser = null;
let currentStationId = null;
let chartInstance = null;
let detailRefreshInterval = null;
let currentStationTab = "owned"; // Track which tab is active

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
    status: isConnected ? "Connected" : "Disconnected",
    badgeClass: isConnected ? "badge-connected" : "badge-disconnected"
  };
}

/**
 * Reduce station title font-size until it fits within its container.
 * This is a lightweight polyfill-style helper for "fit text" behavior.
 * It only reduces font-size (not increases), and stops at a minimum size.
 */
function adjustStationNames(minFontPx = 12) {
  document.querySelectorAll('.station-card .station-header h3').forEach(h3 => {
    // reset any inline size so we start from CSS baseline
    h3.style.fontSize = '';

    const containerWidth = h3.clientWidth;
    // If there's no overflow, nothing to do
    if (h3.scrollWidth <= containerWidth) return;

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

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (token) {
    loadUserSession();
  } else {
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
        const card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `
          <div class="station-header">
            <h3>📍 ${formatStationName(station.owner || 'Unknown', station.location, station.station_id)}</h3>
            <div class="badge-group">
              <span class="badge badge-public">Public</span>
              <span class="badge ${connectionStatus.badgeClass}">${connectionStatus.status}</span>
            </div>
          </div>
          <div class="station-data">
            <div class="data-row">
              <span class="label">🌡️ Temperature:</span>
              <span class="value">${station.temperature}°C</span>
            </div>
            <div class="data-row">
              <span class="label">💧 Humidity:</span>
              <span class="value">${station.humidity}%</span>
            </div>
            <div class="data-row">
              <span class="label">📊 Pressure:</span>
              <span class="value">${station.pressure} hPa</span>
            </div>
            <div class="data-row">
              <span class="label">💨 Wind Speed:</span>
              <span class="value">${station.wind_speed} m/s</span>
            </div>
            <div class="data-row">
              <span class="label">🌧️ Raining:</span>
              <span class="value">${station.is_raining ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-block" onclick="viewPublicStationDetail(${station.station_id})">View Details</button>
        `;
        container.appendChild(card);
      });
      // Ensure long station titles fit on a single line
      adjustStationNames();
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
        const card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `
          <div class="station-header">
            <h3>📍 ${formatStationName(station.owner || 'Unknown', station.location, station.station_id)}</h3>
            <div class="badge-group">
              <span class="badge badge-public">Public</span>
              <span class="badge ${connectionStatus.badgeClass}">${connectionStatus.status}</span>
            </div>
          </div>
          <div class="station-data">
            <div class="data-row">
              <span class="label">🌡️ Temperature:</span>
              <span class="value">${station.temperature}°C</span>
            </div>
            <div class="data-row">
              <span class="label">💧 Humidity:</span>
              <span class="value">${station.humidity}%</span>
            </div>
            <div class="data-row">
              <span class="label">📊 Pressure:</span>
              <span class="value">${station.pressure} hPa</span>
            </div>
            <div class="data-row">
              <span class="label">💨 Wind Speed:</span>
              <span class="value">${station.wind_speed} m/s</span>
            </div>
            <div class="data-row">
              <span class="label">🌧️ Raining:</span>
              <span class="value">${station.is_raining ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-block" onclick="viewPublicStationDetail(${station.station_id})">View Details</button>
        `;
        container.appendChild(card);
      });
      // Ensure long station titles fit on a single line in this grid
      adjustStationNames();
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
        const card = document.createElement("div");
        card.className = "station-card user-station";
        card.innerHTML = `
          <div class="station-header">
            <h3>📍 ${formatStationName(station.owner || currentUser.username, station.location, station.station_id)}</h3>
            <div class="badge-group">
              <span class="badge ${station.is_public ? 'badge-public' : 'badge-private'}">
                ${station.is_public ? 'Public' : 'Private'}
              </span>
              <span class="badge ${connectionStatus.badgeClass}">${connectionStatus.status}</span>
            </div>
          </div>
          <div class="station-data">
            <div class="data-row">
              <span class="label">🌡️ Temperature:</span>
              <span class="value">${station.temperature}°C</span>
            </div>
            <div class="data-row">
              <span class="label">💧 Humidity:</span>
              <span class="value">${station.humidity}%</span>
            </div>
            <div class="data-row">
              <span class="label">📊 Pressure:</span>
              <span class="value">${station.pressure} hPa</span>
            </div>
            <div class="data-row">
              <span class="label">🌐 API Key:</span>
              <span class="value api-key-display" id="key-${station.station_id}">${station.api_access_key}</span>
              <button class="btn btn-sm btn-copy" onclick="copyToClipboard('key-${station.station_id}')">Copy</button>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary" onclick="viewStationDetail(${station.station_id})">View Details</button>
            <button class="btn btn-secondary" onclick="openEditStationModal(${station.station_id}, '${station.location}', ${station.is_public})">Edit</button>
          </div>
        `;
        container.appendChild(card);
      });
      // Ensure long station titles fit on a single line in the user grid
      adjustStationNames();
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

  fetch(`${API_BASE}/stations/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ location })
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
  const headers = isUserStation ? { Authorization: `Bearer ${token}` } : {};

  fetch(`${API_BASE}/stations/${currentStationId}/details`, { headers })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch station details");
      return res.json();
    })
    .then(station => {
      const detailInfo = document.getElementById("detail-info");
      detailInfo.innerHTML = `
        <div class="detail-content">
          <div class="info-row">
            <span class="label">📍 Location:</span>
            <span class="value">${station.location}</span>
          </div>
          <div class="info-row">
            <span class="label">🌡️ Temperature:</span>
            <span class="value">${station.temperature}°C</span>
          </div>
          <div class="info-row">
            <span class="label">💧 Humidity:</span>
            <span class="value">${station.humidity}%</span>
          </div>
          <div class="info-row">
            <span class="label">📊 Pressure:</span>
            <span class="value">${station.pressure} hPa</span>
          </div>
          <div class="info-row">
            <span class="label">💨 Wind Speed:</span>
            <span class="value">${station.wind_speed} m/s</span>
          </div>
          <div class="info-row">
            <span class="label">🧭 Wind Direction:</span>
            <span class="value">${station.wind_direction}</span>
          </div>
          <div class="info-row">
            <span class="label">☀️ UV Index:</span>
            <span class="value">${station.uv_index}</span>
          </div>
          <div class="info-row">
            <span class="label">🌧️ Raining:</span>
            <span class="value">${station.is_raining ? 'Yes' : 'No'}</span>
          </div>
        </div>
      `;
    })
    .catch(err => {
      console.error("Error fetching station details:", err);
      document.getElementById("detail-info").innerHTML = "<p class='error'>Failed to load station details.</p>";
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
      if (!res.ok) throw new Error("Failed to fetch historical data");
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

      const ctx = document.getElementById("historical-chart").getContext("2d");
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
            }
          },
          scales: {
            y: {
              beginAtZero: false
            }
          }
        }
      });
    })
    .catch(err => {
      console.error("Error loading chart data:", err);
      alert("Failed to load historical data");
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

function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;

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
