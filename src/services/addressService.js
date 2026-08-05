import { db } from "../auth.js";
import {
    collection, addDoc, getDocs, doc, deleteDoc, query, where
} from "firebase/firestore";

const COLLECTION_NAME = "enderecos";

export const addressService = {
    async getAll(userId) {
        const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        const enderecos = [];
        snapshot.forEach(d => enderecos.push({ id: d.id, ...d.data() }));
        return enderecos;
    },

    async create(userId, addressData) {
        return await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            ...addressData,
            createdAt: new Date()
        });
    },

    async remove(id) {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
