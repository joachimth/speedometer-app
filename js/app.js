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
    let $watchHandler_showPosition = null;
    let $watchHandler_showLimit = null;

    button.addEventListener("click", manualStart);

    function manualStart() {
        if ($watchHandler_showPosition === null) {
            tryGetLocation();
            document.getElementById("icon-start").style.display = "none";
            document.getElementById("icon-ok").style.display = "inline-block";
        }
    }

    function tryGetLocation($maxage = 0) {
        const options = {
            enableHighAccuracy: true,
            timeout: Infinity,
            maximumAge: $maxage
        };

        if (navigator.geolocation) {
            $watchHandler_showPosition = navigator.geolocation.watchPosition(showPosition, errorCallback, options);
            $watchHandler_showLimit = navigator.geolocation.watchPosition(showLimit, errorCallback, options);
        } else {
            console.error("Geolocation is not supported by this browser.");
        }
    }

    function errorCallback(error) {
        navigator.geolocation.clearWatch($watchHandler_showPosition);
        tryGetLocation();
    }

    function showPosition(position) {
        const speedInKmh = Math.round(position.coords.speed * 3.6);
        speedDisplay.textContent = speedInKmh;

        collectedCoordinates.push({ lat: position.coords.latitude, lng: position.coords.longitude });

        if (collectedCoordinates.length >= SOME_THRESHOLD) {
            snapToRoads(collectedCoordinates).then(snappedPoints => {
                if (snappedPoints.length > 0) {
                    const { lat, lon } = snappedPoints[0];
                    getSpeedLimit(lat, lon);
                    getTrafficAlerts(lat, lon);
                }
            });
            collectedCoordinates = [];
        }
    }

    function showLimit(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        getSpeedLimit(lat, lon);
    }

    function snapToRoads(coordinates) {
        const query = coordinates.map(coord => `way(around:30,${coord.lat},${coord.lng})["highway"];`).join('');
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(${query});out body;`;

        return axios.get(overpassUrl)
            .then(response => response.data.elements)
            .catch(error => {
                console.error("Error in snapToRoads:", error);
                return [];
            });
    }

    function getSpeedLimit(lat, lng) {
        const query = `[out:json];way(around:30,${lat},${lng})["highway"];out body;`;
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        axios.get(overpassUrl)
            .then(response => {
                const roads = response.data.elements;
                if (roads.length > 0) {
                    const nearestRoad = roads[0];
                    const speedLimit = nearestRoad.tags && nearestRoad.tags.maxspeed ? nearestRoad.tags.maxspeed : "Ukendt";
                    updateSpeedLimit(speedLimit);
                } else {
                    console.log("Ingen veje fundet i nærheden");
                }
            })
            .catch(error => {
                console.error("Error fetching road data from OSM:", error);
            });
    }

    function getTrafficAlerts(lat, lng) {
        const url = `https://api.trafikalarm.dk/v2/pins?north-latitude=${lat + 0.01}&south-latitude=${lat - 0.01}&west-longitude=${lng - 0.01}&east-longitude=${lng + 0.01}&limit=200`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Local YOUR_AUTH_TOKEN'
        };

        axios.get(url, { headers: headers })
            .then(response => {
                const alerts = response.data.items;
                checkProximityToAlerts(lat, lng, alerts);
            })
            .catch(error => {
                console.error("Error fetching traffic alerts:", error);
            });
    }

    function checkProximityToAlerts(userLat, userLng, alerts) {
        alerts.forEach(alert => {
            const distance = getDistanceFromLatLonInKm(userLat, userLng, alert.latitude, alert.longitude);
            if (distance <= 1) {
                showTrafficAlert(alert);
            }
        });
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    function deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    function showTrafficAlert(alert) {
        roadInfoDisplay.style.display = 'block';
        roadInfoDisplay.textContent = `Advarsel: Fare nær! (${alert.address})`;
    }
});