// src/config.js
export const config = {
    firebase: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: "quantovougastar.firebaseapp.com",
        projectId: "quantovougastar",
        storageBucket: "quantovougastar.appspot.com",
        messagingSenderId: "591670557539",
        appId: "1:591670557539:web:b1061bc35df30cbd6b3156",
        measurementId: "G-XZ3Z2Y0T4E"
    },
    googleMapsKey: import.meta.env.VITE_GOOGLE_MAPS_KEY
};

console.log("Config loaded:", {
    firebaseKey: config.firebase.apiKey ? "Loaded (Starts with " + config.firebase.apiKey.substring(0, 4) + ")" : "MISSING",
    mapsKey: config.googleMapsKey ? "Loaded" : "MISSING"
});
