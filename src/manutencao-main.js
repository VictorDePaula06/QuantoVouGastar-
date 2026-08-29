import "./style.css";
import { initializeAuth } from "./auth.js";
import { initMaintenance, loadVehiclesForMaintenance } from "./manutencao.js";

document.addEventListener("DOMContentLoaded", () => {
    initMaintenance();
    initializeAuth(loadVehiclesForMaintenance);
});
