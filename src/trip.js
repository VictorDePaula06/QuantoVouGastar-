// src/trip.js
import { getCurrentUserId } from "./auth.js";
import { showMessage } from "./utils.js";
import { tripService } from "./services/tripService.js";

export async function loadTrips() {
    const list = document.getElementById("viagensList");
    if (!list) return;
    const currentUserId = getCurrentUserId();

    if (!currentUserId) {
        list.innerHTML = `<div class="p-4 text-center text-gray-500">Faça login para ver seu histórico de viagens.</div>`;
        return;
    }

    try {
        const viagens = await tripService.getAll(currentUserId);

        if (viagens.length === 0) {
            list.innerHTML = `<div class="p-4 text-center text-gray-500">Nenhuma viagem salva ainda. Depois de calcular um custo, clique em "Salvar Viagem".</div>`;
            return;
        }

        viagens.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        list.innerHTML = "";
        viagens.forEach(v => {
            const card = document.createElement("div");
            card.className = "vehicle-card";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-semibold text-lg">${v.origem} <i class="fas fa-arrow-right text-xs mx-1 text-gray-400"></i> ${v.destino}</h3>
                        <p class="text-sm text-gray-300 mt-1">${v.veiculo} • ${v.distancia} km • ${v.dataHora}</p>
                    </div>
                    <div class="flex items-center space-x-3 flex-shrink-0 ml-2">
                        <span class="text-accent-green font-semibold">R$ ${Number(v.custoTotal).toFixed(2)}</span>
                        <button class="btn-delete-viagem text-red-400 hover:text-red-300" data-id="${v.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

        list.querySelectorAll(".btn-delete-viagem").forEach(btn => btn.addEventListener("click", handleDeleteTrip));
    } catch (e) {
        console.error("Erro ao carregar viagens:", e);
        showMessage("Erro ao carregar histórico de viagens.", "error");
    }
}

async function handleDeleteTrip(e) {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Tem certeza que deseja excluir esta viagem do histórico?")) return;
    try {
        await tripService.remove(id);
        showMessage("Viagem excluída com sucesso!", "success");
        loadTrips();
    } catch (e) {
        console.error("Erro ao excluir viagem:", e);
        showMessage("Erro ao excluir viagem.", "error");
    }
}

export function initializeTripListeners() {
    // Delegação já feita via loadTrips (botões recriados a cada render)
}
