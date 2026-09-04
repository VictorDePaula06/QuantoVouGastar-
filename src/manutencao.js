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
        id: "filtro_combustivel", label: "Filtro de Combustível", icon: "fa-gas-pump", km: 10000, meses: 12,
        motivo: "Filtro entupido reduz o fluxo de combustível, causando perda de potência, engasgos e forçando a bomba de combustível."
    },
    {
        id: "amortecedores", label: "Amortecedores", icon: "fa-car-side", km: 40000, meses: 48,
        motivo: "Amortecedor gasto aumenta a distância de frenagem, prejudica a estabilidade em curvas e acelera o desgaste dos pneus e da suspensão."
    },
    {
        id: "pastilha_freio", label: "Pastilha de Freio", icon: "fa-compact-disc", km: 20000, meses: 24,
        motivo: "Pastilha gasta demora mais pra frear e pode danificar o disco de freio, tornando a troca bem mais cara. Item de segurança direta."
    },
    {
        id: "bateria", label: "Bateria", icon: "fa-car-battery", km: 0, meses: 24,
        motivo: "A bateria perde capacidade com o tempo (independente da quilometragem) e pode deixar você na mão sem aviso. Vida útil média de 2 a 3 anos."
    },
    {
        id: "alinhamento_balanceamento", label: "Alinhamento e Balanceamento", icon: "fa-crosshairs", km: 10000, meses: 12,
        motivo: "Fora de alinhamento, o carro puxa pra um lado e os pneus desgastam de forma irregular, encurtando a vida útil deles."
    },
    {
        id: "velas_ignicao", label: "Velas de Ignição", icon: "fa-bolt", km: 30000, meses: 36,
        motivo: "Vela desgastada piora a combustão, aumenta o consumo de combustível e pode causar falhas/trepidação no motor."
    },
    {
        id: "outro", label: "Outro", icon: "fa-wrench", km: 10000, meses: 12,
        motivo: "Use para qualquer manutenção não listada acima. Consulte o manual do seu veículo para o intervalo recomendado pelo fabricante."
    },
];

let manutencoesCache = [];
let historicoCache = [];
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

// ===== Índice de Saúde do Carro =====
// Calculado só com os itens que o usuário efetivamente registrou — itens "desconhecidos"
// (ex: não sabe quando trocou o amortecedor) ficam de fora da nota, só listados como lembrete.
function computeItemHealthPercent(item, kmAtual) {
    const { kmRestante, diasRestantes } = computeStatus(item, kmAtual);
    const intervaloKm = Number(item.intervaloKm) || 0;
    const intervaloMeses = Number(item.intervaloMeses) || 0;

    let pctKm = null;
    if (kmRestante != null && intervaloKm) {
        pctKm = Math.max(0, Math.min(1, kmRestante / intervaloKm));
    }
    let pctTempo = null;
    if (diasRestantes != null && intervaloMeses) {
        pctTempo = Math.max(0, Math.min(1, diasRestantes / (intervaloMeses * 30)));
    }

    if (pctKm == null && pctTempo == null) return 100;
    return Math.round(Math.min(pctKm ?? 1, pctTempo ?? 1) * 100);
}

function computeSaudeGeral(items, kmAtual) {
    if (!items || items.length === 0) return null;
    const total = items.reduce((sum, item) => sum + computeItemHealthPercent(item, kmAtual), 0);
    return Math.round(total / items.length);
}

function saudeBand(score) {
    if (score >= 80) return { label: "Excelente", color: "#10b981" };
    if (score >= 60) return { label: "Bom", color: "#3b82f6" };
    if (score >= 40) return { label: "Atenção", color: "#FFF08C" };
    return { label: "Crítico", color: "#ef4444" };
}

function renderSaudeGeral() {
    const card = document.getElementById("saudeCarroCard");
    if (!card) return;

    const veiculoId = document.getElementById("maintVeiculo").value;
    if (!veiculoId || manutencoesCache.length === 0) {
        card.classList.add("hidden");
        return;
    }

    const kmAtual = getKmAtual();
    const score = computeSaudeGeral(manutencoesCache, kmAtual);
    const band = saudeBand(score);

    card.classList.remove("hidden");
    document.getElementById("saudeScoreText").textContent = score;
    document.getElementById("saudeGaugeArc").setAttribute("stroke-dasharray", `${score}, 100`);
    document.getElementById("saudeGaugeArc").setAttribute("stroke", band.color);
    const labelEl = document.getElementById("saudeLabelText");
    labelEl.textContent = band.label;
    labelEl.style.color = band.color;
    document.getElementById("saudeSubText").textContent =
        `Baseado em ${manutencoesCache.length} ${manutencoesCache.length > 1 ? 'itens rastreados' : 'item rastreado'}`;

    const tiposRastreados = new Set(manutencoesCache.map(m => m.tipo));
    const naoRastreados = TIPOS_MANUTENCAO.filter(t => t.id !== "outro" && !tiposRastreados.has(t.id));
    const naoRastreadoEl = document.getElementById("saudeNaoRastreado");
    if (naoRastreados.length > 0) {
        naoRastreadoEl.classList.remove("hidden");
        naoRastreadoEl.innerHTML = `<p class="text-xs text-gray-500"><i class="fas fa-circle-question mr-1"></i>Ainda não rastreado (não entra na nota): ${naoRastreados.map(t => t.label).join(", ")}. Registre quando souber a última troca.</p>`;
    } else {
        naoRastreadoEl.classList.add("hidden");
    }
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
        document.getElementById("historicoManutList").innerHTML = "";
        document.getElementById("historicoManutResumo").textContent = "";
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

    loadHistorico(veiculoId);
}

async function loadHistorico(veiculoId) {
    const list = document.getElementById("historicoManutList");
    const resumo = document.getElementById("historicoManutResumo");
    if (!list) return;

    const currentUserId = getCurrentUserId();
    if (!currentUserId || !veiculoId) {
        list.innerHTML = "";
        resumo.textContent = "";
        return;
    }

    try {
        const todas = await maintenanceService.getHistorico(currentUserId);
        historicoCache = todas
            .filter(h => h.veiculoId === veiculoId)
            .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
        renderHistoricoList(historicoCache);
    } catch (e) {
        console.error("Erro ao carregar histórico de manutenções:", e);
    }
}

function renderHistoricoList(items) {
    const list = document.getElementById("historicoManutList");
    const resumo = document.getElementById("historicoManutResumo");
    if (!list) return;

    if (items.length === 0) {
        list.innerHTML = `<div class="p-4 text-center text-gray-500">
            <i class="fas fa-receipt empty-state-icon text-2xl text-gray-600 mb-1.5"></i>
            <p class="text-sm">Nenhuma manutenção concluída registrada ainda.</p>
        </div>`;
        resumo.textContent = "";
        return;
    }

    const totalGasto = items.reduce((sum, h) => sum + (Number(h.custo) || 0), 0);
    resumo.innerHTML = `Total gasto: <span class="text-verde-respira font-semibold">R$ ${totalGasto.toFixed(2)}</span> em ${items.length} registro${items.length > 1 ? 's' : ''}`;

    list.innerHTML = "";
    items.forEach(h => {
        const tipo = tipoInfo(h.tipo);
        const card = document.createElement("div");
        card.className = "vehicle-card";
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="font-semibold text-sm"><i class="fas ${tipo.icon} mr-2 text-azul-ceu"></i>${tipo.label}</h3>
                    <p class="text-xs text-gray-400 mt-0.5">${formatDateBR(h.data)} a ${Number(h.km).toLocaleString('pt-BR')} km</p>
                </div>
                <div class="flex items-center space-x-3 flex-shrink-0 ml-2">
                    <span class="text-sm font-semibold ${h.custo ? 'text-verde-respira' : 'text-gray-500'}">${h.custo ? `R$ ${Number(h.custo).toFixed(2)}` : '--'}</span>
                    <button class="btn-delete-historico text-red-400 hover:text-red-300" data-id="${h.id}" title="Excluir">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll(".btn-delete-historico").forEach(btn => btn.addEventListener("click", handleDeleteHistorico));
}

async function handleDeleteHistorico(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Excluir este registro do histórico?")) return;
    try {
        await maintenanceService.removeHistorico(id);
        showMessage("Registro removido do histórico.", "success");
        loadHistorico(document.getElementById("maintVeiculo").value);
    } catch (e) {
        console.error("Erro ao excluir registro do histórico:", e);
        showMessage("Erro ao excluir registro.", "error");
    }
}

function renderManutencoesList(items) {
    renderSaudeGeral();

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
                    <p class="text-sm text-gray-300 mt-1">Última: ${formatDateBR(item.dataUltima)} a ${Number(item.kmUltima).toLocaleString('pt-BR')} km${item.custoUltimo ? ` • R$ ${Number(item.custoUltimo).toFixed(2)}` : ''}</p>
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
    document.getElementById("maintCusto").value = item.custoUltimo || "";
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
    const item = manutencoesCache.find(m => m.id === id);
    const kmAtual = getKmAtual();
    if (kmAtual == null) { showMessage("Informe o km atual do veículo antes de marcar como feita.", "error"); return; }

    const custoStr = prompt("Quanto você pagou nessa manutenção? (opcional, deixe em branco pra pular)");
    if (custoStr === null) return; // usuário cancelou
    const custo = custoStr.trim() ? parseFloat(custoStr.replace(",", ".")) || 0 : 0;

    const hoje = new Date().toISOString().slice(0, 10);
    const currentUserId = getCurrentUserId();
    try {
        await maintenanceService.update(id, { dataUltima: hoje, kmUltima: kmAtual, custoUltimo: custo });
        if (item) {
            await maintenanceService.addHistorico(currentUserId, {
                veiculoId: item.veiculoId, tipo: item.tipo, data: hoje, km: kmAtual, custo
            });
        }
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
    const custoUltimo = parseFloat(document.getElementById("maintCusto").value) || 0;

    if (!dataUltima || isNaN(kmUltima)) { showMessage("Preencha a data e o km da última troca.", "error"); return; }
    if (!intervaloKm && !intervaloMeses) { showMessage("Informe pelo menos um intervalo (km ou meses).", "error"); return; }

    const data = { veiculoId, tipo, dataUltima, kmUltima, intervaloKm, intervaloMeses, custoUltimo };

    try {
        if (editingId) {
            await maintenanceService.update(editingId, data);
            showMessage("Manutenção atualizada com sucesso!", "success");
        } else {
            await maintenanceService.create(currentUserId, data);
            await maintenanceService.addHistorico(currentUserId, {
                veiculoId, tipo, data: dataUltima, km: kmUltima, custo: custoUltimo
            });
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
    document.getElementById("maintCusto").value = "";
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
