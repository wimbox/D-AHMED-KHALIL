const https = require('https');

https.get('https://firestore.googleapis.com/v1/projects/prescription-app-70fc7/databases/(default)/documents/app_data/clinic_master_data?key=AIzaSyCDXpDM1Q--_1FQb0KumpyiBU6_5oTKcuI', (res) => {
    let size = 0;
    res.on('data', (chunk) => {
        size += chunk.length;
    });
    res.on('end', () => {
        console.log("Total bytes:", size);
        console.log("MB:", (size / (1024 * 1024)).toFixed(2));
    });
});
