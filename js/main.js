import { initLocation } from './location.js';
import { getSpeedLimit } from './speedlimit.js';
import { checkForSpeedCameras } from './speedcamera.js';
import { calculateDirection } from './helpers.js';
// import { getTrafficAlerts } from './trafikinfo.js'; // Disabled for now

document.addEventListener("DOMContentLoaded", function() {
    const speedDisplay      = document.getElementById('speed');
    const speedLimitDisplay = document.getElementById('speedlimit');
    const roadInfoDisplay   = document.getElementById('roadinfo');
    const button            = document.getElementById('clickme');
    const gpsDot            = document.getElementById('gps-dot');
    const gpsLabel          = document.getElementById('gps-label');

    if (!speedDisplay || !speedLimitDisplay || !roadInfoDisplay || !button) {
        console.error("Nødvendige DOM-elementer blev ikke fundet.");
        return;
    }

    let collectedCoordinates = [];
    const SOME_THRESHOLD = 12;
    const ROAD_CHECK_THRESHOLD = 3;
    let roadHistory = [];
    let $watchHandler_showPosition = null;
    let wakeLock = null;
    let currentSpeedLimit = null;

    // Re-acquire wake lock when page becomes visible again
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && $watchHandler_showPosition !== null) {
            await requestWakeLock();
        }
    });

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.warn('Wake lock request failed:', err);
            }
        }
    }

    async function releaseWakeLock() {
        if (wakeLock) {
            try { await wakeLock.release(); } catch (err) { /* ignore */ }
            wakeLock = null;
        }
    }

    button.addEventListener("click", manualStart);

    async function manualStart() {
        if ($watchHandler_showPosition === null) {
            $watchHandler_showPosition = initLocation(showPosition, errorCallback);
            document.getElementById("icon-start").style.display = "none";
            document.getElementById("icon-ok").style.display = "inline-block";
            button.classList.add('running');
            setGpsActive(true);
            await requestWakeLock();
        }
    }

    function setGpsActive(active) {
        if (gpsDot)   gpsDot.classList.toggle('active', active);
        if (gpsLabel) {
            gpsLabel.textContent = active ? 'GPS aktiv' : 'Venter';
            gpsLabel.classList.toggle('active', active);
        }
    }

    function showPosition(position) {
        const speedMs   = position.coords.speed;
        const speedInKmh = (speedMs != null && !isNaN(speedMs)) ? Math.round(speedMs * 3.6) : null;
        const displaySpeed = speedInKmh != null ? speedInKmh : '-';
        speedDisplay.textContent = displaySpeed;

        // Over-limit color
        if (currentSpeedLimit && speedInKmh != null) {
            const limit = parseInt(currentSpeedLimit, 10);
            speedDisplay.classList.toggle('over-limit', !isNaN(limit) && speedInKmh > limit);
        }

        if (collectedCoordinates.length > 0) {
            const last = collectedCoordinates[collectedCoordinates.length - 1];
            const direction = calculateDirection(
                last.lat, last.lng,
                position.coords.latitude, position.coords.longitude
            );
            console.log(`Kører i retning: ${direction.toFixed(1)}°`);
        }

        collectedCoordinates.push({ lat: position.coords.latitude, lng: position.coords.longitude });

        if (collectedCoordinates.length >= SOME_THRESHOLD) {
            getSpeedLimit(collectedCoordinates, roadHistory, speedLimitDisplay, roadInfoDisplay, onSpeedLimitUpdate);
            checkForSpeedCameras(collectedCoordinates);
            collectedCoordinates = [];
        }
    }

    function onSpeedLimitUpdate(limit) {
        currentSpeedLimit = limit;
    }

    function errorCallback(error) {
        console.error("Geolocation error:", error);
        setGpsActive(false);
        releaseWakeLock();
    }
});
