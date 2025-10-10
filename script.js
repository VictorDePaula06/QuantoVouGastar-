import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, getDoc, query, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; // NOVO: Firebase Auth

// ===== Configuração Firebase (MANTER SUAS CHAVES) =====
const firebaseConfig = {
    apiKey: "AIzaSyCP3YOpgh50JgMNwcm5ITWFuyYgf40eQnU",
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
const auth = getAuth(app); // Inicializa o Auth

// ===== Variáveis globais para o mapa e estado da UI =====
let map;
let directionsService;
let directionsRenderer;
let originMarker;
let destinationMarker;
let autocompleteOrigin;
let autocompleteDestination;
let autocompleteParada1;
let autocompleteParada2;
let parada1Marker;
let parada2Marker;
let editId = null;
let showInactive = false;
let distanciaIdaPura = 0;

let veiculoSelecionadoData = null;
let currentUserId = null; // NOVO: Armazena o ID do usuário logado


// ===== Inicializar Google Maps (Mantida) =====
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 5,
        center: { lat: -14.2350, lng: -51.9253 },
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

    setupAutocomplete();
};

// ===== Configurar Autocomplete (Mantida) =====
function setupAutocomplete() {
    const originInput = document.getElementById("origem");
    const destinationInput = document.getElementById("destino");
    const parada1Input = document.getElementById("parada1");
    const parada2Input = document.getElementById("parada2");

    autocompleteOrigin = new google.maps.places.Autocomplete(originInput, {
        componentRestrictions: { country: "br" },
        fields: ["place_id", "geometry", "name", "formatted_address"]
    });

    autocompleteDestination = new google.maps.places.Autocomplete(destinationInput, {
        componentRestrictions: { country: "br" },
        fields: ["place_id", "geometry", "name", "formatted_address"]
    });

    autocompleteParada1 = new google.maps.places.Autocomplete(parada1Input, {
        componentRestrictions: { country: "br" },
        fields: ["place_id", "geometry", "name", "formatted_address"]
    });

    autocompleteParada2 = new google.maps.places.Autocomplete(parada2Input, {
        componentRestrictions: { country: "br" },
        fields: ["place_id", "geometry", "name", "formatted_address"]
    });


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

    autocompleteParada1.addListener("place_changed", () => {
        const place = autocompleteParada1.getPlace();
        if (place.geometry) {
            updateParadaMarker(place, 1);
        }
    });

    autocompleteParada2.addListener("place_changed", () => {
        const place = autocompleteParada2.getPlace();
        if (place.geometry) {
            updateParadaMarker(place, 2);
        }
    });
}

// ===== Funções de Marcadores (Mantidas) =====
function fitMapToMarkers() {
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(originMarker.getPosition());
    bounds.extend(destinationMarker.getPosition());
    if (parada1Marker) bounds.extend(parada1Marker.getPosition());
    if (parada2Marker) bounds.extend(parada2Marker.getPosition());
    map.fitBounds(bounds);

    google.maps.event.addListenerOnce(map, 'bounds_changed', function () {
        if (map.getZoom() > 15) {
            map.setZoom(15);
        }
    });
}

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

function updateParadaMarker(place, index) {
    let marker;
    let iconColor = index === 1 ? '#f59e0b' : '#d97706';

    if (index === 1) {
        if (parada1Marker) parada1Marker.setMap(null);
        marker = parada1Marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: "Parada 1: " + place.name,
        });
    } else {
        if (parada2Marker) parada2Marker.setMap(null);
        marker = parada2Marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: "Parada 2: " + place.name,
        });
    }

    marker.setIcon({
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="12" fill="${iconColor}" stroke="#ffffff" stroke-width="3"/>
                <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">${index}</text>
            </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
    });

    if (originMarker && destinationMarker) {
        fitMapToMarkers();
    }
}

// ===== Exibir mensagens (Mantida) =====
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

// =========================================================
// FUNÇÕES DE AUTENTICAÇÃO (NOVO)
// =========================================================

async function signIn() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Erro no login:", error);
        showMessage("Falha ao entrar com Google. Tente novamente.", "error");
    }
}

async function signOutUser() {
    try {
        await signOut(auth);
        showMessage("Você saiu da sua conta.", "info");
    } catch (error) {
        console.error("Erro no logout:", error);
    }
}

function updateUI(user) {
    const authBtn = document.getElementById("authBtn");
    const userInfo = document.getElementById("userInfo");
    const userNameDisplay = document.getElementById("userName");
    const userEmailDisplay = document.getElementById("userEmail");

    if (user) {
        // Usuário logado
        currentUserId = user.uid;
        userNameDisplay.textContent = user.displayName || 'Usuário';
        userEmailDisplay.textContent = user.email;
        userInfo.classList.remove("hidden");

        // NOVO: Ícone de Perfil/Sair
        authBtn.innerHTML = `
            <i class="fas fa-sign-out-alt text-lg md:mr-1"></i>
            <span class="ml-2 hidden md:inline">Sair</span>
        `;
        authBtn.onclick = signOutUser;
    } else {
        // Usuário deslogado
        currentUserId = null;
        userInfo.classList.add("hidden");

        // NOVO: Ícone de Entrar
        authBtn.innerHTML = `
            <i class="fab fa-google text-lg md:mr-1"></i>
            <span class="ml-2 hidden md:inline">Entrar</span>
        `;
        authBtn.onclick = signIn;
    }

    loadVeiculos();
}

// Listener de estado de autenticação (NOVO)
onAuthStateChanged(auth, (user) => {
    updateUI(user);
    if (user) {
        showMessage(`Bem-vindo, ${user.displayName}!`, "success");
    }
});


// ===== Carregar veículos (AJUSTADO: QUERY POR UID) =====
async function loadVeiculos() {
    const list = document.getElementById("veiculosList");
    const select = document.getElementById("veiculo");
    const toggleBtn = document.getElementById("toggleInativosBtn");

    list.innerHTML = "";
    select.innerHTML = '<option value="">Escolha um veículo</option>';
    veiculoSelecionadoData = null;

    // Se não houver usuário logado, limpa e mostra mensagem
    if (!currentUserId) {
        list.innerHTML = `<div class="p-4 text-center text-gray-500">Faça login para gerenciar seus veículos.</div>`;
        return;
    }

    // 1. ATUALIZA O BOTÃO
    if (toggleBtn) {
        toggleBtn.innerHTML = showInactive
            ? '<i class="fas fa-eye-slash mr-1"></i> <span>Esconder Inativos</span>'
            : '<i class="fas fa-eye mr-1"></i> <span>Mostrar Inativos</span>';
    }

    try {
        // NOVO: Query para filtrar veículos APENAS pelo UID do usuário logado
        const q = query(collection(db, "veiculos"), where("userId", "==", currentUserId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            list.innerHTML = `<div class="p-4 text-center text-gray-500">Nenhum veículo cadastrado.</div>`;
        }

        snapshot.forEach(d => {
            const v = d.data();
            const ef_gas = v.eficiencias?.gasolina || v.eficiencia || 0;
            const ef_eta = v.eficiencias?.etanol || 0;
            const ef_gnv = v.eficiencias?.gnv || 0;

            if (!v.ativo && !showInactive) {
                return;
            }

            let eficienciaText = `${ef_gas} km/l (G)`;
            if (ef_eta > 0) {
                eficienciaText += ` / ${ef_eta} km/l (E)`;
            }
            if (ef_gnv > 0) {
                eficienciaText += ` / ${ef_gnv} km/m³ (GNV)`;
            }

            const li = document.createElement("li");
            li.className = `vehicle-card ${v.ativo ? '' : 'inactive'}`;

            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="font-medium text-gray-900">${v.modelo}</div>
                        <div class="text-sm text-gray-500">${eficienciaText} ${v.ativo ? '' : '(Inativo)'}</div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="px-3 py-1 text-xs bg-primary-100 text-primary-600 hover:bg-primary-200 rounded-lg transition-colors" 
                                onclick="editVeiculo('${d.id}','${v.modelo}',${ef_gas},${ef_eta},${ef_gnv})">
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

            if (v.ativo) {
                const option = document.createElement("option");
                option.value = d.id;
                option.textContent = `${v.modelo} (${eficienciaText})`;
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
window.signIn = signIn; // Torna o login acessível ao botão
window.signOutUser = signOutUser; // Torna o logout acessível ao botão

// Listener para salvar os dados do veículo selecionado
document.getElementById("veiculo").addEventListener('change', async (e) => {
    const veiculoId = e.target.value;
    veiculoSelecionadoData = null;

    if (veiculoId) {
        try {
            // NOVO: Verifica se o doc pertence ao usuário logado
            const docSnap = await getDoc(doc(db, "veiculos", veiculoId));
            const veiculo = docSnap.data();

            if (docSnap.exists() && veiculo.userId === currentUserId) {
                veiculoSelecionadoData = veiculo;
            } else {
                showMessage("Veículo não encontrado ou não pertence a esta conta.", "error");
            }

        } catch (error) {
            console.error("Erro ao carregar dados do veículo:", error);
        }
    }
});


// ===== Cadastro de veículo (AJUSTADO: INCLUI USER ID) =====
document.getElementById("addVeiculoBtn").addEventListener("click", async () => {
    if (!currentUserId) {
        showMessage("Faça login para cadastrar um veículo.", "error");
        return;
    }

    const modelo = document.getElementById("novoModelo").value.trim();
    const ef_gas_str = document.getElementById("novaEficienciaGasolina").value.trim();
    const ef_eta_str = document.getElementById("novaEficienciaEtanol").value.trim();
    const ef_gnv_str = document.getElementById("novaEficienciaGnv").value.trim();

    const ef_gas = parseFloat(ef_gas_str);
    const ef_eta = parseFloat(ef_eta_str);
    const ef_gnv = parseFloat(ef_gnv_str);

    if (!modelo || isNaN(ef_gas) || ef_gas <= 0) {
        showMessage("Preencha o Modelo e a Eficiência Gasolina corretamente!", "error");
        return;
    }

    const btn = document.getElementById("addVeiculoBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        await addDoc(collection(db, "veiculos"), {
            modelo,
            userId: currentUserId, // NOVO: Chave de segurança
            eficiencias: {
                gasolina: ef_gas,
                etanol: isNaN(ef_eta) ? 0 : ef_eta,
                gnv: isNaN(ef_gnv) ? 0 : ef_gnv
            },
            ativo: true
        });
        showMessage("Veículo cadastrado com sucesso!");
        document.getElementById("novoModelo").value = "";
        document.getElementById("novaEficienciaGasolina").value = "";
        document.getElementById("novaEficienciaEtanol").value = "";
        document.getElementById("novaEficienciaGnv").value = "";
        loadVeiculos();
    } catch (e) {
        console.error(e);
        showMessage("Erro ao cadastrar veículo!", "error");
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
});

// ===== Editar veículo (AJUSTADO: Checagem de Login) =====
function editVeiculo(id, modelo, ef_gas, ef_eta, ef_gnv) {
    if (!currentUserId) {
        showMessage("Faça login para editar veículos.", "error");
        return;
    }
    editId = id;
    document.getElementById("editModelo").value = modelo;
    document.getElementById("editEficienciaGasolina").value = ef_gas;
    document.getElementById("editEficienciaEtanol").value = ef_eta > 0 ? ef_eta : '';
    document.getElementById("editEficienciaGnv").value = ef_gnv > 0 ? ef_gnv : '';

    document.getElementById("editModal").classList.remove("hidden");
    document.getElementById("editModal").classList.add("flex");
}

document.getElementById("cancelEditBtn").addEventListener("click", () => {
    document.getElementById("editModal").classList.add("hidden");
    document.getElementById("editModal").classList.remove("flex");
});

document.getElementById("saveEditBtn").addEventListener("click", async () => {
    if (!currentUserId) return;

    const modelo = document.getElementById("editModelo").value.trim();
    const ef_gas = parseFloat(document.getElementById("editEficienciaGasolina").value);
    const ef_eta = parseFloat(document.getElementById("editEficienciaEtanol").value || 0);
    const ef_gnv = parseFloat(document.getElementById("editEficienciaGnv").value || 0);

    if (!modelo || isNaN(ef_gas) || ef_gas <= 0) {
        showMessage("Preencha o Modelo e a Eficiência Gasolina corretamente!", "error");
        return;
    }

    // Otimização: A regra do Firestore deve garantir que o usuário só edite o que é dele.
    try {
        await updateDoc(doc(db, "veiculos", editId), {
            modelo,
            eficiencias: {
                gasolina: ef_gas,
                etanol: isNaN(ef_eta) ? 0 : ef_eta,
                gnv: isNaN(ef_gnv) ? 0 : ef_gnv
            }
        });
        showMessage("Veículo atualizado com sucesso!");
        loadVeiculos();
        document.getElementById("editModal").classList.add("hidden");
        document.getElementById("editModal").classList.remove("flex");
    } catch {
        showMessage("Erro ao atualizar veículo! Verifique se você é o dono.", "error");
    }
});

// ===== Ativar/Inativar veículo (AJUSTADO: Checagem de Login) =====
async function toggleAtivo(id, ativo) {
    if (!currentUserId) {
        showMessage("Faça login para alterar o status do veículo.", "error");
        return;
    }
    try {
        // Otimização: A regra do Firestore deve garantir que o usuário só edite o que é dele.
        await updateDoc(doc(db, "veiculos", id), { ativo: !ativo });
        showMessage(ativo ? "Veículo inativado!" : "Veículo ativado!");
        loadVeiculos();
    } catch {
        showMessage("Erro ao alterar status do veículo! Verifique se você é o dono.", "error");
    }
}

// ===== Funções de Cálculo e Rota (Mantidas) =====

function updateDistanceDisplay(distanciaIda, idaEVoltaChecked) {
    const display = document.getElementById("distanciaDisplay");

    if (distanciaIda === 0) {
        display.textContent = "-- km";
        return;
    }

    const distanciaFinal = idaEVoltaChecked ? distanciaIda * 2 : distanciaIda;
    const rotulo = idaEVoltaChecked ? ' (Ida e Volta)' : '';

    display.textContent = `${distanciaFinal.toFixed(2)} km${rotulo}`;
}


document.getElementById("calcularDistanciaBtn").addEventListener("click", () => {
    const origem = document.getElementById("origem").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const parada1 = document.getElementById("parada1").value.trim();
    const parada2 = document.getElementById("parada2").value.trim();

    if (!origem || !destino) {
        showMessage("Informe origem e destino!", "error");
        return;
    }

    const btn = document.getElementById("calcularDistanciaBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    const waypoints = [];
    if (parada1) {
        waypoints.push({ location: parada1, stopover: true });
    }
    if (parada2) {
        waypoints.push({ location: parada2, stopover: true });
    }

    const request = {
        origin: origem,
        destination: destino,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
    };

    directionsService.route(
        request,
        (result, status) => {
            btn.classList.remove("loading");
            btn.disabled = false;

            if (status === "OK") {
                directionsRenderer.setDirections(result);

                let totalDistanceMeters = 0;
                result.routes[0].legs.forEach(leg => {
                    totalDistanceMeters += leg.distance.value;
                });

                const distanceKm = totalDistanceMeters / 1000;

                distanciaIdaPura = distanceKm;

                const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;
                updateDistanceDisplay(distanciaIdaPura, idaEVoltaChecked);

                if (originMarker) originMarker.setMap(null);
                if (destinationMarker) destinationMarker.setMap(null);
                if (parada1Marker) parada1Marker.setMap(null);
                if (parada2Marker) parada2Marker.setMap(null);

                showMessage(`Rota calculada: ${distanceKm.toFixed(2)} km (incluindo paradas)`);

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


document.getElementById("calcularBtn").addEventListener("click", async () => {
    const veiculoId = document.getElementById("veiculo").value;
    const tipoCombustivel = document.getElementById("combustivel").value;
    const preco = parseFloat(document.getElementById("precoGasolina").value);
    const distanciaText = document.getElementById("distanciaDisplay").textContent;

    const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;
    const FATOR_MULTIPLICADOR = idaEVoltaChecked ? 2 : 1;

    if (!veiculoId || !tipoCombustivel || isNaN(preco) || preco <= 0 || distanciaText === "-- km") {
        showMessage("Preencha todos os dados da viagem corretamente!", "error");
        return;
    }

    if (!veiculoSelecionadoData) {
        showMessage("Erro: Selecione o veículo novamente.", "error");
        return;
    }

    const eficiencia = veiculoSelecionadoData.eficiencias[tipoCombustivel];

    if (isNaN(eficiencia) || eficiencia <= 0) {
        showMessage(`Erro: Eficiência ${tipoCombustivel} não definida para o veículo.`, "error");
        return;
    }

    const distanciaBase = distanciaIdaPura;

    if (distanciaBase === 0) {
        showMessage("Calcule a rota primeiro!", "error");
        return;
    }

    const distancia_ajustada = distanciaBase * FATOR_MULTIPLICADOR;

    const btn = document.getElementById("calcularBtn");
    btn.classList.add("loading");
    btn.disabled = true;

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
            <div class="text-sm opacity-90 mt-1">
                ${litrosNecessarios.toFixed(2)} ${unidade} • ${veiculoSelecionadoData.modelo}
            </div>
            <div class="text-xs opacity-80 mt-1">
                Distância Total: ${distancia_ajustada.toFixed(2)} km ${infoViagem}
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

// ===== Controle do sidebar mobile (Mantido) =====
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
    // loadVeiculos() é chamado por updateUI agora!

    const toggleBtn = document.getElementById("toggleInativosBtn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            showInactive = !showInactive;
            loadVeiculos();
        });
    }

    const checkboxIdaEVolta = document.getElementById("idaEVolta");
    if (checkboxIdaEVolta) {
        checkboxIdaEVolta.addEventListener('change', () => {
            updateDistanceDisplay(distanciaIdaPura, checkboxIdaEVolta.checked);
        });
    }

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