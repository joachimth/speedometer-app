document.addEventListener("DOMContentLoaded", function() {
    const speedDisplay = document.getElementById('speed-display');

    function updateSpeed(position) {
        const speedInKmh = (position.coords.speed * 3.6).toFixed(2);
        speedDisplay.textContent = speedInKmh;
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

    // Keep the screen awake
    // Note: This functionality might need additional implementation based on the browser.
    // No standard method exists as of my last update in January 2022.
});
