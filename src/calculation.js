// src/calculation.js
import { showMessage, saveLastCost } from "./utils.js";
import { getVeiculoSelecionadoData, setVeiculoSelecionadoData } from "./vehicle.js";
import { getDistanciaIdaPura, getCurrentTollCost, getCurrentRoutesResult, getDirectionsRenderer } from "./map.js";
import { db } from "./auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export async function calcularCusto() {
    const veiculoId = document.getElementById("veiculo").value;
    const tipoCombustivel = document.getElementById("combustivel").value;
    const preco = parseFloat(document.getElementById("precoGasolina").value);
    const distanciaText = document.getElementById("distanciaDisplay").textContent;
    const idaEVoltaChecked = document.getElementById("idaEVolta")?.checked || false;

    if (!veiculoId || !tipoCombustivel || isNaN(preco) || preco <= 0 || distanciaText === "-- km") { showMessage("Preencha todos os dados da viagem corretamente!", "error"); return; }

    let veiculoSelecionadoData = getVeiculoSelecionadoData();

    if (!veiculoSelecionadoData || veiculoSelecionadoData.id !== veiculoId) {
        try {
            const docSnap = await getDoc(doc(db, "veiculos", veiculoId));
            if (docSnap.exists()) {
                veiculoSelecionadoData = { id: veiculoId, ...docSnap.data() };
                setVeiculoSelecionadoData(veiculoSelecionadoData);
            }
        } catch (e) { console.error(e); }
    }

    if (!veiculoSelecionadoData) { showMessage("Erro: Selecione o veículo novamente.", "error"); return; }

    const eficiencia = veiculoSelecionadoData.eficiencias[tipoCombustivel];
    if (isNaN(eficiencia) || eficiencia <= 0) { showMessage(`Erro: Eficiência ${tipoCombustivel} não definida para o veículo.`, "error"); return; }

    const distanciaBase = getDistanciaIdaPura();
    if (!distanciaBase || distanciaBase === 0) { showMessage("Calcule a rota primeiro!", "error"); return; }

    const distancia_ajustada = distanciaBase * (idaEVoltaChecked ? 2 : 1);
    const btn = document.getElementById("calcularBtn"); btn.classList.add("loading"); btn.disabled = true;
    try {
        const litrosNecessarios = distancia_ajustada / eficiencia;
        const custoCombustivel = litrosNecessarios * preco;

        const currentTollCost = getCurrentTollCost();
        const custoTotal = custoCombustivel + (currentTollCost * (idaEVoltaChecked ? 2 : 1));

        const resultadoValor = document.getElementById("resultadoValor");
        const infoViagem = idaEVoltaChecked ? ' (Ida e Volta)' : '';
        let combustivelNome = tipoCombustivel.charAt(0).toUpperCase() + tipoCombustivel.slice(1);
        const unidade = (tipoCombustivel === 'gnv') ? 'm³ de GNV' : 'L de ' + combustivelNome;

        let tollInfoHtml = '';
        const currentRoutesResult = getCurrentRoutesResult();
        const directionsRenderer = getDirectionsRenderer();

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

        document.getElementById("resultModal").classList.remove("hidden");
        document.getElementById("resultModal").classList.add("flex");

        saveLastCost(custoTotal);

        showMessage("Custo calculado com sucesso!");
    } catch (error) { console.error("Erro ao calcular custo:", error); showMessage("Erro ao calcular custo da viagem!", "error"); }
    finally { btn.classList.remove("loading"); btn.disabled = false; }
}

export function initializeCalculationListeners() {
    document.getElementById("calcularBtn").addEventListener("click", calcularCusto);
}
