import { initLocation } from './location.js';
import { getSpeedLimit } from './speedlimit.js';
import { checkForSpeedCameras } from './speedcamera.js';
// import { getTrafficAlerts } from './trafikinfo.js'; // Disabled for now

document.addEventListener("DOMContentLoaded", function() {
    const speedDisplay = document.getElementById('speed');
    const speedLimitDisplay = document.getElementById('speedlimit');
    const roadInfoDisplay = document.getElementById('roadinfo');
    const button = document.getElementById('clickme');

    if (!speedDisplay || !speedLimitDisplay || !roadInfoDisplay || !button) {
        console.error("Nødvendige DOM-elementer blev ikke fundet.");
        return;
    }

    let collectedCoordinates = [];
    const SOME_THRESHOLD = 12;
    const ROAD_CHECK_THRESHOLD = 3; // Antal af ens vejopslag
    let roadHistory = []; // Holder de seneste vejopslag
    let $watchHandler_showPosition = null;

    button.addEventListener("click", manualStart);

    function manualStart() {
        if ($watchHandler_showPosition === null) {
            $watchHandler_showPosition = initLocation(showPosition, errorCallback);
            document.getElementById("icon-start").style.display = "none";
            document.getElementById("icon-ok").style.display = "inline-block";
        }
    }

    function showPosition(position) {
        const speedInKmh = Math.round(position.coords.speed * 3.6);
        speedDisplay.textContent = isNaN(speedInKmh) ? '-' : speedInKmh;

        if (collectedCoordinates.length > 0) {
            const lastPosition = collectedCoordinates[collectedCoordinates.length - 1];
            const direction = calculateDirection(
                lastPosition.lat, lastPosition.lng,
                position.coords.latitude, position.coords.longitude
            );
            console.log(`Kører i retning: ${direction.toFixed(2)}°`);
        }

        collectedCoordinates.push({ lat: position.coords.latitude, lng: position.coords.longitude });

        if (collectedCoordinates.length >= SOME_THRESHOLD) {
            getSpeedLimit(collectedCoordinates, roadHistory, speedLimitDisplay, roadInfoDisplay);
            checkForSpeedCameras(collectedCoordinates);
            collectedCoordinates = [];
        }
    }

    function errorCallback(error) {
        console.error("Geolocation error:", error);
    }
});