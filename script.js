// ── Configuration ──────────────────────────────────────────────
const FORECAST_URL = "/api/forecast";
const SEARCH_URL = "/api/search";
const STORAGE_KEY = "weatherapp.savedCities";
// ───────────────────────────────────────────────────────────────

// ── DOM References ──────────────────────────────────────────────
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("searchBtn");
const suggestionsList = document.getElementById("suggestions-list");

const cityEl = document.querySelector("#weather-place h3");
const tempEl = document.getElementById("temp");
const condEl = document.querySelector("#tempType h3");
const condIcon = document.getElementById("main-weather-icon");
const feelsEl = document.querySelector(".feels-like");
const highEl = document.querySelector(".hi-lo-container span:first-child");
const lowEl = document.querySelector(".hi-lo-container span:last-child");

const humidityEl = document.getElementById("humidity-val");
const windEl = document.getElementById("wind-val");
const windDirEl = document.getElementById("wind-dir-val");
const uvEl = document.getElementById("uv-val");

const forecastSection = document.getElementById("forecast");
const forecastContainer = document.getElementById("forecast-container");
const forecastTitleEl = document.querySelector(".forecast-title");

const navLinks = document.querySelectorAll(".sidebar-links a[data-view]");
const views = {
    weather: document.getElementById("view-weather"),
    cities: document.getElementById("view-cities"),
    map: document.getElementById("view-map"),
};

const saveCityBtn = document.getElementById("save-city");
const saveStatusEl = document.getElementById("save-status");
const savedCitiesEl = document.getElementById("saved-cities");
const savedEmptyEl = document.getElementById("saved-empty");
const popularCitiesEl = document.getElementById("popular-cities");
const mapEl = document.getElementById("map");
const mapReadoutEl = document.getElementById("map-readout");

// Esri's Dark Gray Canvas needs no API key and returns real tiles; CARTO's
// basemaps now answer with an "API KEY REQUIRED" placeholder image.
const MAP_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const MAP_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const MAP_ATTRIBUTION =
    'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

const POPULAR_CITIES = [
    { name: "London", q: "London" },
    { name: "New York", q: "New York" },
    { name: "Tokyo", q: "Tokyo" },
    { name: "Mumbai", q: "Mumbai" },
    { name: "Paris", q: "Paris" },
    { name: "Sydney", q: "Sydney" },
];

let lastLocation = null;
let map = null;
let mapMarker = null;
// ───────────────────────────────────────────────────────────────


// ── Helpers ────────────────────────────────────────────────────
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}

function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
        if (el) el.hidden = key !== name;
    });

    navLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.view === name);
        if (link.dataset.view === name) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    if (name === "map") {
        initMap();
        window.requestAnimationFrame(() => {
            if (map) map.invalidateSize();
        });
    }
}
// ───────────────────────────────────────────────────────────────


// ── 1. The Autocomplete Engine ─────────────────────────────────
let searchTimeout;

searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();

    // Clear previous timeout to avoid spamming the API
    clearTimeout(searchTimeout);

    if (query.length < 3) {
        suggestionsList.classList.add("suggestions-hidden");
        return;
    }

    // Wait 300ms after user stops typing before calling API
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            suggestionsList.innerHTML = "";

            if (data.length > 0) {
                data.forEach(location => {
                    const li = document.createElement("li");
                    li.className = "suggestions-list-item";
                    li.textContent = `📍 ${location.name}, ${location.region}, ${location.country}`;

                    // When clicked, fill the input and fetch weather
                    li.addEventListener("click", () => {
                        searchInput.value = location.name;
                        suggestionsList.classList.add("suggestions-hidden");
                        fetchWeather(location.name);
                    });

                    suggestionsList.appendChild(li);
                });
                suggestionsList.classList.remove("suggestions-hidden");
            } else {
                suggestionsList.classList.add("suggestions-hidden");
            }
        } catch (err) {
            console.error("Autocomplete failed:", err);
        }
    }, 300);
});

// Close suggestions if user clicks outside
document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !suggestionsList.contains(e.target)) {
        suggestionsList.classList.add("suggestions-hidden");
    }
});
// ───────────────────────────────────────────────────────────────


// ── 2. The Main Weather Fetcher ────────────────────────────────
async function fetchWeather(query, options = {}) {
    const { keepView = false } = options;

    try {
        // The free plan returns 3 days in total: today plus the 2 forecast days.
        const res = await fetch(`${FORECAST_URL}?q=${encodeURIComponent(query)}`);

        if (!res.ok) {
            const payload = await res.json().catch(() => null);
            const message = payload?.error?.message;
            alert(message ? `Couldn't load "${query}": ${message}` : `City not found: "${query}"`);
            return;
        }

        const data = await res.json();
        renderCurrentWeather(data);
        renderForecast(data.forecast.forecastday);

        if (!keepView) showView("weather");
    } catch (err) {
        console.error("Weather fetch failed:", err);
        alert("Something went wrong loading the forecast.");
    }
}
// ───────────────────────────────────────────────────────────────


// ── 3. Render Functions ────────────────────────────────────────
function renderCurrentWeather(data) {
    const loc = data.location;
    const current = data.current;
    const todayAstro = data.forecast.forecastday[0].day; // Today's min/max data

    // Location
    cityEl.textContent = `${loc.name}, ${loc.country}`;

    // Temperature & Condition
    tempEl.textContent = Math.round(current.temp_c);
    condEl.textContent = current.condition.text;
    condIcon.src = `https:${current.condition.icon}`;
    condIcon.style.display = "block";

    // Meta
    feelsEl.textContent = `Feels like ${Math.round(current.feelslike_c)}°C`;
    highEl.textContent = `H: ${Math.round(todayAstro.maxtemp_c)}°`;
    lowEl.textContent = `L: ${Math.round(todayAstro.mintemp_c)}°`;

    // Conditions panel
    humidityEl.textContent = `${current.humidity}%`;
    windEl.textContent = `${Math.round(current.wind_kph)} km/h`;
    windDirEl.textContent = current.wind_dir;
    uvEl.textContent = current.uv;

    // Remember the place so it can be saved or shown on the map
    lastLocation = {
        name: loc.name,
        region: loc.region,
        country: loc.country,
        lat: loc.lat,
        lon: loc.lon,
    };

    saveCityBtn.disabled = false;

    if (mapReadoutEl) {
        mapReadoutEl.textContent = `${loc.name}${loc.country ? ", " + loc.country : ""} · ${Math.round(current.temp_c)}°C`;
    }

    if (map) focusMap(lastLocation, current.temp_c);
}

function renderForecast(forecastDays) {
    forecastContainer.innerHTML = ""; // Clear old forecast

    // Today already has its own panel above, so the strip covers the days
    // after it. The free plan returns exactly the next two.
    const futureDays = forecastDays.slice(1, 3);

    forecastSection.style.display = futureDays.length ? "block" : "none";
    forecastTitleEl.textContent = `${futureDays.length}-Day Forecast`;

    futureDays.forEach((dayData) => {
        // Parse at local midnight so the weekday never slips a day behind
        // UTC in timezones west of Greenwich.
        const date = new Date(`${dayData.date}T00:00:00`);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

        const box = document.createElement("div");
        box.className = "forecast-box";

        const dayLabel = document.createElement("span");
        dayLabel.className = "forecast-day";
        dayLabel.textContent = dayName;

        const icon = document.createElement("img");
        icon.className = "forecast-icon";
        icon.src = `https:${dayData.day.condition.icon}`;
        icon.alt = dayData.day.condition.text;

        const temps = document.createElement("div");
        temps.className = "forecast-temps";

        const high = document.createElement("span");
        high.className = "forecast-high";
        high.textContent = `${Math.round(dayData.day.maxtemp_c)}°`;

        const low = document.createElement("span");
        low.className = "forecast-low";
        low.textContent = `${Math.round(dayData.day.mintemp_c)}°`;

        temps.append(high, low);
        box.append(dayLabel, icon, temps);
        forecastContainer.appendChild(box);
    });
}
// ───────────────────────────────────────────────────────────────


// ── 4. Cities ──────────────────────────────────────────────────
function loadSavedCities() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function storeSavedCities(cities) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
    } catch (err) {
        console.warn("Could not save cities:", err);
    }
}

function setSaveStatus(message) {
    saveStatusEl.textContent = message;
    clearTimeout(setSaveStatus.timer);
    setSaveStatus.timer = setTimeout(() => {
        saveStatusEl.textContent = "";
    }, 3200);
}

function renderSavedCities() {
    const saved = loadSavedCities();

    savedCitiesEl.replaceChildren();
    savedEmptyEl.hidden = saved.length > 0;

    saved.forEach((city) => {
        const item = document.createElement("li");
        item.className = "city-card";
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", `Show weather for ${city.name}`);

        const text = document.createElement("span");
        text.className = "city-text";

        const name = document.createElement("span");
        name.className = "city-name";
        name.textContent = city.name;

        const meta = document.createElement("span");
        meta.className = "city-meta";
        meta.textContent = [city.region, city.country].filter(Boolean).join(", ");

        text.append(name, meta);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "city-remove";
        remove.setAttribute("aria-label", `Remove ${city.name}`);
        remove.textContent = "×";
        remove.addEventListener("click", (event) => {
            event.stopPropagation();
            const remaining = loadSavedCities().filter(
                (entry) => entry.lat !== city.lat || entry.lon !== city.lon
            );
            storeSavedCities(remaining);
            renderSavedCities();
            setSaveStatus(`${city.name} removed.`);
        });

        const open = () => {
            searchInput.value = city.name;
            fetchWeather(`${city.lat},${city.lon}`);
        };

        item.addEventListener("click", open);
        item.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
            }
        });

        item.append(text, remove);
        savedCitiesEl.appendChild(item);
    });
}

function renderPopularCities() {
    popularCitiesEl.replaceChildren();

    POPULAR_CITIES.forEach((city) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "city-card city-card--button";

        const name = document.createElement("span");
        name.className = "city-name";
        name.textContent = city.name;

        card.appendChild(name);
        card.addEventListener("click", () => {
            searchInput.value = city.q;
            fetchWeather(city.q);
        });

        popularCitiesEl.appendChild(card);
    });
}

function saveCurrentCity() {
    if (!lastLocation) {
        setSaveStatus("Search for a city first.");
        return;
    }

    const saved = loadSavedCities();
    const alreadySaved = saved.some(
        (entry) => entry.lat === lastLocation.lat && entry.lon === lastLocation.lon
    );

    if (alreadySaved) {
        setSaveStatus(`${lastLocation.name} is already saved.`);
        return;
    }

    saved.unshift({ ...lastLocation });
    storeSavedCities(saved);
    renderSavedCities();
    setSaveStatus(`${lastLocation.name} saved.`);
}
// ───────────────────────────────────────────────────────────────


// ── 5. Map ─────────────────────────────────────────────────────
function initMap() {
    if (!mapEl || map) return;

    if (typeof L === "undefined") {
        mapReadoutEl.textContent = "The map library could not load. Check your connection and reload the page.";
        return;
    }

    map = L.map(mapEl, { worldCopyJump: true }).setView([22, 15], 2);

    L.tileLayer(MAP_TILES, {
        maxZoom: 18,
        maxNativeZoom: 16,
        attribution: MAP_ATTRIBUTION,
    }).addTo(map);

    // Place names ship as a separate reference layer on the Esri canvas.
    L.tileLayer(MAP_LABELS, {
        maxZoom: 18,
        maxNativeZoom: 16,
        pane: "overlayPane",
    }).addTo(map);

    // Tap anywhere to load the weather for that point.
    map.on("click", (event) => {
        const { lat, lng } = event.latlng;
        fetchWeather(`${lat.toFixed(4)},${lng.toFixed(4)}`, { keepView: true });
    });

    if (lastLocation) focusMap(lastLocation);
}

function focusMap(location, tempC) {
    if (!map) return;

    const latlng = [location.lat, location.lon];
    const label = `${location.name}${location.country ? `, ${location.country}` : ""}`;
    const popup = `<strong>${escapeHtml(label)}</strong>${
        typeof tempC === "number" ? `<br>${Math.round(tempC)}°C` : ""
    }`;

    if (mapMarker) {
        mapMarker.setLatLng(latlng).setPopupContent(popup).openPopup();
    } else {
        mapMarker = L.marker(latlng, {
            icon: L.divIcon({ className: "map-pin", iconSize: [16, 16] }),
        })
            .addTo(map)
            .bindPopup(popup)
            .openPopup();
    }

    if (map.getZoom() < 8) {
        map.setView(latlng, 9);
    } else {
        map.panTo(latlng);
    }
}
// ───────────────────────────────────────────────────────────────


// ── 6. Search Events ───────────────────────────────────────────
searchBtn.addEventListener("click", () => {
    const city = searchInput.value.trim();
    if (city) {
        suggestionsList.classList.add("suggestions-hidden");
        fetchWeather(city);
    }
});

searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const city = searchInput.value.trim();
        if (city) {
            suggestionsList.classList.add("suggestions-hidden");
            fetchWeather(city);
        }
    }
});

navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        showView(link.dataset.view);
    });
});

saveCityBtn.addEventListener("click", saveCurrentCity);

renderSavedCities();
renderPopularCities();
showView("weather");
// ───────────────────────────────────────────────────────────────
