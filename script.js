import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ===== Configuração Firebase =====
const firebaseConfig = {
    apiKey: "AIzaSyCP3Y0pgh50JgMNwcm5ITWFuyYgf40eQnU",
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

// ===== Variáveis globais para o mapa e estado da UI =====
let map;
let directionsService;
let directionsRenderer;
let originMarker;
let destinationMarker;
let autocompleteOrigin;
let autocompleteDestination;
let editId = null;
let showInactive = false; // NOVO: Estado para rastrear se inativos devem ser exibidos

// ===== Inicializar Google Maps (Chamada pelo script principal) =====
function initMap() {
    // Inicializar o mapa centrado no Brasil
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 5,
        center: { lat: -14.2350, lng: -51.9253 }, // Centro do Brasil
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    // Inicializar serviços de direções
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: false,
        panel: null,
        polylineOptions: {
            strokeColor: "#3b82f6",
            strokeWeight: 4,
            strokeOpacity: 0.8
        }
    });
    directionsRenderer.setMap(map);

    // Configurar autocomplete para os campos de origem e destino
    setupAutocomplete();

    console.log("Google Maps inicializado com sucesso!");
};

// ===== Configurar Autocomplete =====
function setupAutocomplete() {
    const originInput = document.getElementById("origem");
    const destinationInput = document.getElementById("destino");

    // Configurar autocomplete para origem
    autocompleteOrigin = new google.maps.places.Autocomplete(originInput, {
        componentRestrictions: { country: "br" },
        fields: ["place_id", "geometry", "name", "formatted_address"]
    });

    // Configurar autocomplete para destino
    autocompleteDestination = new google.maps.places.Autocomplete(destinationInput, {
        componentRestrictions: { country: "br" },
        fields: ["place_id", "geometry", "name", "formatted_address"]
    });

    // Listeners para quando um local é selecionado
    autocompleteOrigin.addListener("place_changed", () => {
        const place = autocompleteOrigin.getPlace();
        if (place.geometry) {
            updateOriginMarker(place);
        }
    });

    autocompleteDestination.addListener("place_changed", () => {
        const place = autocompleteDestination.getPlace();
        if (place.geometry) {
            updateDestinationMarker(place);
        }
    });
}

// ===== Atualizar marcador de origem / destino / fitMapToMarkers (funções omitidas para brevidade, mas estão no seu código) =====
// ... (Seu código para updateOriginMarker, updateDestinationMarker e fitMapToMarkers) ...

// ===== Ajustar mapa para mostrar ambos os marcadores =====
function fitMapToMarkers() {
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(originMarker.getPosition());
    bounds.extend(destinationMarker.getPosition());
    map.fitBounds(bounds);

    // Garantir um zoom mínimo
    google.maps.event.addListenerOnce(map, 'bounds_changed', function () {
        if (map.getZoom() > 15) {
            map.setZoom(15);
        }
    });
}

// ===== Atualizar marcador de origem =====
function updateOriginMarker(place) {
    if (originMarker) {
        originMarker.setMap(null);
    }

    originMarker = new google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: "Origem: " + place.name,
        icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="#22c55e" stroke="#ffffff" stroke-width="3"/>
                    <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">A</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        }
    });

    if (originMarker && destinationMarker) {
        fitMapToMarkers();
    }
}

// ===== Atualizar marcador de destino =====
function updateDestinationMarker(place) {
    if (destinationMarker) {
        destinationMarker.setMap(null);
    }

    destinationMarker = new google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: "Destino: " + place.name,
        icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="#ef4444" stroke="#ffffff" stroke-width="3"/>
                    <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">B</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        }
    });

    if (originMarker && destinationMarker) {
        fitMapToMarkers();
    }
}
// ===== Exibir mensagens (função omitida para brevidade, mas está no seu código) =====
function showMessage(msg, type = "success") {
    const box = document.createElement("div");
    box.className = `message-box ${type}`;
    box.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
            <span>${msg}</span>
        </div>
    `;
    document.body.appendChild(box);
    setTimeout(() => {
        box.style.transform = 'translateX(100%)';
        setTimeout(() => box.remove(), 300);
    }, 3000);
}

// ===== Carregar veículos (COM LÓGICA DE FILTRAGEM) =====
async function loadVeiculos() {
    const list = document.getElementById("veiculosList");
    const select = document.getElementById("veiculo");
    const toggleBtn = document.getElementById("toggleInativosBtn");

    list.innerHTML = "";
    select.innerHTML = '<option value="">Escolha um veículo</option>';

    // 1. ATUALIZA O BOTÃO: Define o ícone e texto com base no estado atual
    if (toggleBtn) {
        toggleBtn.innerHTML = showInactive
            ? '<i class="fas fa-eye-slash mr-1"></i> <span>Esconder Inativos</span>'
            : '<i class="fas fa-eye mr-1"></i> <span>Mostrar Inativos</span>';
    }

    try {
        const snapshot = await getDocs(collection(db, "veiculos"));
        snapshot.forEach(d => {
            const v = d.data();

            // 2. FILTRAGEM: Se o veículo estiver inativo E NÃO for para mostrar inativos, pula.
            if (!v.ativo && !showInactive) {
                return;
            }

            const li = document.createElement("li");
            li.className = `vehicle-card ${v.ativo ? '' : 'inactive'}`;

            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="font-medium text-gray-900">${v.modelo}</div>
                        <div class="text-sm text-gray-500">${v.eficiencia} km/l ${v.ativo ? '' : '(Inativo)'}</div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="px-3 py-1 text-xs bg-primary-100 text-primary-600 hover:bg-primary-200 rounded-lg transition-colors" 
                                onclick="editVeiculo('${d.id}','${v.modelo}',${v.eficiencia})">
                            <i class="fas fa-edit mr-1"></i>Editar
                        </button>
                        <button class="px-3 py-1 text-xs ${v.ativo ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'} rounded-lg transition-colors" 
                                onclick="toggleAtivo('${d.id}',${v.ativo})">
                            <i class="fas fa-${v.ativo ? 'times' : 'check'} mr-1"></i>${v.ativo ? 'Inativar' : 'Ativar'}
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(li);

            // 3. SELECT: O select lista APENAS veículos ativos.
            if (v.ativo) {
                const option = document.createElement("option");
                option.value = d.id;
                option.textContent = `${v.modelo} (${v.eficiencia} km/l)`;
                select.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Erro ao carregar veículos:", error);
        showMessage("Erro ao carregar veículos!", "error");
    }
}

// Tornar funções globais para uso nos event handlers inline
window.editVeiculo = editVeiculo;
window.toggleAtivo = toggleAtivo;

// ===== Cadastro de veículo (função omitida para brevidade, mas está no seu código) =====
document.getElementById("addVeiculoBtn").addEventListener("click", async () => {
    const modelo = document.getElementById("novoModelo").value.trim();
    const eficiencia = document.getElementById("novaEficiencia").value.trim();

    if (!modelo || !eficiencia) {
        showMessage("Preencha todos os campos!", "error");
        return;
    }

    const btn = document.getElementById("addVeiculoBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        await addDoc(collection(db, "veiculos"), {
            modelo,
            eficiencia: parseFloat(eficiencia),
            ativo: true
        });
        showMessage("Veículo cadastrado com sucesso!");
        document.getElementById("novoModelo").value = "";
        document.getElementById("novaEficiencia").value = "";
        loadVeiculos();
    } catch (e) {
        console.error(e);
        showMessage("Erro ao cadastrar veículo!", "error");
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
});

// ===== Editar veículo (funções omitidas para brevidade, mas estão no seu código) =====
function editVeiculo(id, modelo, eficiencia) {
    editId = id;
    document.getElementById("editModelo").value = modelo;
    document.getElementById("editEficiencia").value = eficiencia;
    document.getElementById("editModal").classList.remove("hidden");
    document.getElementById("editModal").classList.add("flex");
}

document.getElementById("cancelEditBtn").addEventListener("click", () => {
    document.getElementById("editModal").classList.add("hidden");
    document.getElementById("editModal").classList.remove("flex");
});

document.getElementById("saveEditBtn").addEventListener("click", async () => {
    const modelo = document.getElementById("editModelo").value.trim();
    const eficiencia = parseFloat(document.getElementById("editEficiencia").value);

    if (!modelo || isNaN(eficiencia)) {
        showMessage("Preencha todos os campos corretamente!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "veiculos", editId), { modelo, eficiencia });
        showMessage("Veículo atualizado com sucesso!");
        loadVeiculos();
        document.getElementById("editModal").classList.add("hidden");
        document.getElementById("editModal").classList.remove("flex");
    } catch {
        showMessage("Erro ao atualizar veículo!", "error");
    }
});

// ===== Ativar/Inativar veículo (função omitida para brevidade, mas está no seu código) =====
async function toggleAtivo(id, ativo) {
    try {
        await updateDoc(doc(db, "veiculos", id), { ativo: !ativo });
        showMessage(ativo ? "Veículo inativado!" : "Veículo ativado!");
        loadVeiculos();
    } catch {
        showMessage("Erro ao alterar status do veículo!", "error");
    }
}

// ===== Calcular distância e exibir rota (função omitida para brevidade, mas está no seu código) =====
document.getElementById("calcularDistanciaBtn").addEventListener("click", () => {
    const origem = document.getElementById("origem").value.trim();
    const destino = document.getElementById("destino").value.trim();

    if (!origem || !destino) {
        showMessage("Informe origem e destino!", "error");
        return;
    }

    const btn = document.getElementById("calcularDistanciaBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    directionsService.route(
        {
            origin: origem,
            destination: destino,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC,
            avoidHighways: false,
            avoidTolls: false
        },
        (result, status) => {
            btn.classList.remove("loading");
            btn.disabled = false;

            if (status === "OK") {
                directionsRenderer.setDirections(result);
                const route = result.routes[0];
                const leg = route.legs[0];
                const distanceKm = leg.distance.value / 1000;
                document.getElementById("distanciaDisplay").textContent = `${distanceKm.toFixed(2)} km`;

                if (originMarker) originMarker.setMap(null);
                if (destinationMarker) destinationMarker.setMap(null);

                showMessage(`Rota calculada: ${distanceKm.toFixed(2)} km`);

                document.querySelector('#resultado').scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            } else {
                showMessage("Erro ao calcular rota. Verifique os endereços informados.", "error");
                console.error("Erro na API de Direções:", status);
            }
        }
    );
});

// ===== Calcular custo da viagem (função omitida para brevidade, mas está no seu código) =====
document.getElementById("calcularBtn").addEventListener("click", async () => {
    const veiculoId = document.getElementById("veiculo").value;
    const preco = parseFloat(document.getElementById("precoGasolina").value);
    const distanciaText = document.getElementById("distanciaDisplay").textContent;

    if (!veiculoId || isNaN(preco) || preco <= 0 || distanciaText === "-- km") {
        showMessage("Preencha todos os dados da viagem corretamente!", "error");
        return;
    }

    const distancia = parseFloat(distanciaText.replace(" km", ""));
    const btn = document.getElementById("calcularBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        const docSnap = await getDoc(doc(db, "veiculos", veiculoId));
        const veiculo = docSnap.data();

        const litrosNecessarios = distancia / veiculo.eficiencia;
        const custoTotal = litrosNecessarios * preco;

        const resultadoDiv = document.getElementById("resultado");
        const resultadoValor = document.getElementById("resultadoValor");

        resultadoValor.innerHTML = `
            <div>R$ ${custoTotal.toFixed(2)}</div>
            <div class="text-sm opacity-90 mt-1">
                ${litrosNecessarios.toFixed(2)}L • ${veiculo.modelo}
            </div>
        `;

        resultadoDiv.classList.remove("hidden");
        resultadoDiv.classList.add("animate-fade-in-up");
        showMessage("Custo calculado com sucesso!");
        resultadoDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error("Erro ao calcular custo:", error);
        showMessage("Erro ao calcular custo da viagem!", "error");
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
});

// ===== Controle do sidebar mobile =====
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

// ===== Inicialização (BLOCO FINAL) =====
document.addEventListener("DOMContentLoaded", () => {
    loadVeiculos();

    // NOVO Listener para o botão de alternar inativos
    const toggleBtn = document.getElementById("toggleInativosBtn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            showInactive = !showInactive; // Inverte o estado
            loadVeiculos(); // Recarrega a lista para aplicar o novo filtro
        });
    }

    // CORREÇÃO GOOGLE MAPS: Espera a API do Google Maps carregar
    const mapLoadCheck = setInterval(() => {
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            clearInterval(mapLoadCheck);
            initMap();

            setTimeout(() => {
                document.querySelector("#sidebar").classList.add("animate-slide-in-left");
            }, 100);
        }
    }, 100);

    window.addEventListener('error', (e) => {
        console.error('Erro global capturado:', e.error);
    });

    console.log("Script da Calculadora de Combustível carregado com sucesso!");
});