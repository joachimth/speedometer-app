document.addEventListener("DOMContentLoaded", function() {
    const speedDisplay = document.getElementById('speed-display');

    function updateSpeed(position) {
        const speedInKmh = Math.round(position.coords.speed * 3.6);
    document.getElementById('speed-display').textContent = speedInKmh;
    // Opdater hastighedsgrænsen her, når du har data
    }

// Antag at du har en funktion til at hente hastighedsgrænsen
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
    
function getSpeedLimit(lat, lng) {
    const apiKey = 'AIzaSyBiNnRq_bOUJ2i1gvmPz1Rzmp42eYd3-lg';
    const url = `https://roads.googleapis.com/v1/speedLimits?path=${lat},${lng}&key=${apiKey}`;

    axios.get(url)
        .then(response => {
            const speedLimit = response.data.speedLimits[0].speedLimit;
            // Opdater din UI med hastighedsgrænsen
        })
        .catch(error => {
            console.error("Error fetching speed limit:", error);
        });
}

    // Keep the screen awake
    // Note: This functionality might need additional implementation based on the browser.
    // No standard method exists as of my last update in January 2022.
});
