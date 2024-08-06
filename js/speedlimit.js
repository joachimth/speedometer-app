import { updateRoadHistory, isConsistentRoadData } from './helpers.js';

export function getSpeedLimit(coordinates, roadHistory, speedLimitDisplay, roadInfoDisplay) {
    const query = coordinates.map(coord => `way(around:30,${coord.lat},${coord.lng})["highway"];`).join('');
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(${query});out body;`;

    axios.get(overpassUrl)
        .then(response => {
            const roads = response.data.elements;
            if (roads.length > 0) {
                const nearestRoad = roads[0];
                const speedLimit = nearestRoad.tags.maxspeed || "Ukendt";
                const roadName = nearestRoad.tags.name || nearestRoad.tags.ref || "Ukendt";
                const roadType = nearestRoad.tags.highway || "Ukendt";

                updateRoadHistory(roadHistory, { roadName, speedLimit, roadType }, 3);
                if (isConsistentRoadData(roadHistory)) {
                    speedLimitDisplay.textContent = `${speedLimit}`;
                    roadInfoDisplay.textContent = `Vej: ${roadName} (${roadType})`;
                }
            } else {
                console.log("Ingen veje fundet i nærheden");
            }
        })
        .catch(error => {
            console.error("Error fetching road data from OSM:", error);
        });
}