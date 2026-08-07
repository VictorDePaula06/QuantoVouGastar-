// src/utils.js

// ===== Chuva de moedinhas (efeito no resultado do cálculo) =====
export function spawnCoinBurst(containerEl, count = 10) {
    if (!containerEl) return;
    for (let i = 0; i < count; i++) {
        const coin = document.createElement("span");
        coin.className = "coin-burst";
        coin.textContent = "🪙";
        coin.style.left = `${8 + Math.random() * 84}%`;
        coin.style.animationDelay = `${Math.random() * 0.35}s`;
        coin.style.setProperty("--rot", `${Math.round(Math.random() * 70 - 35)}deg`);
        containerEl.appendChild(coin);
        coin.addEventListener("animationend", () => coin.remove());
    }
}

// ===== Funções de Mensagens (Toast) =====
export function showMessage(msg, type = "success") {
    const existing = document.querySelectorAll(".message-box").length;
    const box = document.createElement("div");
    box.className = `message-box ${type}`;
    box.style.setProperty("--toast-offset", `${existing * 4.25}rem`);
    box.innerHTML = `<div class="flex items-center"><i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i><span>${msg}</span></div>`;
    document.body.appendChild(box);
    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateX(120%)';
        setTimeout(() => box.remove(), 300);
    }, 3500);
}

// ===== Funções de Persistência de Custo (localStorage) =====
export function saveLastCost(cost) {
    localStorage.setItem('lastCalculatedCost', cost.toFixed(2));
    loadLastCost(); // Atualiza o display imediatamente
}

export function loadLastCost() {
    const lastCost = localStorage.getItem('lastCalculatedCost');
    const display = document.getElementById('ultimoCustoDisplay');
    if (display) {
        if (lastCost) {
            display.textContent = `R$ ${lastCost}`;
            document.getElementById('ultimoCustoContainer').classList.remove('hidden');
        } else {
            display.textContent = '--';
            // Garante que o container esteja escondido se não houver custo salvo
            const container = document.getElementById('ultimoCustoContainer');
            if (container) container.classList.add('hidden');
        }
    }
}

// ===== Funções de UI (Sidebar e Modal) =====
export function setupUIListeners() {
    // Fechar Modal de Resultado
    document.getElementById("closeResultModalBtn").addEventListener("click", () => {
        document.getElementById("resultModal").classList.add("hidden");
        document.getElementById("resultModal").classList.remove("flex");
    });

    // Sidebar toggle mobile
    document.getElementById("toggleSidebar").addEventListener("click", () => {
        const sidebar = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebarOverlay");
        sidebar.classList.toggle("panel-closed");
        overlay.classList.toggle("hidden");
    });
    document.getElementById("sidebarOverlay").addEventListener("click", () => {
        const sidebar = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebarOverlay");
        sidebar.classList.add("panel-closed");
        overlay.classList.add("hidden");
    });
}

export function highlightLoginButton(message) {
    // 1. Mostra a mensagem (top-right toast)
    showMessage(message || "É necessário fazer login para esta ação.", "info");

    // 2. Encontra e destaca o botão de autenticação (Header)
    const authBtn = document.getElementById("authBtn");
    if (authBtn) {
        authBtn.classList.add("highlight-login");
        setTimeout(() => {
            authBtn.classList.remove("highlight-login");
        }, 3000);
    }

    // 3. Fecha a sidebar no mobile
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (window.innerWidth <= 1024) {
        sidebar.classList.add("panel-closed");
        overlay.classList.add("hidden");
    }

    // 4. Mostra o modal de prompt de login
    const loginModal = document.getElementById("loginPromptModal");
    if (loginModal) {
        loginModal.classList.remove("hidden");
        loginModal.classList.add("flex");
    }
}

export function updateDistanceDisplay(distancia, idaEVoltaChecked) {
    const display = document.getElementById("distanciaDisplay");
    if (!distancia || distancia === 0) { display.textContent = "-- km"; return; }
    const distanciaFinal = idaEVoltaChecked ? distancia * 2 : distancia;
    display.textContent = `${distanciaFinal.toFixed(2)} km${idaEVoltaChecked ? ' (Ida e Volta)' : ''}`;
}

export function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}min`;
    return result.trim() || 'Menos de 1 min';
}
