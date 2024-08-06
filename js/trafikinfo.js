// import { getDistanceFromLatLonInKm } from './helpers.js';

// export function getTrafficAlerts(lat, lng) {
//     const url = `https://api.trafikalarm.dk/v2/pins?north-latitude=${lat + 0.01}&south-latitude=${lat - 0.01}&west-longitude=${lng - 0.01}&east-longitude=${lng + 0.01}&limit=200`;
//     const headers = {
//         'Content-Type': 'application/json',
//         'Authorization': 'Local YOUR_AUTH_TOKEN'
//     };

//     axios.get(url, { headers: headers })
//         .then(response => {
//             const alerts = response.data.items;
//             checkProximityToAlerts(lat, lng, alerts);
//         })
//         .catch(error => {
//             console.error("Error fetching traffic alerts:", error);
//         });
// }

// function checkProximityToAlerts(userLat, userLng, alerts) {
//     alerts.forEach(alert => {
//         const distance = getDistanceFromLatLonInKm(userLat, userLng, alert.latitude, alert.longitude);
//         if (distance <= 1) {
//             console.log(`Advarsel: Fare nær! (${alert.address})`);
//         }
//     });
// }