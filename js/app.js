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
    // Opret en separat Overpass API-forespørgsel for hver koordinat
    const queries = coordinates.map(coord => 
        `way(around:30,${coord.lat},${coord.lng})["highway"];`
    ).join('');

    const query = `
        [out:json];
        (
            ${queries}
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
