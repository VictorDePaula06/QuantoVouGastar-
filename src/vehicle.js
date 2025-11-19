// src/vehicle.js
import { db, getCurrentUserId, getShowInactive, setShowInactive } from "./auth.js";
import { showMessage, highlightLoginButton } from "./utils.js";
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variável para o veículo selecionado
export let veiculoSelecionadoData = null;

// Variável para a Edição (expõe globalmente)
window.editId = null;

// Função para carregar e exibir os veículos
export async function loadVeiculos() {
    const list = document.getElementById("veiculosList");
    const select = document.getElementById("veiculo");
    const toggleBtn = document.getElementById("toggleInativosBtn");
    const currentUserId = getCurrentUserId();
    const showInactive = getShowInactive();

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

        veiculos.sort((a, b) => a.modelo.localeCompare(b.modelo)).forEach(v => {
            if (!v.ativo) inactiveCount++;
            if (!showInactive && !v.ativo) return;

            const ef_gas = v.eficiencias?.gasolina || v.eficiencia || 0;
            const ef_eta = v.eficiencias?.etanol || 0;
            const ef_gnv = v.eficiencias?.gnv || 0;
            const ef_die = v.eficiencias?.diesel || 0;

            // Adiciona ao Select
            const option = document.createElement("option");
            option.value = v.id;
            option.textContent = v.modelo + (v.ativo ? '' : ' (Inativo)');
            select.appendChild(option);

            // Adiciona à Lista
            const card = document.createElement("div");
            card.className = `vehicle-card ${v.ativo ? '' : 'inactive'}`;
            card.innerHTML = `
                <div class="flex justify-between items-center">
                    <h3 class="font-semibold text-lg">${v.modelo}</h3>
                    <div class="space-x-2 flex items-center">
                        <button class="btn-edit text-blue-400 hover:text-blue-300" data-id="${v.id}" data-modelo="${v.modelo}" data-gas="${ef_gas}" data-eta="${ef_eta}" data-gnv="${ef_gnv}" data-die="${ef_die}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-toggle-active text-yellow-400 hover:text-yellow-300" data-id="${v.id}" data-ativo="${v.ativo}">
                            <i class="fas fa-${v.ativo ? 'eye-slash' : 'eye'}"></i>
                        </button>
                        <button class="btn-delete text-red-400 hover:text-red-300" data-id="${v.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="text-sm text-gray-300 mt-1">
                    ${ef_gas ? `Gas: ${ef_gas} km/l` : ''}
                    ${ef_eta ? ` | Etanol: ${ef_eta} km/l` : ''}
                    ${ef_gnv ? ` | GNV: ${ef_gnv} km/m³` : ''}
                    ${ef_die ? ` | Diesel: ${ef_die} km/l` : ''}
                </p>
            `;
            list.appendChild(card);
        });

        if (inactiveCount > 0) {
            toggleBtn.classList.remove("hidden");
            toggleBtn.textContent = showInactive ? `Esconder Inativos (${inactiveCount})` : `Mostrar Inativos (${inactiveCount})`;
        } else {
            toggleBtn.classList.add("hidden");
        }

        list.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', handleEditClick));
        list.querySelectorAll('.btn-toggle-active').forEach(btn => btn.addEventListener('click', handleToggleActive));
        list.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', handleDelete));

    } catch (e) {
        console.error("Erro ao carregar veículos:", e);
        showMessage("Erro ao carregar veículos.", "error");
    }
}

async function handleAddVeiculo() {
    const modelo = document.getElementById("novoModelo").value.trim();
    const ef_gas = parseFloat(document.getElementById("novaEficienciaGasolina").value) || 0;
    const ef_eta = parseFloat(document.getElementById("novaEficienciaEtanol").value) || 0;
    const ef_gnv = parseFloat(document.getElementById("novaEficienciaGnv").value) || 0;
    const ef_die = parseFloat(document.getElementById("novaEficienciaDiesel").value) || 0;
    const currentUserId = getCurrentUserId();

    if (!currentUserId) { highlightLoginButton(); return; }
    if (!modelo) { showMessage("Informe o modelo do veículo.", "error"); return; }
    if (ef_gas <= 0 && ef_eta <= 0 && ef_gnv <= 0 && ef_die <= 0) { showMessage("Informe pelo menos uma eficiência de combustível.", "error"); return; }

    try {
        await addDoc(collection(db, "veiculos"), {
            userId: currentUserId,
            modelo,
            eficiencias: {
                gasolina: ef_gas,
                etanol: ef_eta,
                gnv: ef_gnv,
                diesel: ef_die
            },
            ativo: true,
            createdAt: new Date()
        });
        showMessage("Veículo adicionado com sucesso!", "success");
        document.getElementById("novoModelo").value = "";
        document.getElementById("novaEficienciaGasolina").value = "";
        document.getElementById("novaEficienciaEtanol").value = "";
        document.getElementById("novaEficienciaGnv").value = "";
        document.getElementById("novaEficienciaDiesel").value = "";
        loadVeiculos();
    } catch (e) {
        console.error("Erro ao adicionar veículo:", e);
        showMessage("Erro ao adicionar veículo.", "error");
    }
}

function handleEditClick(e) {
    const btn = e.currentTarget;
    window.editId = btn.dataset.id;
    document.getElementById("editModelo").value = btn.dataset.modelo;
    document.getElementById("editEficienciaGasolina").value = btn.dataset.gas;
    document.getElementById("editEficienciaEtanol").value = btn.dataset.eta;
    document.getElementById("editEficienciaGnv").value = btn.dataset.gnv;
    document.getElementById("editEficienciaDiesel").value = btn.dataset.die;
    document.getElementById("editModal").classList.remove("hidden");
    document.getElementById("editModal").classList.add("flex");
}

async function handleSaveEdit() {
    const id = window.editId;
    const modelo = document.getElementById("editModelo").value.trim();
    const ef_gas = parseFloat(document.getElementById("editEficienciaGasolina").value) || 0;
    const ef_eta = parseFloat(document.getElementById("editEficienciaEtanol").value) || 0;
    const ef_gnv = parseFloat(document.getElementById("editEficienciaGnv").value) || 0;
    const ef_die = parseFloat(document.getElementById("editEficienciaDiesel").value) || 0;

    if (!modelo) { showMessage("Informe o modelo do veículo.", "error"); return; }
    if (ef_gas <= 0 && ef_eta <= 0 && ef_gnv <= 0 && ef_die <= 0) { showMessage("Informe pelo menos uma eficiência de combustível.", "error"); return; }

    try {
        const veiculoRef = doc(db, "veiculos", id);
        await updateDoc(veiculoRef, {
            modelo,
            eficiencias: {
                gasolina: ef_gas,
                etanol: ef_eta,
                gnv: ef_gnv,
                diesel: ef_die
            }
        });
        showMessage("Veículo atualizado com sucesso!", "success");
        document.getElementById("editModal").classList.add("hidden");
        document.getElementById("editModal").classList.remove("flex");
        loadVeiculos();
    } catch (e) {
        console.error("Erro ao atualizar veículo:", e);
        showMessage("Erro ao atualizar veículo.", "error");
    }
}

async function handleToggleActive(e) {
    const id = e.currentTarget.dataset.id;
    const ativo = e.currentTarget.dataset.ativo === 'true';
    try {
        const veiculoRef = doc(db, "veiculos", id);
        await updateDoc(veiculoRef, { ativo: !ativo });
        showMessage(`Veículo ${!ativo ? 'ativado' : 'inativado'} com sucesso!`, "info");
        loadVeiculos();
    } catch (e) {
        console.error("Erro ao alterar status:", e);
        showMessage("Erro ao alterar status do veículo.", "error");
    }
}

async function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Tem certeza que deseja excluir este veículo?")) return;
    try {
        await deleteDoc(doc(db, "veiculos", id));
        showMessage("Veículo excluído com sucesso!", "success");
        loadVeiculos();
    } catch (e) {
        console.error("Erro ao excluir veículo:", e);
        showMessage("Erro ao excluir veículo.", "error");
    }
}

export function initializeVehicleListeners() {
    document.getElementById("addVeiculoBtn").addEventListener("click", handleAddVeiculo);
    document.getElementById("saveEditBtn").addEventListener("click", handleSaveEdit);
    document.getElementById("cancelEditBtn").addEventListener("click", () => {
        document.getElementById("editModal").classList.add("hidden");
        document.getElementById("editModal").classList.remove("flex");
    });
    document.getElementById("toggleInativosBtn").addEventListener("click", () => {
        setShowInactive(!getShowInactive());
        loadVeiculos();
    });
}

export function getVeiculoSelecionadoData() {
    return veiculoSelecionadoData;
}

export function setVeiculoSelecionadoData(data) {
    veiculoSelecionadoData = data;
}
