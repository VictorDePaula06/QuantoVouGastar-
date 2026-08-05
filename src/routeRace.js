// src/routeRace.js
// Efeito visual: anima um marcador em cada rota alternativa "correndo" até o destino,
// na velocidade proporcional ao tempo estimado real — a mais rápida sempre chega primeiro.

const RACE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#fb7185'];
const ANIM_TOTAL_MS = 3800;

let raceLines = [];
let raceMarkers = [];
let rafId = null;

function clearRace() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    raceLines.forEach(line => line.setMap(null));
    raceLines = [];
    raceMarkers.forEach(marker => marker.setMap(null));
    raceMarkers = [];
}

function buildCumulativeDistances(path) {
    const distances = [0];
    for (let i = 1; i < path.length; i++) {
        const d = google.maps.geometry.spherical.computeDistanceBetween(path[i - 1], path[i]);
        distances.push(distances[i - 1] + d);
    }
    return distances;
}

function positionAtFraction(path, cumulative, fraction) {
    const totalLength = cumulative[cumulative.length - 1];
    if (totalLength === 0) return path[0];
    const targetDist = fraction * totalLength;

    let i = 1;
    while (i < cumulative.length && cumulative[i] < targetDist) i++;
    if (i >= cumulative.length) return path[path.length - 1];

    const segStart = cumulative[i - 1];
    const segEnd = cumulative[i];
    const segFraction = segEnd === segStart ? 0 : (targetDist - segStart) / (segEnd - segStart);
    return google.maps.geometry.spherical.interpolate(path[i - 1], path[i], segFraction);
}

function markerIcon(color, scale = 8) {
    return {
        path: google.maps.SymbolPath.CIRCLE,
        scale,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#0f172a',
        strokeWeight: 2
    };
}

// Roda a "corrida" entre as rotas alternativas. onWinner(index) é chamado quando a primeira rota chega.
export function runRouteRace(map, routes, onWinner) {
    clearRace();
    if (!google.maps.geometry || !routes || routes.length < 2) return;

    const durations = routes.map(route => route.legs.reduce((sum, leg) => sum + leg.duration.value, 0));
    const maxDuration = Math.max(...durations);
    if (maxDuration <= 0) return;

    const tracks = routes.map((route, index) => {
        const path = route.overview_path;
        const cumulative = buildCumulativeDistances(path);
        const color = RACE_COLORS[index % RACE_COLORS.length];

        const line = new google.maps.Polyline({
            path,
            strokeColor: color,
            strokeOpacity: 0.45,
            strokeWeight: 3,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 }, offset: '0', repeat: '14px' }],
            map
        });
        raceLines.push(line);

        const marker = new google.maps.Marker({
            position: path[0],
            map,
            icon: markerIcon(color),
            zIndex: 1000 + index
        });
        raceMarkers.push(marker);

        return {
            index,
            path,
            cumulative,
            marker,
            animMs: ANIM_TOTAL_MS * (durations[index] / maxDuration),
            finished: false
        };
    });

    let winnerAnnounced = false;
    const start = performance.now();

    function step(now) {
        const elapsed = now - start;
        let allDone = true;

        tracks.forEach(track => {
            if (track.finished) return;
            const fraction = Math.min(elapsed / track.animMs, 1);
            track.marker.setPosition(positionAtFraction(track.path, track.cumulative, fraction));

            if (fraction >= 1) {
                track.finished = true;
                track.marker.setIcon(markerIcon(RACE_COLORS[track.index % RACE_COLORS.length], 10));
                if (!winnerAnnounced) {
                    winnerAnnounced = true;
                    if (onWinner) onWinner(track.index);
                }
            } else {
                allDone = false;
            }
        });

        if (!allDone) {
            rafId = requestAnimationFrame(step);
        } else {
            rafId = null;
            // Some tempo depois, remove os marcadores da corrida (as linhas finas ficam como "trilhas")
            setTimeout(() => {
                raceMarkers.forEach(marker => marker.setMap(null));
                raceMarkers = [];
            }, 1200);
        }
    }

    rafId = requestAnimationFrame(step);
}

export { clearRace };
