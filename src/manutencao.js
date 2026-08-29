// src/manutencao.js
import { getCurrentUserId } from "./auth.js";
import { showMessage, highlightLoginButton } from "./utils.js";
import { vehicleService } from "./services/vehicleService.js";
import { maintenanceService } from "./services/maintenanceService.js";

const TIPOS_MANUTENCAO = [
    {
        id: "oleo", label: "Troca de Óleo", icon: "fa-oil-can", km: 5000, meses: 6,
        motivo: "O óleo perde viscosidade e se contamina com o uso. Rodar além do prazo reduz a lubrificação e aumenta o desgaste do motor, podendo causar dano permanente."
    },
    {
        id: "filtro_oleo", label: "Filtro de Óleo", icon: "fa-filter", km: 5000, meses: 6,
        motivo: "Troca sempre junto com o óleo. Um filtro saturado deixa impurezas circularem pelo motor, anulando parte do benefício do óleo novo."
    },
    {
        id: "filtro_ar", label: "Filtro de Ar", icon: "fa-wind", km: 10000, meses: 12,
        motivo: "Filtro sujo restringe a entrada de ar, piora a queima de combustível e aumenta o consumo — além de forçar o motor."
    },
    {
        id: "pneus", label: "Rodízio de Pneus", icon: "fa-circle-notch", km: 10000, meses: 12,
        motivo: "Equilibra o desgaste entre os pneus, aumentando a vida útil de todos e mantendo a aderência e a segurança na frenagem/curvas."
    },
    {
        id: "correia_dentada", label: "Correia Dentada", icon: "fa-cog", km: 60000, meses: 60,
        motivo: "Um dos itens mais críticos: se romper em uso, pode causar dano grave (às vezes total) ao motor. Nunca vale a pena atrasar essa troca."
    },
    {
        id: "outro", label: "Outro", icon: "fa-wrench", km: 10000, meses: 12,
        motivo: "Use para qualquer manutenção não listada acima. Consulte o manual do seu veículo para o intervalo recomendado pelo fabricante."
    },
];

let manutencoesCache = [];
let editingId = null;

function tipoInfo(tipoId) {
    return TIPOS_MANUTENCAO.find(t => t.id === tipoId) || TIPOS_MANUTENCAO[TIPOS_MANUTENCAO.length - 1];
}

function formatDateBR(isoDate) {
    if (!isoDate) return "--";
    const [ano, mes, dia] = isoDate.split("-");
    return `${dia}/${mes}/${ano}`;
}

function computeStatus(item, kmAtual) {
    const dataUltima = item.dataUltima ? new Date(item.dataUltima + "T00:00:00") : null;
    const kmUltima = Number(item.kmUltima) || 0;
    const intervaloKm = Number(item.intervaloKm) || 0;
    const intervaloMeses = Number(item.intervaloMeses) || 0;

    const kmProxima = intervaloKm ? kmUltima + intervaloKm : null;
    let dataProxima = null;
    if (dataUltima && intervaloMeses) {
        dataProxima = new Date(dataUltima);
        dataProxima.setMonth(dataProxima.getMonth() + intervaloMeses);
    }

    const kmRestante = (kmAtual != null && !isNaN(kmAtual) && kmProxima != null) ? kmProxima - kmAtual : null;
    const diasRestantes = dataProxima ? Math.ceil((dataProxima - new Date()) / 86400000) : null;

    let status = "ok";
    if ((kmRestante !== null && kmRestante <= 0) || (diasRestantes !== null && diasRestantes <= 0)) {
        status = "vencido";
    } else if ((kmRestante !== null && intervaloKm && kmRestante <= intervaloKm * 0.1) || (diasRestantes !== null && diasRestantes <= 30)) {
        status = "proximo";
    }

    return { status, kmProxima, dataProxima, kmRestante, diasRestantes };
}

function statusBadgeHtml(status) {
    if (status === "vencido") return `<span class="maint-badge maint-badge-red"><i class="fas fa-exclamation-circle mr-1"></i>Vencida</span>`;
    if (status === "proximo") return `<span class="maint-badge maint-badge-yellow"><i class="fas fa-clock mr-1"></i>Próxima</span>`;
    return `<span class="maint-badge maint-badge-green"><i class="fas fa-check-circle mr-1"></i>Em dia</span>`;
}

function getKmAtual() {
    const val = parseFloat(document.getElementById("maintKmAtual").value);
    return isNaN(val) ? null : val;
}

function renderTipoOptions() {
    const select = document.getElementById("maintTipo");
    select.innerHTML = TIPOS_MANUTENCAO.map(t => `<option value="${t.id}">${t.label}</option>`).join("");
}

function renderGuia() {
    const container = document.getElementById("guiaManutencao");
    if (!container) return;
    container.innerHTML = TIPOS_MANUTENCAO.map(t => `
        <div class="border-b border-gray-700 last:border-0 pb-3 last:pb-0">
            <h3 class="font-semibold text-sm text-gray-100">
                <i class="fas ${t.icon} mr-2 text-azul-ceu"></i>${t.label}
                <span class="text-xs font-normal text-gray-400">— a cada ${t.km.toLocaleString('pt-BR')} km ou ${t.meses} meses</span>
            </h3>
            <p class="text-sm text-gray-400 mt-1">${t.motivo}</p>
        </div>
    `).join("");
}

export async function loadVehiclesForMaintenance() {
    const select = document.getElementById("maintVeiculo");
    const currentUserId = getCurrentUserId();
    select.innerHTML = '<option value="">Escolha um veículo</option>';

    if (!currentUserId) {
        renderManutencoesList([]);
        document.getElementById("manutencoesList").innerHTML = `<div class="p-3 text-center text-sm text-gray-500">Faça login para gerenciar as manutenções dos seus veículos.</div>`;
        return;
    }

    try {
        const veiculos = await vehicleService.getAll(currentUserId);
        veiculos.filter(v => v.ativo !== false).sort((a, b) => a.modelo.localeCompare(b.modelo)).forEach(v => {
            const option = document.createElement("option");
            option.value = v.id;
            option.textContent = v.modelo;
            select.appendChild(option);
        });

        if (veiculos.length === 0) {
            document.getElementById("manutencoesList").innerHTML = `<div class="p-3 text-center text-sm text-gray-500">Nenhum veículo cadastrado ainda. Cadastre um na Calculadora de Combustível primeiro.</div>`;
        } else {
            document.getElementById("manutencoesList").innerHTML = `<div class="p-3 text-center text-sm text-gray-500">Selecione um veículo acima para ver as manutenções.</div>`;
        }
    } catch (e) {
        console.error("Erro ao carregar veículos:", e);
        showMessage("Erro ao carregar veículos.", "error");
    }
}

async function loadManutencoes(veiculoId) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId || !veiculoId) return;

    try {
        const todas = await maintenanceService.getAll(currentUserId);
        manutencoesCache = todas.filter(m => m.veiculoId === veiculoId);
        renderManutencoesList(manutencoesCache);
    } catch (e) {
        console.error("Erro ao carregar manutenções:", e);
        showMessage("Erro ao carregar manutenções.", "error");
    }
}

function renderManutencoesList(items) {
    const list = document.getElementById("manutencoesList");
    const veiculoId = document.getElementById("maintVeiculo").value;

    if (!veiculoId) {
        list.innerHTML = `<div class="p-3 text-center text-sm text-gray-500">Selecione um veículo acima para ver as manutenções.</div>`;
        return;
    }

    if (items.length === 0) {
        list.innerHTML = `<div class="p-4 text-center text-gray-500">
            <i class="fas fa-wrench empty-state-icon text-2xl text-gray-600 mb-1.5"></i>
            <p class="text-sm">Nenhuma manutenção registrada para este veículo ainda.</p>
        </div>`;
        return;
    }

    const kmAtual = getKmAtual();

    list.innerHTML = "";
    items.forEach(item => {
        const tipo = tipoInfo(item.tipo);
        const { status, kmProxima, dataProxima } = computeStatus(item, kmAtual);

        const proximaKmTexto = kmProxima != null ? `${kmProxima.toLocaleString('pt-BR')} km` : "--";
        const proximaDataTexto = dataProxima ? dataProxima.toLocaleDateString('pt-BR') : "--";

        const card = document.createElement("div");
        card.className = "vehicle-card";
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg"><i class="fas ${tipo.icon} mr-2 text-azul-ceu"></i>${tipo.label}</h3>
                    <p class="text-sm text-gray-300 mt-1">Última: ${formatDateBR(item.dataUltima)} a ${Number(item.kmUltima).toLocaleString('pt-BR')} km</p>
                    <p class="text-xs text-gray-400 mt-0.5">Próxima: em ${proximaKmTexto} ou até ${proximaDataTexto}</p>
                    <div class="mt-2">${statusBadgeHtml(status)}</div>
                </div>
                <div class="flex flex-col items-end space-y-2 flex-shrink-0 ml-2">
                    <div class="space-x-2 flex items-center">
                        <button class="btn-edit-maint text-azul-ceu hover:text-azul-ceu/70" data-id="${item.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete-maint text-red-400 hover:text-red-300" data-id="${item.id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <button class="btn-done-maint text-xs bg-verde-respira/20 border border-verde-respira/40 text-verde-respira hover:bg-verde-respira/30 rounded-lg px-2 py-1" data-id="${item.id}">
                        <i class="fas fa-check mr-1"></i>Feita agora
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll(".btn-edit-maint").forEach(btn => btn.addEventListener("click", handleEditClick));
    list.querySelectorAll(".btn-delete-maint").forEach(btn => btn.addEventListener("click", handleDelete));
    list.querySelectorAll(".btn-done-maint").forEach(btn => btn.addEventListener("click", handleMarkDone));
}

function handleEditClick(e) {
    const id = e.currentTarget.dataset.id;
    const item = manutencoesCache.find(m => m.id === id);
    if (!item) return;

    editingId = id;
    document.getElementById("maintTipo").value = item.tipo;
    document.getElementById("maintData").value = item.dataUltima || "";
    document.getElementById("maintKm").value = item.kmUltima || "";
    document.getElementById("maintIntervaloKm").value = item.intervaloKm || "";
    document.getElementById("maintIntervaloMeses").value = item.intervaloMeses || "";
    updateTipoMotivo();
    document.getElementById("addManutencaoForm").classList.remove("hidden");
    document.getElementById("addManutencaoForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Tem certeza que deseja excluir esta manutenção?")) return;
    try {
        await maintenanceService.remove(id);
        showMessage("Manutenção excluída com sucesso!", "success");
        loadManutencoes(document.getElementById("maintVeiculo").value);
    } catch (e) {
        console.error("Erro ao excluir manutenção:", e);
        showMessage("Erro ao excluir manutenção.", "error");
    }
}

async function handleMarkDone(e) {
    const id = e.currentTarget.dataset.id;
    const kmAtual = getKmAtual();
    if (kmAtual == null) { showMessage("Informe o km atual do veículo antes de marcar como feita.", "error"); return; }

    const hoje = new Date().toISOString().slice(0, 10);
    try {
        await maintenanceService.update(id, { dataUltima: hoje, kmUltima: kmAtual });
        showMessage("Manutenção atualizada! Marcada como feita hoje.", "success");
        loadManutencoes(document.getElementById("maintVeiculo").value);
    } catch (e) {
        console.error("Erro ao atualizar manutenção:", e);
        showMessage("Erro ao atualizar manutenção.", "error");
    }
}

async function handleSaveManutencao() {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) { highlightLoginButton(); return; }

    const veiculoId = document.getElementById("maintVeiculo").value;
    if (!veiculoId) { showMessage("Selecione um veículo primeiro.", "error"); return; }

    const tipo = document.getElementById("maintTipo").value;
    const dataUltima = document.getElementById("maintData").value;
    const kmUltima = parseFloat(document.getElementById("maintKm").value);
    const intervaloKm = parseFloat(document.getElementById("maintIntervaloKm").value) || 0;
    const intervaloMeses = parseFloat(document.getElementById("maintIntervaloMeses").value) || 0;

    if (!dataUltima || isNaN(kmUltima)) { showMessage("Preencha a data e o km da última troca.", "error"); return; }
    if (!intervaloKm && !intervaloMeses) { showMessage("Informe pelo menos um intervalo (km ou meses).", "error"); return; }

    const data = { veiculoId, tipo, dataUltima, kmUltima, intervaloKm, intervaloMeses };

    try {
        if (editingId) {
            await maintenanceService.update(editingId, data);
            showMessage("Manutenção atualizada com sucesso!", "success");
        } else {
            await maintenanceService.create(currentUserId, data);
            showMessage("Manutenção registrada com sucesso!", "success");
        }
        resetForm();
        loadManutencoes(veiculoId);
    } catch (e) {
        console.error("Erro ao salvar manutenção:", e);
        showMessage("Erro ao salvar manutenção.", "error");
    }
}

function resetForm() {
    editingId = null;
    document.getElementById("maintData").value = "";
    document.getElementById("maintKm").value = "";
    document.getElementById("addManutencaoForm").classList.add("hidden");
    applyTipoDefaults();
}

function updateTipoMotivo() {
    const tipo = tipoInfo(document.getElementById("maintTipo").value);
    const motivoEl = document.getElementById("maintTipoMotivo");
    if (motivoEl) motivoEl.textContent = tipo.motivo;
}

function applyTipoDefaults() {
    const tipo = tipoInfo(document.getElementById("maintTipo").value);
    document.getElementById("maintIntervaloKm").value = tipo.km;
    document.getElementById("maintIntervaloMeses").value = tipo.meses;
    updateTipoMotivo();
}

export function initMaintenance() {
    renderTipoOptions();
    applyTipoDefaults();
    renderGuia();

    document.getElementById("toggleGuiaBtn")?.addEventListener("click", () => {
        document.getElementById("guiaManutencao").classList.toggle("hidden");
    });

    document.getElementById("maintTipo").addEventListener("change", () => {
        if (editingId) updateTipoMotivo();
        else applyTipoDefaults();
    });

    document.getElementById("maintVeiculo").addEventListener("change", (e) => {
        loadManutencoes(e.target.value);
    });

    document.getElementById("maintKmAtual").addEventListener("input", () => {
        renderManutencoesList(manutencoesCache);
    });

    document.getElementById("toggleAddManutencaoBtn").addEventListener("click", () => {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) { highlightLoginButton(); return; }
        if (!document.getElementById("maintVeiculo").value) { showMessage("Selecione um veículo primeiro.", "error"); return; }
        document.getElementById("addManutencaoForm").classList.toggle("hidden");
    });

    document.getElementById("salvarManutencaoBtn").addEventListener("click", handleSaveManutencao);
}
