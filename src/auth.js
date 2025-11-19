// src/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { showMessage } from "./utils.js";

// Variável global para o ID do usuário
export let currentUserId = null;

// Variável para o estado de exibição de inativos (será atualizada pelo módulo de veículos)
export let showInactive = false;

// ===== Configuração Firebase (Use sua chave de Auth) =====
const firebaseConfig = {
    apiKey: "AIzaSyCP3YOpgh50JgMNwcm5ITWFuyYgf40eQnU", // Use sua chave real do Firebase Auth aqui
    authDomain: "quantovougastar.firebaseapp.com",
    projectId: "quantovougastar",
    storageBucket: "quantovougastar.appspot.com",
    messagingSenderId: "591670557539",
    appId: "1:591670557539:web:b1061bc35df30cbd6b3156",
    measurementId: "G-XZ3Z2Y0T4E"
};

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
    const toggleBtn = document.getElementById("toggleSidebar");

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

    // Gerencia a visibilidade do botão de menu no mobile
    if (window.innerWidth <= 1024) {
        toggleBtn.style.display = 'flex';
        if (!user) {
            document.getElementById("sidebar").classList.add("-translate-x-full");
            document.getElementById("sidebarOverlay").classList.add("hidden");
        }
    } else {
        toggleBtn.style.display = 'none';
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

    // Adiciona listener ao botão de login no modal de prompt
    document.getElementById("googleLoginPromptBtn").addEventListener("click", signIn);
    document.getElementById("closeLoginModalBtn").addEventListener("click", () => {
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
