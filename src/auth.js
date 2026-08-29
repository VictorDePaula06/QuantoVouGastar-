// src/auth.js
import { initializeApp } from "firebase/app";
import {
    getFirestore
} from "firebase/firestore";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "firebase/auth";

import { showMessage } from "./utils.js";

// Variável global para o ID do usuário
export let currentUserId = null;

// Variável para o estado de exibição de inativos (será atualizada pelo módulo de veículos)
export let showInactive = false;

import { config } from "./config.js";

// ===== Configuração Firebase (Use sua chave de Auth) =====
const firebaseConfig = config.firebase;

// ===== Inicializar Firebase =====
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Função de login
export async function signIn() {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); }
    catch (error) { console.error("Erro no login:", error); showMessage("Falha ao entrar com Google. Tente novamente.", "error"); }
}

// Função de logout
export async function signOutUser() {
    try { await signOut(auth); showMessage("Você saiu da sua conta.", "info"); } catch (e) { console.error(e); }
}

// Função para atualizar a UI com base no estado de autenticação
export function updateUI(user, loadVeiculosCallback) {
    const authBtn = document.getElementById("authBtn");
    const authIcon = document.getElementById("authIcon");

    if (user) {
        currentUserId = user.uid;
        authIcon.className = "fas fa-user-circle text-lg";
        authBtn.onclick = signOutUser;
        authBtn.title = `Sair de ${user.displayName}`;

    } else {
        currentUserId = null;
        authIcon.className = "fab fa-google text-lg";
        authBtn.onclick = signIn;
        authBtn.title = "Entrar com Google";
    }

    // No mobile, fecha o painel automaticamente se o usuário deslogar (só existe na calculadora)
    if (window.innerWidth <= 1024 && !user) {
        document.getElementById("sidebar")?.classList.add("panel-closed");
        document.getElementById("sidebarOverlay")?.classList.add("hidden");
    }

    // Chama a função de carregar veículos (passada como callback)
    if (loadVeiculosCallback) {
        loadVeiculosCallback();
    }
}

// Inicializa o listener de autenticação
export function initializeAuth(loadVeiculosCallback) {
    onAuthStateChanged(auth, (user) => {
        updateUI(user, loadVeiculosCallback);
        if (user) showMessage(`Bem-vindo, ${user.displayName}!`, "success");
    });

    // Adiciona listener ao botão de login no modal de prompt (só existe em páginas que o incluem)
    document.getElementById("googleLoginPromptBtn")?.addEventListener("click", signIn);
    document.getElementById("closeLoginModalBtn")?.addEventListener("click", () => {
        document.getElementById("loginPromptModal").classList.add("hidden");
        document.getElementById("loginPromptModal").classList.remove("flex");
    });
}

// Exporta a função para ser usada em outros módulos
export function getCurrentUserId() {
    return currentUserId;
}

export function getShowInactive() {
    return showInactive;
}

export function setShowInactive(value) {
    showInactive = value;
}
