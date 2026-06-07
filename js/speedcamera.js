import { getDistanceFromLatLonInKm } from './helpers.js';

// Throttle state - cameras change rarely, so 60s + 200m is plenty
let lastCameraFetchTime = 0;
let lastCameraLat = null;
let lastCameraLng = null;
let cameraBackoffUntil = 0;

const CAMERA_MIN_INTERVAL_MS = 60000; // 60s between requests
const CAMERA_MIN_DISTANCE_M  = 200;   // 200m movement before re-fetching
const CAMERA_BACKOFF_MS      = 120000; // 2 min backoff on 429

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkForSpeedCameras(coordinates) {
    const now = Date.now();
    const latest = coordinates[coordinates.length - 1];

    // Respect backoff after 429
    if (now < cameraBackoffUntil) return;

    // Minimum time between requests
    if (now - lastCameraFetchTime < CAMERA_MIN_INTERVAL_MS) return;

    // Minimum distance moved since last fetch
    if (lastCameraLat !== null) {
        const dist = haversineMeters(lastCameraLat, lastCameraLng, latest.lat, latest.lng);
        if (dist < CAMERA_MIN_DISTANCE_M) return;
    }

    lastCameraFetchTime = now;
    lastCameraLat = latest.lat;
    lastCameraLng = latest.lng;

    // Query only the most recent position with a 500m radius
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
                console.warn("OSM rate limit (429) på fartkamera - venter 2 minutter");
            } else {
                console.error("Error checking for speed cameras:", error);
            }
        });
}