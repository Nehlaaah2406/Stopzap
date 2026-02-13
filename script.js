/**
 * Don't Miss Your Stop - Smart Proximity Alert System
 * Core Logic: Geocoding, Tracking, Distance Calculation & Alerts
 */

// --- State Management ---
let map, userMarker, destMarker, watchId;
let destination = JSON.parse(localStorage.getItem('saved_destination')) || null;
let recentStops = JSON.parse(localStorage.getItem('recent_stops')) || [];
let isTracking = false;
let isSimulating = false;
let simInterval = null;

// --- DOM Elements ---
const destInput = document.getElementById('destination-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const radiusInput = document.getElementById('radius-input');
const startBtn = document.getElementById('start-tracking-btn');
const simulateToggle = document.getElementById('simulate-toggle');
const recentList = document.getElementById('recent-list');
const recentSection = document.getElementById('recent-stops-section');
const distanceDisplay = document.getElementById('distance-display');
const currCoordsEl = document.getElementById('curr-coords');
const destNameEl = document.getElementById('dest-name');
const statusHint = document.getElementById('status-hint');
const trackingIndicator = document.getElementById('tracking-indicator');
const mapOverlay = document.getElementById('map-overlay');
const alarmSound = document.getElementById('alarm-sound');

// --- Module 3: Map Initialization ---
function initMap() {
    // Default view, will be updated by geolocation
    map = L.map('map').setView([0, 0], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Start background tracking immediately for "lively" feel
    startBackgroundTracking();

    // Load saved destination if it exists (Module 7)
    if (destination) {
        updateDestinationUI(destination);
    }
}

function startBackgroundTracking() {
    if (!navigator.geolocation) {
        console.warn("Geolocation not supported.");
        return;
    }

    // Single fix for initial map centering
    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 15);
        updateUserMarker(latitude, longitude);
    }, (err) => {
        console.warn("Initial location fix failed:", err);
    });

    // Continuous watch for "lively" tracking
    navigator.geolocation.watchPosition(
        (pos) => handleUpdate(pos),
        (err) => handleError(err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

function updateUserMarker(latitude, longitude) {
    if (!userMarker) {
        userMarker = L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: "#6366f1",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);
    } else {
        userMarker.setLatLng([latitude, longitude]);
    }
}

// --- Module 2: Geocoding (Nominatim API) ---
async function searchDestination() {
    const query = destInput.value.trim();
    if (!query) return;

    searchBtn.innerHTML = '⏳';
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();
        showResults(data);
    } catch (err) {
        console.error("Geocoding error:", err);
        alert("Could not connect to search service. Check internet.");
    } finally {
        searchBtn.innerHTML = '🔍';
    }
}

function showResults(results) {
    searchResults.innerHTML = '';
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-item">No results found</div>';
    } else {
        results.forEach(res => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.textContent = res.display_name;
            div.onclick = () => selectDestination(res);
            searchResults.appendChild(div);
        });
    }
    searchResults.classList.remove('hidden');
}

function selectDestination(res) {
    destination = {
        name: res.display_name,
        lat: parseFloat(res.lat),
        lon: parseFloat(res.lon)
    };

    // Module 7: Store locally
    localStorage.setItem('saved_destination', JSON.stringify(destination));

    updateDestinationUI(destination);
    searchResults.classList.add('hidden');
    destInput.value = res.display_name;
}

function updateDestinationUI(dest) {
    if (destMarker) map.removeLayer(destMarker);

    destMarker = L.marker([dest.lat, dest.lon], {
        icon: L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        })
    }).addTo(map);

    destMarker.bindPopup("Destination: " + dest.name).openPopup();
    map.flyTo([dest.lat, dest.lon], 15);

    destNameEl.textContent = dest.name;
    startBtn.disabled = false;
    statusHint.textContent = "Destination set! Click Start Tracking.";
    statusHint.style.color = "var(--success)";

    saveRecentStop(dest);
    updateRecentListUI();
}

function saveRecentStop(dest) {
    if (recentStops.some(s => s.name === dest.name)) return;
    recentStops.unshift(dest);
    recentStops = recentStops.slice(0, 5); // Keep last 5
    localStorage.setItem('recent_stops', JSON.stringify(recentStops));
}

function updateRecentListUI() {
    if (recentStops.length === 0) {
        recentSection.classList.add('hidden');
        return;
    }
    recentSection.classList.remove('hidden');
    recentList.innerHTML = '';
    recentStops.forEach(stop => {
        const chip = document.createElement('div');
        chip.className = 'recent-chip';
        chip.textContent = stop.name.split(',')[0];
        chip.onclick = () => {
            destination = stop;
            localStorage.setItem('saved_destination', JSON.stringify(destination));
            updateDestinationUI(destination);
            destInput.value = stop.name;
        };
        recentList.appendChild(chip);
    });
}

// --- Module 5: Haversine Formula (Distance Calculation) ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // In meters
}

// --- Module 4: Live GPS Tracking ---
function toggleTracking() {
    if (isTracking) {
        stopTracking();
    } else {
        if (simulateToggle.checked) {
            startSimulation();
        } else {
            activateAlarm();
        }
    }
}

function activateAlarm() {
    isTracking = true;
    startBtn.textContent = "Alarm Active - Click to Off";
    startBtn.classList.replace('btn-primary', 'btn-danger');
    trackingIndicator.classList.add('active');
    mapOverlay.classList.remove('hidden');
    statusHint.textContent = "Alarm monitoring active...";
}

function startSimulation() {
    if (!destination) return;
    isTracking = true;
    isSimulating = true;
    startBtn.textContent = "Stop Simulation";
    startBtn.classList.replace('btn-primary', 'btn-danger');
    trackingIndicator.classList.add('active');
    mapOverlay.classList.remove('hidden');
    statusHint.textContent = "Simulating journey...";

    // Start 500m away
    let currentLat = destination.lat + 0.005;
    let currentLon = destination.lon + 0.005;

    simInterval = setInterval(() => {
        currentLat -= (currentLat - destination.lat) * 0.1;
        currentLon -= (currentLon - destination.lon) * 0.1;

        handleUpdate({
            coords: {
                latitude: currentLat,
                longitude: currentLon
            }
        });

        if (calculateDistance(currentLat, currentLon, destination.lat, destination.lon) < 5) {
            clearInterval(simInterval);
        }
    }, 1000);
}

function stopTracking() {
    isTracking = false;
    if (isSimulating) {
        clearInterval(simInterval);
        isSimulating = false;
    }
    // Note: We don't clear the watchId anymore because we want "lively" tracking 24/7
    startBtn.textContent = "Start Tracking";
    startBtn.classList.replace('btn-danger', 'btn-primary');
    trackingIndicator.classList.remove('active');
    mapOverlay.classList.add('hidden');
    alarmSound.pause();
    alarmSound.currentTime = 0;
    statusHint.textContent = "Alarm disabled.";
    document.body.style.boxShadow = "none";
    window.alerted = false;
}

function handleUpdate(position) {
    const { latitude, longitude } = position.coords;
    currCoordsEl.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

    // Update User Marker
    updateUserMarker(latitude, longitude);

    // Auto-center if it's the first fix or if alarm is active
    if (isTracking && !map.getBounds().contains([latitude, longitude])) {
        map.panTo([latitude, longitude]);
    }

    // Calculate distance to destination
    if (destination) {
        const dist = calculateDistance(latitude, longitude, destination.lat, destination.lon);
        distanceDisplay.textContent = Math.round(dist) + ' m';

        // --- Module 6: Stop Alert System ---
        // Trigger only if alarm monitoring is "isTracking"
        if (isTracking) {
            const alertRadius = parseInt(radiusInput.value) || 50;
            if (dist <= alertRadius) {
                triggerAlert();
            }
        }
    }
}

function triggerAlert() {
    // Vibration (Hardware support needed)
    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500]);
    }

    // Audio Alert
    if (alarmSound.paused) {
        alarmSound.play().catch(e => console.log("Audio play failed, needs user interaction."));
    }

    // Visual Alert (Avoiding blocking alert() to keep map visible)
    statusHint.textContent = "YOUR STOP IS ARRIVING!";
    statusHint.style.color = "var(--danger)";
    document.body.style.boxShadow = "inset 0 0 50px rgba(239, 68, 68, 0.5)";

    // One-time notification
    if (!window.alerted) {
        alert("Wake up! Your stop is arriving!");
        window.alerted = true;
    }
}

function handleError(err) {
    console.warn(`Geolocation error (${err.code}): ${err.message}`);
    statusHint.textContent = "GPS Error: " + err.message;
}

// --- Event Listeners ---
searchBtn.onclick = searchDestination;
destInput.onkeypress = (e) => { if (e.key === 'Enter') searchDestination(); };
startBtn.onclick = toggleTracking;

// Basic offline check (Module 7)
window.addEventListener('online', () => {
    document.getElementById('connection-status').classList.remove('offline');
    document.getElementById('connection-status').querySelector('.status-text').textContent = "Online";
});
window.addEventListener('offline', () => {
    document.getElementById('connection-status').classList.add('offline');
    document.getElementById('connection-status').querySelector('.status-text').textContent = "Offline";
});

// Close results when clicking outside
document.onclick = (e) => {
    if (!e.target.closest('.search-wrapper')) {
        searchResults.classList.add('hidden');
    }
};

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW Registered!', reg);
        }).catch(err => {
            console.log('SW Registration failed:', err);
        });
    });
}

// Initialize
initMap();
updateRecentListUI();
