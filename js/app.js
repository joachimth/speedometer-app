document.addEventListener("DOMContentLoaded", function() {
    const speedDisplay = document.getElementById('speed-display');
    let collectedCoordinates = [];

    function updateSpeed(position) {
        const speedInKmh = Math.round(position.coords.speed * 3.6);
        document.getElementById('speed-display').textContent = speedInKmh;

        // Collect coordinates
        collectedCoordinates.push({ lat: position.coords.latitude, lng: position.coords.longitude });

        // Call Snap to Roads when threshold is reached
        if (collectedCoordinates.length >= SOME_THRESHOLD) {
            snapToRoads(collectedCoordinates).then(snappedPoints => {
                // Use snapped points to get speed limits
                // Assuming the first snapped point is where we want to check the speed limit
                if (snappedPoints.length > 0) {
                    const { lat, lon } = snappedPoints[0].location;
                    getSpeedLimit(lat, lon);
                }
            });

            // Reset collected coordinates
            collectedCoordinates = [];
        }
    }

    function updateSpeedLimit(speedLimit) {
        document.getElementById('speed-limit').textContent = speedLimit;
    }

    function handleError(error) {
        console.warn('ERROR(' + error.code + '): ' + error.message);
    }

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updateSpeed, handleError, {
            enableHighAccuracy: true,
            maximumAge: 0
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }

    function snapToRoads(coordinates) {
    // Konverter koordinater til en streng, der kan bruges i Overpass API-forespørgslen
    // Brug et semikolon til at adskille koordinaterne
    const coordinatesString = coordinates.map(coord => `${coord.lat},${coord.lng}`).join(';');

    // Overpass API-forespørgsel for at finde veje tæt på de givne koordinater
    const query = `
        [out:json];
        (
            way(around:30, ${coordinatesString})["highway"];
        );
        out body;
    `;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    return axios.get(overpassUrl)
        .then(response => {
            return response.data.elements;
        })
        .catch(error => {
            console.error("Error in snapToRoads:", error);
            return [];
        });
}

        function getSpeedLimit(lat, lng) {
        const query = `
            [out:json];
            way
              (around:30,${lat},${lng})
              ["highway"];
            out body;
        `;
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        axios.get(overpassUrl)
            .then(response => {
                const roads = response.data.elements;
                if (roads.length > 0) {
                    const nearestRoad = roads[0];
                    const speedLimit = extractSpeedLimit(nearestRoad);
                    updateSpeedLimit(speedLimit);
                } else {
                    console.log("Ingen veje fundet i nærheden");
                }
            })
            .catch(error => {
                console.error("Error fetching road data from OSM:", error);
            });
    }

    function extractSpeedLimit(road) {
        if (road.tags && road.tags.maxspeed) {
            return road.tags.maxspeed;
        } else {
            return "Ukendt";
        }
    }

    const SOME_THRESHOLD = 12; // Adjust based on your specific requirements
});
