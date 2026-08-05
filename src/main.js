import "./style.css";
import { config } from "./config.js";
import { initializeAuth } from "./auth.js";
import { initMap, initializeMapListeners, setupGeoButton } from "./map.js";
import { loadVeiculos, initializeVehicleListeners } from "./vehicle.js";
import { initializeCalculationListeners } from "./calculation.js";
import { loadLastCost, setupUIListeners } from "./utils.js";
import { initTabs } from "./tabs.js";
import { loadAddresses, initializeAddressListeners } from "./address.js";
import { loadTrips } from "./trip.js";

function loadUserData() {
    loadVeiculos();
    loadAddresses();
    loadTrips();
}

// =============================
//  Carregamento Dinâmico do Maps
// =============================
function loadMapsScript() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        // Nota: o callback=initMap na URL é um padrão da API, mas como estamos carregando dinamicamente,
        // vamos resolver a promise no onload e chamar initMap manualmente se necessário.


        // Nota: initMap agora é chamado manualmente após carregamento
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsKey}&libraries=places,geometry&language=pt-BR&region=BR`;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}


// =============================
//  Inicialização Geral
// =============================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadMapsScript();
        console.log("%cGoogle Maps API carregada com sucesso!", "color:#4ade80");

        // Inicializa o mapa
        initMap();

        // Inicializa o resto
        loadLastCost();
        setupUIListeners();
        initTabs();
        initializeVehicleListeners();
        initializeAddressListeners();
        initializeCalculationListeners();
        initializeAuth(loadUserData);
        initializeMapListeners();
        setupGeoButton();

    } catch (e) {
        console.error("Erro ao inicializar:", e);
        alert("Erro ao carregar aplicação. Verifique o console.");
    }

    // PWA: registra o service worker para permitir "Adicionar à tela inicial"
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Falha ao registrar service worker:", e));
    }
});