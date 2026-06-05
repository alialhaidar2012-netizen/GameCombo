import {initializeApp}from "";
import {
  GoogleAuthProvider,
  signInWithPopup,
  getAuth,
  createUserWithEmailAndPasswort,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  onAuthStateChanged,
  updateDoc,
  increment,
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
  doc
} from "";
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider();

async function loginWithGoogle(){
  try{
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const q = query(collection(db,"users"), where("uid", "===", user.uid));
    const querySnapshot = await getDocs(q);
    if(querySnapshot.empty){
      let username = user.displayName;
    } else{
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      let username = userData.username;
    }
    if(!username){
      username = user.email.split('@') [0];
    }
    await addDoc(collection(db,"users"),{
      uid: user.uid,
      username: username,
      email: user.email,
      createdAt: serverTimestamp(),
      gesamtTrophies: 0,
      spieleGesamt: 0,
      spiele: {}
    });
    localStorage.setItem("currentUser",JSON.stringify({
      uid: user.uid,
      username: username,
      email: user.email,
      gesamtTrophies: 0
    }));
    return {success: true, message: "Welcome "+username+" !"};
  }catch(error){
    if(error.code === 'auth/popup-blocked'){
      return{ success: false, error: "Popup was blocked. Please allow Popups in your settings"};
    }else{
      return {success: false, error: error.message};
    }
  }
}
async function registerUser(email, username, password) {
  try {
    const userCredential = await createUserWithEmailAndPasswort(auth, email, password);
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
    console.log("Registration succeded!Verification Email is sent");
    return{success: true, message: "Please confirm your Email"};
} catch (error) {
  console.error("Registration went wrong:", error)
  if(error.code === 'auth/email-already-in-use'){
    return{success: false, error: "Email is already used"};
  }else if(error.code === 'auth/weak-password'){
    return {success: false, error: "Password is too weak(min. 6 characters)"};
  }else if(error.code === 'auth/ used-username'){
    return {success: false, error:"Username is already used"};
  }else{
    return{success: false, error: error.message};
  }
 }
} //Teil 4 Anmelden
async function loginUser(username, password) {
try{
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "===", username));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty){
    return{success: false, error:"Username not found. Please check the spelling"};
  }
  const userDoc = querySnapshot.docs[0];
  const userData = userDoc.data();
  const userCredential = await signInWithEmailAndPassword(auth, password);
  const user = userCredential.user;
localStorage.setItem("currentUser", JSON.stringify({
  uid: user.uid,
  username: userData.username,
  email: user.email,
  gesamtTrophies: userData.gesamtTrophies || 0
}));
console.log("You are logged in");
return{success: true, message: "Welcome back"};
}catch(error){
 console.error("Login didn't succed:", error);
 if(error.code === 'auth/invalid-credential'){
   return{success: false, error:"Wrong username or wrong password"};
 }else if(error.code === 'auth/user-not-found'){
   return{success: false, error:"No Account with that username found"};
 }else{
   return{success: false, error: error.message};
 }
}
}

function logoutUser() {
  try{
    await signOut(auth);
    localStorage.removeItem("currentUser");
    console.log("Logged out");
    return{success:true};
  } catch (error){
    console.error("Logging out went wrong:", error)
    return{success: false, error: error.message};
  }
}
function getCurrentUser(){
  const user = localStorage.getItem("currentUser");
  return user ? JSON.parse(user) : null;
}
onAuthStateChanged(auth, (user) => {
  if(user){
    console.log("User is logged in:", user.username);
  }else{
    console.log("No user is logged in");
    localStorage.removeItem("currentUser");
  }
});
async function addTrophies(spielName, erhalteneTrophies) {
  const currentUser = getCurrentUser(); //Wer ist eingeloggt
  if(!currentUser){
    throw new Error("Please Login");
  }
  const userRef = doc(db, "users", currentUser.id); //userRef ist wie eine Adresse fuer den Nutzer
  const userSnap = await getDoc(userRef); //aktuelle Daten holen
  if(!userSnap.exists()){
    throw new Error("Benutzer nicht gefunden!");
  }
  const userData = userSnap.data();
  
  const aktuelleSpielTrophies = userData.spiele?.[spielName] || 0;
  const neueSpielTrophies = aktuelleSpielTrophies + erhalteneTrophies; //Spiel-Trophies berechnen
  const neueGesamtTrophies = (userData.gesamtTrophies || 0) + erhalteneTrophies;
  await updateDoc(userRef,{
    [`spiele.${spielName}`]: neueSpielTrophies,
    gesamtTrophies: neueGesamtTrophies,
    spieleGesamt: (userData.spieleGesamt || 0) +1 //in Firebase speichern aber nur bestimmte Felder
  });
}
async function getTrophiesRangliste() {
try{  const q = query(
    collection(db, "users"),
    orderBy("gesamtTrophies","desc"),
    limit(10)
  );
  const querySnapshot = await getDocs(q);
  const rangliste = [];
  let rank = 1;
  
  querySnapshot.forEach((doc)=>{
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
} catch(error){
  console.error("Error by loading the Ranklist:", error);
  return[];
  }
}
async function meineStatistiken() {
  try{
    //wer ist eingeloggt
    const currentUser = getCurrentUser();
    if(!currentUser){
      console.warn("Kein Benutzer eingeloggt");
      return null;
    }
    //sage wo sich das Benutzer Dokument befindet
    const userRef = doc(db,"users",currentUser.id);
    
    //Daten aus der Datenbank holen
    const userSnap = await getDoc(userRef)
   
   //checken ob es den Benutzer gibt
   if(!userSnap.exists()){
     console.warn("User not defind");
     return null;
   }
   //nicht nur Snapschuss sondern echte Daten holen
   const userData = userSnap.data();
   
   //Statistiken zurueckgeben
   return{
     username: userData.username,
     gesamtTrophies: userData.gesamtTrophies||0,
     spieleGesamt: userData.spieleGesamt||0,
     spiele: userData.spiele || {},
     registriertAm: userData.createdAt?.toDate?.() || new Date()
   };
   document.getElementById("nutzername").innerText= username;
   document.getElementById("Trophies").innerText= gesamtTrophies;
   document.getElementById("Gespielte Spiele").innerText= spieleGesamt;
   document.getElementById("Uebersicht").innerText= spiele;
   document.getElementById("RegistriertAm").innerText= registriertAm;
  }catch(error){
    console.error("Something happed wrong by loading the statistics:", error);
    return null;
  }
}
function getTrophiesforLevel(spielName,level) {
  const levelData = {
"snake": {1:{sieg: 1, verlust: 1}, 2:{sieg: 2, verlust: 2}, 3:{sieg: 3, verlust: 3}, 4:{sieg: 4, verlust: 4},5:{sieg:5, verlust: 5}},
"Super_Cat": {1:{sieg: 1, verlust: 1}, 2:{sieg: 2, verlust: 2}, 3:{sieg: 3, verlust: 3}, 4:{sieg: 4, verlust: 4},5:{sieg:5, verlust: 5}},
"TTT_Ki": {1:{sieg: 1, verlust: 1}, 2:{sieg: 2, verlust: 2}, 3:{sieg: 3, verlust: 3}, 4:{sieg: 4, verlust: 4},5:{sieg:5, verlust: 5}},
"TTT_2P": {1:{sieg: 1, verlust: 1}, 2:{sieg: 2, verlust: 2}, 3:{sieg: 3, verlust: 3}, 4:{sieg: 4, verlust: 4},5:{sieg:5, verlust: 5}},
"Tischtennis": {1:{sieg: 1, verlust: 1}, 2:{sieg: 2, verlust: 2}, 3:{sieg: 3, verlust: 3}, 4:{sieg: 4, verlust: 4},5:{sieg:5, verlust: 5}},
"E_R": {1:{sieg: 1, verlust: 1}, 2:{sieg: 2, verlust: 2}, 3:{sieg: 3, verlust: 3}, 4:{sieg: 4, verlust: 4},5:{sieg:5, verlust: 5}}

  };
  if (levelData[spielName] && levelData[spielName][level]){
    return levelData[spielName][level];
  }
  return {sieg: level, verlust: level}
}
async function spielBeenden(spielName, level, gewonnen) {
    const currentUser = getCurrentUser();
    if(!currentUser){
      console.warn("Please Login");
      return {success: false};
    }
    const regeln = getTrophiesforLevel(spielName, level);
    const trophies = gewonnen ? regeln.sieg : -regeln.verlust;
    const result = await addTrophies(spielName,trophies);
    return result;
}
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
