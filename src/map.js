// src/map.js
import { showMessage, updateDistanceDisplay, formatDuration } from "./utils.js";

// Variáveis globais do mapa
export let map, directionsService, directionsRenderer;
let originMarker, destinationMarker, parada1Marker, parada2Marker;
let autocompleteOrigin, autocompleteDestination, autocompleteParada1, autocompleteParada2;
let distanciaIdaPura = 0;
let currentRoutesResult = null; // Armazena o resultado completo da rota
let currentTollCost = 0; // Custo do pedágio da rota selecionada

// ===== Inicializar Google Maps =====
export function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 5,
        center: { lat: -14.2350, lng: -51.9253 },
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: false,
        panel: null,
        polylineOptions: { strokeColor: "#60a5fa", strokeWeight: 5, strokeOpacity: 0.9 }
    });
    directionsRenderer.setMap(map);
    setupAutocomplete();
}

// ===== Autocomplete e Marcadores =====
function setupAutocomplete() {
    const originInput = document.getElementById("origem");
    const destinationInput = document.getElementById("destino");
    const parada1Input = document.getElementById("parada1");
    const parada2Input = document.getElementById("parada2");

    autocompleteOrigin = new google.maps.places.Autocomplete(originInput, { componentRestrictions: { country: "br" }, fields: ["place_id", "geometry", "name", "formatted_address"] });
    autocompleteDestination = new google.maps.places.Autocomplete(destinationInput, { componentRestrictions: { country: "br" }, fields: ["place_id", "geometry", "name", "formatted_address"] });
    autocompleteParada1 = new google.maps.places.Autocomplete(parada1Input, { componentRestrictions: { country: "br" }, fields: ["place_id", "geometry", "name", "formatted_address"] });
    autocompleteParada2 = new google.maps.places.Autocomplete(parada2Input, { componentRestrictions: { country: "br" }, fields: ["place_id", "geometry", "name", "formatted_address"] });

    autocompleteOrigin.addListener("place_changed", () => { const place = autocompleteOrigin.getPlace(); if (place.geometry) updateOriginMarker(place); });
    autocompleteDestination.addListener("place_changed", () => { const place = autocompleteDestination.getPlace(); if (place.geometry) updateDestinationMarker(place); });
    autocompleteParada1.addListener("place_changed", () => { const place = autocompleteParada1.getPlace(); if (place.geometry) updateParadaMarker(place, 1); });
    autocompleteParada2.addListener("place_changed", () => { const place = autocompleteParada2.getPlace(); if (place.geometry) updateParadaMarker(place, 2); });
}

function updateOriginMarker(place) {
    if (originMarker) originMarker.setMap(null);
    originMarker = new google.maps.Marker({ position: place.geometry.location, map, title: "Origem: " + place.name });
    if (originMarker && destinationMarker) fitMapToMarkers();
}
function updateDestinationMarker(place) {
    if (destinationMarker) destinationMarker.setMap(null);
    destinationMarker = new google.maps.Marker({ position: place.geometry.location, map, title: "Destino: " + place.name });
    if (originMarker && destinationMarker) fitMapToMarkers();
}
function updateParadaMarker(place, index) {
    const iconColor = index === 1 ? '#f59e0b' : '#d97706';
    if (index === 1) { if (parada1Marker) parada1Marker.setMap(null); parada1Marker = new google.maps.Marker({ position: place.geometry.location, map, title: "Parada 1: " + place.name }); }
    else { if (parada2Marker) parada2Marker.setMap(null); parada2Marker = new google.maps.Marker({ position: place.geometry.location, map, title: "Parada 2: " + place.name }); }
    if (originMarker && destinationMarker) fitMapToMarkers();
}
function fitMapToMarkers() {
    try {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(originMarker.getPosition());
        bounds.extend(destinationMarker.getPosition());
        if (parada1Marker) bounds.extend(parada1Marker.getPosition());
        if (parada2Marker) bounds.extend(parada2Marker.getPosition());
        map.fitBounds(bounds);
        google.maps.event.addListenerOnce(map, 'bounds_changed', function () { if (map.getZoom() > 15) map.setZoom(15); });
    } catch (e) { /* ignore */ }
}

// ===== Funções de Rota =====
function displayRouteOptions(routes) {
    const container = document.getElementById('routeOptionsContainer');
    const list = document.getElementById('routeOptionsList');
    list.innerHTML = '';

    if (routes.length > 1) {
        container.classList.remove('hidden');
        routes.forEach((route, index) => {
            const totalDistanceMeters = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
            const totalDurationSeconds = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
            const distanceKm = (totalDistanceMeters / 1000).toFixed(2);
            const durationText = formatDuration(totalDurationSeconds);

            const hasTolls = route.warnings.some(w => w.includes('tolls'));
            const tollCost = hasTolls ? -1 : 0;

            const card = document.createElement('div');
            card.className = `route-option-card ${index === 0 ? 'selected' : ''}`;
            card.dataset.routeIndex = index;
            card.dataset.tollCost = tollCost;
            card.innerHTML = `
                <div class="route-title flex justify-between items-center">
                    <span>${route.summary}</span>
                    ${index === 0 ? '<i class="fas fa-check-circle text-accent-green"></i>' : ''}
                </div>
                <div class="route-details">
                    Distância: ${distanceKm} km | Tempo: ${durationText}
                </div>
                ${tollCost === -1 ? '<div class="toll-info-card"><i class="fas fa-road mr-1"></i> Pedágio: <span class="toll-value">Presente (Custo Desconhecido)</span></div>' : ''}
            `;
            card.addEventListener('click', () => selectRoute(index));
            list.appendChild(card);
        });
    } else {
        container.classList.add('hidden');
    }
}

export function selectRoute(index) {
    if (!currentRoutesResult || !currentRoutesResult.routes[index]) return;

    directionsRenderer.setRouteIndex(index);

    const selectedRoute = currentRoutesResult.routes[index];
    const totalDistanceMeters = selectedRoute.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    distanciaIdaPura = totalDistanceMeters / 1000;

    const selectedTollCost = parseFloat(document.querySelector(`.route-option-card[data-route-index="${index}"]`).dataset.tollCost);
    currentTollCost = selectedTollCost === -1 ? 0 : selectedTollCost;

    const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;
    updateDistanceDisplay(distanciaIdaPura, idaEVoltaChecked);

    document.querySelectorAll('.route-option-card').forEach(card => {
        card.classList.remove('selected');
        const checkIcon = card.querySelector('.fa-check-circle');
        if (checkIcon) checkIcon.remove();

        if (parseInt(card.dataset.routeIndex) === index) {
            card.classList.add('selected');
            const checkIconNew = document.createElement('i');
            checkIconNew.className = 'fas fa-check-circle text-accent-green';
            card.querySelector('.route-title').appendChild(checkIconNew);
        }
    });

    showMessage(`Rota ${index + 1} selecionada. Distância atualizada.`, "info");
}

export function calcularDistancia() {
    const origem = document.getElementById("origem").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const parada1 = document.getElementById("parada1").value.trim();
    const parada2 = document.getElementById("parada2").value.trim();
    if (!origem || !destino) { showMessage("Informe origem e destino!", "error"); return; }
    const btn = document.getElementById("calcularDistanciaBtn"); btn.classList.add("loading"); btn.disabled = true;

    document.getElementById('routeOptionsContainer').classList.add('hidden');
    document.getElementById('routeOptionsList').innerHTML = '';
    currentRoutesResult = null;
    currentTollCost = 0;

    const waypoints = [];
    if (parada1) waypoints.push({ location: parada1, stopover: true });
    if (parada2) waypoints.push({ location: parada2, stopover: true });

    const request = {
        origin: origem,
        destination: destino,
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false,
        provideRouteAlternatives: true
    };

    directionsService.route(request, (result, status) => {
        btn.classList.remove("loading"); btn.disabled = false;
        if (status === "OK") {
            currentRoutesResult = result;

            directionsRenderer.setDirections(result);
            directionsRenderer.setRouteIndex(0);

            let totalDistanceMeters = 0;
            result.routes[0].legs.forEach(leg => totalDistanceMeters += leg.distance.value);
            const distanceKm = totalDistanceMeters / 1000;
            distanciaIdaPura = distanceKm;
            const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;
            updateDistanceDisplay(distanciaIdaPura, idaEVoltaChecked);

            if (originMarker) originMarker.setMap(null); if (destinationMarker) destinationMarker.setMap(null); if (parada1Marker) parada1Marker.setMap(null); if (parada2Marker) parada2Marker.setMap(null);

            showMessage(`Rota calculada: ${distanceKm.toFixed(2)} km (incluindo paradas). ${result.routes.length > 1 ? 'Veja as opções alternativas abaixo.' : ''}`);

            displayRouteOptions(result.routes);

            selectRoute(0);

        } else { showMessage("Erro ao calcular rota. Verifique os endereços informados.", "error"); console.error("Erro na API de Direções:", status); }
    });
}

export function initializeMapListeners() {
    document.getElementById("calcularDistanciaBtn").addEventListener("click", calcularDistancia);
}

export function getDistanciaIdaPura() {
    return distanciaIdaPura;
}

export function getCurrentTollCost() {
    return currentTollCost;
}

export function getCurrentRoutesResult() {
    return currentRoutesResult;
}

export function getDirectionsRenderer() {
    return directionsRenderer;
}

// Função para capturar a tela do mapa
export async function captureMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) {
        showMessage("Elemento do mapa não encontrado.", "error");
        return null;
    }

    // O html2canvas precisa de um pequeno delay para garantir que o mapa esteja totalmente renderizado
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        const canvas = await html2canvas(mapElement, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            // Ajuste para garantir que apenas a área visível do mapa seja capturada
            width: mapElement.offsetWidth,
            height: mapElement.offsetHeight
        });
        return canvas.toDataURL("image/jpeg", 0.8); // Retorna a imagem em base64
    } catch (error) {
        console.error("Erro ao capturar o mapa:", error);
        showMessage("Erro ao capturar o mapa para o relatório.", "error");
        return null;
    }
}