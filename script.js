// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAqy43f1t23z7vV1wb_Ilwu1uwM30TfZMU",
  authDomain: "chatm-b0631.firebaseapp.com",
  databaseURL: "https://chatm-b0631-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chatm-b0631",
  storageBucket: "chatm-b0631.firebasestorage.app",
  messagingSenderId: "247199877966",
  appId: "1:247199877966:web:ba62c5a441df249056ac1f",
  measurementId: "G-506MJ86GC5"
};

firebase.initializeApp(firebaseConfig);

firebase.auth().signInAnonymously().catch((error) => {
  console.error("Errore login anonimo:", error);
});

const db = firebase.database();

// Elementi DOM
const userNameInput = document.getElementById('userName');
const chatCodeInput = document.getElementById('chatCodeInput');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const info = document.getElementById('info');

const loginDiv = document.getElementById('login');
const chatDiv = document.getElementById('chat');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatNameSpan = document.getElementById('chatName');

// Variabili globali
let userName = "";
let chatCode = "";
let joined = false;
let messagesRef = null;
let usersRef = null;
let encryptionKey = "";
let intervalloScadenza = null;

// === FUNZIONI DI PULIZIA AUTOMATICA ===
function avviaControlloScadenza(codiceChat) {
  // Ferma eventuali controlli precedenti
  if(intervalloScadenza) {
    clearInterval(intervalloScadenza);
  }
  
  // Controlla ogni 5 minuti se la chat è scaduta
  intervalloScadenza = setInterval(async () => {
    await controllaEEliminaSeScaduta(codiceChat);
  }, 5 * 60 * 1000); // 5 minuti
  
  // Controlla anche subito dopo 1 secondo
  setTimeout(() => controllaEEliminaSeScaduta(codiceChat), 1000);
}

async function controllaEEliminaSeScaduta(codiceChat) {
  try {
    const chatMetaRef = db.ref('chats/' + codiceChat + '/metadata');
    const snapshot = await chatMetaRef.get();
    
    if(snapshot.exists()) {
      const metadata = snapshot.val();
      const now = Date.now();
      
      if(metadata.expires && now > metadata.expires) {
        console.log(`Chat ${codiceChat} scaduta. Eliminazione in corso...`);
        
        // Mostra avviso agli utenti prima di eliminare
        if(joined) {
          aggiungiMessaggio("⚠️ Chat scaduta. Eliminazione automatica tra 30 secondi...", 'info');
          
          setTimeout(async () => {
            await eliminaChat(codiceChat);
            // Torna alla schermata login
            resetToLogin();
          }, 30000); // 30 secondi di avviso
        } else {
          // Se non siamo connessi, elimina subito
          await eliminaChat(codiceChat);
        }
        
        // Ferma il controllo
        if(intervalloScadenza) {
          clearInterval(intervalloScadenza);
          intervalloScadenza = null;
        }
      }
    }
  } catch (error) {
    console.error("Errore controllo scadenza:", error);
  }
}

async function eliminaChat(codiceChat) {
  try {
    // Rimuovi l'utente corrente dagli utenti attivi prima di eliminare tutto
    if(joined && usersRef && userName && encryptionKey) {
      const nomeCriptato = cripta(userName, encryptionKey);
      await usersRef.child(nomeCriptato).remove();
    }
    
    // Elimina l'intera chat (messaggi, utenti, metadata)
    await db.ref('chats/' + codiceChat).remove();
    console.log(`Chat ${codiceChat} eliminata con successo`);
    
  } catch (error) {
    console.error("Errore eliminazione chat:", error);
  }
}

// Pulizia globale - elimina tutte le chat scadute
async function puliziaGlobaleChat() {
  try {
    const chatsRef = db.ref('chats');
    const snapshot = await chatsRef.get();
    
    if(snapshot.exists()) {
      const chats = snapshot.val();
      const now = Date.now();
      
      for(const chatId in chats) {
        const chat = chats[chatId];
        if(chat.metadata && chat.metadata.expires && now > chat.metadata.expires) {
          console.log(`Eliminazione chat scaduta: ${chatId}`);
          await db.ref('chats/' + chatId).remove();
        }
      }
    }
  } catch (error) {
    console.error("Errore pulizia globale:", error);
  }
}

// === FUNZIONI DI CRITTOGRAFIA ===
function generaChiaveCrittografia(codiceChat) {
  // Genera una chiave basata sul codice chat usando un hash semplice
  let hash = 0;
  for (let i = 0; i < codiceChat.length; i++) {
    const char = codiceChat.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converte a 32bit integer
  }
  // Estende la chiave a 16 caratteri per maggiore sicurezza
  return Math.abs(hash).toString(36).padStart(16, '0').substring(0, 16);
}

function cripta(testo, chiave) {
  if (!testo || !chiave) return testo;
  
  let risultato = '';
  for (let i = 0; i < testo.length; i++) {
    const charCode = testo.charCodeAt(i);
    const keyChar = chiave.charCodeAt(i % chiave.length);
    const encrypted = charCode ^ keyChar;
    risultato += String.fromCharCode(encrypted);
  }
  // Codifica in base64 per renderlo sicuro per il database
  return btoa(risultato);
}

function decripta(testoCriptato, chiave) {
  if (!testoCriptato || !chiave) return testoCriptato;
  
  try {
    // Decodifica da base64
    const decoded = atob(testoCriptato);
    let risultato = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i);
      const keyChar = chiave.charCodeAt(i % chiave.length);
      const decrypted = charCode ^ keyChar;
      risultato += String.fromCharCode(decrypted);
    }
    return risultato;
  } catch (error) {
    console.error("Errore decrittazione:", error);
    return "[Messaggio non decifrabile]";
  }
}

// Genera codice chat: 4 lettere (maiuscole/minuscole), 3 numeri, 1 carattere speciale
function generaCodice() {
  const lettere = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeri = "0123456789";
  const speciali = "!@$%&*";
  let codice = "";
  
  // Genera 4 lettere
  for(let i = 0; i < 4; i++) {
    codice += lettere.charAt(Math.floor(Math.random() * lettere.length));
  }
  // Genera 3 numeri
  for(let i = 0; i < 3; i++) {
    codice += numeri.charAt(Math.floor(Math.random() * numeri.length));
  }
  // Genera 1 carattere speciale
  codice += speciali.charAt(Math.floor(Math.random() * speciali.length));
  
  // Mischia i caratteri per non avere sempre lo stesso ordine
  codice = codice.split('').sort(() => Math.random() - 0.5).join('');
  return codice;
}

function aggiungiMessaggio(text, tipo, nome = "") {
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(tipo);
  
  if(tipo === 'info'){
    div.textContent = text;
  } else {
    // Sanitizza il contenuto per evitare XSS
    div.textContent = (nome ? nome + ": " : "") + text;
  }
  
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function startListeners() {
  if (!messagesRef || !usersRef) return;
  
  // Rimuovo vecchi listener se presenti
  messagesRef.off();
  usersRef.off();

  messagesRef.on('child_added', snap => {
    const msg = snap.val();
    if (!msg || !msg.text || !msg.name) return;
    
    try {
      // Decritta il messaggio prima di mostrarlo
      const testoDecriptato = decripta(msg.text, encryptionKey);
      const nomeDecriptato = decripta(msg.name, encryptionKey);
      
      if(nomeDecriptato === userName) {
        aggiungiMessaggio(testoDecriptato, 'me', nomeDecriptato);
      } else {
        aggiungiMessaggio(testoDecriptato, 'other', nomeDecriptato);
      }
    } catch (error) {
      console.error("Errore nel mostrare messaggio:", error);
    }
  });

  // Gestisce gli utenti che si uniscono
  let isInitialLoad = true;
  usersRef.on('child_added', snap => {
    if(joined && !isInitialLoad) {
      try {
        // Decripta il nome utente per le notifiche
        const nomeDecriptato = decripta(snap.key, encryptionKey);
        if(nomeDecriptato && nomeDecriptato !== userName) {
          aggiungiMessaggio(`${nomeDecriptato} si è unito alla chat`, 'info');
        }
      } catch (error) {
        console.error("Errore nel gestire utente che si unisce:", error);
      }
    }
  });

  // Dopo il primo caricamento, inizia a mostrare le notifiche
  setTimeout(() => { isInitialLoad = false; }, 1000);

  usersRef.on('child_removed', snap => {
    if(joined) {
      try {
        // Decripta il nome utente per le notifiche
        const nomeDecriptato = decripta(snap.key, encryptionKey);
        if(nomeDecriptato) {
          aggiungiMessaggio(`${nomeDecriptato} ha lasciato la chat`, 'info');
        }
      } catch (error) {
        console.error("Errore nel gestire utente che lascia:", error);
      }
    }
  });
}

function resetToLogin() {
  chatDiv.style.display = 'none';
  loginDiv.style.display = 'block';
  joined = false;
  messagesDiv.innerHTML = '';
  info.textContent = "Chat eliminata automaticamente dopo 2 giorni.";
  
  // Pulisce i riferimenti
  messagesRef = null;
  usersRef = null;
  encryptionKey = "";
  userName = "";
  chatCode = "";
}

async function creaChat() {
  userName = userNameInput.value.trim();
  
  if(userName.length < 1) {
    info.textContent = "Inserisci il tuo nome prima.";
    return;
  }
  
  if(userName.length > 20) {
    info.textContent = "Il nome non può superare i 20 caratteri.";
    return;
  }
  
  try {
    chatCode = generaCodice();
    chatCodeInput.value = chatCode;
    chatNameSpan.textContent = chatCode;
    info.textContent = "";

    // Genera la chiave di crittografia basata sul codice chat
    encryptionKey = generaChiaveCrittografia(chatCode);

    messagesRef = db.ref('chats/' + chatCode + '/messages');
    usersRef = db.ref('chats/' + chatCode + '/users');
    
    // Imposta timestamp di creazione chat e auto-eliminazione dopo 2 giorni
    const chatMetaRef = db.ref('chats/' + chatCode + '/metadata');
    const creationTime = Date.now();
    const expirationTime = creationTime + (2 * 24 * 60 * 60 * 1000); // 2 giorni in millisecondi
    
    await chatMetaRef.set({
      created: creationTime,
      expires: expirationTime,
      autoDelete: true
    });

    // Cripta il nome utente prima di salvarlo
    const nomeCriptato = cripta(userName, encryptionKey);
    await usersRef.child(nomeCriptato).set(true);
    joined = true;

    // Avvia controllo scadenza
    avviaControlloScadenza(chatCode);

    loginDiv.style.display = 'none';
    chatDiv.style.display = 'flex';
    messagesDiv.innerHTML = '';
    startListeners();
    
    aggiungiMessaggio("Chat creata con successo! ", 'info');
    
  } catch (error) {
    console.error("Errore nella creazione della chat:", error);
    info.textContent = "Errore nella creazione della chat. Riprova.";
  }
}

async function entraInChat() {
  userName = userNameInput.value.trim();
  chatCode = chatCodeInput.value.trim();

  if(userName.length < 1) {
    info.textContent = "Inserisci il tuo nome.";
    return;
  }
  
  if(userName.length > 20) {
    info.textContent = "Il nome non può superare i 20 caratteri.";
    return;
  }
  
  if(chatCode.length !== 8) {
    info.textContent = "Il codice chat deve essere lungo 8 caratteri.";
    return;
  }
  
  try {
    chatNameSpan.textContent = chatCode;
    
    // Genera la chiave di crittografia
    encryptionKey = generaChiaveCrittografia(chatCode);
    
    messagesRef = db.ref('chats/' + chatCode + '/messages');
    usersRef = db.ref('chats/' + chatCode + '/users');
    const chatMetaRef = db.ref('chats/' + chatCode + '/metadata');

    // Controlla che la chat esista
    const chatSnapshot = await db.ref('chats/' + chatCode).get();
    if(!chatSnapshot.exists()) {
      info.textContent = "Chat non trovata.";
      return;
    }

    // Controlla se la chat è scaduta
    const metaSnapshot = await chatMetaRef.get();
    if(metaSnapshot.exists()) {
      const metadata = metaSnapshot.val();
      if(metadata.expires && Date.now() > metadata.expires) {
        // Chat scaduta
        await db.ref('chats/' + chatCode).remove();
        info.textContent = "Chat scaduta ed eliminata.";
        return;
      }
    }

    // Controlla numero utenti (max 10)
    const usersSnapshot = await usersRef.get();
    if(usersSnapshot.exists() && Object.keys(usersSnapshot.val()).length >= 10) {
      info.textContent = "Chat piena (max 10 persone).";
      return;
    }

    // Cripta il nome utente prima di salvarlo
    const nomeCriptato = cripta(userName, encryptionKey);
    await usersRef.child(nomeCriptato).set(true);
    joined = true;

    // Avvia controllo scadenza anche per coloro che entrano
    avviaControlloScadenza(chatCode);

    loginDiv.style.display = 'none';
    chatDiv.style.display = 'flex';
    messagesDiv.innerHTML = '';
    info.textContent = '';
    startListeners();
    
  } catch (error) {
    console.error("Errore nell'entrare in chat:", error);
    info.textContent = "Errore nel connetersi alla chat. Riprova.";
  }
}

async function inviaMessaggio() {
  if(!joined) return;
  
  const testo = messageInput.value.trim();
  if(testo.length < 1) return;
  
  if(testo.length > 500) {
    info.textContent = "Il messaggio non può superare i 500 caratteri.";
    return;
  }
  
  try {
    // Cripta sia il nome che il messaggio prima di inviarlo
    const testoCriptato = cripta(testo, encryptionKey);
    const nomeCriptato = cripta(userName, encryptionKey);
    
    await messagesRef.push({ 
      name: nomeCriptato, 
      text: testoCriptato, 
      timestamp: Date.now() 
    });
    
    messageInput.value = '';
    info.textContent = ''; // Pulisce eventuali messaggi di errore
    
  } catch (error) {
    console.error("Errore nell'invio del messaggio:", error);
    info.textContent = "Errore nell'invio del messaggio. Riprova.";
  }
}

// Event listeners
joinBtn.addEventListener('click', entraInChat);
createBtn.addEventListener('click', creaChat);
sendBtn.addEventListener('click', inviaMessaggio);

messageInput.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    inviaMessaggio();
  }
});

// Gestione disconnessione: rimuove l'utente quando questo chiude la pagina
window.addEventListener('beforeunload', async () => {
  if(joined && usersRef && userName && encryptionKey) {
    const nomeCriptato = cripta(userName, encryptionKey);
    await usersRef.child(nomeCriptato).remove();
  }
  
  // Ferma il controllo scadenza chat
  if(intervalloScadenza) {
    clearInterval(intervalloScadenza);
  }
});

// Gestione visibilità pagina (quando l'utente cambia tab)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && joined && usersRef && userName && encryptionKey) {
    // L'utente ha cambiato tab, ma non rimuoviamo subito dalla chat
    // Questo evita disconnessioni accidentali
  }
});


// Controllo elementi DOM all'avvio
window.addEventListener('DOMContentLoaded', () => {
  const requiredElements = [
    'userName', 'chatCodeInput', 'joinBtn', 'createBtn', 
    'info', 'login', 'chat', 'messages', 'messageInput', 
    'sendBtn', 'chatName'
  ];
  
  requiredElements.forEach(id => {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`Elemento mancante: #${id}`);
    }
  });
});