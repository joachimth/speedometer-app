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

    button.addEventListener("click", manualStart);

    function updateSpeed(position) {
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

    function updateSpeedLimit(speedLimit) {
        speedLimitDisplay.textContent = speedLimit;
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
        const coordinatesString = coordinates.map(coord => `${coord.lat},${coord.lng}`).join(';');
        const query = `[out:json];(way(around:30,${coordinatesString})["highway"];);out body;`;
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

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
        const trafficAlertDiv = document.getElementById('roadinfo');
        trafficAlertDiv.style.display = 'block';
        trafficAlertDiv.textContent = `Advarsel: Fare nær! (${alert.address})`;
    }

    const tryGetSpeedLimit = async ($lat, $lon) => {
        let $eofstr = `[out:json];(way(around:10,${$lat},${$lon})[highway][maxspeed];);out tags;`;
        try {
            const response = await fetch($prodapi, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "text/plain;charset=UTF-8"
                },
                body: $eofstr
            });
            let $respjson = await response.json();
            $roadname = $respjson?.["elements"]?.[0]?.["tags"]?.["name"] ?? "N/A";
            $roadlimit = $respjson?.["elements"]?.[0]?.["tags"]?.["maxspeed"] ?? "N/A";
            return $respjson;
        } catch ($error) {
            return null;
        }
    };

    const showLimit = async ($position) => {
        const $respjson = await tryGetSpeedLimit($position.coords.latitude, $position.coords.longitude);
        $lastdata.push($respjson?.["elements"]?.[0]?.["tags"]?.["name"]);
        $roadname = $respjson?.["elements"]?.[0]?.["tags"]?.["name"] ?? "N/A";
        $roadlimit = $respjson?.["elements"]?.[0]?.["tags"]?.["maxspeed"] ?? "N/A";

        if ($lastdata.length >= 3) {
            for await (let $entry_roadname of $lastdata) {
                if ($i >= 2) { $i = -1; }
                if (!($entry_roadname == null || $entry_roadname == undefined)) {
                    $i++;
                    $roadnames[$i] = $entry_roadname ?? null;
                }
                break;
            }

            const $bool_allthree = $roadnames.every(function ($ename) {
                return $ename === $roadname;
            });

            if ($bool_allthree) {
                roadInfoDisplay.innerHTML = "Vej: " + $roadname;
                speedLimitDisplay.innerHTML = $roadlimit;
            }

            $lastdata = [];
        }
    };

    function manualStart() {
        if ($watchHandler_showPosition == null) {
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
            $info.innerHTML = "Geolocation is not supported by this browser.";
        }
    }

    function errorCallback($err) {
        navigator.geolocation.clearWatch($watchHandler_showPosition);
        tryGetLocation($maxage);
    }

    const showPosition = async ($position) => {
        let $speed = $position.coords.speed;
        let $accu = $position.coords.accuracy;
        let $ts = $position.timestamp;
        let $dpspeed = Math.round($speed * 3.6);
        speedDisplay.innerHTML = $dpspeed;

        let $dt = new Date($ts);
        $info.innerHTML = `Tid: ${$dt.toLocaleTimeString("da-DK")} <br>Nøjagtighed: ${Math.round($accu)} m`;
    };

    const $button = document.getElementById("clickme");
    $button.addEventListener("click", manualStart);
    document.addEventListener('readystatechange', event => {
        if (event.target.readyState === "complete") {
            manualStart();
        }
    });
});