import { db } from "../auth.js";
import {
    collection, addDoc, getDocs, doc, deleteDoc, query, where
} from "firebase/firestore";

const COLLECTION_NAME = "viagens";

export const tripService = {
    async getAll(userId) {
        const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        const viagens = [];
        snapshot.forEach(d => viagens.push({ id: d.id, ...d.data() }));
        return viagens;
    },

    async create(userId, tripData) {
        return await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            ...tripData,
            createdAt: new Date()
        });
    },

    async remove(id) {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
