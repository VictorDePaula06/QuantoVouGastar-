// src/tollService.js
import { config } from "./config.js";

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

function toWaypoint(address) {
    return { address };
}

function parseMoney(money) {
    if (!money) return null;
    const units = Number(money.units || 0);
    const nanos = Number(money.nanos || 0);
    return { value: units + nanos / 1e9, currency: money.currencyCode || "BRL" };
}

// Busca a estimativa de pedágio de cada rota, na mesma ordem em que o DirectionsService normalmente as retorna.
// Retorna um array (um item por rota, ou null se não houver pedágio/estimativa) ou null se a chamada falhar.
export async function fetchTollEstimates({ origem, destino, paradas = [] }) {
    if (!config.googleMapsKey || !origem || !destino) return null;

    const body = {
        origin: toWaypoint(origem),
        destination: toWaypoint(destino),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: true,
        routeModifiers: { avoidTolls: false },
        languageCode: "pt-BR",
        regionCode: "BR",
        units: "METRIC",
        extraComputations: ["TOLLS"]
    };

    if (paradas.length > 0) {
        body.intermediates = paradas.map(toWaypoint);
        body.optimizeWaypointOrder = true;
    }

    try {
        const response = await fetch(ROUTES_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": config.googleMapsKey,
                "X-Goog-FieldMask": "routes.travelAdvisory.tollInfo"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.warn("Routes API (pedágio) retornou erro:", response.status, await response.text());
            return null;
        }

        const data = await response.json();
        if (!data.routes) return null;

        return data.routes.map(route => {
            const prices = route.travelAdvisory?.tollInfo?.estimatedPrice;
            if (!prices || prices.length === 0) return null;
            return parseMoney(prices[0]);
        });
    } catch (e) {
        console.warn("Erro ao buscar estimativa de pedágio:", e);
        return null;
    }
}
