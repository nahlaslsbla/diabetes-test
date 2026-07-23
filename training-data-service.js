import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { db } from "./firebase.js";

const TRAINING_COLLECTION = "training_data";

export async function getTrainingDataset() {
  const snapshot = await getDocs(collection(db, TRAINING_COLLECTION));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
