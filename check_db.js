import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  try {
    const snapshot = await getDocs(collection(db, 'materials'));
    console.log("Number of materials:", snapshot.size);
    snapshot.forEach(doc => console.log(doc.id, doc.data().title));
  } catch (e) {
    console.error("Error:", e);
  }
}

check();
