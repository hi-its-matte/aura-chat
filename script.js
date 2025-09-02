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
  getDocs,
  arrayUnion,
  arrayRemove,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = { 
  apiKey: "AIzaSyDUAuD94pcZytGIIqb-g3yknf0Gw7IF4Ys", 
  authDomain: "aurachat-b9006.firebaseapp.com", 
  databaseURL: "https://aurachat-b9006-default-rtdb.europe-west1.firebasedatabase.app", 
  projectId: "aurachat-b9006", 
  storageBucket: "aurachat-b9006.firebasestorage.app", 
  messagingSenderId: "120403084146", 
  appId: "1:120403084146:web:52cf28eccf165bdad8d3eb" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Global variables
let currentUser = null;
let currentChatId = null;
let currentChatType = null;
let currentChatData = null;
let unsubscribeMessages = null;
let unsubscribeChats = null;
let selectedMembers = [];
let searchTimeout = null;

// DOM elements
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("versionInfo").textContent = `versione: ${versione}`;
});

const loginScreen = document.getElementById("loginScreen");
const registerScreen = document.getElementById("registerScreen");
const profileSetupScreen = document.getElementById("profileSetupScreen");
const chatScreen = document.getElementById("chatScreen");
const noChatSelected = document.getElementById("noChatSelected");
const chatArea = document.getElementById("chatArea");
const loadingOverlay = document.getElementById("loadingOverlay");
// versione
let versione = "2.3.2"; 

// Inserisci la versione nell'HTML
document.getElementById("versionInfo").textContent = `versione: ${versione}`;
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
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      await updateDoc(userDocRef, {
        lastSeen: serverTimestamp(),
        isOnline: true
      });
    }
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
    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      hideLoading();
      showMessage('registerMessage', 'Username già in uso. Scegline un altro!', 'error');
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
    
    await updateProfile(currentUser, {
      displayName: displayName,
      photoURL: finalPhotoURL
    });

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
    
    localStorage.removeItem('tempUsername');
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

    unsubscribeChats = onSnapshot(chatsQuery, async (snapshot) => {
      const chatList = document.getElementById('chatList');
      if (!chatList) return;
      
      chatList.innerHTML = '';

      for (const chatDoc of snapshot.docs) {
        const chat = chatDoc.data();
        const chatElement = await createChatListItem(chatDoc.id, chat);
        chatList.appendChild(chatElement);
      }
    }, (error) => {
      console.error('Error loading chats:', error);
    });
  } catch (error) {
    console.error('Error setting up chats listener:', error);
  }
}

async function createChatListItem(chatId, chatData) {
  const div = document.createElement('div');
  div.className = 'chat-item';
  div.onclick = () => openChat(chatId, chatData);

  let displayName = chatData.name || 'Chat senza nome';
  let avatarUrl = chatData.photoURL || generateAvatarURL(displayName);

  div.innerHTML = `
    <div class="avatar-container">
      <img class="chat-avatar" src="${avatarUrl}" alt="Chat Avatar">
      <div class="online-status"></div>
    </div>
    <div class="chat-info">
      <h4 class="chat-name">${escapeHtml(displayName)}</h4>
      <p class="chat-last-message">${escapeHtml(chatData.lastMessage || 'Nessun messaggio')}</p>
    </div>
    <div class="chat-meta">
      <span class="chat-time">${formatTime(chatData.lastMessageTime)}</span>
    </div>
  `;

  return div;
}

async function openChat(chatId, chatData) {
  currentChatId = chatId;
  currentChatType = chatData.type;
  currentChatData = chatData;

  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
  
  event.currentTarget.classList.add('active');

  noChatSelected.classList.add('hidden');
  chatArea.classList.remove('hidden');

  let displayName = chatData.name || 'Chat';
  let avatarUrl = chatData.photoURL || generateAvatarURL(displayName);

  const chatNameEl = document.getElementById('chatName');
  const chatAvatarEl = document.getElementById('chatAvatar');
  const addMemberBtn = document.getElementById('addMemberBtn');
  
  if (chatNameEl) chatNameEl.textContent = displayName;
  if (chatAvatarEl) chatAvatarEl.src = avatarUrl;
  
  // Show add member button only for groups
  if (addMemberBtn) {
    if (chatData.type === 'group') {
      addMemberBtn.style.display = 'block';
    } else {
      addMemberBtn.style.display = 'none';
    }
  }
 

  loadMessages(chatId);
}

// Load messages for current chat
function loadMessages(chatId) {
  if (!chatId) return;
  
  try {
    const messagesQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
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

  // Add sender name for group chats and received messages
  if (!isSent && currentChatType === 'group' && messageData.senderName) {
    content += `<div class="message-sender">${escapeHtml(messageData.senderName)}</div>`;
  }

  // Message content based on type
  if (messageData.type === 'system') {
    content += `<div class="message-content system-message">${escapeHtml(messageData.content || '')}</div>`;
  } else if (messageData.type === 'text') {
    content += `<div class="message-content">${escapeHtml(messageData.content || '')}</div>`;
  } else if (messageData.type === 'image' && messageData.fileUrl) {
    content += `
      <div class="message-content">
        <img src="${messageData.fileUrl}" class="file-preview" alt="Image" style="max-width: 200px; border-radius: 8px;">
        ${messageData.content ? `<p>${escapeHtml(messageData.content)}</p>` : ''}
      </div>
    `;
  } else if (messageData.type === 'file' && messageData.fileName) {
    content += `
      <div class="message-content">
        <div class="file-info" style="display: flex; align-items: center; gap: 10px;">
          <i class="file-icon ${getFileIcon(messageData.fileName)}" style="font-size: 24px;"></i>
          <div class="file-details">
            <div class="file-name">${escapeHtml(messageData.fileName)}</div>
            <div class="file-size" style="font-size: 12px; opacity: 0.7;">${formatFileSize(messageData.fileSize || 0)}</div>
          </div>
        </div>
        ${messageData.content ? `<p>${escapeHtml(messageData.content)}</p>` : ''}
      </div>
    `;
  }

  content += `<div class="message-time" style="font-size: 11px; opacity: 0.6; margin-top: 4px;">${formatTime(messageData.timestamp)}</div>`;

  messageBubble.innerHTML = content;
  div.appendChild(messageBubble);

  return div;
}

// Send message (FIXED)
window.sendMessage = async () => {
  if (!currentChatId || !currentUser) return;

  const messageInput = document.getElementById('messageInput');
  if (!messageInput) return;
  
  const content = messageInput.value.trim();
  
  if (!content) return;

  try {
    // Get current user data for sender name
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const senderName = userData.displayName || currentUser.displayName || currentUser.email.split('@')[0];

    const messageData = {
      senderId: currentUser.uid,
      senderName: senderName,
      content: content,
      type: 'text',
      timestamp: serverTimestamp()
    };

    await addDoc(collection(db, "chats", currentChatId, "messages"), messageData);
    
    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: content,
      lastMessageTime: serverTimestamp()
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
  } catch (error) {
    console.error('Error sending message:', error);
    showMessage('chatMessage', 'Errore nell\'invio del messaggio', 'error');
  }
};

// Auto-resize message input
const messageInput = document.getElementById('messageInput');
if (messageInput) {
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

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
  if (modal) {
    modal.classList.remove('hidden');
    selectedMembers = [];
    updateSelectedMembersDisplay();
    
    // Reset form
    const form = document.getElementById('newChatForm');
    if (form) form.reset();
    
    // Show appropriate sections based on default selection
    const chatType = document.getElementById('chatType').value;
    toggleChatTypeOptions(chatType);
  }
};

window.hideNewChatModal = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('newChatModal');
    if (modal) modal.classList.add('hidden');
    selectedMembers = [];
    clearSearchResults();
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

// Chat info and user management functions
window.showChatInfo = async () => {
  if (!currentChatId || !currentChatData) return;
  
  const modal = document.getElementById('chatInfoModal');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  
  // Update chat info
  const chatInfoAvatar = document.getElementById('chatInfoAvatar');
  const chatInfoName = document.getElementById('chatInfoName');
  const chatInfoType = document.getElementById('chatInfoType');
  const groupInfoSection = document.getElementById('groupInfoSection');
  const privateInfoSection = document.getElementById('privateInfoSection');
  
  let displayName = currentChatData.name || 'Chat';
  let avatarUrl = currentChatData.photoURL || generateAvatarURL(displayName);
  

  if (chatInfoAvatar) chatInfoAvatar.src = avatarUrl;
  if (chatInfoName) chatInfoName.textContent = displayName;
  if (chatInfoType) {
    const typeText = currentChatData.type === 'group' ? 'Gruppo' : 
                    currentChatData.type === 'private' ? 'Chat Privata' : 'Chat Personale';
    chatInfoType.textContent = typeText;
  }
  
  // Show appropriate section
  if (currentChatData.type === 'group') {
    if (groupInfoSection) groupInfoSection.style.display = 'block';
    if (privateInfoSection) privateInfoSection.style.display = 'none';
    await loadGroupMembers();
  } else {
    if (groupInfoSection) groupInfoSection.style.display = 'none';
    if (privateInfoSection) privateInfoSection.style.display = 'block';
    await loadPrivateUserInfo();
  }
};

window.hideChatInfo = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('chatInfoModal');
    if (modal) modal.classList.add('hidden');
  }
};

// Load group members
async function loadGroupMembers() {
  if (!currentChatData || !currentChatData.participants) return;
  
  const membersList = document.getElementById('membersList');
  const membersCount = document.getElementById('membersCount');
  
  if (!membersList) return;
  
  membersList.innerHTML = '';
  
  if (membersCount) membersCount.textContent = currentChatData.participants.length;
  
  for (const memberId of currentChatData.participants) {
    try {
      const userDoc = await getDoc(doc(db, "users", memberId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const memberElement = createMemberElement(memberId, userData);
        membersList.appendChild(memberElement);
      }
    } catch (error) {
      console.error('Error loading member:', error);
    }
  }
}

// Create member element
function createMemberElement(memberId, userData) {
  const div = document.createElement('div');
  div.className = 'member-item';
  div.style.cssText = `
    display: flex;
    align-items: center;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    background: rgba(255,255,255,0.1);
  `;
  
  const isCurrentUser = memberId === currentUser.uid;
  const isCreator = memberId === currentChatData.createdBy;
  
  div.innerHTML = `
    <img class="member-avatar" src="${userData.photoURL || generateAvatarURL(userData.displayName)}" 
         alt="Member Avatar" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px;">
    <div class="member-info" style="flex: 1;">
      <h5 style="margin: 0; font-size: 14px;">${escapeHtml(userData.displayName || 'Utente')} ${isCurrentUser ? '(Tu)' : ''}</h5>
      <p style="margin: 0; font-size: 12px; opacity: 0.7;">${escapeHtml(userData.username || '')}</p>
    </div>
    ${isCreator ? '<span class="member-role" style="background: #ff7aff; padding: 2px 8px; border-radius: 12px; font-size: 10px;">Admin</span>' : ''}
    ${!isCurrentUser && currentUser.uid === currentChatData.createdBy ? 
      `<button class="remove-member-btn" onclick="removeMember('${memberId}')" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Rimuovi</button>` : ''}
  `;
  
  return div;
}

// Load private user info
async function loadPrivateUserInfo() {
  if (!currentChatData || currentChatData.type !== 'private') return;
  
  const userInfoDetails = document.getElementById('userInfoDetails');
  if (!userInfoDetails) return;
  
  const otherUserId = currentChatData.participants.find(id => id !== currentUser.uid);
  
  try {
    const otherUserDoc = await getDoc(doc(db, "users", otherUserId));
    if (otherUserDoc.exists()) {
      const otherUser = otherUserDoc.data();
      userInfoDetails.innerHTML = `
        <div class="settings-item" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.1); margin-bottom: 8px;">
          <i class="fas fa-user" style="margin-right: 12px; width: 20px;"></i>
          <div class="settings-item-content">
            <div class="settings-item-title">${escapeHtml(otherUser.displayName || 'Utente')}</div>
            <div class="settings-item-desc" style="font-size: 12px; opacity: 0.7;">${escapeHtml(otherUser.username || '')}</div>
          </div>
        </div>
        <div class="settings-item" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.1);">
          <i class="fas fa-envelope" style="margin-right: 12px; width: 20px;"></i>
          <div class="settings-item-content">
            <div class="settings-item-title">${escapeHtml(otherUser.email || '')}</div>
            <div class="settings-item-desc" style="font-size: 12px; opacity: 0.7;">Email</div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading private user info:', error);
  }
}

// Remove member from group
window.removeMember = async (memberId) => {
  if (!currentChatId || !currentChatData) return;
  
  if (currentUser.uid !== currentChatData.createdBy) {
    alert('Solo l\'admin può rimuovere membri');
    return;
  }
  
  try {
    await updateDoc(doc(db, "chats", currentChatId), {
      participants: arrayRemove(memberId)
    });
    
    // Add system message
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
      type: 'system',
      content: 'Un membro è stato rimosso dal gruppo',
      timestamp: serverTimestamp()
    });
    
    await loadGroupMembers();
  } catch (error) {
    console.error('Error removing member:', error);
  }
};

// Show add member modal
window.showAddMemberModal = () => {
  const modal = document.getElementById('addMemberModal');
  if (modal) modal.classList.remove('hidden');
};

window.hideAddMemberModal = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('addMemberModal');
    if (modal) modal.classList.add('hidden');
  }
};

// Show edit group modal
window.showEditGroupModal = () => {
  const modal = document.getElementById('editGroupModal');
  if (!modal || !currentChatData) return;
  
  modal.classList.remove('hidden');
  
  // Pre-fill form
  const editGroupName = document.getElementById('editGroupName');
  const editGroupDescription = document.getElementById('editGroupDescription');
  const editGroupPhoto = document.getElementById('editGroupPhoto');
  
  if (editGroupName) editGroupName.value = currentChatData.name || '';
  if (editGroupDescription) editGroupDescription.value = currentChatData.description || '';
  if (editGroupPhoto) editGroupPhoto.value = currentChatData.photoURL || '';
};

window.hideEditGroupModal = (event) => {
  if (!event || event.target === event.currentTarget) {
    const modal = document.getElementById('editGroupModal');
    if (modal) modal.classList.add('hidden');
  }
};

// Toggle chat type options
function toggleChatTypeOptions(chatType) {
  const recipientGroup = document.getElementById('recipientGroup');
  const groupMembersSection = document.getElementById('groupMembersSection');
  const chatNameGroup = document.getElementById('chatNameGroup');
  
  if (chatType === 'group') {
    if (recipientGroup) recipientGroup.style.display = 'none';
    if (groupMembersSection) groupMembersSection.style.display = 'block'; // Mostra per i gruppi
    if (chatNameGroup) chatNameGroup.style.display = 'block';
  } else {
    if (recipientGroup) recipientGroup.style.display = 'none';
    if (groupMembersSection) groupMembersSection.style.display = 'none';
    if (chatNameGroup) chatNameGroup.style.display = 'block';
  }
}

// Search users function (FIXED)
// Funzione di ricerca utenti (RIPARATA)
async function searchUsers(termineRicerca, containerRisultati, alClickUtente) {
  if (!termineRicerca || termineRicerca.length < 2) {
    if (containerRisultati) containerRisultati.innerHTML = '';
    return;
  }
  
  try {
    // Ricerca per username o nome visualizzato
    const usernameQuery = termineRicerca.startsWith('@') ? termineRicerca : `@${termineRicerca}`;
    
    const queryUtenti = query(
      collection(db, "users"),
      where("username", ">=", usernameQuery),
      where("username", "<=", usernameQuery + '\uf8ff'),
      limit(10)
    );
    
    const snapshot = await getDocs(queryUtenti);
    const utenti = [];
    
    snapshot.forEach((doc) => {
      if (doc.id !== currentUser.uid) {
        utenti.push({ id: doc.id, ...doc.data() });
      }
    });
    
    // Cerca anche per nome visualizzato se non c'è il prefisso @
    if (!termineRicerca.startsWith('@') && utenti.length < 5) {
      const queryNome = query(
        collection(db, "users"),
        where("displayName", ">=", termineRicerca),
        where("displayName", "<=", termineRicerca + '\uf8ff'),
        limit(5)
      );
      
      const snapshotNome = await getDocs(queryNome);
      snapshotNome.forEach((doc) => {
        if (doc.id !== currentUser.uid && !utenti.find(u => u.id === doc.id)) {
          utenti.push({ id: doc.id, ...doc.data() });
        }
      });
    }
    
    displaySearchResults(utenti, containerRisultati, alClickUtente);
  } catch (error) {
    console.error('Error searching users:', error);
  }
}

// Display search results
function displaySearchResults(users, container, onUserClick) {
  if (!container) return;
  
  container.innerHTML = '';
  
  if (users.length === 0) {
    container.innerHTML = '<p class="small" style="padding: 10px; text-align: center; color: rgba(255,255,255,0.6);">Nessun utente trovato</p>';
    return;
  }
  
  users.forEach(user => {
    const div = document.createElement('div');
    div.className = 'user-result';
    div.style.cssText = `
      display: flex;
      align-items: center;
      padding: 10px;
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      margin-bottom: 5px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    div.onclick = () => onUserClick(user);
    
    div.addEventListener('mouseenter', () => {
      div.style.background = 'rgba(255,255,255,0.2)';
    });
    
    div.addEventListener('mouseleave', () => {
      div.style.background = 'rgba(255,255,255,0.1)';
    });
    
    div.innerHTML = `
      <img class="user-result-avatar" src="${user.photoURL || generateAvatarURL(user.displayName)}" 
           alt="User Avatar" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px;">
      <div class="user-result-info">
        <h4 style="margin: 0; font-size: 14px;">${escapeHtml(user.displayName || 'Utente')}</h4>
        <p style="margin: 0; font-size: 12px; opacity: 0.7;">${escapeHtml(user.username || '')}</p>
      </div>
    `;
    
    container.appendChild(div);
  });
}

// Clear search results
function clearSearchResults() {
  const containers = [
    'userSearchResults',
    'groupMembersSearchResults',
    'addMemberSearchResults'
  ];
  
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  });
}

// Update selected members display
function updateSelectedMembersDisplay() {
  const container = document.getElementById('selectedMembers');
  if (!container) return;
  
  container.innerHTML = '';
  
  selectedMembers.forEach(member => {
    const div = document.createElement('div');
    div.className = 'selected-member';
    div.style.cssText = `
      display: inline-flex;
      align-items: center;
      background: #ff7aff;
      color: white;
      padding: 5px 10px;
      border-radius: 15px;
      margin: 2px;
      font-size: 12px;
    `;
    
    div.innerHTML = `
      <img src="${member.photoURL || generateAvatarURL(member.displayName)}" 
           alt="Member" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 5px;">
      <span>${escapeHtml(member.displayName)}</span>
      <button class="remove-member" onclick="removeSelectedMember('${member.id}')" 
              style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 16px;">&times;</button>
    `;
    
    container.appendChild(div);
  });
}

// Remove selected member
window.removeSelectedMember = (memberId) => {
  selectedMembers = selectedMembers.filter(member => member.id !== memberId);
  updateSelectedMembersDisplay();
};

// Add member to selection
function addMemberToSelection(user) {
  if (!selectedMembers.find(member => member.id === user.id)) {
    selectedMembers.push(user);
    updateSelectedMembersDisplay();
  }
}

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

// Chat type selection handler
const chatTypeSelect = document.getElementById('chatType');
if (chatTypeSelect) {
  chatTypeSelect.addEventListener('change', function() {
    toggleChatTypeOptions(this.value);
  });
}

const newChatForm = document.getElementById('newChatForm');
if (newChatForm) {
  newChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const chatType = document.getElementById('chatType').value;
    const chatName = document.getElementById('chatNameInput').value.trim();

    if (chatType === 'group') {
      if (!chatName) {
        showMessage('chatMessage', 'Inserisci un nome per il gruppo', 'error');
        return;
      }
      if (selectedMembers.length === 0) {
        showMessage('chatMessage', 'Aggiungi almeno un membro al gruppo', 'error');
        return;
      }
      await createGroupChat(chatName);
    } else {
      if (!chatName) {
        showMessage('chatMessage', 'Inserisci un nome per la chat', 'error');
        return;
      }
      await createPersonalChat(chatName);
    }
  });
}



// Create group chat
async function createGroupChat(chatName) {
  try {
    const participants = [currentUser.uid, ...selectedMembers.map(m => m.id)];
    
    const chatData = {
      name: chatName,
      type: 'group',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      participants: participants,
      description: '',
      photoURL: generateAvatarURL(chatName)
    };

    const docRef = await addDoc(collection(db, "chats"), chatData);
    
    // Add welcome message
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const senderName = userData.displayName || currentUser.displayName || currentUser.email.split('@')[0];
    
    await addDoc(collection(db, "chats", docRef.id, "messages"), {
      type: 'system',
      content: `${senderName} ha creato il gruppo "${chatName}"`,
      timestamp: serverTimestamp()
    });

    window.hideNewChatModal();
    newChatForm.reset();
    selectedMembers = [];
    
    setTimeout(() => {
      openChatById(docRef.id);
    }, 500);
    
  } catch (error) {
    console.error('Error creating group chat:', error);
    showMessage('chatMessage', 'Errore durante la creazione del gruppo', 'error');
  }
}

// Create personal chat
async function createPersonalChat(chatName) {
  try {
    const chatData = {
      name: chatName,
      type: 'personal',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      participants: [currentUser.uid],
      photoURL: generateAvatarURL(chatName)
    };

    const docRef = await addDoc(collection(db, "chats"), chatData);
    
    // Add welcome message
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const senderName = userData.displayName || currentUser.displayName || currentUser.email.split('@')[0];
    
    await addDoc(collection(db, "chats", docRef.id, "messages"), {
      type: 'system',
      content: `Chat personale "${chatName}" creata`,
      timestamp: serverTimestamp()
    });

    window.hideNewChatModal();
    newChatForm.reset();
    
    setTimeout(() => {
      openChatById(docRef.id);
    }, 500);
    
  } catch (error) {
    console.error('Error creating personal chat:', error);
    showMessage('chatMessage', 'Errore durante la creazione della chat', 'error');
  }
}

// Edit group form handler
const editGroupForm = document.getElementById('editGroupForm');
if (editGroupForm) {
  editGroupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentChatId || !currentChatData || currentUser.uid !== currentChatData.createdBy) {
      showMessage('editGroupMessage', 'Solo l\'admin può modificare il gruppo', 'error');
      return;
    }
    
    const newName = document.getElementById('editGroupName').value.trim();
    const newDescription = document.getElementById('editGroupDescription').value.trim();
    const newPhoto = document.getElementById('editGroupPhoto').value.trim();
    
    if (!newName) {
      showMessage('editGroupMessage', 'Il nome del gruppo è obbligatorio', 'error');
      return;
    }
    
    try {
      const updateData = {
        name: newName,
        description: newDescription
      };
      
      if (newPhoto) {
        updateData.photoURL = newPhoto;
      }
      
      await updateDoc(doc(db, "chats", currentChatId), updateData);
      
      // Add system message
      await addDoc(collection(db, "chats", currentChatId, "messages"), {
        type: 'system',
        content: 'Le informazioni del gruppo sono state aggiornate',
        timestamp: serverTimestamp()
      });
      
      window.hideEditGroupModal();
      
      // Refresh chat info if open
      if (!document.getElementById('chatInfoModal').classList.contains('hidden')) {
        setTimeout(() => window.showChatInfo(), 500);
      }
      
    } catch (error) {
      console.error('Error updating group:', error);
      showMessage('editGroupMessage', 'Errore nell\'aggiornamento del gruppo', 'error');
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

// Search input event listeners
const recipientUsernameInput = document.getElementById('recipientUsername');
if (recipientUsernameInput) {
  recipientUsernameInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchUsers(this.value, document.getElementById('userSearchResults'), (user) => {
        this.value = user.username;
        document.getElementById('userSearchResults').innerHTML = '';
      });
    }, 300);
  });
}

const groupMembersSearchInput = document.getElementById('groupMembersSearch');
if (groupMembersSearchInput) {
  groupMembersSearchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchUsers(this.value, document.getElementById('groupMembersSearchResults'), (user) => {
        addMemberToSelection(user);
        this.value = '';
        document.getElementById('groupMembersSearchResults').innerHTML = '';
      });
    }, 300);
  });
}

const addMemberSearchInput = document.getElementById('addMemberSearch');
if (addMemberSearchInput) {
  addMemberSearchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchUsers(this.value, document.getElementById('addMemberSearchResults'), async (user) => {
        await addMemberToChat(user);
        this.value = '';
        document.getElementById('addMemberSearchResults').innerHTML = '';
      });
    }, 300);
  });
}

// Add member to current chat
async function addMemberToChat(user) {
  if (!currentChatId || !currentChatData) return;
  
  if (currentUser.uid !== currentChatData.createdBy) {
    alert('Solo l\'admin può aggiungere membri');
    return;
  }
  
  if (currentChatData.participants.includes(user.id)) {
    alert('L\'utente è già nel gruppo');
    return;
  }
  
  try {
    await updateDoc(doc(db, "chats", currentChatId), {
      participants: arrayUnion(user.id)
    });
    
    // Add system message
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
      type: 'system',
      content: `${user.displayName} è stato aggiunto al gruppo`,
      timestamp: serverTimestamp()
    });
    
    window.hideAddMemberModal();
  } catch (error) {
    console.error('Error adding member:', error);
  }
}

// Username validation
const usernameInput = document.getElementById('username');
if (usernameInput) {
  usernameInput.addEventListener('input', function() {
    if (!this.value.startsWith('@') && this.value.length > 0) {
      this.value = '@' + this.value;
    }
    
    const isValid = /^@[a-zA-Z0-9_]{3,20}$/.test(this.value);
    this.style.borderColor = isValid ? '#4caf50' : '#f44336';
  });

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

// Handle file uploads
const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length || !currentChatId) return;

    for (const file of files) {
      await uploadAndSendFile(file);
    }
    
    // Reset input
    e.target.value = '';
  });
}

// Upload and send file
async function uploadAndSendFile(file) {
  if (!file || !currentChatId) return;
  
  try {
    const fileRef = ref(storage, `files/${currentChatId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    const fileUrl = await getDownloadURL(snapshot.ref);

    // Get current user data for sender name
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const senderName = userData.displayName || currentUser.displayName || currentUser.email.split('@')[0];

    const messageData = {
      senderId: currentUser.uid,
      senderName: senderName,
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

// Utility functions
function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Ora';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m fa`;
    } else if (diffHours < 24) {
      return `${diffHours}h fa`;
    } else if (diffDays < 7) {
      return `${diffDays}g fa`;
    } else {
      return date.toLocaleDateString('it-IT', { 
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    }
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
    rar: 'fas fa-file-archive',
    mp3: 'fas fa-file-audio',
    wav: 'fas fa-file-audio',
    mp4: 'fas fa-file-video',
    avi: 'fas fa-file-video',
    jpg: 'fas fa-file-image',
    jpeg: 'fas fa-file-image',
    png: 'fas fa-file-image',
    gif: 'fas fa-file-image'
  };
  return icons[ext] || 'fas fa-file';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Chat search functionality
const chatSearchInput = document.getElementById('chatSearch');
if (chatSearchInput) {
  chatSearchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
      const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
      const lastMessage = item.querySelector('.chat-last-message').textContent.toLowerCase();
      
      if (chatName.includes(searchTerm) || lastMessage.includes(searchTerm)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
}

// Auto-focus message input when chat is selected
function focusMessageInput() {
  const messageInput = document.getElementById('messageInput');
  if (messageInput && !messageInput.disabled) {
    setTimeout(() => {
      messageInput.focus();
    }, 100);
  }
}

// Enhanced message input with emoji support
if (messageInput) {
  // Handle paste events for images
  messageInput.addEventListener('paste', async (e) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadAndSendFile(file);
        }
      }
    }
  });
  
  // Handle drag and drop
  messageInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  
  messageInput.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    for (const file of files) {
      await uploadAndSendFile(file);
    }
  });
}

// Enhanced error handling for network issues
function handleNetworkError(error) {
  console.error('Network error:', error);
  
  // Show user-friendly error message
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: #f44336;
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    z-index: 10000;
    font-size: 14px;
  `;
  errorDiv.textContent = 'Errore di connessione. Verifica la tua connessione internet.';
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

// Add connection status indicator
function updateConnectionStatus(isOnline) {
  let statusIndicator = document.getElementById('connectionStatus');
  
  if (!statusIndicator) {
    statusIndicator = document.createElement('div');
    statusIndicator.id = 'connectionStatus';
    statusIndicator.style.cssText = `
      position: fixed;
      top: 50px;
      right: 20px;
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 12px;
      z-index: 1000;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(statusIndicator);
  }
  
  if (isOnline) {
    statusIndicator.textContent = '🟢 Online';
    statusIndicator.style.background = 'rgba(76, 175, 80, 0.9)';
    statusIndicator.style.color = 'white';
  } else {
    statusIndicator.textContent = '🔴 Offline';
    statusIndicator.style.background = 'rgba(244, 67, 54, 0.9)';
    statusIndicator.style.color = 'white';
  }
}

// Monitor connection status
window.addEventListener('online', () => updateConnectionStatus(true));
window.addEventListener('offline', () => updateConnectionStatus(false));

// Initial connection status
updateConnectionStatus(navigator.onLine);

// Add typing indicator functionality
let typingTimeout;
let isTyping = false;

if (messageInput) {
  messageInput.addEventListener('input', () => {
    if (!currentChatId) return;
    
    // Clear existing timeout
    clearTimeout(typingTimeout);
    
    // Set typing status
    if (!isTyping) {
      setTypingStatus(true);
    }
    
    // Clear typing after 2 seconds of no input
    typingTimeout = setTimeout(() => {
      setTypingStatus(false);
    }, 2000);
  });
}

async function setTypingStatus(typing) {
  if (!currentChatId || !currentUser) return;
  
  isTyping = typing;
  
  try {
    const typingRef = doc(db, "chats", currentChatId, "typing", currentUser.uid);
    
    if (typing) {
      await setDoc(typingRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email.split('@')[0],
        timestamp: serverTimestamp()
      });
    } else {
      await deleteDoc(typingRef);
    }
  } catch (error) {
    console.error('Error updating typing status:', error);
  }
}

// Listen for typing indicators (simplified for this example)
function listenForTyping(chatId) {
  if (!chatId) return;
  
  // Implementation would go here for real-time typing indicators
  // For brevity, this is simplified
}

// Enhanced scroll to bottom with smooth animation
function scrollToBottom(smooth = true) {
  const messagesContainer = document.getElementById('messages');
  if (messagesContainer) {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
}

// Load more messages when scrolling to top (pagination)
let loadingOlderMessages = false;

const messagesContainer = document.getElementById('messages');
if (messagesContainer) {
  messagesContainer.addEventListener('scroll', async () => {
    if (messagesContainer.scrollTop === 0 && !loadingOlderMessages && currentChatId) {
      loadingOlderMessages = true;
      // Implementation for loading older messages would go here
      // For now, we'll just reset the flag
      setTimeout(() => {
        loadingOlderMessages = false;
      }, 1000);
    }
  });
}

// Add notification support (if permitted)
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function showNotification(title, body, icon) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: icon || '/favicon.ico',
      tag: 'aura-chat'
    });
  }
}

// Request notification permission on app load
setTimeout(requestNotificationPermission, 3000);

// Enhanced keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.getElementById('chatSearch');
    if (searchInput) searchInput.focus();
  }
  
  // Ctrl/Cmd + N for new chat
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    window.showNewChatModal();
  }
  
  // Escape to close modals
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal-overlay:not(.hidden)');
    modals.forEach(modal => modal.classList.add('hidden'));
  }
});

// Add PWA support detection
function checkPWASupport() {
  if ('serviceWorker' in navigator) {
    console.log('PWA support detected');
    // Service worker registration would go here
  }
}

// Initialize PWA check
checkPWASupport();

console.log("versione Aura Chat: " + versione ) ;
