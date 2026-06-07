import { haversineMeters } from './speedlimit.js';

// Gate: min 5s OR min 100m moved. Skip if in flight.
// 500m detection radius at 80km/h = ~22 seconds warning at worst.
// That's plenty of time - no need for aggressive throttling here.
let lastCameraFetchTime = 0;
let lastCameraLat = null;
let lastCameraLng = null;
let cameraBackoffUntil = 0;
let cameraInFlight = false;

const CAMERA_MIN_INTERVAL_MS = 5000;  // 5s
const CAMERA_MIN_DISTANCE_M  = 100;   // 100m - fine for 500m detection radius
const CAMERA_BACKOFF_MS      = 60000; // 60s backoff on 429

export function checkForSpeedCameras(coordinates) {
    const now = Date.now();
    const latest = coordinates[coordinates.length - 1];

    if (now < cameraBackoffUntil) return;
    if (cameraInFlight) return;
    if (now - lastCameraFetchTime < CAMERA_MIN_INTERVAL_MS) return;
    if (lastCameraLat !== null) {
        const dist = haversineMeters(lastCameraLat, lastCameraLng, latest.lat, latest.lng);
        if (dist < CAMERA_MIN_DISTANCE_M) return;
    }

    lastCameraFetchTime = now;
    lastCameraLat = latest.lat;
    lastCameraLng = latest.lng;
    cameraInFlight = true;

    const query = `node(around:500,${latest.lat},${latest.lng})["highway"="speed_camera"];`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(${query});out body;`;

    axios.get(overpassUrl)
        .then(response => {
            const cameras = response.data.elements;
            if (cameras.length > 0) {
                const camera = cameras[0];
                const distance = haversineMeters(latest.lat, latest.lng, camera.lat, camera.lon);
                console.log(`Fartkamera ${distance.toFixed(0)}m væk`);
            }
        })
        .catch(error => {
            if (error.response && error.response.status === 429) {
                cameraBackoffUntil = Date.now() + CAMERA_BACKOFF_MS;
                console.warn("OSM rate limit (429) på fartkamera - venter 60s");
            } else {
                console.error("Error checking for speed cameras:", error);
            }
        })
        .finally(() => { cameraInFlight = false; });
}