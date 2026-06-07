import { updateRoadHistory, isConsistentRoadData } from './helpers.js';

// Throttle state - prevents hammering Overpass API (max ~1 req/min per IP)
let lastFetchTime = 0;
let lastFetchLat = null;
let lastFetchLng = null;
let backoffUntil = 0;

const MIN_FETCH_INTERVAL_MS = 30000; // minimum 30s between requests
const MIN_DISTANCE_M = 100;          // minimum 100m movement before re-fetching
const BACKOFF_MS = 120000;           // 2 minute backoff on 429

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getSpeedLimit(coordinates, roadHistory, speedLimitDisplay, roadInfoDisplay, onLimitUpdate) {
    const now = Date.now();
    const latest = coordinates[coordinates.length - 1];

    // Respect backoff after 429
    if (now < backoffUntil) {
        console.log(`OSM backoff aktiv - ${Math.round((backoffUntil - now) / 1000)}s tilbage`);
        return;
    }

    // Minimum time between requests
    if (now - lastFetchTime < MIN_FETCH_INTERVAL_MS) return;

    // Minimum distance moved since last fetch
    if (lastFetchLat !== null) {
        const dist = haversineMeters(lastFetchLat, lastFetchLng, latest.lat, latest.lng);
        if (dist < MIN_DISTANCE_M) return;
    }

    lastFetchTime = now;
    lastFetchLat = latest.lat;
    lastFetchLng = latest.lng;

    // Query only the most recent position (not all 12 coordinates)
    const query = `way(around:30,${latest.lat},${latest.lng})["highway"];`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(${query});out body;`;

    axios.get(overpassUrl)
        .then(response => {
            const roads = response.data.elements;
            if (roads.length > 0) {
                const nearestRoad = roads[0];
                const speedLimit = nearestRoad.tags.maxspeed || "";
                const roadName   = nearestRoad.tags.name || nearestRoad.tags.ref || "";
                const roadType   = nearestRoad.tags.highway || "";

                updateRoadHistory(roadHistory, { roadName, speedLimit, roadType }, 3);
                if (isConsistentRoadData(roadHistory)) {
                    speedLimitDisplay.textContent = speedLimit || "–";
                    roadInfoDisplay.textContent   = roadName ? `${roadName} (${roadType})` : roadType;
                    if (typeof onLimitUpdate === 'function') onLimitUpdate(speedLimit);
                }
            } else {
                console.log("Ingen veje fundet i nærheden");
            }
        })
        .catch(error => {
            if (error.response && error.response.status === 429) {
                backoffUntil = Date.now() + BACKOFF_MS;
                console.warn("OSM rate limit (429) - venter 2 minutter");
            } else {
                console.error("Error fetching road data from OSM:", error);
            }
        });
}
