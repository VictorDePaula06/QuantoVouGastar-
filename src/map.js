// src/map.js
import { showMessage, updateDistanceDisplay, formatDuration } from "./utils.js";
import html2canvas from "html2canvas";
import { fetchTollEstimates } from "./tollService.js";
import { runRouteRace, clearRace } from "./routeRace.js";

// Variáveis globais do mapa
export let map, directionsService, directionsRenderer;
let originMarker, destinationMarker, parada1Marker, parada2Marker;
let autocompleteOrigin, autocompleteDestination, autocompleteParada1, autocompleteParada2;
let distanciaIdaPura = 0;
let currentRoutesResult = null; // Armazena o resultado completo da rota
let currentTollCost = 0; // Custo do pedágio da rota selecionada
let tollEstimates = null; // Array de estimativas de pedágio (Routes API), uma por rota
const lastPlaces = {}; // Último place (com geometry) selecionado por campo: origem, destino, parada1, parada2

// ===== Inicializar Google Maps =====
export function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 5,
        center: { lat: -14.2350, lng: -51.9253 },
        mapTypeControl: true,
        mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
        streetViewControl: false,
        fullscreenControl: true,
        fullscreenControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
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

    autocompleteOrigin.addListener("place_changed", () => { const place = autocompleteOrigin.getPlace(); if (place.geometry) { lastPlaces.origem = place; updateOriginMarker(place); } });
    autocompleteDestination.addListener("place_changed", () => { const place = autocompleteDestination.getPlace(); if (place.geometry) { lastPlaces.destino = place; updateDestinationMarker(place); } });
    autocompleteParada1.addListener("place_changed", () => { const place = autocompleteParada1.getPlace(); if (place.geometry) { lastPlaces.parada1 = place; updateParadaMarker(place, 1); } });
    autocompleteParada2.addListener("place_changed", () => { const place = autocompleteParada2.getPlace(); if (place.geometry) { lastPlaces.parada2 = place; updateParadaMarker(place, 2); } });
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

// ===== Corrida das rotas (efeito visual) =====
function markWinnerCard(index) {
    const card = document.querySelector(`.route-option-card[data-route-index="${index}"]`);
    if (!card) return;
    const title = card.querySelector('.route-title');
    if (title && !title.querySelector('.race-winner-badge')) {
        const badge = document.createElement('span');
        badge.className = 'race-winner-badge';
        badge.innerHTML = '<i class="fas fa-trophy mr-1"></i>Mais rápida';
        title.querySelector('span').after(badge);
    }
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

            let tollHtml = '';
            const tollEstimate = tollEstimates ? tollEstimates[index] : undefined;
            if (tollEstimate) {
                tollHtml = `<div class="toll-info-card"><i class="fas fa-road mr-1"></i> Pedágio estimado: <span class="toll-value">R$ ${tollEstimate.value.toFixed(2)}</span></div>`;
            } else if (tollEstimate === undefined) {
                // Estimativa via API indisponível: cai no aviso genérico baseado nos avisos do Directions
                const hasTolls = route.warnings.some(w => w.toLowerCase().includes('tolls') || w.toLowerCase().includes('pedágio'));
                if (hasTolls) tollHtml = '<div class="toll-info-card"><i class="fas fa-road mr-1"></i> Pedágio: <span class="toll-value">Presente (Custo Desconhecido)</span></div>';
            }

            const card = document.createElement('div');
            card.className = `route-option-card ${index === 0 ? 'selected' : ''}`;
            card.dataset.routeIndex = index;
            card.innerHTML = `
                <div class="route-title flex justify-between items-center">
                    <span>${route.summary}</span>
                    ${index === 0 ? '<i class="fas fa-check-circle text-accent-green"></i>' : ''}
                </div>
                <div class="route-details">
                    Distância: ${distanceKm} km | Tempo: ${durationText}
                </div>
                ${tollHtml}
            `;
            card.addEventListener('click', () => selectRoute(index));
            list.appendChild(card);
        });
    } else {
        container.classList.add('hidden');
    }
}

function updateTollBanner(tollEstimate, tollDataAvailable) {
    const banner = document.getElementById('tollStatusBanner');
    const mapBadge = document.getElementById('tollMapBadge');
    const mapBadgeText = document.getElementById('tollMapBadgeText');

    if (!tollDataAvailable) {
        if (banner) { banner.classList.add('hidden'); banner.innerHTML = ''; }
        if (mapBadge) mapBadge.classList.add('hidden');
        return;
    }

    if (banner) {
        banner.classList.remove('hidden');
        if (tollEstimate) {
            banner.className = 'p-3 rounded-lg text-sm flex items-start space-x-2 bg-emerald-900/40 border border-emerald-700/60 text-emerald-200';
            banner.innerHTML = `<i class="fas fa-road mt-0.5 flex-shrink-0"></i><p><strong>Pedágio detectado nesta rota:</strong> R$ ${tollEstimate.value.toFixed(2)} (já preenchido abaixo).</p>`;
        } else {
            banner.className = 'p-3 rounded-lg text-sm flex items-start space-x-2 bg-slate-700/50 border border-slate-600 text-slate-300';
            banner.innerHTML = `<i class="fas fa-check-circle mt-0.5 flex-shrink-0"></i><p>Nenhum pedágio detectado nesta rota.</p>`;
        }
    }

    if (mapBadge && mapBadgeText) {
        if (tollEstimate) {
            mapBadgeText.textContent = `Pedágio: R$ ${tollEstimate.value.toFixed(2)}`;
            mapBadge.classList.remove('hidden');
        } else {
            mapBadge.classList.add('hidden');
        }
    }
}

export function selectRoute(index) {
    if (!currentRoutesResult || !currentRoutesResult.routes[index]) return;

    directionsRenderer.setRouteIndex(index);

    const selectedRoute = currentRoutesResult.routes[index];
    const totalDistanceMeters = selectedRoute.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    distanciaIdaPura = totalDistanceMeters / 1000;

    const tollEstimate = tollEstimates ? tollEstimates[index] : null;
    currentTollCost = tollEstimate ? tollEstimate.value : 0;
    updateTollBanner(tollEstimate, !!tollEstimates);

    if (tollEstimate) {
        const custoPedagioInput = document.getElementById("custoPedagio");
        if (custoPedagioInput) custoPedagioInput.value = tollEstimate.value.toFixed(2);
    }

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

    showMessage(`Rota ${index + 1} selecionada.${tollEstimate ? ` Pedágio estimado: R$ ${tollEstimate.value.toFixed(2)} (preenchido automaticamente).` : ''}`, "info");
}

function routeDirections(request) {
    return new Promise(resolve => {
        directionsService.route(request, (result, status) => resolve({ result, status }));
    });
}

export async function calcularDistancia() {
    const origem = document.getElementById("origem").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const parada1 = document.getElementById("parada1").value.trim();
    const parada2 = document.getElementById("parada2").value.trim();
    if (!origem || !destino) { showMessage("Informe origem e destino!", "error"); return; }
    const btn = document.getElementById("calcularDistanciaBtn"); btn.classList.add("loading"); btn.disabled = true;

    document.getElementById('routeOptionsContainer').classList.add('hidden');
    document.getElementById('routeOptionsList').innerHTML = '';
    document.getElementById('tollStatusBanner').classList.add('hidden');
    document.getElementById('tollMapBadge').classList.add('hidden');
    currentRoutesResult = null;
    currentTollCost = 0;
    tollEstimates = null;
    clearRace();

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

    const paradas = [parada1, parada2].filter(Boolean);

    const [{ result, status }, tollResult] = await Promise.all([
        routeDirections(request),
        fetchTollEstimates({ origem, destino, paradas })
    ]);

    btn.classList.remove("loading"); btn.disabled = false;

    if (status === "OK") {
        currentRoutesResult = result;
        tollEstimates = tollResult;

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

        runRouteRace(map, result.routes, markWinnerCard);

        // No mobile, recolhe o painel automaticamente para revelar o mapa com a rota calculada
        if (window.innerWidth < 1024) {
            document.getElementById("sidebar")?.classList.add("panel-closed");
            document.getElementById("sidebarOverlay")?.classList.add("hidden");
        }

    } else { showMessage("Erro ao calcular rota. Verifique os endereços informados.", "error"); console.error("Erro na API de Direções:", status); }
}

export function initializeMapListeners() {
    document.getElementById("calcularDistanciaBtn").addEventListener("click", calcularDistancia);
}

// Remove as trilhas/marcadores da corrida do mapa, deixando só a rota escolhida visível (usado antes de capturar o mapa para relatórios)
export function clearRouteRaceVisuals() {
    clearRace();
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

// Retorna o último place (com geometry) selecionado via autocomplete para um campo: origem, destino, parada1, parada2
export function getLastPlace(fieldKey) {
    return lastPlaces[fieldKey] || null;
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

// =============================
//  Função Geolocalização
// =============================
export function setupGeoButton() {
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
                const latlng = { lat, lng };

                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ location: latlng }, (results, status) => {
                    if (status === "OK" && results[0]) {
                        // Preenche o campo de origem
                        const origemInput = document.getElementById("origem");
                        if (origemInput) origemInput.value = results[0].formatted_address;
                        lastPlaces.origem = { formatted_address: results[0].formatted_address, geometry: { location: { lat: () => lat, lng: () => lng } } };

                        // Centraliza o mapa usando a variável local 'map' deste módulo
                        if (map) {
                            map.setCenter(latlng);
                            map.setZoom(15);

                            new google.maps.Marker({
                                position: latlng,
                                map: map,
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