import { haversineMeters } from './speedlimit.js';
import { getFilteredPosition } from './helpers.js';

// Strategy: fetch ALL cameras within FETCH_RADIUS once, cache locally.
// Re-fetch only when we've moved > REFETCH_DISTANCE from the cache center.
// All proximity checks are then pure JS - zero network calls while driving.
//
// At 130 km/h you cover 3km in ~83 seconds, so REFETCH_DISTANCE=3000m
// means ~1 Overpass request per 1-2 minutes max, even at motorway speed.
// The cache margin (FETCH_RADIUS >> ALERT_RADIUS) ensures no camera is missed
// near the edge of the cache zone.

const FETCH_RADIUS    = 5000;  // 5km fetch radius - large cache area
const REFETCH_DISTANCE = 3000; // re-fetch when >3km from cache center
const ALERT_RADIUS    = 500;   // warn driver when camera is within 500m
const BACKOFF_MS      = 300000; // 5 min backoff on 429

let cameraCache      = [];  // all cameras fetched last time
let cacheCenterLat   = null;
let cacheCenterLng   = null;
let cameraInFlight   = false;
let cameraBackoffUntil = 0;

function fetchCameraCache(lat, lng) {
    if (cameraInFlight) return;
    if (Date.now() < cameraBackoffUntil) {
        const remaining = Math.round((cameraBackoffUntil - Date.now()) / 1000);
        console.log(`[Fartkamera] Backoff aktiv - ${remaining}s tilbage`);
        return;
    }

    cameraInFlight = true;
    console.log(`[Fartkamera] Henter ${FETCH_RADIUS / 1000}km cache @ ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    const query = `[out:json];(node(around:${FETCH_RADIUS},${lat},${lng})["highway"="speed_camera"];);out body;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    axios.get(overpassUrl)
        .then(response => {
            cameraCache    = response.data.elements;
            cacheCenterLat = lat;
            cacheCenterLng = lng;
            console.log(`[Fartkamera] Cache opdateret: ${cameraCache.length} kamera(er) inden for ${FETCH_RADIUS / 1000}km`);
            if (cameraCache.length > 0) {
                cameraCache.forEach((c, i) => {
                    const dist = haversineMeters(lat, lng, c.lat, c.lon);
                    const type = c.tags?.camera_type || c.tags?.enforcement || 'ukendt';
                    const dir  = c.tags?.direction || '?';
                    console.log(`[Fartkamera] Cache #${i + 1}: ${dist.toFixed(0)}m | type: ${type} | retning: ${dir}`);
                });
            }
        })
        .catch(error => {
            if (error.response && error.response.status === 429) {
                cameraBackoffUntil = Date.now() + BACKOFF_MS;
                console.warn(`[Fartkamera] Rate limit (429) - backoff ${BACKOFF_MS / 60000} min`);
            } else {
                console.error("[Fartkamera] Fejl ved hentning:", error.message || error);
            }
        })
        .finally(() => { cameraInFlight = false; });
}

export function checkForSpeedCameras(coordinates) {
    const latest = getFilteredPosition(coordinates);

    // Re-fetch if no cache yet, or we've driven far enough from cache center
    if (cacheCenterLat === null) {
        fetchCameraCache(latest.lat, latest.lng);
        return;
    }

    const distFromCenter = haversineMeters(cacheCenterLat, cacheCenterLng, latest.lat, latest.lng);
    if (distFromCenter > REFETCH_DISTANCE) {
        console.log(`[Fartkamera] Kørt ${distFromCenter.toFixed(0)}m fra cache-centrum - henter nyt område`);
        fetchCameraCache(latest.lat, latest.lng);
    }

    // Check all cached cameras - pure JS, no network
    if (cameraCache.length === 0) return;

    const nearby = cameraCache
        .map(c => ({ ...c, distance: haversineMeters(latest.lat, latest.lng, c.lat, c.lon) }))
        .filter(c => c.distance <= ALERT_RADIUS)
        .sort((a, b) => a.distance - b.distance);

    if (nearby.length > 0) {
        nearby.forEach((c, i) => {
            const type = c.tags?.camera_type || c.tags?.enforcement || 'ukendt';
            const dir  = c.tags?.direction || '?';
            console.log(`[Fartkamera] ⚠ #${i + 1} inden for ${ALERT_RADIUS}m: ${c.distance.toFixed(0)}m | type: ${type} | retning: ${dir}`);
        });
    }
}