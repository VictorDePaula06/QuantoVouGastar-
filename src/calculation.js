// src/calculation.js
import { showMessage, saveLastCost, highlightLoginButton, spawnCoinBurst } from "./utils.js";
import { getVeiculoSelecionadoData, setVeiculoSelecionadoData } from "./vehicle.js";
import { getDistanciaIdaPura, getDistanciaVoltaReal, getCurrentTollCost, getCurrentRoutesResult, getDirectionsRenderer, captureMap, clearRouteRaceVisuals } from "./map.js";
import { db, getCurrentUserId } from "./auth.js";
import { getDoc, doc } from "firebase/firestore";
import { tripService } from "./services/tripService.js";
import { loadTrips } from "./trip.js";

export async function calcularCusto() {
    const veiculoId = document.getElementById("veiculo").value;
    const tipoCombustivel = document.getElementById("combustivel").value;
    const preco = parseFloat(document.getElementById("precoGasolina").value);
    const custoPedagio = parseFloat(document.getElementById("custoPedagio").value) || 0; // NOVO
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

    // Usa a distância real da volta (rota separada calculada destino->origem) quando disponível,
    // já que ela pode ser diferente da ida por causa de retornos, mão única etc.
    const distanciaVoltaReal = getDistanciaVoltaReal();
    const distancia_ajustada = idaEVoltaChecked
        ? distanciaBase + (distanciaVoltaReal != null ? distanciaVoltaReal : distanciaBase)
        : distanciaBase;
    const btn = document.getElementById("calcularBtn"); btn.classList.add("loading"); btn.disabled = true;
    try {
        const litrosNecessarios = distancia_ajustada / eficiencia;
        const custoCombustivel = litrosNecessarios * preco;

        // Soma o pedágio manual ao custo total (se ida e volta, dobra o pedágio tambem? Geralmente sim, mas vamos assumir que o usuario colocou o total da viagem ou por trecho? 
        // Vamos assumir que o input é "Custo Extra TOTAL da viagem" para simplificar, ou "Por Trecho"?
        // O label diz "Custos Extra / Pedágio". Se for Ida e Volta, faz sentido dobrar se o usuário pensar "trecho". 
        // Mas para evitar confusão, vamos tratar como "Valor Total Extra". O usuário digita o quanto vai gastar a mais no total.
        const custoTotal = custoCombustivel + custoPedagio;

        const resultadoValor = document.getElementById("resultadoValor");
        const infoViagem = idaEVoltaChecked ? ' (Ida e Volta)' : '';
        let combustivelNome = tipoCombustivel.charAt(0).toUpperCase() + tipoCombustivel.slice(1);
        const unidade = (tipoCombustivel === 'gnv') ? 'm³ de GNV' : 'L de ' + combustivelNome;

        let tollWarningHtml = '';
        const currentRoutesResult = getCurrentRoutesResult();
        const directionsRenderer = getDirectionsRenderer();
        const currentRoute = currentRoutesResult?.routes[directionsRenderer.getRouteIndex()];
        const hasTolls = currentRoute?.warnings?.some(w => w.toLowerCase().includes('tolls') || w.toLowerCase().includes('pedágio'));

        if (custoPedagio <= 0 && hasTolls) {
            tollWarningHtml = `<div class="text-xs text-crema-paz mt-2 font-bold"><i class="fas fa-exclamation-triangle"></i> Atenção: Pedágios detectados na rota, mas nenhum valor foi informado.</div>`;
        }

        resultadoValor.innerHTML = `
            <div class="space-y-1.5 text-sm">
                <div class="flex justify-between"><span class="opacity-85">Combustível (${litrosNecessarios.toFixed(2)} ${unidade})</span><span class="font-semibold">R$ ${custoCombustivel.toFixed(2)}</span></div>
                <div class="flex justify-between"><span class="opacity-85">Pedágio / Extras</span><span class="font-semibold">R$ ${custoPedagio.toFixed(2)}</span></div>
            </div>
            <div class="border-t border-white/25 mt-2 pt-2 flex justify-between items-center">
                <span class="text-sm opacity-90">Total</span>
                <span class="text-2xl font-bold">R$ ${custoTotal.toFixed(2)}</span>
            </div>
            <div class="text-xs opacity-70 mt-2 text-center">${veiculoSelecionadoData.modelo} • Distância Total: ${distancia_ajustada.toFixed(2)} km ${infoViagem}</div>
            ${tollWarningHtml}
        `;

        document.getElementById("resultModal").classList.remove("hidden");
        document.getElementById("resultModal").classList.add("flex");
        spawnCoinBurst(document.getElementById("resultado"));

        saveLastCost(custoTotal);
        clearRouteRaceVisuals();

        // Armazena os dados para o relatório (o mapa é capturado só na hora de gerar o relatório, sob demanda)
        storeCalculationData({
            veiculoId,
            veiculo: veiculoSelecionadoData.modelo,
            placa: veiculoSelecionadoData.placa || '',
            combustivel: combustivelNome,
            combustivelTipo: tipoCombustivel,
            preco: preco,
            eficiencia: eficiencia,
            distanciaBase: distanciaBase,
            distanciaVoltaReal: distanciaVoltaReal,
            custoCombustivel: custoCombustivel,
            custoPedagio: custoPedagio, // NOVO
            origem: document.getElementById("origem").value.trim(),
            destino: document.getElementById("destino").value.trim(),
            distancia: distancia_ajustada.toFixed(2),
            custoTotal: custoTotal,
            litros: litrosNecessarios,
            unidade,
            idaEVolta: idaEVoltaChecked,
            rota: getCurrentRoutesResult().routes[getDirectionsRenderer().getRouteIndex()].summary,
            dataHora: new Date().toLocaleString('pt-BR')
        });

        showMessage("Custo calculado com sucesso!");
    } catch (error) { console.error("Erro ao calcular custo:", error); showMessage("Erro ao calcular custo da viagem!", "error"); }
    finally { btn.classList.remove("loading"); btn.disabled = false; }
}

function shareOnWhatsApp() {
    if (!lastCalculationData) { showMessage("Calcule primeiro.", "error"); return; }

    const { veiculo, distancia, custoTotal, litros, combustivel, custoPedagio } = lastCalculationData;

    const text = `🚗 *Planejamento de Viagem - Quanto Vou Gastar* 🚗%0A%0A` +
        `*Veículo:* ${veiculo}%0A` +
        `*Distância:* ${distancia} km%0A` +
        `*Consumo:* ${litros.toFixed(1)} L (${combustivel})%0A` +
        (custoPedagio > 0 ? `*Pedágio/Extras:* R$ ${custoPedagio.toFixed(2)}%0A` : '') +
        `%0A💰 *CUSTO TOTAL: R$ ${custoTotal.toFixed(2)}*`;

    window.open(`https://wa.me/?text=${text}`, '_blank');
}

async function handleSaveTrip() {
    if (!lastCalculationData) { showMessage("Calcule o custo da viagem primeiro.", "error"); return; }

    const currentUserId = getCurrentUserId();
    if (!currentUserId) { highlightLoginButton("Faça login para salvar esta viagem no histórico."); return; }

    const { veiculoId, veiculo, combustivel, combustivelTipo, origem, destino, distancia, custoTotal, litros, rota, dataHora } = lastCalculationData;
    try {
        await tripService.create(currentUserId, { veiculoId, veiculo, combustivel, combustivelTipo, origem, destino, distancia, custoTotal, litros, rota, dataHora });
        showMessage("Viagem salva no histórico!", "success");
        loadTrips();
    } catch (e) {
        console.error("Erro ao salvar viagem:", e);
        showMessage("Erro ao salvar viagem.", "error");
    }
}

export function initializeCalculationListeners() {
    document.getElementById("calcularBtn").addEventListener("click", calcularCusto);
    document.getElementById("generateReportBtn").addEventListener("click", generateReimbursementReport);
    document.getElementById("shareWhatsappBtn").addEventListener("click", shareOnWhatsApp);
    document.getElementById("saveTripBtn").addEventListener("click", handleSaveTrip);
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

    const { veiculo, placa, combustivel, preco, eficiencia, distanciaBase, distanciaVoltaReal, custoCombustivel, custoPedagio, origem, destino, distancia, custoTotal, litros, unidade, idaEVolta, rota, dataHora } = lastCalculationData;
    const unidadeEficiencia = combustivel.toLowerCase() === 'gnv' ? 'km/m³' : 'km/l';

    showMessage("Gerando relatório...", "info");
    const [{ jsPDF }, mapaBase64] = await Promise.all([
        import("jspdf"),
        captureMap()
    ]);

    const doc = new jsPDF();
    let y = 15;

    // Cabeçalho / marca
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text("Quanto Vou Gastar", 105, y, null, null, "center");
    y += 7;
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text("Relatório de Viagem", 105, y, null, null, "center");
    y += 6;
    doc.setFontSize(9);
    doc.text(`Gerado em: ${dataHora}`, 105, y, null, null, "center");
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 195, y);
    y += 8;

    // Trajeto
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("Trajeto", 15, y);
    y += 7;
    doc.setFontSize(11);
    doc.text(`De: ${origem || '-'}`, 15, y);
    y += 6;
    doc.text(`Para: ${destino || '-'}`, 15, y);
    y += 6;
    doc.text(`Rota: ${rota}${idaEVolta ? ' (Ida e Volta)' : ''}`, 15, y);
    y += 10;

    // Detalhes da Viagem
    doc.setFontSize(14);
    doc.text("Detalhes da Viagem", 15, y);
    y += 7;

    doc.setFontSize(11);
    doc.text(`Veículo: ${veiculo}${placa ? ` (Placa: ${placa})` : ''}`, 15, y);
    doc.text(`Combustível: ${combustivel} (R$ ${preco.toFixed(2)}/L)`, 105, y);
    y += 6;
    doc.text(`Distância Total: ${distancia} km`, 15, y);
    doc.text(`Consumo: ${litros.toFixed(2)} ${unidade || 'L'}`, 105, y);
    y += 10;

    // Breakdown de custos
    doc.setFontSize(14);
    doc.text("Custos", 15, y);
    y += 7;
    doc.setFontSize(11);
    doc.text("Combustível:", 15, y);
    doc.text(`R$ ${custoCombustivel.toFixed(2)}`, 195, y, null, null, "right");
    y += 6;
    doc.text("Pedágio / Extras:", 15, y);
    doc.text(`R$ ${custoPedagio.toFixed(2)}`, 195, y, null, null, "right");
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 195, y);
    y += 8;

    // Custo Total
    doc.setFontSize(16);
    doc.setTextColor(30, 110, 100);
    /* Verde Respira escurecido p/ contraste no papel */
    doc.text("Custo Total:", 15, y);
    doc.text(`R$ ${custoTotal.toFixed(2)}`, 195, y, null, null, "right");
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Memória de Cálculo (mostra a fórmula usada, passo a passo)
    doc.setFontSize(14);
    doc.text("Memória de Cálculo", 15, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    if (idaEVolta && distanciaBase) {
        if (distanciaVoltaReal != null) {
            doc.text(`Distância: ${distanciaBase.toFixed(2)} km (ida)  +  ${distanciaVoltaReal.toFixed(2)} km (volta, rota real)  =  ${distancia} km`, 15, y);
        } else {
            doc.text(`Distância (ida): ${distanciaBase.toFixed(2)} km  ×  2 (ida e volta)  =  ${distancia} km`, 15, y);
        }
        y += 6;
    } else {
        doc.text(`Distância percorrida: ${distancia} km`, 15, y);
        y += 6;
    }

    if (eficiencia) {
        doc.text(`Consumo: ${distancia} km  ÷  ${eficiencia} ${unidadeEficiencia} (eficiência do veículo)  =  ${litros.toFixed(2)} ${unidade}`, 15, y);
        y += 6;
    }

    doc.text(`Custo do combustível: ${litros.toFixed(2)} ${unidade}  ×  R$ ${preco.toFixed(2)}  =  R$ ${custoCombustivel.toFixed(2)}`, 15, y);
    y += 6;
    doc.text(`Custo total: R$ ${custoCombustivel.toFixed(2)} (combustível)  +  R$ ${custoPedagio.toFixed(2)} (pedágio/extras)  =  R$ ${custoTotal.toFixed(2)}`, 15, y);
    y += 6;

    doc.setTextColor(0, 0, 0);
    y += 6;

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
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Fonte dos Dados:", 15, y);
    y += 5;
    doc.text("• Cálculo de Custo: Fórmula de consumo baseada na eficiência do veículo e preço do combustível.", 15, y);
    y += 5;
    doc.text("• Rota e Distância: Google Maps Directions API.", 15, y);
    y += 5;
    doc.text("• Pedágio: Estimativa via Google Routes API, quando disponível.", 15, y);
    y += 5;
    doc.text("• Autenticidade: Este relatório é gerado automaticamente com base nos dados da API e do usuário.", 15, y);
    y += 10;

    // Salvar o PDF
    doc.save(`Relatorio_Viagem_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    showMessage("Relatório gerado com sucesso!", "success");
}