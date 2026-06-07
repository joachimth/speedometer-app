import { haversineMeters } from './speedlimit.js';
import { getFilteredPosition } from './helpers.js';

// Primary source: static JSON with all 20 known Danish ATK stærekasser.
// Loaded once at startup - no network, no rate limits, always available.
// Secondary: OSM Overpass for areas outside Denmark (5km cache, refetch at 3km).

const ALERT_RADIUS     = 500;   // warn when camera is within 500m
const FETCH_RADIUS     = 5000;  // OSM fallback: 5km radius
const REFETCH_DISTANCE = 3000;  // OSM fallback: refetch when >3km from cache center
const BACKOFF_MS       = 300000; // 5 min backoff on 429

// Static DK cameras - loaded once
let dkCameras        = null;  // null = not loaded yet, [] = loaded (none found)
let dkLoadAttempted  = false;

// OSM fallback cache
let osmCache         = [];
let cacheCenterLat   = null;
let cacheCenterLng   = null;
let osmInFlight      = false;
let osmBackoffUntil  = 0;

// Denmark bounding box (approx)
const DK_BOUNDS = { minLat: 54.5, maxLat: 57.8, minLng: 8.0, maxLng: 15.3 };
function isInDenmark(lat, lng) {
    return lat >= DK_BOUNDS.minLat && lat <= DK_BOUNDS.maxLat &&
           lng >= DK_BOUNDS.minLng && lng <= DK_BOUNDS.maxLng;
}

function loadDkCameras() {
    if (dkLoadAttempted) return;
    dkLoadAttempted = true;

    // Path relative to the page (GitHub Pages serves from repo root)
    fetch('./data/dk-speed-cameras.json')
        .then(r => r.json())
        .then(data => {
            // Preserve status field: 'aktiv' (default) or 'planlagt'
            dkCameras = data.cameras.map(c => ({
                lat: c.lat, lng: c.lng,
                name: c.name,
                road: c.road,
                maxspeed: c.maxspeed,
                direction: c.direction,
                status: c.status || 'aktiv'  // no status field = confirmed/active
            }));
            const confirmed = dkCameras.filter(c => c.status === 'aktiv').length;
            const planned   = dkCameras.filter(c => c.status === 'planlagt').length;
            console.log(`[Fartkamera] ${dkCameras.length} DK ATK-kameraer indlæst (${confirmed} aktive, ${planned} planlagte)`);
        })
        .catch(err => {
            console.warn("[Fartkamera] Kunne ikke indlæse dk-speed-cameras.json:", err.message);
            dkCameras = []; // mark as loaded so we fall back to OSM
        });
}

function fetchOsmCache(lat, lng) {
    if (osmInFlight) return;
    if (Date.now() < osmBackoffUntil) {
        const remaining = Math.round((osmBackoffUntil - Date.now()) / 1000);
        console.log(`[Fartkamera] OSM backoff aktiv - ${remaining}s tilbage`);
        return;
    }

    osmInFlight = true;
    console.log(`[Fartkamera] Henter OSM ${FETCH_RADIUS / 1000}km cache @ ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    const query = `[out:json];(node(around:${FETCH_RADIUS},${lat},${lng})["highway"="speed_camera"];);out body;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    axios.get(overpassUrl)
        .then(response => {
            osmCache       = response.data.elements;
            cacheCenterLat = lat;
            cacheCenterLng = lng;
            console.log(`[Fartkamera] OSM cache opdateret: ${osmCache.length} kamera(er) inden for ${FETCH_RADIUS / 1000}km`);
        })
        .catch(error => {
            if (error.response && error.response.status === 429) {
                osmBackoffUntil = Date.now() + BACKOFF_MS;
                console.warn(`[Fartkamera] OSM rate limit (429) - backoff ${BACKOFF_MS / 60000} min`);
            } else {
                console.error("[Fartkamera] OSM fejl:", error.message || error);
            }
        })
        .finally(() => { osmInFlight = false; });
}

// Returns the closest camera within ALERT_RADIUS, or null.
// For DK cameras: respects status field ('aktiv' | 'planlagt').
// For OSM cameras: treated as 'aktiv'.
function findClosest(cameras, lat, lng, lngKey = 'lng') {
    return cameras
        .map(c => ({ ...c, distance: haversineMeters(lat, lng, c.lat, c[lngKey] ?? c.lon) }))
        .filter(c => c.distance <= ALERT_RADIUS)
        .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

// onCameraWarning(info | null)
//   info = { type: 'confirmed'|'planned', distance, name, maxspeed }
//   null = no camera nearby (clear warning)
export function checkForSpeedCameras(coordinates, onCameraWarning) {
    // Start loading static DK cameras on first call
    if (!dkLoadAttempted) loadDkCameras();

    const latest = getFilteredPosition(coordinates);
    const inDK   = isInDenmark(latest.lat, latest.lng);

    if (inDK) {
        if (dkCameras === null) {
            console.log("[Fartkamera] DK-data endnu ikke indlæst - vent...");
            return;
        }

        // Check confirmed first - takes priority
        const confirmed = findClosest(
            dkCameras.filter(c => c.status === 'aktiv'),
            latest.lat, latest.lng
        );
        if (confirmed) {
            console.log(`[Fartkamera] ⚠ BEKRÆFTET ATK: ${confirmed.distance.toFixed(0)}m | ${confirmed.name} | max: ${confirmed.maxspeed}`);
            onCameraWarning?.({ type: 'confirmed', distance: confirmed.distance, name: confirmed.name, maxspeed: confirmed.maxspeed });
            return;
        }

        // Check planned cameras - softer
        const planned = findClosest(
            dkCameras.filter(c => c.status === 'planlagt'),
            latest.lat, latest.lng
        );
        if (planned) {
            console.log(`[Fartkamera] ~ PLANLAGT ATK (2027): ${planned.distance.toFixed(0)}m | ${planned.name} | max: ${planned.maxspeed}`);
            onCameraWarning?.({ type: 'planned', distance: planned.distance, name: planned.name, maxspeed: planned.maxspeed });
            return;
        }

        console.log(`[Fartkamera] Ingen DK ATK-kameraer inden for ${ALERT_RADIUS}m`);
        onCameraWarning?.(null);

    } else {
        // Outside Denmark: use OSM cache
        if (cacheCenterLat === null) {
            fetchOsmCache(latest.lat, latest.lng);
            return;
        }
        const distFromCenter = haversineMeters(cacheCenterLat, cacheCenterLng, latest.lat, latest.lng);
        if (distFromCenter > REFETCH_DISTANCE) {
            console.log(`[Fartkamera] Kørt ${distFromCenter.toFixed(0)}m fra OSM cache-centrum - henter nyt`);
            fetchOsmCache(latest.lat, latest.lng);
        }

        const closest = osmCache.length > 0
            ? findClosest(osmCache, latest.lat, latest.lng, 'lon')
            : null;

        if (closest) {
            const name = closest.tags?.name || closest.tags?.operator || 'Fartkamera';
            const spd  = closest.tags?.maxspeed ?? '?';
            console.log(`[Fartkamera] ⚠ OSM: ${closest.distance.toFixed(0)}m | ${name} | max: ${spd}`);
            onCameraWarning?.({ type: 'confirmed', distance: closest.distance, name, maxspeed: spd });
        } else {
            console.log(`[Fartkamera] Ingen OSM kameraer inden for ${ALERT_RADIUS}m`);
            onCameraWarning?.(null);
        }
    }
}