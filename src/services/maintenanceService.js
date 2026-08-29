import { db } from "../auth.js";
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where
} from "firebase/firestore";

const COLLECTION_NAME = "manutencoes";

export const maintenanceService = {
    async getAll(userId) {
        const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        const manutencoes = [];
        snapshot.forEach(d => manutencoes.push({ id: d.id, ...d.data() }));
        return manutencoes;
    },

    async create(userId, data) {
        return await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            ...data,
            createdAt: new Date()
        });
    },

    async update(id, data) {
        const ref = doc(db, COLLECTION_NAME, id);
        await updateDoc(ref, data);
    },

    async remove(id) {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
