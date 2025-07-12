// Toggle between login and signup forms
function toggleAuthForms() {
  const loginForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");
  loginForm.style.display = loginForm.style.display === "none" ? "block" : "none";
  signupForm.style.display = signupForm.style.display === "none" ? "block" : "none";
}
// SIGN UP
function signup() {
  const username = document.getElementById("signup-username").value;
  const password = document.getElementById("signup-password").value;

  fetch("/users/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(res => res.ok ? res.json() : Promise.reject("Signup failed"))
    .then(user => {
      alert("Signup successful. You can now login.");
      toggleAuthForms();
    })
    .catch(err => alert(err));
}
// SIGN IN
function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  fetch("/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(res => res.ok ? res.json() : Promise.reject("Login failed"))
    .then(token => {
      localStorage.setItem("token", token.access_token);
      loadUserDashboard(); // Load user data and switch to dashboard
    })
    .catch(err => alert(err));
}
// LOGOUT
function logout() {
  if (!confirm("Are you sure you want to log out?")) return;
  
  // Clear session data
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // Hide dashboard and show auth section
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("auth-section").classList.remove("hidden");

  alert("You’ve been logged out.");
}

// On load
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("token")) {
    loadUserDashboard();
  } else {
    document.getElementById("auth-section").style.display = "block";
  }
});

function loadUserDashboard() {
  fetch("/users/me", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  })
    .then(res => {
      if (!res.ok) throw new Error("Auth failed");
      return res.json();
    })
    .then(user => {
      localStorage.setItem("user", JSON.stringify(user));
      showDashboard(user);
      renderStations("my"); // Default to My Stations
    })
    .catch(err => {
      alert("Session expired or invalid. Please login again.");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      document.getElementById("auth-section").classList.remove("hidden");
      document.getElementById("dashboard").classList.add("hidden");
    });
}

function showDashboard(user) {
  // Hide auth section and show dashboard
  document.getElementById("auth-section").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");

  const infoHtml = `
    <p><strong>Username:</strong> ${user.username}</p>
    <p><strong>User Type:</strong> ${user.is_admin ? "Admin" : "Standard"}</p>
    <p><strong>Stations:</strong> ${user.stations}</p>
  `;
  const userInfo = document.getElementById("user-info");
  if (userInfo) userInfo.innerHTML = infoHtml;
}

document.getElementById("stations-btn").addEventListener("click", () => {
  const nextView = currentStationView === "my" ? "public" : "my";
  renderStations(nextView);
});

let currentStationView = "my"; // Track current view

function renderStations(view = "my") {
  currentStationView = view;
  const container = document.getElementById("stations-grid");
  const btn = document.getElementById("stations-btn");

  const isMyStations = view === "my";
  const endpoint = isMyStations ? "/stations/all/" : "/stations/public";
  const headers = isMyStations
    ? { Authorization: "Bearer " + localStorage.getItem("token") }
    : {};

  fetch(endpoint, { headers })
    .then(res => res.json())
    .then(stations => {
      container.innerHTML = "";

      if (stations.length === 0) {
        container.innerHTML = `<p>${isMyStations ? "You have no stations yet." : "No public stations available."}</p>`;
      if (isMyStations) {
        const addCard = document.createElement("div");
        addCard.className = "station-card add-card";
        addCard.innerHTML = `<div class="plus-icon" onclick="showAddStationPopup()">➕</div>`;
        container.appendChild(addCard);
      }        return;
      }

      stations.forEach(station => {
        const card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `
          <span class="station-status ${station.is_public ? 'public' : 'private'}">
          ${station.is_public ? 'Public' : 'Private'}
          </span>
          <h4>📍 ${station.location}</h4>
          <p>
            🌡️ ${station.temperature} °C <br>
            🌧️ ${station.is_raining}
          </p>

          ${
            isMyStations
              ? `
            <p class="hidden">
              <strong>API Key:</strong>
              <span id="key-${station.station_id}">${station.api_access_key}</span>
            </p>
            <div class="card-actions">
              <button onclick="showStationDetail(${station.station_id})">View</button>
              <button class="delete-btn" onclick="deleteStation(${station.station_id})">Delete</button>
              <button class="edit-btn" onclick="showEditStationPopup(${station.station_id}, '${station.location}', ${station.is_public})">Edit</button>
              <button class="copy-btn" onclick="copyApiKey(${station.station_id}, this)">Copy API Key</button>
            </div>`
              : `<button onclick="showStationDetail(${station.station_id})">View</button>`
          }
        `;
        container.appendChild(card);
      });

      // Add "+" card only for My Stations
      if (isMyStations) {
        const addCard = document.createElement("div");
        addCard.className = "station-card add-card";
        addCard.innerHTML = `<div class="plus-icon" onclick="showAddStationPopup()">➕</div>`;
        container.appendChild(addCard);
      }

      // Update toggle button text
      btn.textContent = isMyStations ? "🌍 View Public Stations" : "🌐 View My Stations";
    })
    .catch(err => {
      console.error("Failed to fetch stations:", err);
    });
}


function showAddStationPopup() {
  document.getElementById("add-station-popup").classList.remove("hidden");
}

function hideAddStationPopup() {
  document.getElementById("add-station-popup").classList.add("hidden");
}

function submitAddStation(event) {
  event.preventDefault();

  const location = document.getElementById("station-location").value.trim();

  if (!location) {
    alert("Location is required.");
    return;
  }

  fetch("/stations/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ location })
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to add station");
      return res.json();
    })
    .then(() => {
      alert("Station added successfully!");
      hideAddStationPopup();
      renderStations();
    })
    .catch(err => {
      console.error("Error:", err);
      alert("Could not add station.");
    });
}

function deleteStation(stationId) {
  if (!confirm("Are you sure you want to delete this station?")) return;

  fetch(`/stations/${stationId}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  })
    .then(res => {
      if (!res.ok) throw new Error("Delete failed");
      alert("Station deleted successfully.");
      renderStations(); // Refresh stations list
    })
    .catch(err => {
      console.error("Error deleting station:", err);
      alert("Failed to delete station.");
    });
}

function copyApiKey(stationId, button) {
  const keySpan = document.getElementById(`key-${stationId}`);
  if (!keySpan) {
    console.warn(`API key not found for station ID: ${stationId}`);
    return;
  }

  const key = keySpan.textContent.trim();

  navigator.clipboard.writeText(key).then(() => {
    const tooltip = button.querySelector('.tooltip-text');
    if (tooltip) {
      tooltip.textContent = "Copied!";
      setTimeout(() => {
        tooltip.textContent = "Copy API key";
      }, 1500);
    }
  }).catch(err => {
    console.error("Copy failed:", err);
    alert("Failed to copy API key.");
  });
}




// Station Edit View

function showEditStationPopup(id, location, isPublic) {
  document.getElementById("edit-station-id").value = id;
  document.getElementById("edit-location").value = location;
  document.getElementById("edit-is-public").checked = isPublic;
  document.getElementById("edit-station-popup").classList.remove("hidden");
}

function closeEditStationPopup() {
  document.getElementById("edit-station-popup").classList.add("hidden");
}

document.getElementById("edit-station-form").addEventListener("submit", handleEditStationSubmit);

function handleEditStationSubmit(event) {
  event.preventDefault(); // Prevent default form behavior

  const stationId = document.getElementById("edit-station-id").value;
  const location = document.getElementById("edit-location").value;
  const isPublic = document.getElementById("edit-is-public").checked;

  fetch(`/stations/${stationId}/location`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({
      location: location,
      is_public: isPublic
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to update station");
      return res.json();
    })
    .then(updatedStation => {
      alert("Station updated successfully.");
      closeEditStationPopup();
      renderStations(); // Refresh stations grid
    })
    .catch(err => {
      console.error("Error updating station:", err);
      alert("Error updating station.");
    });
}



// Station Detail View

let currentStationId = null;
let detailInterval = null;

function showStationDetail(id) {
  currentStationId = id;
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("station-detail").classList.remove("hidden");
  fetchStationDetail();
  if (detailInterval) clearInterval(detailInterval);
  detailInterval = setInterval(fetchStationDetail, 10000);
}

function fetchStationDetail() {
  fetch(`/stations/${currentStationId}/details`,
    {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    }
  )
    .then(res => res.json())
    .then(data => {
      document.getElementById("detail-title").textContent = "Station Details";
      document.getElementById("detail-info").innerHTML = `
        <p>📍 <strong>Location:</strong> ${data.location}</p>
        <p>🌡️ <strong>Temperature:</strong> ${data.temperature} °C</p>
        <p>💧 <strong>Humidity:</strong> ${data.humidity} %</p>
        <p>📈 <strong>Pressure:</strong> ${data.pressure} hPa</p>
        <p>💨 <strong>Wind Speed:</strong> ${data.wind_speed} m/s</p>
        <p>🧭 <strong>Wind Direction:</strong> ${data.wind_direction}</p>
        <p>☀️ <strong>UV Index:</strong> ${data.uv_index}</p>
        <p>🌧️ <strong>Rain Status:</strong> ${data.is_raining}</p>
      `;
    });
}

function backToDashboard() {
  document.getElementById("station-detail").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  if (detailInterval) clearInterval(detailInterval);
}





// Historical Data Chart

let chartInstance = null;

function showHistoricalChart() {
  document.getElementById("historical-popup").classList.remove("hidden");

  const selectedFields = Array.from(
    document.querySelectorAll("#historical-popup input[type='checkbox']")
  )
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  fetch(`/stations/${currentStationId}/historical_data`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  })
    .then(res => res.json())
    .then(dataList => {
      if (!Array.isArray(dataList) || dataList.length === 0) {
        console.warn("No historical data found.");
        return;
      }

      // Extract timestamps
      const labels = dataList.map(entry => new Date(entry.created_at).toLocaleString());

      // Build datasets for selected fields
      const datasets = selectedFields.map(field => ({
        label: field,
        data: dataList.map(entry => entry[field]),
        borderColor: getRandomColor(),
        fill: false,
        tension: 0.1
      }));

      if (chartInstance) chartInstance.destroy();

      const ctx = document.getElementById("historical-chart").getContext("2d");
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top'
            }
          },
          scales: {
            x: {
              ticks: { autoSkip: true, maxTicksLimit: 10 }
            }
          }
        }
      });
    })
    .catch(err => {
      console.error("Error loading historical data:", err);
    });
}

function getRandomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;
}

function closeHistoricalChart() {
  document.getElementById("historical-popup").classList.add("hidden");
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

