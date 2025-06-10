import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBaPuCdflLnZJkpEoEUZ6DTKCcQ9CmdLo4",
  authDomain: "turea-2452b.firebaseapp.com",
  projectId: "turea-2452b",
  storageBucket: "turea-2452b.firebasestorage.app",
  messagingSenderId: "406829970034",
  appId: "1:406829970034:web:807daf84c8b1f8bc5288eb",
  measurementId: "G-TWSJ9LVHX6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function checkUserIdExists(uid) {
  if (!uid) return false;
  const userDoc = await getDoc(doc(db, "study_tracker_user", uid));
  return userDoc.exists();
}
