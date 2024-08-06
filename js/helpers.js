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

export function isConsistentRoadData(roadHistory) {
    if (roadHistory.length < ROAD_CHECK_THRESHOLD) return false;
    return roadHistory.every(rd => rd.roadName === roadHistory[0].roadName && rd.speedLimit === roadHistory[0].speedLimit);
}