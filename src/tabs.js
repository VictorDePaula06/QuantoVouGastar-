// src/tabs.js
const STORAGE_KEY = "activeTab";

export function initTabs() {
    const buttons = document.querySelectorAll("[data-tab-btn]");
    const panels = document.querySelectorAll("[data-tab-panel]");

    function activate(tabName) {
        buttons.forEach(btn => btn.classList.toggle("active", btn.dataset.tabBtn === tabName));
        panels.forEach(panel => panel.classList.toggle("hidden", panel.dataset.tabPanel !== tabName));
        localStorage.setItem(STORAGE_KEY, tabName);
    }

    buttons.forEach(btn => {
        btn.addEventListener("click", () => activate(btn.dataset.tabBtn));
    });

    const saved = localStorage.getItem(STORAGE_KEY);
    const initialTab = (saved && document.querySelector(`[data-tab-btn="${saved}"]`)) ? saved : buttons[0]?.dataset.tabBtn;
    if (initialTab) activate(initialTab);
}
