import { haversineMeters } from './speedlimit.js';
import { getFilteredPosition } from './helpers.js';

// Speed cameras have 500m detection radius.
// At 80 km/h you traverse 500m in ~22s - so 20s interval is safe and
// won't compete too hard with the speedlimit requests on the same endpoint.
let lastCameraFetchTime = 0;
let lastCameraLat = null;
let lastCameraLng = null;
let cameraBackoffUntil = 0;
let cameraInFlight = false;

const CAMERA_MIN_INTERVAL_MS = 20000; // 20s - shares endpoint with speedlimit
const CAMERA_MIN_DISTANCE_M  = 200;   // 200m - well within 500m detection radius
const CAMERA_BACKOFF_MS      = 120000; // 2 min backoff on 429

export function checkForSpeedCameras(coordinates) {
    const now = Date.now();
    const latest = getFilteredPosition(coordinates);

    if (now < cameraBackoffUntil) {
        const remaining = Math.round((cameraBackoffUntil - now) / 1000);
        console.log(`[Fartkamera] Backoff aktiv - ${remaining}s tilbage`);
        return;
    }
    if (cameraInFlight) {
        console.log("[Fartkamera] Request allerede i gang - skipper");
        return;
    }

    const elapsed = now - lastCameraFetchTime;
    if (elapsed < CAMERA_MIN_INTERVAL_MS) {
        console.log(`[Fartkamera] For tidligt (${Math.round(elapsed / 1000)}s siden sidst, min ${CAMERA_MIN_INTERVAL_MS / 1000}s)`);
        return;
    }

    if (lastCameraLat !== null) {
        const dist = haversineMeters(lastCameraLat, lastCameraLng, latest.lat, latest.lng);
        if (dist < CAMERA_MIN_DISTANCE_M) {
            console.log(`[Fartkamera] Ikke rykket nok (${dist.toFixed(0)}m, min ${CAMERA_MIN_DISTANCE_M}m)`);
            return;
        }
    }

    lastCameraFetchTime = now;
    lastCameraLat = latest.lat;
    lastCameraLng = latest.lng;
    cameraInFlight = true;

    console.log(`[Fartkamera] Henter @ ${latest.lat.toFixed(5)}, ${latest.lng.toFixed(5)}`);

    const query = `[out:json];(node(around:500,${latest.lat},${latest.lng})["highway"="speed_camera"];);out body;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    axios.get(overpassUrl)
        .then(response => {
            const cameras = response.data.elements;
            console.log(`[Fartkamera] Svar: ${cameras.length} kamera(er) inden for 500m`);
            if (cameras.length > 0) {
                cameras.forEach((camera, i) => {
                    const distance = haversineMeters(latest.lat, latest.lng, camera.lat, camera.lon);
                    const dir = camera.tags?.direction || '?';
                    const type = camera.tags?.camera_type || camera.tags?.enforcement || '?';
                    console.log(`[Fartkamera] #${i + 1}: ${distance.toFixed(0)}m væk | retning: ${dir} | type: ${type}`);
                });
            } else {
                console.log("[Fartkamera] Ingen kameraer i nærheden");
            }
        })
        .catch(error => {
            if (error.response && error.response.status === 429) {
                cameraBackoffUntil = Date.now() + CAMERA_BACKOFF_MS;
                console.warn(`[Fartkamera] Rate limit (429) - backoff 2 min`);
            } else {
                console.error("[Fartkamera] Fejl ved hentning:", error.message || error);
            }
        })
        .finally(() => { cameraInFlight = false; });
}