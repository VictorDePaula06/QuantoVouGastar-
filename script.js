// =============================
//  Importações
// =============================
import { initializeAuth } from "./src/auth.js";
import { initMap, initializeMapListeners } from "./src/map.js";
import { loadVeiculos, initializeVehicleListeners } from "./src/vehicle.js";
import { initializeCalculationListeners } from "./src/calculation.js";
import { loadLastCost, setupUIListeners } from "./src/utils.js";

// =============================
//  Inicialização Geral
// =============================
document.addEventListener("DOMContentLoaded", () => {
    loadLastCost();
    setupUIListeners();
    initializeVehicleListeners();
    initializeCalculationListeners();
    initializeAuth(loadVeiculos);
    initializeMapListeners();

    setupGeoButton(); // <-- adicionamos aqui
});

// =============================
//  Garantir que Google Maps carregou
// =============================
function googleLoaded() {
    return window.google && window.google.maps;
}

const loader = setInterval(() => {
    if (googleLoaded()) {
        clearInterval(loader);
        console.log("%cGoogle Maps API carregada com sucesso!", "color:#4ade80");
        initMap(); // <-- inicialização segura
    }
}, 50);


// =============================
//  🔥 Função Geolocalização
// =============================
function setupGeoButton() {
    const btn = document.getElementById("geolocalizacaoBtn");

    if (!btn) {
        console.warn("Botão de geolocalização não encontrado.");
        return;
    }

    btn.addEventListener("click", () => {
        if (!navigator.geolocation) {
            alert("Seu navegador não suporta geolocalização.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                const geocoder = new google.maps.Geocoder();
                const latlng = { lat, lng };

                geocoder.geocode({ location: latlng }, (results, status) => {
                    if (status === "OK" && results[0]) {

                        // Preenche o campo de origem
                        const origemInput = document.getElementById("origem");
                        if (origemInput) origemInput.value = results[0].formatted_address;

                        // Centraliza o mapa
                        if (window.map) {
                            window.map.setCenter(latlng);
                            window.map.setZoom(15);

                            new google.maps.Marker({
                                position: latlng,
                                map: window.map,
                                title: "Sua localização atual",
                            });
                        }

                        console.log("Localização detectada:", results[0].formatted_address);
                    } else {
                        alert("Não foi possível obter seu endereço.");
                    }
                });
            },

            (err) => {
                console.error("Erro ao obter localização:", err);
                alert("Não foi possível acessar sua localização.");
            }
        );
    });
}


// =============================
//  Exportação
// =============================
export { initMap };