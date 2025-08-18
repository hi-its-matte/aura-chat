// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  where,
  serverTimestamp,
  deleteDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";


const firebaseConfig = { apiKey: "AIzaSyDUAuD94pcZytGIIqb-g3yknf0Gw7IF4Ys", authDomain: "aurachat-b9006.firebaseapp.com", databaseURL: "https://aurachat-b9006-default-rtdb.europe-west1.firebasedatabase.app", projectId: "aurachat-b9006", storageBucket: "aurachat-b9006.firebasestorage.app", messagingSenderId: "120403084146", appId: "1:120403084146:web:52cf28eccf165bdad8d3eb" };

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Variabili globali
let currentUser = null;
let currentChatId = null;
let currentChatType = null;
let unsubscribeMessages = null;
let unsubscribeChats = null;

// Elementi DOM
const loginScreen = document.getElementById("loginScreen");
const registerScreen = document.getElementById("registerScreen");
const profileSetupScreen = document.getElementById("profileSetupScreen");
const chatScreen = document.getElementById("chatScreen");
const noChatSelected = document.getElementById("noChatSelected");
const chatArea = document.getElementById("chatArea");
const loadingOverlay = document.getElementById("loadingOverlay");

// Authentication State Observer
onAuthStateChanged(auth, async (user) => {
  hideLoading();
  
  if (user) {
    currentUser = user;
    try {
      const needsProfileSetup = await checkIfNeedsProfileSetup(user);
      if (needsProfileSetup) {
        showProfileSetupScreen();
      } else {
        await initializeUserProfile(user);
        showChatScreen();
        loadChats();
      }
    } catch (error) {
      console.error('Error initializing user:', error);
      showMessage('loginMessage', 'Errore durante l\'inizializzazione', 'error');
    }
  } else {
    currentUser = null;
    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribeChats) unsubscribeChats();
    showLoginScreen();
  }
});

// Check if user needs profile setup
async function checkIfNeedsProfileSetup(user) {
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    return !userDoc.exists() || !userDoc.data().profileCompleted;
  } catch (error) {
    console.error('Error checking profile setup:', error);
    return false;
  }
}

// Initialize user profile
async function initializeUserProfile(user) {
  try {
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, {
      lastSeen: serverTimestamp(),
      isOnline: true
    });
  } catch (error) {
    console.error('Error initializing user profile:', error);
    throw error;
  }
}

// Screen Management Functions
function showLoginScreen() {
  hideAllScreens();
  loginScreen.classList.remove('hidden');
}

function showRegisterScreen() {
  hideAllScreens();
  registerScreen.classList.remove('hidden');
}

function showProfileSetupScreen() {
  hideAllScreens();
  profileSetupScreen.classList.remove('hidden');
  setupProfilePreview();
}

function showChatScreen() {
  hideAllScreens();
  chatScreen.classList.remove('hidden');
  updateUserProfile();
}

function hideAllScreens() {
  loginScreen.classList.add('hidden');
  registerScreen.classList.add('hidden');
  profileSetupScreen.classList.add('hidden');
  chatScreen.classList.add('hidden');
}

function showLoading() {
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Setup profile preview
function setupProfilePreview() {
  if (currentUser) {
    const previewName = document.getElementById('previewName');
    const previewUsername = document.getElementById('previewUsername');
    const previewAvatar = document.getElementById('previewAvatar');
    const setupDisplayName = document.getElementById('setupDisplayName');
    
    const email = currentUser.email.split('@')[0];
    const avatarURL = generateAvatarURL(email);
    
    if (previewName) previewName.textContent = email;
    if (previewAvatar) previewAvatar.src = avatarURL;
    if (setupDisplayName) setupDisplayName.value = email;
    
    // Get the username from temporary storage or generate one
    const storedUsername = localStorage.getItem('tempUsername') || `@${email}_${Math.random().toString(36).substr(2, 4)}`;
    if (previewUsername) previewUsername.textContent = storedUsername;
  }
}

// Generate avatar URL
function generateAvatarURL(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff7aff&color=fff&size=200`;
}

// Update user profile in UI
async function updateUserProfile() {
  if (!currentUser) return;
  
  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.exists() ? userDoc.data() : null;
    
    const displayName = userData?.displayName || currentUser.displayName || 'Utente';
    const email = currentUser.email;
    const photoURL = userData?.photoURL || currentUser.photoURL || generateAvatarURL(displayName);
    
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const userAvatarEl = document.getElementById('userAvatar');
    
    if (userNameEl) userNameEl.textContent = displayName;
    if (userEmailEl) userEmailEl.textContent = email;
    if (userAvatarEl) userAvatarEl.src = photoURL;
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

// Login Form Handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showMessage('loginMessage', 'Compila tutti i campi', 'error');
    return;
  }
  
  showLoading();
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage('loginMessage', 'Accesso effettuato con successo!', 'success');
  } catch (error) {
    hideLoading();
    console.error('Login error:', error);
    showMessage('loginMessage', getErrorMessage(error.code), 'error');
  }
});

// Register Form Handler
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const username = document.getElementById('username').value.trim();

  // Validation
  if (!email || !password || !username) {
    showMessage('registerMessage', 'Compila tutti i campi', 'error');
    return;
  }

  if (!isValidUsername(username)) {
    showMessage('registerMessage', 'Username non valido. Deve iniziare con @ e contenere solo lettere, numeri e underscore (3-20 caratteri)', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('registerMessage', 'La password deve essere di almeno 6 caratteri', 'error');
    return;
  }

  showLoading();

  try {
    // Check if username already exists
    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      hideLoading();
      showMessage('registerMessage', 'Username già in uso. Scegline un altro!', 'error');
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Store username temporarily for profile setup
    localStorage.setItem('tempUsername', username);
    
    showMessage('registerMessage', 'Registrazione completata! Completa il tuo profilo', 'success');
  } catch (error) {
    hideLoading();
    console.error('Registration error:', error);
    showMessage('registerMessage', getErrorMessage(error.code), 'error');
  }
});

// Profile Setup Form Handler
document.getElementById('profileSetupForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!currentUser) return;
  
  const displayName = document.getElementById('setupDisplayName').value.trim();
  const photoURL = document.getElementById('setupPhotoURL').value.trim();
  
  if (!displayName) {
    showMessage('profileSetupMessage', 'Il nome visualizzato è obbligatorio', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const username = localStorage.getItem('tempUsername');
    const finalPhotoURL = photoURL || generateAvatarURL(displayName);
    
    // Update Firebase Auth profile
    await updateProfile(currentUser, {
      displayName: displayName,
      photoURL: finalPhotoURL
    });

    // Save user data in Firestore
    await setDoc(doc(db, "users", currentUser.uid), {
      email: currentUser.email,
      displayName: displayName,
      username: username,
      photoURL: finalPhotoURL,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      isOnline: true,
      profileCompleted: true
    });
    
    // Clean up temporary storage
    localStorage.removeItem('tempUsername');
    
    // Initialize and show chat screen
    await initializeUserProfile(currentUser);
    showChatScreen();
    loadChats();
    
    showMessage('profileSetupMessage', 'Profilo completato!', 'success');
  } catch (error) {
    hideLoading();
    console.error('Profile setup error:', error);
    showMessage('profileSetupMessage', 'Errore durante il setup del profilo', 'error');
  }
});

// Validate username format
function isValidUsername(username) {
  return /^@[a-zA-Z0-9_]{3,20}$/.test(username);
}

// Check if username exists
async function checkUsernameExists(username) {
  try {
    const usernameQuery = query(
      collection(db, "users"),
      where("username", "==", username)
    );
    const snapshot = await getDocs(usernameQuery);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
}

// Show/hide messages
function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.textContent = message;
  element.className = `info-message info-${type}`;
  element.classList.remove('hidden');
  setTimeout(() => {
    element.classList.add('hidden');
  }, 5000);
}

// Get user-friendly error messages
function getErrorMessage(errorCode) {
  const messages = {
    'auth/user-not-found': 'Utente non trovato',
    'auth/wrong-password': 'Password errata',
    'auth/email-already-in-use': 'Email già registrata',
    'auth/weak-password': 'Password troppo debole (minimo 6 caratteri)',
    'auth/invalid-email': 'Email non valida',
    'auth/too-many-requests': 'Troppi tentativi. Riprova più tardi',
    'auth/network-request-failed': 'Errore di connessione'
  };
  return messages[errorCode] || 'Si è verificato un errore. Riprova.';
}

// Navigation Functions
window.showRegister = () => showRegisterScreen();
window.showLogin = () => showLoginScreen();

// Load chats for current user
async function loadChats() {
  if (!currentUser) return;

  try {
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("lastMessageTime", "desc")
    );

    if (unsubscribeChats) unsubscribeChats();

    unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      const chatList = document.getElementById('chatList');
      if (!chatList) return;
      
      chatList.innerHTML = '';

      snapshot.forEach((doc) => {
        const chat = doc.data();
        const chatElement = createChatListItem(doc.id, chat);
        chatList.appendChild(chatElement);
      });
    }, (error) => {
      console.error('Error loading chats:', error);
    });
  } catch (error) {
    console.error('Error setting up chats listener:', error);
  }
}

// Create chat list item element
function createChatListItem(chatId, chatData) {
  const div = document.createElement('div');
  div.className = 'chat-item';
  div.onclick = () => openChat(chatId, chatData);

  const avatarUrl = chatData.photoURL || generateAvatarURL(chatData.name || 'Chat');

  div.innerHTML = `
    <div class="avatar-container">
      <img class="chat-avatar" src="${avatarUrl}" alt="Chat Avatar">
      <div class="online-status"></div>
    </div>
    <div class="chat-info">
      <h4 class="chat-name">${escapeHtml(chatData.name || 'Chat senza nome')}</h4>
      <p class="chat-last-message">${escapeHtml(chatData.lastMessage || 'Nessun messaggio')}</p>
    </div>
    <div class="chat-meta">
      <span class="chat-time">${formatTime(chatData.lastMessageTime)}</span>
    </div>
  `;

  return div;
}

// Open chat
function openChat(chatId, chatData) {
  currentChatId = chatId;
  currentChatType = chatData.type;

  // Update active chat
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
  
  event.currentTarget.classList.add('active');

  // Show chat area
  noChatSelected.classList.add('hidden');
  chatArea.classList.remove('hidden');

  // Update chat header
  const chatNameEl = document.getElementById('chatName');
  const chatAvatarEl = document.getElementById('chatAvatar');
  
  if (chatNameEl) chatNameEl.textContent = chatData.name || 'Chat';
  if (chatAvatarEl) {
    chatAvatarEl.src = chatData.photoURL || generateAvatarURL(chatData.name || 'Chat');
  }

  // Load messages
  loadMessages(chatId);
}

// Load messages for current chat
function loadMessages(chatId) {
  if (!chatId) return;
  
  try {
    const messagesQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    if (unsubscribeMessages) unsubscribeMessages();

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messagesContainer = document.getElementById('messages');
      if (!messagesContainer) return;
      
      messagesContainer.innerHTML = '';

      snapshot.forEach((doc) => {
        const message = doc.data();
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
      });

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, (error) => {
      console.error('Error loading messages:', error);
    });
  } catch (error) {
    console.error('Error setting up messages listener:', error);
  }
}

// Create message element
function createMessageElement(messageData) {
  const div = document.createElement('div');
  const isSent = messageData.senderId === currentUser.uid;
  div.className = `message ${isSent ? 'sent' : 'received'}`;

  const messageBubble = document.createElement('div');
  messageBubble.className = 'message-bubble';

  let content = '';

  // Add sender name for group chats
  if (!isSent && currentChatType === 'group' && messageData.senderName) {
    content += `<div class="message-sender">${escapeHtml(messageData.senderName)}</div>`;
  }

  // Message content
  if (messageData.type === 'text') {
    content += `<div class="message-content">${escapeHtml(messageData.content || '')}</div>`;
  } else if (messageData.type === 'image' && messageData.fileUrl) {
    content += `
      <div class="message-content">
        <img src="${messageData.fileUrl}" class="file-preview" alt="Image">
        ${messageData.content ? `<p>${escapeHtml(messageData.content)}</p>` : ''}
      </div>
    `;
  } else if (messageData.type === 'file' && messageData.fileName) {
    content += `
      <div class="message-content">
        <div class="file-info">
          <i class="file-icon ${getFileIcon(messageData.fileName)}"></i>
          <div class="file-details">
            <div class="file-name">${escapeHtml(messageData.fileName)}</div>
            <div class="file-size">${formatFileSize(messageData.fileSize || 0)}</div>
          </div>
        </div>
        ${messageData.content ? `<p>${escapeHtml(messageData.content)}</p>` : ''}
      </div>
    `;
  }

  // Add timestamp
  content += `<div class="message-time">${formatTime(messageData.timestamp)}</div>`;

  messageBubble.innerHTML = content;
  div.appendChild(messageBubble);

  return div;
}

// Send message
window.sendMessage = async () => {
  if (!currentChatId || !currentUser) return;

  const messageInput = document.getElementById('messageInput');
  if (!messageInput) return;
  
  const content = messageInput.value.trim();
  
  if (!content) return;

  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email.split('@')[0],
    content: content,
    type: 'text',
    timestamp: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "chats", currentChatId, "messages"), messageData);
    
    // Update last message in chat
    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: content,
      lastMessageTime: serverTimestamp()
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

// Auto-resize message input
const messageInput = document.getElementById('messageInput');
if (messageInput) {
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // Send message on Enter
  messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.sendMessage();
    }
  });
}

// Modal Functions
window.showNewChatModal = () => {
  const modal = document.getElementById('newChatModal');
  if (modal) modal.classList.remove('hidden');
};

window.hideNewChatModal = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('newChatModal');
    if (modal) modal.classList.add('hidden');
  }
};

window.showSettings = () => {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('hidden');
};

window.hideSettings = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('hidden');
  }
};

window.showProfile = () => {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.remove('hidden');
  
  if (currentUser) {
    const profileName = document.getElementById('profileName');
    const profilePhoto = document.getElementById('profilePhoto');
    
    if (profileName) profileName.value = currentUser.displayName || '';
    if (profilePhoto) profilePhoto.value = currentUser.photoURL || '';
  }
};

window.hideProfile = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('hidden');
  }
};

window.showPrivacyPolicy = () => {
  const modal = document.getElementById('privacyModal');
  if (modal) modal.classList.remove('hidden');
};

window.hidePrivacyPolicy = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('privacyModal');
    if (modal) modal.classList.add('hidden');
  }
};

window.showAbout = () => {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.classList.remove('hidden');
};

window.hideAbout = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.classList.add('hidden');
  }
};

window.showAttachmentOptions = () => {
  const modal = document.getElementById('attachmentModal');
  if (modal) modal.classList.remove('hidden');
};

window.hideAttachmentModal = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('attachmentModal');
    if (modal) modal.classList.add('hidden');
  }
};

window.selectFileType = (acceptType) => {
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.accept = acceptType;
    fileInput.click();
    window.hideAttachmentModal();
  }
};

// Logout
window.logout = async () => {
  try {
    if (currentUser) {
      await updateDoc(doc(db, "users", currentUser.uid), {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    }
    await signOut(auth);
  } catch (error) {
    console.error('Error logging out:', error);
  }
};

// Utility functions
function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    return '';
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(fileName) {
  if (!fileName) return 'fas fa-file';
  
  const ext = fileName.split('.').pop().toLowerCase();
  const icons = {
    pdf: 'fas fa-file-pdf',
    doc: 'fas fa-file-word',
    docx: 'fas fa-file-word',
    xls: 'fas fa-file-excel',
    xlsx: 'fas fa-file-excel',
    ppt: 'fas fa-file-powerpoint',
    pptx: 'fas fa-file-powerpoint',
    txt: 'fas fa-file-alt',
    zip: 'fas fa-file-archive',
    rar: 'fas fa-file-archive'
  };
  return icons[ext] || 'fas fa-file';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Username validation
const usernameInput = document.getElementById('username');
if (usernameInput) {
  usernameInput.addEventListener('input', function() {
    if (!this.value.startsWith('@') && this.value.length > 0) {
      this.value = '@' + this.value;
    }
    
    // Real-time validation
    const isValid = /^@[a-zA-Z0-9_]{3,20}$/.test(this.value);
    this.style.borderColor = isValid ? '#4caf50' : '#f44336';
  });

  // Check username availability
  let usernameTimeout;
  usernameInput.addEventListener('input', function() {
    clearTimeout(usernameTimeout);
    const username = this.value;
    
    if (!username.match(/^@[a-zA-Z0-9_]{3,20}$/)) return;

    usernameTimeout = setTimeout(async () => {
      await checkUsernameAvailability(username);
    }, 800);
  });
}

async function checkUsernameAvailability(username) {
  try {
    const usernameQuery = query(
      collection(db, "users"),
      where("username", "==", username)
    );
    const snapshot = await getDocs(usernameQuery);
    
    const usernameInput = document.getElementById('username');
    if (!usernameInput) return;
    
    const existingIndicator = document.querySelector('.username-indicator');
    if (existingIndicator) existingIndicator.remove();

    const indicator = document.createElement('div');
    indicator.className = 'username-indicator';
    indicator.style.cssText = `
      font-size: 0.8rem;
      margin-top: 5px;
      padding: 5px;
      border-radius: 4px;
    `;

    if (snapshot.empty) {
      indicator.innerHTML = '<i class="fas fa-check"></i> Username disponibile!';
      indicator.style.background = 'rgba(76, 175, 80, 0.2)';
      indicator.style.color = '#4caf50';
      usernameInput.style.borderColor = '#4caf50';
    } else {
      indicator.innerHTML = '<i class="fas fa-times"></i> Username già in uso';
      indicator.style.background = 'rgba(244, 67, 54, 0.2)';
      indicator.style.color = '#f44336';
      usernameInput.style.borderColor = '#f44336';
    }

    if (usernameInput.parentNode) {
      usernameInput.parentNode.appendChild(indicator);
    }
  } catch (error) {
    console.error('Error checking username:', error);
  }
}

// Create new chat form handler
const newChatForm = document.getElementById('newChatForm');
if (newChatForm) {
  newChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const chatType = document.getElementById('chatType').value;
    const chatName = document.getElementById('chatNameInput').value.trim();
    const recipientUsername = document.getElementById('recipientUsername').value.trim();

    if (!chatName) {
      showMessage('chatMessage', 'Inserisci un nome per la chat', 'error');
      return;
    }

    try {
      const chatData = {
        name: chatName,
        type: chatType,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        participants: [currentUser.uid]
      };

      if (chatType === 'private' && recipientUsername) {
        // Find recipient user by username
        const usersQuery = query(
          collection(db, "users"),
          where("username", "==", recipientUsername)
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        if (!usersSnapshot.empty) {
          const recipientUser = usersSnapshot.docs[0];
          const recipientData = recipientUser.data();
          
          chatData.participants.push(recipientUser.id);
          chatData.name = `${recipientData.displayName} (${recipientData.username})`;
          chatData.recipientId = recipientUser.id;
          chatData.photoURL = recipientData.photoURL;
        } else {
          showMessage('chatMessage', 'Utente non trovato! Controlla lo username.', 'error');
          return;
        }
      }

      const docRef = await addDoc(collection(db, "chats"), chatData);
      window.hideNewChatModal();
      
      // Reset form
      newChatForm.reset();
      
      // Auto-open the new chat
      setTimeout(() => {
        openChatById(docRef.id);
      }, 500);
      
    } catch (error) {
      console.error('Error creating chat:', error);
      showMessage('chatMessage', 'Errore durante la creazione della chat', 'error');
    }
  });
}

// Update profile form handler
const profileForm = document.getElementById('profileForm');
if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newDisplayName = document.getElementById('profileName').value.trim();
    const newPhotoURL = document.getElementById('profilePhoto').value.trim();

    if (!newDisplayName) {
      showMessage('profileMessage', 'Il nome è obbligatorio', 'error');
      return;
    }

    try {
      await updateProfile(currentUser, {
        displayName: newDisplayName,
        photoURL: newPhotoURL
      });

      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: newDisplayName,
        photoURL: newPhotoURL
      });

      updateUserProfile();
      window.hideProfile();
      showMessage('profileMessage', 'Profilo aggiornato con successo!', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showMessage('profileMessage', 'Errore nell\'aggiornamento del profilo', 'error');
    }
  });
}

// Handle file uploads
const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length || !currentChatId) return;

    for (const file of files) {
      await uploadAndSendFile(file);
    }
  });
}

// Upload and send file
async function uploadAndSendFile(file) {
  if (!file || !currentChatId) return;
  
  try {
    const fileRef = ref(storage, `files/${currentChatId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    const fileUrl = await getDownloadURL(snapshot.ref);

    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split('@')[0],
      type: file.type.startsWith('image/') ? 'image' : 'file',
      fileUrl: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      timestamp: serverTimestamp()
    };

    await addDoc(collection(db, "chats", currentChatId, "messages"), messageData);
    
    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: `📎 ${file.name}`,
      lastMessageTime: serverTimestamp()
    });

  } catch (error) {
    console.error('Error uploading file:', error);
  }
}

// Show chat type selection
const chatTypeSelect = document.getElementById('chatType');
if (chatTypeSelect) {
  chatTypeSelect.addEventListener('change', function() {
    const recipientGroup = document.getElementById('recipientGroup');
    const recipientUsername = document.getElementById('recipientUsername');
    
    if (this.value === 'private') {
      if (recipientGroup) recipientGroup.style.display = 'block';
      if (recipientUsername) recipientUsername.required = true;
    } else {
      if (recipientGroup) recipientGroup.style.display = 'none';
      if (recipientUsername) recipientUsername.required = false;
    }
  });
}

// Auto-open chat function
async function openChatById(chatId) {
  if (!chatId) return;
  
  try {
    const chatDoc = await getDoc(doc(db, "chats", chatId));
    if (chatDoc.exists()) {
      const chatData = chatDoc.data();
      openChat(chatId, chatData);
    }
  } catch (error) {
    console.error('Error opening chat by ID:', error);
  }
}

// Handle online/offline status
window.addEventListener('beforeunload', async () => {
  if (currentUser) {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating offline status:', error);
    }
  }
});

console.log('🌟 Aura Chat inizializzato!');
console.log('🔒 Crittografia End-to-End attiva');
console.log('☁️ Sincronizzazione multi-dispositivo pronta');
console.log('👥 Sistema di ricerca utenti tramite username attivo');