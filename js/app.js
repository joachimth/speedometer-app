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
                // Update UI with new speed limits
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
        const path = coordinates.map(coord => `${coord.lat},${coord.lng}`).join('|');
        const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&key=YOUR_API_KEY`;

        return axios.get(url)
            .then(response => response.data.snappedPoints)
            .catch(error => console.error("Error in snapToRoads:", error));
    }

    // Define the threshold for Snap to Roads API calls
    const SOME_THRESHOLD = 12; // Adjust based on your specific requirements
    const YOUR_API_KEY = "AIzaSyBiNnRq_bOUJ2i1gvmPz1Rzmp42eYd3-lg";
});
