// src/address.js
import { getCurrentUserId } from "./auth.js";
import { showMessage, highlightLoginButton } from "./utils.js";
import { addressService } from "./services/addressService.js";
import { getLastPlace } from "./map.js";

const FIELD_MAP = {
    origem: { starBtn: "starOrigemBtn", input: "origem", chips: "chipsOrigem" },
    destino: { starBtn: "starDestinoBtn", input: "destino", chips: "chipsDestino" },
    parada1: { starBtn: "starParada1Btn", input: "parada1", chips: "chipsParada1" },
    parada2: { starBtn: "starParada2Btn", input: "parada2", chips: "chipsParada2" },
};

let cachedEnderecos = [];

async function handleSaveAddress(fieldKey) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) { highlightLoginButton(); return; }

    const { input } = FIELD_MAP[fieldKey];
    const inputEl = document.getElementById(input);
    const value = inputEl.value.trim();
    if (!value) { showMessage("Digite ou selecione um endereço antes de salvar.", "error"); return; }

    const place = getLastPlace(fieldKey);
    const apelido = prompt("Como quer chamar este endereço? (Ex: Casa, Trabalho)");
    if (!apelido || !apelido.trim()) return;

    const lat = place?.geometry?.location?.lat ? place.geometry.location.lat() : null;
    const lng = place?.geometry?.location?.lng ? place.geometry.location.lng() : null;

    try {
        await addressService.create(currentUserId, {
            apelido: apelido.trim(),
            endereco: place?.formatted_address || value,
            lat,
            lng
        });
        showMessage("Endereço salvo com sucesso!", "success");
        await loadAddresses();
    } catch (e) {
        console.error("Erro ao salvar endereço:", e);
        showMessage("Erro ao salvar endereço.", "error");
    }
}

async function handleDeleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Tem certeza que deseja excluir este endereço?")) return;
    try {
        await addressService.remove(id);
        showMessage("Endereço excluído com sucesso!", "success");
        await loadAddresses();
    } catch (e) {
        console.error("Erro ao excluir endereço:", e);
        showMessage("Erro ao excluir endereço.", "error");
    }
}

function renderAddressList(enderecos) {
    const list = document.getElementById("enderecosList");
    if (!list) return;

    if (enderecos.length === 0) {
        list.innerHTML = `<div class="p-6 text-center text-gray-500">
            <i class="fas fa-map-marker-alt empty-state-icon text-3xl text-gray-600 mb-2"></i>
            <p>Nenhum endereço salvo ainda. Use a estrela ao lado dos campos de Origem/Destino/Parada para salvar.</p>
        </div>`;
        return;
    }

    list.innerHTML = "";
    enderecos.sort((a, b) => a.apelido.localeCompare(b.apelido)).forEach(end => {
        const card = document.createElement("div");
        card.className = "vehicle-card";
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="font-semibold text-lg"><i class="fas fa-star text-yellow-400 mr-1"></i>${end.apelido}</h3>
                    <p class="text-sm text-gray-300 mt-1">${end.endereco}</p>
                </div>
                <button class="btn-delete-endereco text-red-400 hover:text-red-300" data-id="${end.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(card);
    });
    list.querySelectorAll(".btn-delete-endereco").forEach(btn => btn.addEventListener("click", handleDeleteAddress));
}

function renderChips(fieldKey, enderecos) {
    const { chips, input } = FIELD_MAP[fieldKey];
    const container = document.getElementById(chips);
    if (!container) return;

    if (enderecos.length === 0) { container.innerHTML = ""; container.classList.add("hidden"); return; }

    container.classList.remove("hidden");
    container.innerHTML = "";
    enderecos.forEach(end => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "address-chip";
        chip.innerHTML = `<i class="fas fa-star text-yellow-400 mr-1"></i>${end.apelido}`;
        chip.addEventListener("click", () => {
            document.getElementById(input).value = end.endereco;
        });
        container.appendChild(chip);
    });
}

export async function loadAddresses() {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        cachedEnderecos = [];
        const list = document.getElementById("enderecosList");
        if (list) list.innerHTML = `<div class="p-4 text-center text-gray-500">Faça login para salvar endereços.</div>`;
        Object.keys(FIELD_MAP).forEach(key => renderChips(key, []));
        return;
    }

    try {
        cachedEnderecos = await addressService.getAll(currentUserId);
        renderAddressList(cachedEnderecos);
        Object.keys(FIELD_MAP).forEach(key => renderChips(key, cachedEnderecos));
    } catch (e) {
        console.error("Erro ao carregar endereços:", e);
        showMessage("Erro ao carregar endereços.", "error");
    }
}

export function initializeAddressListeners() {
    Object.entries(FIELD_MAP).forEach(([fieldKey, { starBtn }]) => {
        const btn = document.getElementById(starBtn);
        if (btn) btn.addEventListener("click", () => handleSaveAddress(fieldKey));
    });
}
