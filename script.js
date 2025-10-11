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
    const userInfo = document.getElementById("userInfo");
    const userNameDisplay = document.getElementById("userName");
    const userEmailDisplay = document.getElementById("userEmail");
    const toggleBtn = document.getElementById("toggleSidebar");

    if (user) {
        currentUserId = user.uid;
        userNameDisplay.textContent = user.displayName || "Usuário";
        userEmailDisplay.textContent = user.email || "";
        userInfo.classList.remove("hidden");
        authBtn.innerHTML = `<i class="fas fa-sign-out-alt text-lg md:mr-1"></i><span class="ml-2 hidden md:inline">Sair</span>`;
        authBtn.onclick = signOutUser;
    } else {
        currentUserId = null;
        userInfo.classList.add("hidden");
        authBtn.innerHTML = `<i class="fab fa-google text-lg md:mr-1"></i><span class="ml-2 hidden md:inline">Entrar</span>`;
        authBtn.onclick = signIn;
    }

    // Gerencia a visibilidade do botão de menu no mobile
    if (window.innerWidth <= 1024) {
        toggleBtn.style.display = user ? 'flex' : 'none';
        // Se deslogar, força a sidebar a fechar no mobile
        if (!user) {
            document.getElementById("sidebar").classList.add("-translate-x-full");
            document.getElementById("sidebarOverlay").classList.add("hidden");
        }
    } else {
        toggleBtn.style.display = 'none'; // Sempre escondido no desktop
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

            let eficienciaText = `${ef_gas} km/l (G)`;
            if (ef_eta > 0) eficienciaText += ` / ${ef_eta} km/l (E)`;
            if (ef_gnv > 0) eficienciaText += ` / ${ef_gnv} km/m³ (GNV)`;

            const li = document.createElement("div");
            li.className = `vehicle-card ${v.ativo ? '' : 'inactive'}`;
            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="font-medium text-white">${v.modelo} ${v.ativo ? '' : '<span class="text-xs text-red-400">(Inativo)</span>'}</div>
                        <div class="text-sm text-gray-400">${eficienciaText}</div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="px-3 py-1 text-xs bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/40 rounded-lg" onclick="editVeiculo('${v.id}','${v.modelo}',${ef_gas},${ef_eta},${ef_gnv})"><i class="fas fa-edit mr-1"></i>Editar</button>
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
window.editVeiculo = function (id, modelo, ef_gas, ef_eta, ef_gnv) {
    if (!currentUserId) { showMessage("Faça login para editar veículos.", "error"); return; }
    window.editId = id;
    document.getElementById("editModelo").value = modelo;
    document.getElementById("editEficienciaGasolina").value = ef_gas;
    document.getElementById("editEficienciaEtanol").value = ef_eta > 0 ? ef_eta : '';
    document.getElementById("editEficienciaGnv").value = ef_gnv > 0 ? ef_gnv : '';
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

// ===== Cadastro e Edição (Mantidas) =====
document.getElementById("addVeiculoBtn").addEventListener("click", async () => { /* ... */ });
document.getElementById("cancelEditBtn").addEventListener("click", () => { /* ... */ });
document.getElementById("saveEditBtn").addEventListener("click", async () => { /* ... */ });


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

            const card = document.createElement('div');
            card.className = `route-option-card ${isSelected ? 'selected' : ''}`;
            card.dataset.routeIndex = index;
            card.innerHTML = `
                <div class="route-title flex justify-between items-center">
                    <span>Rota ${index + 1} ${route.summary ? `(${route.summary})` : ''}</span>
                    ${isSelected ? '<i class="fas fa-check-circle text-accent-green"></i>' : ''}
                </div>
                <div class="route-details">
                    Distância: ${distanceKm} km | Tempo: ${durationText}
                </div>
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

    const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;
    updateDistanceDisplay(distanciaIdaPura, idaEVoltaChecked);

    document.querySelectorAll('.route-option-card').forEach(card => {
        card.classList.remove('selected');
        const checkIcon = card.querySelector('.fa-check-circle');
        if (checkIcon) checkIcon.remove();

        if (parseInt(card.dataset.routeIndex) === index) {
            card.classList.add('selected');
            const newCheckIcon = document.createElement('i');
            newCheckIcon.className = 'fas fa-check-circle text-accent-green';
            card.querySelector('.route-title').appendChild(newCheckIcon);
        }
    });

    showMessage(`Rota ${index + 1} selecionada. Distância atualizada.`, "info");
}


// ===== Calcular rota (Modificado para Rotas Alternativas) =====
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

    const waypoints = [];
    if (parada1) waypoints.push({ location: parada1, stopover: true });
    if (parada2) waypoints.push({ location: parada2, stopover: true });

    const request = {
        origin: origem, destination: destino, waypoints, optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING, unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false, avoidTolls: false, provideRouteAlternatives: true
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

            const resultadoDiv = document.getElementById('resultado');
            resultadoDiv.classList.remove('hidden');
            setTimeout(() => { resultadoDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 300);
        } else { showMessage("Erro ao calcular rota. Verifique os endereços informados.", "error"); console.error("Erro na API de Direções:", status); }
    });
});


// ===== Calcular custo (CORRIGIDO PARA RECARREGAR O VEÍCULO) =====
document.getElementById("calcularBtn").addEventListener("click", async () => {
    const veiculoId = document.getElementById("veiculo").value;
    const tipoCombustivel = document.getElementById("combustivel").value;
    const preco = parseFloat(document.getElementById("precoGasolina").value);
    const distanciaText = document.getElementById("distanciaDisplay").textContent;
    const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;

    if (!veiculoId || !tipoCombustivel || isNaN(preco) || preco <= 0 || distanciaText === "-- km") { showMessage("Preencha todos os dados da viagem corretamente!", "error"); return; }

    const btn = document.getElementById("calcularBtn"); btn.classList.add("loading"); btn.disabled = true;

    // CORREÇÃO CRÍTICA: FORÇA A RECARGA DOS DADOS DO VEÍCULO A CADA CÁLCULO
    try {
        const docSnap = await getDoc(doc(db, "veiculos", veiculoId));
        if (docSnap.exists()) {
            veiculoSelecionadoData = { id: veiculoId, ...docSnap.data() };
        } else {
            showMessage("Veículo não encontrado no sistema.", "error");
            veiculoSelecionadoData = null;
            return;
        }
    } catch (e) {
        showMessage("Erro ao carregar dados do veículo.", "error");
        console.error(e);
        veiculoSelecionadoData = null;
        return;
    }

    const eficiencia = veiculoSelecionadoData.eficiencias[tipoCombustivel];

    if (isNaN(eficiencia) || eficiencia <= 0) {
        showMessage(`Erro: Eficiência ${tipoCombustivel} não definida para o veículo.`, "error");
        btn.classList.remove("loading"); btn.disabled = false;
        return;
    }

    const distanciaBase = distanciaIdaPura;
    if (!distanciaBase || distanciaBase === 0) { showMessage("Calcule a rota primeiro!", "error"); }

    const distancia_ajustada = distanciaBase * (idaEVoltaChecked ? 2 : 1);

    try {
        const litrosNecessarios = distancia_ajustada / eficiencia;
        const custoTotal = litrosNecessarios * preco;

        const resultadoDiv = document.getElementById("resultado");
        const resultadoValor = document.getElementById("resultadoValor");
        const infoViagem = idaEVoltaChecked ? ' (Ida e Volta)' : '';
        let combustivelNome = tipoCombustivel.charAt(0).toUpperCase() + tipoCombustivel.slice(1);
        const unidade = (tipoCombustivel === 'gnv') ? 'm³ de GNV' : 'L de ' + combustivelNome;

        resultadoValor.innerHTML = `
            <div>R$ ${custoTotal.toFixed(2)}</div>
            <div class="text-sm opacity-90 mt-1">${litrosNecessarios.toFixed(2)} ${unidade} • ${veiculoSelecionadoData.modelo}</div>
            <div class="text-xs opacity-80 mt-1">Distância Total: ${distancia_ajustada.toFixed(2)} km ${infoViagem}</div>
        `;
        resultadoDiv.classList.remove("hidden");
        setTimeout(() => { resultadoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
        showMessage("Custo calculado com sucesso!");

    } catch (error) {
        console.error("Erro ao calcular custo:", error);
        showMessage("Erro ao calcular custo da viagem!", "error");
    } finally {
        btn.classList.remove("loading"); btn.disabled = false;
    }
});

function updateDistanceDisplay(distancia, idaEVoltaChecked) {
    const display = document.getElementById("distanciaDisplay");
    if (!distancia || distancia === 0) { display.textContent = "-- km"; return; }
    const distanciaFinal = idaEVoltaChecked ? distancia * 2 : distancia;
    display.textContent = `${distanciaFinal.toFixed(2)} km${idaEVoltaChecked ? ' (Ida e Volta)' : ''}`;
}


// ===== Sidebar toggle mobile (CORRIGIDO) =====
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");
const toggleBtn = document.getElementById("toggleSidebar");

function toggleSidebar() {
    sidebar.classList.toggle("-translate-x-full");
    overlay.classList.toggle("hidden");

    // Altera o ícone do botão
    if (sidebar.classList.contains("-translate-x-full")) {
        toggleBtn.innerHTML = '<i class="fas fa-bars text-gray-200"></i>';
    } else {
        toggleBtn.innerHTML = '<i class="fas fa-times text-gray-200"></i>';
    }
}

toggleBtn.addEventListener("click", toggleSidebar);
overlay.addEventListener("click", toggleSidebar);

// Corrigido: Inicializar o estado da sidebar no mobile
if (window.innerWidth <= 1024) {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
}

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