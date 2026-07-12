import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { 
  GoogleAuthProvider,
  signInWithPopup,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  where,
  getDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwPGiInieRxjm3_ifiQYUDT5u6k0T5cyM",
  authDomain: "ranglistedaten.firebaseapp.com",
  projectId: "ranglistedaten",
  storageBucket: "ranglistedaten.firebasestorage.app",
  messagingSenderId: "824301650931",
  appId: "1:824301650931:web:e4a1e8b0a79ef7ee224886"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const q = query(collection(db, "users"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);
    
    let username;
    if (querySnapshot.empty) {
      username = user.displayName;
    } else {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      username = userData.username;
    }
    if (!username) {
      username = user.email.split('@')[0];
    }
    
    if (querySnapshot.empty) {
      await addDoc(collection(db, "users"), {
        uid: user.uid,
        username: username,
        email: user.email,
        createdAt: serverTimestamp(),
        gesamtTrophies: 0,
        spieleGesamt: 0,
        spiele: {}
      });
    }
    
    localStorage.setItem("currentUser", JSON.stringify({
      uid: user.uid,
      username: username,
      email: user.email,
      gesamtTrophies: 0
    }));
    
    return { success: true, message: "Welcome " + username + "!" };
  } catch (error) {
    if (error.code === 'auth/popup-blocked') {
      return { success: false, error: "Popup was blocked. Please allow Popups in your settings" };
    } else {
      return { success: false, error: error.message };
    }
  }
}

async function registerUser(email, username, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await sendEmailVerification(user);
    await addDoc(collection(db, "users"), {
      uid: user.uid,
      username: username,
      email: email,
      createdAt: serverTimestamp(),
      gesamtTrophies: 0,
      spieleGesamt: 0,
      emailVerifiziert: false
    });
    console.log("Registration succeeded! Verification Email is sent");
    return { success: true, message: "Please confirm your Email" };
  } catch (error) {
    console.error("Registration went wrong:", error);
    if (error.code === 'auth/email-already-in-use') {
      return { success: false, error: "Email is already used" };
    } else if (error.code === 'auth/weak-password') {
      return { success: false, error: "Password is too weak (min. 6 characters)" };
    } else {
      return { success: false, error: error.message };
    }
  }
}

async function loginUser(username, password) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, error: "Username not found. Please check the spelling" };
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
    const user = userCredential.user;
    
    localStorage.setItem("currentUser", JSON.stringify({
      uid: user.uid,
      username: userData.username,
      email: user.email,
      gesamtTrophies: userData.gesamtTrophies || 0
    }));
    
    console.log("You are logged in");
    return { success: true, message: "Welcome back" };
  } catch (error) {
    console.error("Login didn't succeed:", error);
    if (error.code === 'auth/invalid-credential') {
      return { success: false, error: "Wrong username or wrong password" };
    } else {
      return { success: false, error: error.message };
    }
  }
}

async function logoutUser() {
  try {
    await signOut(auth);
    localStorage.removeItem("currentUser");
    console.log("Logged out");
    return { success: true };
  } catch (error) {
    console.error("Logging out went wrong:", error);
    return { success: false, error: error.message };
  }
}

function getCurrentUser() {
  const user = localStorage.getItem("currentUser");
  return user ? JSON.parse(user) : null;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is logged in:", user.email);
  } else {
    console.log("No user is logged in");
    localStorage.removeItem("currentUser");
  }
});

async function addTrophies(spielName, erhalteneTrophies) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("Please Login");
  }
  
  const q = query(collection(db, "users"), where("uid", "==", currentUser.uid));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    throw new Error("Benutzer nicht gefunden!");
  }
  
  const userDoc = querySnapshot.docs[0];
  const userRef = doc(db, "users", userDoc.id);
  const userData = userDoc.data();
  
  const aktuelleSpielTrophies = userData.spiele?.[spielName] || 0;
  const neueSpielTrophies = aktuelleSpielTrophies + erhalteneTrophies;
  const neueGesamtTrophies = (userData.gesamtTrophies || 0) + erhalteneTrophies;
  
  await updateDoc(userRef, {
    [`spiele.${spielName}`]: neueSpielTrophies,
    gesamtTrophies: neueGesamtTrophies,
    spieleGesamt: (userData.spieleGesamt || 0) + 1
  });
}

async function getTrophiesRangliste() {
  try {
    const q = query(
      collection(db, "users"),
      orderBy("gesamtTrophies", "desc"),
      limit(100)
    );
    const querySnapshot = await getDocs(q);
    const rangliste = [];
    let rank = 1;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      rangliste.push({
        rank: rank++,
        userId: doc.id,
        username: data.username,
        trophies: data.gesamtTrophies || 0,
        spieleGesamt: data.spieleGesamt || 0
      });
    });
    return rangliste;
  } catch (error) {
    console.error("Error by loading the Ranklist:", error);
    return [];
  }
}

// ============ MEINE STATISTIKEN ============
async function meineStatistiken() {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.warn("Kein Benutzer eingeloggt");
      return null;
    }
    
    const q = query(collection(db, "users"), where("uid", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.warn("User not found");
      return null;
    }
    
    const userData = querySnapshot.docs[0].data();
    
    return {
      username: userData.username,
      gesamtTrophies: userData.gesamtTrophies || 0,
      spieleGesamt: userData.spieleGesamt || 0,
      spiele: userData.spiele || {},
      registriertAm: userData.createdAt?.toDate?.() || new Date()
    };
  } catch (error) {
    console.error("Something went wrong by loading the statistics:", error);
    return null;
  }
}

function getTrophiesforLevel(spielName, level) {
  const levelData = {
    "snake": { 1: { sieg: 3, verlust: 1 }, 2: { sieg: 4, verlust: 1 }, 3: { sieg: 5, verlust: 1 } },
    "Super_Cat": { 1: { sieg: 5, verlust: 1 } },
    "TTT_Ki": { 1: { sieg: 3, verlust: 1 } },
    "TTT_2P": { 1: { sieg: 3, verlust: 1 } },
    "Tischtennis": { 1: { sieg: 3, verlust: 1 }, 2: { sieg: 4, verlust: 1 }, 3: { sieg: 5, verlust: 2 }, 4: { sieg: 6, verlust: 3 }, 5: { sieg: 10, verlust: 3 } },
    "E-R": { 1: { sieg: 3, verlust: 1 }, 2: { sieg: 4, verlust: 1 }, 3: { sieg: 5, verlust: 2 }, 4: { sieg: 6, verlust: 3 }, 5: { sieg: 10, verlust: 3 } }
  };
  
  if (levelData[spielName] && levelData[spielName][level]) {
    return levelData[spielName][level];
  }
  return { sieg: level, verlust: level };
}

// ============ SPIEL BEENDEN ============
async function spielBeenden(spielName, level, gewonnen) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.warn("Please Login");
    return { success: false };
  }
  const regeln = getTrophiesforLevel(spielName, level);
  const trophies = gewonnen ? regeln.sieg : -regeln.verlust;
  await addTrophies(spielName, trophies);
  return { success: true };
}
export{
loginWithGoogle,
registerUser,
loginUser,
logoutUser,
getCurrentUser,
addTrophies,
getTrophiesRangliste,
meineStatistiken,
getTrophiesforLevel,
spielBeenden
};
window.loginWithGoogle = loginWithGoogle;
window.spielBeenden = spielBeenden;
window.getTrophiesforLevel = getTrophiesforLevel;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.getCurrentUser = getCurrentUser;
window.addTrophies = addTrophies;
window.getTrophiesRangliste = getTrophiesRangliste;
window.meineStatistiken = meineStatistiken;
//Schule als beispiel beim unterschied zwischen userSnap und userSnap.data()
