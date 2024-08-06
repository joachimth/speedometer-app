import { getDistanceFromLatLonInKm } from './helpers.js';

export function checkForSpeedCameras(coordinates) {
    const query = coordinates.map(coord => `node(around:500,${coord.lat},${coord.lng})["highway"="speed_camera"];`).join('');
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(${query});out body;`;

    axios.get(overpassUrl)
        .then(response => {
            const cameras = response.data.elements;
            if (cameras.length > 0) {
                const camera = cameras[0];
                const { lat, lon } = coordinates[0];
                const distance = getDistanceFromLatLonInKm(lat, lon, camera.lat, camera.lon);
                console.log(`Fartkamera ${distance.toFixed(1)}m væk`);
            }
        })
        .catch(error => {
            console.error("Error checking for speed cameras:", error);
        });
}