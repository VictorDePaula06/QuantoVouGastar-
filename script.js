import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, getDoc, query, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ===== Configuração Firebase (Use sua chave de Auth) =====
const firebaseConfig = {
    apiKey: "AIzaSyCP3YOpgh50JgMNwcm5ITWFuyYgf40eQnU", // Use sua chave real do Firebase Auth aqui
    authDomain: "quantovougastar.firebaseapp.com",
    projectId: "quantovougastar",
    storageBucket: "quantovougastar.appspot.com",
    messagingSenderId: "591670557539",
    appId: "1:591670557539:web:b1061bc35df30cbd6b3156",
    measurementId: "G-XZ3Z2Y0T4E"
};

// ===== Inicializar Firebase =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Variáveis globais =====
let map, directionsService, directionsRenderer;
let originMarker, destinationMarker, parada1Marker, parada2Marker;
let autocompleteOrigin, autocompleteDestination, autocompleteParada1, autocompleteParada2;
let distanciaIdaPura = 0;
let veiculoSelecionadoData = null; // Armazena o veículo selecionado (Dados atualizados no cálculo)
let currentUserId = null;
let showInactive = false;
let currentRoutesResult = null; // Armazena o resultado completo da rota
let currentTollCost = 0; // NOVO: Custo do pedágio da rota selecionada

// Variável para a Edição (expõe globalmente)
window.editId = null;

// ===== Inicializar Google Maps =====
function initMap() {
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

// ===== Autocomplete e Marcadores (Funções mantidas) =====
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


// ===== Mensagens (Mantida) =====
function showMessage(msg, type = "success") {
    const box = document.createElement("div");
    box.className = `message-box ${type}`;
    box.innerHTML = `<div class="flex items-center"><i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i><span>${msg}</span></div>`;
    document.body.appendChild(box);
    setTimeout(() => { box.style.transform = 'translateX(100%)'; setTimeout(() => box.remove(), 300); }, 3000);
}


// ===== Auth (Funções completas) =====
async function signIn() {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); }
    catch (error) { console.error("Erro no login:", error); showMessage("Falha ao entrar com Google. Tente novamente.", "error"); }
}
async function signOutUser() { try { await signOut(auth); showMessage("Você saiu da sua conta.", "info"); } catch (e) { console.error(e); } }

function updateUI(user) {
    const authBtn = document.getElementById("authBtn");
    const authIcon = document.getElementById("authIcon");
    const toggleBtn = document.getElementById("toggleSidebar");

    if (user) {
        currentUserId = user.uid;
        // Se houver usuário, muda o ícone para um de perfil ou logout
        authIcon.className = "fas fa-user-circle text-lg";
        // Adiciona um listener para o perfil/logout
        authBtn.onclick = signOutUser;
        authBtn.title = `Sair de ${user.displayName}`;

    } else {
        currentUserId = null;
        // Se deslogado, volta para o ícone do Google (entrar)
        authIcon.className = "fab fa-google text-lg";
        authBtn.onclick = signIn;
        authBtn.title = "Entrar com Google";
    }

    // Gerencia a visibilidade do botão de menu no mobile
    // NOTA: O botão de menu sanduíche foi movido para a esquerda no HTML
    if (window.innerWidth <= 1024) {
        toggleBtn.style.display = 'flex'; // Sempre visível para abrir o menu lateral
        // Se deslogar, força a sidebar a fechar no mobile
        if (!user) {
            document.getElementById("sidebar").classList.add("-translate-x-full");
            document.getElementById("sidebarOverlay").classList.add("hidden");
        }
    } else {
        toggleBtn.style.display = 'none'; // Escondido no desktop (o menu já está visível)
    }

    loadVeiculos();
}

onAuthStateChanged(auth, (user) => {
    updateUI(user);
    if (user) showMessage(`Bem-vindo, ${user.displayName}!`, "success");
});


// ===== Veículos (Funções completas) =====
async function loadVeiculos() {
    const list = document.getElementById("veiculosList");
    const select = document.getElementById("veiculo");
    const toggleBtn = document.getElementById("toggleInativosBtn");
    list.innerHTML = "";
    select.innerHTML = '<option value="">Escolha um veículo</option>';
    veiculoSelecionadoData = null;

    if (!currentUserId) {
        list.innerHTML = `<div class="p-4 text-center text-gray-500">Faça login para gerenciar seus veículos.</div>`;
        toggleBtn.classList.add("hidden");
        return;
    }

    try {
        const q = query(collection(db, "veiculos"), where("userId", "==", currentUserId));
        const snapshot = await getDocs(q);
        const veiculos = [];
        snapshot.forEach(d => veiculos.push({ id: d.id, ...d.data() }));

        if (veiculos.length === 0) {
            list.innerHTML = `<div class="p-4 text-center text-gray-500">Nenhum veículo cadastrado.</div>`;
            toggleBtn.classList.add("hidden");
            return;
        }

        let inactiveCount = 0;

        veiculos.forEach(v => {
            if (!v.ativo) inactiveCount++;
            if (!showInactive && !v.ativo) return;

            const ef_gas = v.eficiencias?.gasolina || v.eficiencia || 0;
            const ef_eta = v.eficiencias?.etanol || 0;
            const ef_gnv = v.eficiencias?.gnv || 0;
            const ef_die = v.eficiencias?.diesel || 0; // NOVO: Diesel

            let eficienciaText = `${ef_gas} km/l (G)`;
            if (ef_eta > 0) eficienciaText += ` / ${ef_eta} km/l (E)`;
            if (ef_gnv > 0) eficienciaText += ` / ${ef_gnv} km/m³ (GNV)`;
            if (ef_die > 0) eficienciaText += ` / ${ef_die} km/l (D)`; // NOVO: Diesel

            const li = document.createElement("div");
            li.className = `vehicle-card ${v.ativo ? '' : 'inactive'}`;
            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="font-medium text-white">${v.modelo} ${v.ativo ? '' : '<span class="text-xs text-red-400">(Inativo)</span>'}</div>
                        <div class="text-sm text-gray-400">${eficienciaText}</div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="px-3 py-1 text-xs bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/40 rounded-lg" onclick="editVeiculo('${v.id}','${v.modelo}',${ef_gas},${ef_eta},${ef_gnv},${ef_die})"><i class="fas fa-edit mr-1"></i>Editar</button>
                        <button class="px-3 py-1 text-xs ${v.ativo ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/40'} rounded-lg" onclick="toggleAtivo('${v.id}',${v.ativo})">
                            <i class="fas fa-${v.ativo ? 'times' : 'check'} mr-1"></i>${v.ativo ? 'Inativar' : 'Ativar'}
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(li);

            if (v.ativo) {
                const option = document.createElement("option");
                option.value = v.id;
                option.textContent = `${v.modelo} (${eficienciaText})`;
                select.appendChild(option);
            }
        });

        if (inactiveCount > 0) {
            toggleBtn.classList.remove("hidden");
            toggleBtn.innerHTML = showInactive
                ? `<i class="fas fa-eye-slash mr-1"></i> Esconder Inativos (${inactiveCount})`
                : `<i class="fas fa-eye mr-1"></i> Mostrar Inativos (${inactiveCount})`;
        } else {
            toggleBtn.classList.add("hidden");
        }

    } catch (error) { console.error("Erro ao carregar veículos:", error); showMessage("Erro ao carregar veículos!", "error"); }
}

// Expor globalmente (essencial)
window.editVeiculo = function (id, modelo, ef_gas, ef_eta, ef_gnv, ef_die) { // NOVO: ef_die
    if (!currentUserId) { showMessage("Faça login para editar veículos.", "error"); return; }
    window.editId = id;
    document.getElementById("editModelo").value = modelo;
    document.getElementById("editEficienciaGasolina").value = ef_gas;
    document.getElementById("editEficienciaEtanol").value = ef_eta > 0 ? ef_eta : '';
    document.getElementById("editEficienciaGnv").value = ef_gnv > 0 ? ef_gnv : '';
    document.getElementById("editEficienciaDiesel").value = ef_die > 0 ? ef_die : ''; // NOVO: Diesel
    document.getElementById("editModal").classList.remove("hidden");
    document.getElementById("editModal").classList.add("flex");
};
window.toggleAtivo = async function (id, ativo) {
    if (!currentUserId) { showMessage("Faça login para alterar o status do veículo.", "error"); return; }
    try { await updateDoc(doc(db, "veiculos", id), { ativo: !ativo }); showMessage(ativo ? "Veículo inativado!" : "Veículo ativado!"); loadVeiculos(); } catch { showMessage("Erro ao alterar status do veículo!", "error"); }
};
window.signIn = signIn;
window.signOutUser = signOutUser;
window.selectRoute = selectRoute; // Expondo a função de rota alternativa globalmente

document.getElementById("toggleInativosBtn").addEventListener("click", () => {
    showInactive = !showInactive;
    loadVeiculos();
});

// ===== Geolocalização (NOVO) =====
document.getElementById("geolocalizacaoBtn").addEventListener("click", () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latlng = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ location: latlng }, (results, status) => {
                    if (status === "OK" && results[0]) {
                        document.getElementById("origem").value = results[0].formatted_address;
                        showMessage("Localização atual preenchida!", "info");
                    } else {
                        showMessage("Não foi possível obter o endereço da sua localização.", "error");
                    }
                });
            },
            (error) => {
                console.error("Erro na geolocalização:", error);
                showMessage("Permissão de localização negada ou indisponível.", "error");
            }
        );
    } else {
        showMessage("Seu navegador não suporta geolocalização.", "error");
    }
});

// ===== Add vehicle =====
document.getElementById("addVeiculoBtn").addEventListener("click", async () => {
    if (!currentUserId) { showMessage("Faça login para cadastrar um veículo.", "error"); return; }
    const modelo = document.getElementById("novoModelo").value.trim();
    const ef_gas = parseFloat(document.getElementById("novaEficienciaGasolina").value.trim());
    const ef_eta = parseFloat(document.getElementById("novaEficienciaEtanol").value.trim() || 0);
    const ef_gnv = parseFloat(document.getElementById("novaEficienciaGnv").value.trim() || 0);
    const ef_die = parseFloat(document.getElementById("novaEficienciaDiesel").value.trim() || 0); // NOVO: Diesel

    if (!modelo || isNaN(ef_gas) || ef_gas <= 0) { showMessage("Preencha o Modelo e a Eficiência Gasolina corretamente!", "error"); return; }

    const btn = document.getElementById("addVeiculoBtn");
    btn.classList.add("loading"); btn.disabled = true;
    try {
        await addDoc(collection(db, "veiculos"), {
            modelo,
            userId: currentUserId,
            eficiencias: {
                gasolina: ef_gas,
                etanol: isNaN(ef_eta) ? 0 : ef_eta,
                gnv: isNaN(ef_gnv) ? 0 : ef_gnv,
                diesel: isNaN(ef_die) ? 0 : ef_die // NOVO: Diesel
            },
            ativo: true
        });
        showMessage("Veículo cadastrado com sucesso!");
        document.getElementById("novoModelo").value = "";
        document.getElementById("novaEficienciaGasolina").value = "";
        document.getElementById("novaEficienciaEtanol").value = "";
        document.getElementById("novaEficienciaGnv").value = "";
        document.getElementById("novaEficienciaDiesel").value = ""; // NOVO: Diesel
        loadVeiculos();
    } catch (e) { console.error(e); showMessage("Erro ao cadastrar veículo!", "error"); } finally { btn.classList.remove("loading"); btn.disabled = false; }
});

// ===== Edit modal actions (CORRIGIDO) =====
function closeEditModal() {
    document.getElementById("editModal").classList.add("hidden");
    document.getElementById("editModal").classList.remove("flex");
    window.editId = null; // Limpa o ID de edição
}

document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);

document.getElementById("saveEditBtn").addEventListener("click", async () => {
    if (!currentUserId || !window.editId) return;
    const modelo = document.getElementById("editModelo").value.trim();
    const ef_gas = parseFloat(document.getElementById("editEficienciaGasolina").value);
    const ef_eta = parseFloat(document.getElementById("editEficienciaEtanol").value || 0);
    const ef_gnv = parseFloat(document.getElementById("editEficienciaGnv").value || 0);
    const ef_die = parseFloat(document.getElementById("editEficienciaDiesel").value || 0); // NOVO: Diesel

    if (!modelo || isNaN(ef_gas) || ef_gas <= 0) { showMessage("Preencha o Modelo e a Eficiência Gasolina corretamente!", "error"); return; }

    const btn = document.getElementById("saveEditBtn");
    btn.classList.add("loading"); btn.disabled = true;

    try {
        await updateDoc(doc(db, "veiculos", window.editId), {
            modelo,
            eficiencias: {
                gasolina: ef_gas,
                etanol: isNaN(ef_eta) ? 0 : ef_eta,
                gnv: isNaN(ef_gnv) ? 0 : ef_gnv,
                diesel: isNaN(ef_die) ? 0 : ef_die // NOVO: Diesel
            }
        });
        showMessage("Veículo atualizado com sucesso!");
        loadVeiculos();
        closeEditModal();
    } catch (e) {
        console.error(e);
        showMessage("Erro ao atualizar veículo! Verifique se você é o dono.", "error");
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
});


// ===== Funções de Rota Alternativa (Completas) =====
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
            const isSelected = directionsRenderer.getRouteIndex() === index;

            // NOVO: Cálculo do custo do pedágio para a rota
            let tollCost = 0;
            if (route.fare && route.fare.value) {
                // A API de Direções do Google Maps não retorna o custo do pedágio diretamente no Brasil,
                // mas sim o custo total da rota (fare). No entanto, o Routes API (que não está em JS)
                // retorna o custo do pedágio. Para a API de Direções, vamos apenas verificar se há
                // pedágios a serem evitados.
                // Para simular o custo, vamos usar uma variável global que será atualizada na seleção.
                // A API de Direções não fornece o custo exato.
                // Vamos usar a propriedade 'tolls' na rota para indicar a presença.
                const hasTolls = route.warnings.some(w => w.includes('tolls'));
                tollCost = hasTolls ? -1 : 0; // -1 indica pedágio presente, mas custo desconhecido
            }

            const card = document.createElement('div');
            card.className = `route-option-card ${isSelected ? 'selected' : ''}`;
            card.dataset.routeIndex = index;
            card.dataset.tollCost = tollCost; // Armazena o custo/status do pedágio
            card.innerHTML = `
                <div class="route-title flex justify-between items-center">
                    <span>Rota ${index + 1} ${route.summary ? `(${route.summary})` : ''}</span>
                    ${isSelected ? '<i class="fas fa-check-circle text-accent-green"></i>' : ''}
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

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}min`;
    return result.trim() || 'Menos de 1 min';
}

function selectRoute(index) {
    if (!currentRoutesResult || !currentRoutesResult.routes[index]) return;

    directionsRenderer.setRouteIndex(index);

    const selectedRoute = currentRoutesResult.routes[index];
    const totalDistanceMeters = selectedRoute.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    distanciaIdaPura = totalDistanceMeters / 1000;

    // NOVO: Atualiza o custo do pedágio
    const selectedTollCost = parseFloat(document.querySelector(`.route-option-card[data-route-index="${index}"]`).dataset.tollCost);
    currentTollCost = selectedTollCost === -1 ? 0 : selectedTollCost; // Se for -1 (desconhecido), trata como 0 para o cálculo

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

// ===== Calcular rota (Mantida) =====
document.getElementById("calcularDistanciaBtn").addEventListener("click", () => {
    const origem = document.getElementById("origem").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const parada1 = document.getElementById("parada1").value.trim();
    const parada2 = document.getElementById("parada2").value.trim();
    if (!origem || !destino) { showMessage("Informe origem e destino!", "error"); return; }
    const btn = document.getElementById("calcularDistanciaBtn"); btn.classList.add("loading"); btn.disabled = true;

    document.getElementById('routeOptionsContainer').classList.add('hidden');
    document.getElementById('routeOptionsList').innerHTML = '';
    currentRoutesResult = null;
    currentTollCost = 0; // Reseta o custo do pedágio

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

            // Seleciona a primeira rota por padrão e atualiza o custo do pedágio
            selectRoute(0);

        } else { showMessage("Erro ao calcular rota. Verifique os endereços informados.", "error"); console.error("Erro na API de Direções:", status); }
    });
});

function updateDistanceDisplay(distancia, idaEVoltaChecked) {
    const display = document.getElementById("distanciaDisplay");
    if (!distancia || distancia === 0) { display.textContent = "-- km"; return; }
    const distanciaFinal = idaEVoltaChecked ? distancia * 2 : distancia;
    display.textContent = `${distanciaFinal.toFixed(2)} km${idaEVoltaChecked ? ' (Ida e Volta)' : ''}`;
}

// ===== Calcular custo (MODIFICADO para usar Modal) =====
document.getElementById("calcularBtn").addEventListener("click", async () => {
    const veiculoId = document.getElementById("veiculo").value;
    const tipoCombustivel = document.getElementById("combustivel").value;
    const preco = parseFloat(document.getElementById("precoGasolina").value);
    const distanciaText = document.getElementById("distanciaDisplay").textContent;
    const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;

    if (!veiculoId || !tipoCombustivel || isNaN(preco) || preco <= 0 || distanciaText === "-- km") { showMessage("Preencha todos os dados da viagem corretamente!", "error"); return; }

    // Tenta carregar os dados do veículo se ainda não estiverem na memória
    if (!veiculoSelecionadoData || veiculoSelecionadoData.id !== veiculoId) {
        try {
            const docSnap = await getDoc(doc(db, "veiculos", veiculoId));
            if (docSnap.exists()) veiculoSelecionadoData = { id: veiculoId, ...docSnap.data() };
        } catch (e) { console.error(e); }
    }

    if (!veiculoSelecionadoData) { showMessage("Erro: Selecione o veículo novamente.", "error"); return; }

    const eficiencia = veiculoSelecionadoData.eficiencias[tipoCombustivel];
    if (isNaN(eficiencia) || eficiencia <= 0) { showMessage(`Erro: Eficiência ${tipoCombustivel} não definida para o veículo.`, "error"); return; }

    const distanciaBase = distanciaIdaPura;
    if (!distanciaBase || distanciaBase === 0) { showMessage("Calcule a rota primeiro!", "error"); return; }

    const distancia_ajustada = distanciaBase * (idaEVoltaChecked ? 2 : 1);
    const btn = document.getElementById("calcularBtn"); btn.classList.add("loading"); btn.disabled = true;
    try {
        const litrosNecessarios = distancia_ajustada / eficiencia;
        const custoCombustivel = litrosNecessarios * preco;

        // NOVO: Adiciona o custo do pedágio (se conhecido)
        const custoTotal = custoCombustivel + (currentTollCost * (idaEVoltaChecked ? 2 : 1));

        const resultadoValor = document.getElementById("resultadoValor");
        const infoViagem = idaEVoltaChecked ? ' (Ida e Volta)' : '';
        let combustivelNome = tipoCombustivel.charAt(0).toUpperCase() + tipoCombustivel.slice(1);
        const unidade = (tipoCombustivel === 'gnv') ? 'm³ de GNV' : 'L de ' + combustivelNome;

        let tollInfoHtml = '';
        if (currentTollCost > 0) {
            tollInfoHtml = `<div class="text-xs opacity-80 mt-1">Pedágio: R$ ${currentTollCost.toFixed(2)}</div>`;
        } else if (currentTollCost === 0 && currentRoutesResult && currentRoutesResult.routes[directionsRenderer.getRouteIndex()].warnings.some(w => w.includes('tolls'))) {
            tollInfoHtml = `<div class="text-xs opacity-80 mt-1">Pedágio: Presente (Custo Desconhecido)</div>`;
        }

        resultadoValor.innerHTML = `
            <div>R$ ${custoTotal.toFixed(2)}</div>
            <div class="text-sm opacity-90 mt-1">${litrosNecessarios.toFixed(2)} ${unidade} • ${veiculoSelecionadoData.modelo}</div>
            <div class="text-xs opacity-80 mt-1">Distância Total: ${distancia_ajustada.toFixed(2)} km ${infoViagem}</div>
            ${tollInfoHtml}
        `;

        // Exibe o novo modal de resultado
        document.getElementById("resultModal").classList.remove("hidden");
        document.getElementById("resultModal").classList.add("flex");

        showMessage("Custo calculado com sucesso!");
    } catch (error) { console.error("Erro ao calcular custo:", error); showMessage("Erro ao calcular custo da viagem!", "error"); }
    finally { btn.classList.remove("loading"); btn.disabled = false; }
});

// ===== Fechar Modal de Resultado =====
document.getElementById("closeResultModalBtn").addEventListener("click", () => {
    document.getElementById("resultModal").classList.add("hidden");
    document.getElementById("resultModal").classList.remove("flex");
});

// ===== Sidebar toggle mobile (Mantida) =====
document.getElementById("toggleSidebar").addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    sidebar.classList.toggle("-translate-x-full");
    overlay.classList.toggle("hidden");
});
document.getElementById("sidebarOverlay").addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
});

// ===== Inicialização (Mantida) =====
document.addEventListener("DOMContentLoaded", () => {
    const mapLoadCheck = setInterval(() => {
        if (typeof google !== "undefined" && typeof google.maps !== "undefined") {
            clearInterval(mapLoadCheck);
            initMap();
        }
    }, 120);

    window.addEventListener("error", (e) => { console.error("Erro global capturado:", e.error || e); });
});
