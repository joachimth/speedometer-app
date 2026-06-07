export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Return in meters
}

export function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

export function calculateDirection(lat1, lon1, lat2, lon2) {
    const toRadians = (deg) => deg * Math.PI / 180;
    const toDegrees = (rad) => rad * 180 / Math.PI;

    const dLon = toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
    const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
              Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
    const brng = Math.atan2(y, x);

    return (toDegrees(brng) + 360) % 360; // Retning i grader
}

export function updateRoadHistory(roadHistory, roadData, ROAD_CHECK_THRESHOLD) {
    if (roadHistory.length >= ROAD_CHECK_THRESHOLD) {
        roadHistory.shift(); // Fjern det ældste opslag
    }
    roadHistory.push(roadData);
}

export function isConsistentRoadData(roadHistory, threshold = 3) {
    if (roadHistory.length < threshold) return false;
    return roadHistory.every(rd => rd.roadName === roadHistory[0].roadName && rd.speedLimit === roadHistory[0].speedLimit);
}

// Bearing in degrees (0-360) from one coordinate to another
export function bearingDeg(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Smallest angle between two bearings (0-180)
export function angleDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

// Filter out GPS outliers by direction consistency, then return averaged position.
//
// Strategy:
// 1. Calculate bearing for each segment between consecutive points (skip segments < 5m - GPS jitter at standstill)
// 2. Find median bearing across all valid segments
// 3. Discard points whose inbound bearing deviates > 45° from median
// 4. Average the remaining points
//
// This removes the occasional GPS spike that would send the OSM query to a wrong location.
export function getFilteredPosition(coordinates) {
    if (coordinates.length < 3) return coordinates[coordinates.length - 1];

    const MIN_SEGMENT_M = 5; // ignore segments shorter than this (noise at low speed / standstill)

    // Build (pointIndex, bearing) pairs for meaningful segments
    const segments = [];
    for (let i = 1; i < coordinates.length; i++) {
        const prev = coordinates[i - 1];
        const curr = coordinates[i];
        // Quick planar approximation for short distances (good enough for outlier detection)
        const dLat = (curr.lat - prev.lat) * 111320;
        const dLng = (curr.lng - prev.lng) * 111320 * Math.cos(prev.lat * Math.PI / 180);
        const dist  = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist >= MIN_SEGMENT_M) {
            segments.push({ idx: i, bearing: bearingDeg(prev, curr), dist });
        }
    }

    if (segments.length < 2) {
        // Not enough movement to judge direction - use last point as-is
        return coordinates[coordinates.length - 1];
    }

    // Median bearing (robust against a few wild outliers)
    const sorted = [...segments].sort((a, b) => a.bearing - b.bearing);
    const medianBearing = sorted[Math.floor(sorted.length / 2)].bearing;

    // Keep points whose inbound bearing is within 45° of median
    const MAX_DEV = 45;
    const goodIdx = new Set(
        segments
            .filter(s => angleDiff(s.bearing, medianBearing) <= MAX_DEV)
            .map(s => s.idx)
    );

    const filtered = coordinates.filter((_, i) => goodIdx.has(i));

    const discarded = coordinates.length - filtered.length;
    if (discarded > 0) {
        console.log(`[GPS filter] ${discarded}/${coordinates.length} punkter fjernet (retningsafvigelse > ${MAX_DEV}°)`);
    }

    if (filtered.length === 0) return coordinates[coordinates.length - 1];

    const avgLat = filtered.reduce((sum, c) => sum + c.lat, 0) / filtered.length;
    const avgLng = filtered.reduce((sum, c) => sum + c.lng, 0) / filtered.length;
    return { lat: avgLat, lng: avgLng };
}