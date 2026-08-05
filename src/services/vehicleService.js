import { db } from "../auth.js";
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where
} from "firebase/firestore";

const COLLECTION_NAME = "veiculos";

export const vehicleService = {
    async getAll(userId) {
        const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        const veiculos = [];
        snapshot.forEach(d => veiculos.push({ id: d.id, ...d.data() }));
        return veiculos;
    },

    async create(userId, vehicleData) {
        return await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            ...vehicleData,
            createdAt: new Date()
        });
    },

    async update(id, data) {
        const veiculoRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(veiculoRef, data);
    },

    async remove(id) {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
