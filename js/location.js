export function initLocation(showPosition, errorCallback) {
    const options = {
        enableHighAccuracy: true,
        timeout: Infinity,
        maximumAge: 0
    };

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(showPosition, errorCallback, options);
    } else {
        console.error("Geolocation is not supported by this browser.");
    }
}