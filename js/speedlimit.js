import { updateRoadHistory, isConsistentRoadData, getFilteredPosition } from './helpers.js';

// Gate: min 5s OR min 50m moved. Skip if request already in flight.
// The 429 was caused by 12-coordinate batch queries, not frequency.
// A single-node query every 5s is well within Overpass fair use.
let lastFetchTime = 0;
let lastFetchLat = null;
let lastFetchLng = null;
let backoffUntil = 0;
let inFlight = false;

const MIN_FETCH_INTERVAL_MS = 5000; // 5s - at 80km/h = ~110m max lag
const MIN_DISTANCE_M = 50;          // 50m - catches zone boundaries promptly
const BACKOFF_MS = 60000;           // 60s backoff on 429

export function haversineMeters(lat1, lng1, lat2, lng2) {
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
    const latest = getFilteredPosition(coordinates);

    if (now < backoffUntil) return;
    if (inFlight) return;
    if (now - lastFetchTime < MIN_FETCH_INTERVAL_MS) return;
    if (lastFetchLat !== null) {
        const dist = haversineMeters(lastFetchLat, lastFetchLng, latest.lat, latest.lng);
        if (dist < MIN_DISTANCE_M) return;
    }

    lastFetchTime = now;
    lastFetchLat = latest.lat;
    lastFetchLng = latest.lng;
    inFlight = true;

    const query = `[out:json];(way(around:30,${latest.lat},${latest.lng})["highway"];);out body;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    console.log(`[OSM] Henter hastighedsgrænse @ ${latest.lat.toFixed(5)}, ${latest.lng.toFixed(5)}`);

    axios.get(overpassUrl)
        .then(response => {
            const roads = response.data.elements;
            console.log(`[OSM] Svar: ${roads.length} vej(e) fundet`);

            if (roads.length === 0) {
                console.log("[OSM] Ingen veje i nærheden");
                return;
            }

            const nearestRoad = roads[0];
            const speedLimit = nearestRoad.tags?.maxspeed || "";
            const roadName   = nearestRoad.tags?.name || nearestRoad.tags?.ref || "";
            const roadType   = nearestRoad.tags?.highway || "";

            console.log(`[OSM] Vej: "${roadName}" (${roadType}) | maxspeed: "${speedLimit || 'ikke sat'}"`);

            updateRoadHistory(roadHistory, { roadName, speedLimit, roadType }, 3);
            console.log(`[OSM] Historik (${roadHistory.length}/3):`, roadHistory.map(r => r.speedLimit || '–'));

            // Show speed limit immediately when we have one.
            // History is used to debounce road-name flicker on roadInfo, not to gate the speed limit itself.
            if (speedLimit) {
                speedLimitDisplay.textContent = speedLimit;
                if (typeof onLimitUpdate === 'function') onLimitUpdate(speedLimit);
                console.log(`[OSM] Viser hastighedsgrænse: ${speedLimit}`);
            } else {
                console.log("[OSM] Ingen maxspeed-tag på denne vej");
            }

            // Road info: only update when history is consistent (avoids flicker at intersections)
            if (isConsistentRoadData(roadHistory)) {
                roadInfoDisplay.textContent = roadName ? `${roadName} (${roadType})` : roadType;
            } else {
                console.log("[OSM] Historik endnu ikke konsistent - venter med at vise vejnavn");
            }
        })
        .catch(error => {
            if (error.response && error.response.status === 429) {
                backoffUntil = Date.now() + BACKOFF_MS;
                console.warn("[OSM] Rate limit (429) - venter 60s");
            } else {
                console.error("[OSM] Fejl ved hentning:", error.message || error);
            }
        })
        .finally(() => { inFlight = false; });
}
