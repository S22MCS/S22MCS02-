import { db, auth, isAdmin } from '../firebase-config.js';
import {
    collection, query, orderBy, onSnapshot, doc, updateDoc,
    serverTimestamp, addDoc, setDoc, deleteDoc, getDoc, limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- DOM Elements ---
const elements = {
    appContainer: document.getElementById('app-container'),
    sidebarView: document.getElementById('sidebar-view'),
    chatView: document.getElementById('chat-view'),
    groupsList: document.getElementById('groups-list'),
    messagesContainer: document.getElementById('messages-container'),
    messageForm: document.getElementById('message-form'),
    messageInput: document.getElementById('message-input'),
    headerTitle: document.getElementById('header-title'),
    headerStatus: document.getElementById('header-status'),
    headerIcon: document.getElementById('header-icon'),
    backBtn: document.getElementById('back-btn'),
    typingIndicator: document.getElementById('typing-indicator'),
    currentUserImg: document.getElementById('current-user-img'),
    currentUserName: document.getElementById('current-user-name'),
    groupInfoBtn: document.getElementById('group-info-btn'),
    broadcastBanner: document.getElementById('broadcast-banner')
};

// --- State ---
const state = {
    currentUser: null,
    currentGroup: null,
    unsubscribeMessages: null,
    unsubscribeTyping: null,
    typingTimeout: null,
    isMobile: window.innerWidth < 768,
    lastReadMap: JSON.parse(localStorage.getItem('tawasol_read_map') || '{}'),
    isMaintenance: false
};

// --- Sounds ---
const sounds = {
    send: new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'),
    receive: new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3') // Different receive sound
};

// --- Initialization ---
async function init() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUser = user;
            // Load User Data
            try {
                const userSnap = await getDoc(doc(db, 'users', user.uid));
                const userData = userSnap.data();

                const displayName = userData?.displayName || user.displayName || 'مستخدم';
                elements.currentUserName.textContent = displayName;
                elements.currentUserImg.src = userData?.photoUrl || user.photoURL || `https://ui-avatars.com/api/?name=${displayName}`;

                // Save user minimal info to state for faster access
                state.currentUser.displayName = displayName;

                loadGroups();
                initPresenceSystem();
                loadSettings();
                initNotifications();

            } catch (e) {
                console.error("Error loading user data", e);
            }

        } else {
            window.location.href = 'login_contect_user_system_med.html';
        }
    });

    // Event Listeners
    elements.backBtn.addEventListener('click', closeChat);
    elements.messageForm.addEventListener('submit', sendMessage);
    elements.messageInput.addEventListener('input', handleTyping);

    // Resize Listener
    window.addEventListener('resize', () => {
        state.isMobile = window.innerWidth < 768;
        if (!state.isMobile) {
            document.body.classList.remove('chat-active');
        }
    });
}

function initNotifications() {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// --- Groups Logic ---
function loadGroups() {
    const q = query(collection(db, 'tawasol_groups'), orderBy('lastMessageTime', 'desc'));

    onSnapshot(q, (snapshot) => {
        elements.groupsList.innerHTML = '';
        if (snapshot.empty) {
            elements.groupsList.innerHTML = '<p class="text-center text-gray-500 mt-10">لا توجد مجموعات</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const group = { id: docSnap.id, ...docSnap.data() };
            renderGroupItem(group);
        });
    });
}

function renderGroupItem(group) {
    const item = document.createElement('div');
    const lastMsgTime = group.lastMessageTime ? group.lastMessageTime.toMillis() : 0;
    const lastReadTime = state.lastReadMap[group.id] || 0;
    const isUnread = lastMsgTime > lastReadTime;
    const isActive = state.currentGroup?.id === group.id;

    // Highlight unread with bold text and red dot

    item.className = `group-item cursor-pointer flex items-center gap-3 ${isActive ? 'active' : ''}`;
    item.onclick = () => openChat(group);

    item.innerHTML = `
        <div class="group-avatar w-12 h-12 rounded-full flex items-center justify-center font-bold relative text-white text-lg">
            ${group.imageUrl && group.imageUrl.length > 20 ?
            `<img src="${group.imageUrl}" class="w-full h-full rounded-full object-cover">` :
            group.name.charAt(0)}
            ${isUnread ? '<span class="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>' : ''}
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex justify-between items-center">
                <h4 class="font-bold text-gray-800 truncate text-sm">${group.name}</h4>
                <span class="text-[10px] text-gray-400 font-medium">${formatRelativeTime(group.lastMessageTime)}</span>
            </div>
            <p class="text-[11px] truncate mt-1 ${isUnread ? 'font-bold text-gray-900' : 'text-gray-500'}">
                ${group.lastMessageSender ? `<span class="text-indigo-600">${group.lastMessageSender}:</span>` : ''} 
                ${group.lastMessage || 'بدء محادثة جديدة'}
            </p>
        </div>
    `;
    elements.groupsList.appendChild(item);
}

// --- Chat Logic ---
function openChat(group) {
    if (state.isMaintenance && !isAdmin(state.currentUser)) {
        Swal.fire({ icon: 'warning', title: 'عذراً', text: 'المحادثة مغلقة للصيانة مؤقتاً' });
        return;
    }

    state.currentGroup = group;

    // UI Updates
    elements.headerTitle.textContent = group.name;
    elements.headerIcon.textContent = group.name.charAt(0);
    elements.headerStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500 inline-block mr-1"></span> متصل';

    // Mark Read
    state.lastReadMap[group.id] = Date.now();
    localStorage.setItem('tawasol_read_map', JSON.stringify(state.lastReadMap));

    // Transitions (CSS Class based)
    // Update active class in list
    document.querySelectorAll('.group-item').forEach(el => el.classList.remove('active'));
    // (Optimization: We could find specific element but re-render is handled by snapshot if needed, or simple DOM find)

    document.body.classList.add('chat-active'); // Triggers CSS transform for Mobile

    // Load Messages
    loadMessages(group.id);
    listenTyping(group.id);
}

function closeChat() {
    state.currentGroup = null;
    document.body.classList.remove('chat-active');

    if (state.unsubscribeMessages) state.unsubscribeMessages();
    if (state.unsubscribeTyping) state.unsubscribeTyping();

    elements.headerTitle.textContent = "اختر محادثة";
}

// --- Messages ---
function loadMessages(groupId) {
    if (state.unsubscribeMessages) state.unsubscribeMessages();

    // Show Loader
    elements.messagesContainer.innerHTML = '<div class="absolute inset-0 flex items-center justify-center"><div class="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div></div>';

    const q = query(
        collection(db, 'tawasol_groups', groupId, 'messages'),
        orderBy('timestamp', 'asc')
    );

    let isInitialLoad = true;

    state.unsubscribeMessages = onSnapshot(q, (snapshot) => {
        // Clear loader on first data
        if (isInitialLoad) {
            elements.messagesContainer.innerHTML = '';
        }

        if (snapshot.empty) {
            elements.messagesContainer.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                    <i class="fas fa-comments text-5xl mb-4"></i>
                    <p>ابدأ المحادثة الآن</p>
                </div>
            `;
            isInitialLoad = false;
            return;
        }

        // Handle Additions
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                renderMessage(change.doc.id, msg, isInitialLoad);

                // Sound Effect if not me and not initial load
                if (!isInitialLoad && msg.senderId !== state.currentUser.uid) {
                    sounds.receive.play().catch(() => { });
                    // Browser Notify
                    if (document.hidden && Notification.permission === "granted") {
                        new Notification(msg.senderName, { body: msg.text, icon: '/icon.png' });
                    }
                }
            }
        });

        isInitialLoad = false;
        scrollToBottom();
    });
}

function renderMessage(id, msg, isBulk) {
    const isMe = msg.senderId === state.currentUser.uid;
    const div = document.createElement('div');
    div.className = `flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'}`;

    div.innerHTML = `
        <div class="message-bubble ${isMe ? 'msg-mine' : 'msg-theirs'} max-w-[80%] flex flex-col relative group">
            ${!isMe ? `<span class="text-[10px] font-bold opacity-75 mb-1 text-indigo-500">${msg.senderName}</span>` : ''}
            <span class="text-[0.93rem] leading-relaxed break-words">${msg.text}</span>
            <span class="text-[9px] opacity-60 self-end mt-1 flex items-center gap-1 select-none">
                ${formatTime(msg.timestamp)} 
                ${isMe ? '<i class="fas fa-check-double text-indigo-200"></i>' : ''}
            </span>
        </div>
    `;
    elements.messagesContainer.appendChild(div);
}

// --- Typing System ---
function handleTyping() {
    if (!state.currentGroup) return;

    if (!state.typingTimeout) {
        // Set typing status
        setDoc(doc(db, 'tawasol_groups', state.currentGroup.id, 'typing', state.currentUser.uid), {
            name: state.currentUser.displayName,
            timestamp: serverTimestamp()
        });
    }

    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
        // Remove typing status
        deleteDoc(doc(db, 'tawasol_groups', state.currentGroup.id, 'typing', state.currentUser.uid));
        state.typingTimeout = null;
    }, 2000);
}

function listenTyping(groupId) {
    if (state.unsubscribeTyping) state.unsubscribeTyping();
    const typingRef = collection(db, 'tawasol_groups', groupId, 'typing');

    state.unsubscribeTyping = onSnapshot(typingRef, (snap) => {
        const names = [];
        snap.forEach(doc => {
            if (doc.id !== state.currentUser.uid) {
                names.push(doc.data().name);
            }
        });

        if (names.length > 0) {
            const txt = names.length === 1 ? `${names[0]} يكتب...` : `${names.length} يكتبون...`;
            elements.typingIndicator.textContent = txt;
            elements.typingIndicator.style.opacity = '1';
        } else {
            elements.typingIndicator.style.opacity = '0';
        }
    });
}

// --- Actions ---
async function sendMessage(e) {
    e.preventDefault();
    const text = elements.messageInput.value.trim();
    if (!text || !state.currentGroup) return;

    elements.messageInput.value = '';

    try {
        await addDoc(collection(db, 'tawasol_groups', state.currentGroup.id, 'messages'), {
            text: text,
            senderId: state.currentUser.uid,
            senderName: state.currentUser.displayName || 'مستخدم',
            timestamp: serverTimestamp(),
            type: 'text'
        });

        // Update Group metadata (Last Message)
        updateDoc(doc(db, 'tawasol_groups', state.currentGroup.id), {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: state.currentUser.displayName || 'مستخدم'
        });

        sounds.send.play().catch(() => { });

    } catch (err) {
        console.error("Send failed", err);
        Swal.fire({ toast: true, icon: 'error', title: 'فشل الإرسال' });
    }
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// --- Helpers ---
function formatTime(ts) {
    if (!ts) return '...';
    return ts.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(ts) {
    if (!ts) return '';
    const date = ts.toDate();
    const now = new Date();
    const diff = (now - date) / 1000; // seconds

    if (diff < 60) return 'الآن';
    if (diff < 3600) return `${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
    return date.toLocaleDateString('ar-EG');
}

function initPresenceSystem() {
    // Simple online status update
    const userStatusRef = doc(db, 'status', state.currentUser.uid);
    const setOnline = () => {
        setDoc(userStatusRef, {
            state: 'online',
            last_changed: serverTimestamp(),
            name: state.currentUser.displayName
        }, { merge: true });
    };

    setOnline();
    setInterval(setOnline, 60000);
}

async function loadSettings() {
    const s = await getDoc(doc(db, 'settings', 'chat_config'));
    if (s.exists()) {
        const data = s.data();
        if (data.broadcastMessage) {
            elements.broadcastBanner.textContent = data.broadcastMessage;
            elements.broadcastBanner.classList.remove('hidden');
        }
        state.isMaintenance = data.maintenanceMode || false;

        if (state.isMaintenance && !isAdmin(state.currentUser)) {
            elements.messageInput.placeholder = "المحادثة مغلقة للصيانة";
            elements.messageInput.disabled = true;
            document.querySelector('#message-form button[type="submit"]').disabled = true;
        }
    }
}

// Start
init();
