// src/calculation.js
import { showMessage, saveLastCost } from "./utils.js";
import { getVeiculoSelecionadoData, setVeiculoSelecionadoData } from "./vehicle.js";
import { getDistanciaIdaPura, getCurrentTollCost, getCurrentRoutesResult, getDirectionsRenderer, captureMap } from "./map.js";
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

        // Armazena os dados para o relatório
        storeCalculationData({
            veiculo: veiculoSelecionadoData.modelo,
            combustivel: combustivelNome,
            preco: preco,
            distancia: distancia_ajustada.toFixed(2),
            custoTotal: custoTotal,
            litros: litrosNecessarios,
            rota: currentRoutesResult.routes[directionsRenderer.getRouteIndex()].summary,
            dataHora: new Date().toLocaleString('pt-BR'),
            mapaBase64: await captureMap() // Captura o mapa
        });

        showMessage("Custo calculado com sucesso!");
    } catch (error) { console.error("Erro ao calcular custo:", error); showMessage("Erro ao calcular custo da viagem!", "error"); }
    finally { btn.classList.remove("loading"); btn.disabled = false; }
}

export function initializeCalculationListeners() {
    document.getElementById("calcularBtn").addEventListener("click", calcularCusto);
    document.getElementById("generateReportBtn").addEventListener("click", generateReimbursementReport);
}

// Variável global para armazenar os dados do último cálculo
let lastCalculationData = null;

// Função para armazenar os dados do cálculo
function storeCalculationData(data) {
    lastCalculationData = data;
}

// Função para gerar o relatório de reembolso em PDF
export async function generateReimbursementReport() {
    if (!lastCalculationData) {
        showMessage("Calcule o custo da viagem primeiro para gerar o relatório.", "error");
        return;
    }

    const { veiculo, combustivel, preco, distancia, custoTotal, litros, rota, dataHora, mapaBase64 } = lastCalculationData;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15;

    // Título
    doc.setFontSize(22);
    doc.text("Relatório de Reembolso de Viagem", 105, y, null, null, "center");
    y += 10;

    // Data e Hora
    doc.setFontSize(10);
    doc.text(`Gerado em: ${dataHora}`, 105, y, null, null, "center");
    y += 10;

    // Detalhes da Viagem
    doc.setFontSize(14);
    doc.text("Detalhes da Viagem", 15, y);
    y += 7;

    doc.setFontSize(12);
    doc.text(`Veículo: ${veiculo}`, 15, y);
    doc.text(`Combustível: ${combustivel} (R$ ${preco.toFixed(2)}/L)`, 105, y);
    y += 7;
    doc.text(`Distância Total: ${distancia} km`, 15, y);
    doc.text(`Consumo: ${litros.toFixed(2)} L`, 105, y);
    y += 7;
    doc.text(`Rota: ${rota}`, 15, y);
    y += 10;

    // Custo Total
    doc.setFontSize(18);
    doc.text(`Custo Total para Reembolso: R$ ${custoTotal.toFixed(2)}`, 105, y, null, null, "center");
    y += 10;

    // Mapa (se disponível)
    if (mapaBase64) {
        doc.setFontSize(14);
        doc.text("Rota no Mapa", 15, y);
        y += 5;

        const imgWidth = 180;
        const imgHeight = (doc.internal.pageSize.getHeight() - y - 30) > 100 ? 100 : (doc.internal.pageSize.getHeight() - y - 30); // Limita a altura
        doc.addImage(mapaBase64, 'JPEG', 15, y, imgWidth, imgHeight);
        y += imgHeight + 10;
    }

    // Fonte e Autenticidade
    doc.setFontSize(10);
    doc.text("Fonte dos Dados:", 15, y);
    y += 5;
    doc.text("• Cálculo de Custo: Fórmula de consumo baseada na eficiência do veículo e preço do combustível.", 15, y);
    y += 5;
    doc.text("• Rota e Distância: Google Maps Directions API.", 15, y);
    y += 5;
    doc.text("• Autenticidade: Este relatório é gerado automaticamente com base nos dados da API e do usuário.", 15, y);
    y += 10;

    // Salvar o PDF
    doc.save(`Relatorio_Reembolso_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    showMessage("Relatório de reembolso gerado com sucesso!", "success");
}