// ========== ИМПОРТЫ ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    addDoc, 
    deleteDoc,
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    limit,
    arrayUnion,
    arrayRemove,
    increment
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ========== FIREBASE КОНФИГУРАЦИЯ ==========
const firebaseConfig = {
    apiKey: "AIzaSyBRNl0xA5ie8EGcZ4UIdP0e1IJuacoMarE",
    authDomain: "gocklain-bf553.firebaseapp.com",
    projectId: "gocklain-bf553",
    storageBucket: "gocklain-bf553.firebasestorage.app",
    messagingSenderId: "747181228665",
    appId: "1:747181228665:web:bd9dd2cd60b1cd5bb8caa8"
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
let app, auth, db;
let authError = false;
let currentUser = null;
let currentChat = null;
let allUsers = new Map();
let unsubscribeMessages = null;
let unsubscribeChats = null;
let groupMembers = new Map();
let userNicknames = new Map();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;
let videoMediaRecorder = null;
let videoChunks = [];
let isVideoRecording = false;
let videoRecordingStartTime = null;
let videoRecordingTimer = null;
let currentCamera = 'user';
let videoStream = null;
let currentReplyTo = null;
let selectedAvatar = null;
let selectedAvatarColor = null;
let onlineStatusInterval = null;

// OneSignal переменные
let oneSignalInitialized = false;
let pushEnabled = false;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Firebase готов");
} catch (error) {
    console.error("❌ Ошибка Firebase:", error);
    authError = true;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showLoading(show) {
    document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function getRandomColor() {
    const colors = ['#FF6B35', '#FF8E53', '#FFB347', '#FF7043', '#FF9E6D'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function formatTime(date) {
    if (!date) return '';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function getUserDisplayName(user) {
    if (!user) return 'Неизвестный';
    const nickname = userNicknames.get(user.id);
    return nickname || user.name || 'Неизвестный';
}

// ========== ФУНКЦИИ ОНЛАЙН-СТАТУСА ==========
function isUserOnline(lastActive) {
    if (!lastActive) return false;
    try {
        const lastActiveDate = lastActive?.toDate ? lastActive.toDate() : new Date(lastActive);
        if (isNaN(lastActiveDate.getTime())) return false;
        const diffSeconds = Math.floor((Date.now() - lastActiveDate) / 1000);
        return diffSeconds < 30;
    } catch {
        return false;
    }
}

async function updateUserOnlineStatus() {
    if (!currentUser || authError) return;
    try {
        await updateDoc(doc(db, 'users', currentUser.id), {
            lastActive: serverTimestamp()
        });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
    }
}

// ========== ФУНКЦИИ ONESIGNAL ==========
async function initOneSignal() {
    if (oneSignalInitialized) return true;
    
    // Ждем инициализации OneSignal
    for (let i = 0; i < 10; i++) {
        if (window.oneSignal) {
            oneSignalInitialized = true;
            console.log('✅ OneSignal готов');
            
            // Проверяем статус подписки
            try {
                const subscription = await window.oneSignal.User.PushSubscription;
                if (subscription && subscription.id) {
                    pushEnabled = true;
                    updatePushUI();
                    
                    // Сохраняем ID подписки в Firestore
                    if (currentUser && !authError) {
                        await updateDoc(doc(db, 'users', currentUser.id), {
                            onesignalId: subscription.id,
                            pushEnabled: true
                        });
                    }
                }
            } catch (e) {
                console.log('Ошибка проверки подписки:', e);
            }
            
            return true;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    console.log('❌ OneSignal не загрузился');
    return false;
}

async function enablePushNotifications() {
    if (!window.oneSignal) {
        showNotification('OneSignal не загружен', 'error');
        return false;
    }
    
    try {
        showLoading(true);
        
        // Запрашиваем разрешение
        await window.oneSignal.Notifications.requestPermission();
        
        // Получаем подписку
        const subscription = await window.oneSignal.User.PushSubscription;
        
        if (subscription && subscription.id) {
            pushEnabled = true;
            updatePushUI();
            
            // Сохраняем в локальное хранилище
            localStorage.setItem('absgram_push_enabled', 'true');
            
            // Сохраняем в Firestore
            if (currentUser && !authError) {
                await updateDoc(doc(db, 'users', currentUser.id), {
                    onesignalId: subscription.id,
                    pushEnabled: true,
                    pushOptedIn: true
                });
            }
            
            // Отправляем тестовое уведомление через OneSignal API
            await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic YOUR_REST_API_KEY' // Замените на ваш REST API ключ
                },
                body: JSON.stringify({
                    app_id: "33e5e9c7-33ae-457c-b759-9fcd28e77db4",
                    include_subscription_ids: [subscription.id],
                    headings: { en: "✅ Уведомления включены" },
                    contents: { en: "Теперь вы будете получать уведомления" },
                    web_url: window.location.origin,
                    web_buttons: [
                        { id: "open", text: "Открыть", url: window.location.origin }
                    ]
                })
            }).catch(e => console.log('Ошибка отправки теста:', e));
            
            showNotification('✅ Уведомления включены', 'success');
        } else {
            showNotification('❌ Не удалось подписаться', 'error');
        }
        
    } catch (error) {
        console.error('Ошибка включения уведомлений:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function testPushNotification() {
    if (!pushEnabled || !window.oneSignal) {
        showNotification('Сначала включите уведомления', 'warning');
        return;
    }
    
    try {
        const subscription = await window.oneSignal.User.PushSubscription;
        if (!subscription || !subscription.id) {
            showNotification('Нет активной подписки', 'error');
            return;
        }
        
        // Отправляем тестовое уведомление
        await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic YOUR_REST_API_KEY' // Замените на ваш REST API ключ
            },
            body: JSON.stringify({
                app_id: "33e5e9c7-33ae-457c-b759-9fcd28e77db4",
                include_subscription_ids: [subscription.id],
                headings: { en: "📨 Тестовое уведомление" },
                contents: { en: "Push-уведомления работают!" },
                web_url: window.location.origin,
                web_buttons: [
                    { id: "open", text: "Открыть чат", url: window.location.origin }
                ]
            })
        });
        
        showNotification('✅ Тест отправлен', 'success');
        
    } catch (error) {
        console.error('Ошибка теста:', error);
        showNotification('Ошибка отправки теста', 'error');
    }
}

function updatePushUI() {
    const pushStatus = document.getElementById('pushStatus');
    const pushBtn = document.getElementById('pushStatusBtn');
    
    if (pushEnabled) {
        if (pushStatus) pushStatus.innerHTML = '✅ Активны';
        if (pushBtn) pushBtn.style.background = '#4CAF50';
    } else {
        if (pushStatus) pushStatus.innerHTML = '❌ Не активны';
        if (pushBtn) pushBtn.style.background = '#2a2a2a';
    }
}

// ========== ФУНКЦИИ АВТОРИЗАЦИИ ==========
function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;

    try {
        if (authError) {
            // Локальный режим
            const users = JSON.parse(localStorage.getItem('absgram_users') || '[]');
            const user = users.find(u => u.username === username && u.password === password);
            if (!user) throw new Error('Неверный логин или пароль');
            
            currentUser = user;
            localStorage.setItem('absgram_current_user', JSON.stringify(user));
            showScreen('chatsScreen');
            await loadChats();
            initOneSignal();
        } else {
            const usersQuery = query(collection(db, 'users'), where('username', '==', username));
            const snapshot = await getDocs(usersQuery);
            if (snapshot.empty) throw new Error('Пользователь не найден');
            
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            
            await signInWithEmailAndPassword(auth, userData.email, password);
        }
    } catch (error) {
        showNotification(error.message, 'error');
        btn.innerHTML = 'Войти';
        btn.disabled = false;
    }
}

async function register() {
    const name = document.getElementById('registerName').value.trim();
    const username = document.getElementById('registerUsername').value.trim().toLowerCase();
    const password = document.getElementById('registerPassword').value;
    
    if (!name || !username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Пароль минимум 6 символов', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;

    try {
        if (authError) {
            // Локальный режим
            const users = JSON.parse(localStorage.getItem('absgram_users') || '[]');
            if (users.some(u => u.username === username)) {
                throw new Error('Никнейм уже занят');
            }
            
            const newUser = {
                id: 'user_' + Date.now(),
                name: name,
                username: username,
                password: password,
                avatarColor: getRandomColor(),
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            localStorage.setItem('absgram_users', JSON.stringify(users));
            localStorage.setItem('absgram_current_user', JSON.stringify(newUser));
            
            currentUser = newUser;
            showScreen('chatsScreen');
            await loadChats();
            initOneSignal();
        } else {
            const email = `${username}@absgram.com`;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                name: name,
                username: username,
                email: email,
                avatarColor: getRandomColor(),
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp()
            });
        }
    } catch (error) {
        showNotification(error.message, 'error');
        btn.innerHTML = 'Зарегистрироваться';
        btn.disabled = false;
    }
}

// ========== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ==========
onAuthStateChanged(auth, async (user) => {
    if (user && !authError) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUser = {
                id: user.uid,
                ...userDoc.data()
            };
            showScreen('chatsScreen');
            await loadChats();
            updateProfile();
            startOnlineStatusUpdater();
            initOneSignal();
            
            // Загружаем статус push из Firestore
            if (userDoc.data().pushEnabled) {
                pushEnabled = true;
                updatePushUI();
            }
        }
    } else if (!authError) {
        // Проверяем локальное хранилище
        const localUser = localStorage.getItem('absgram_current_user');
        if (localUser) {
            currentUser = JSON.parse(localUser);
            showScreen('chatsScreen');
            await loadChats();
            updateProfile();
            
            // Загружаем статус push из localStorage
            pushEnabled = localStorage.getItem('absgram_push_enabled') === 'true';
            updatePushUI();
            initOneSignal();
        } else {
            showScreen('authScreen');
        }
    }
});

// ========== ФУНКЦИИ ПРОФИЛЯ ==========
function updateProfile() {
    if (!currentUser) return;
    
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileUsername').textContent = '@' + currentUser.username;
    document.getElementById('profileUsernameValue').textContent = '@' + currentUser.username;
    document.getElementById('profileId').textContent = currentUser.id.substring(0, 8) + '...';
    
    const avatar = document.getElementById('profileAvatar');
    if (currentUser.avatar) {
        avatar.style.backgroundImage = `url('${currentUser.avatar}')`;
        avatar.style.backgroundSize = 'cover';
        avatar.textContent = '';
    } else {
        avatar.style.backgroundImage = '';
        avatar.textContent = currentUser.name.charAt(0).toUpperCase();
        avatar.style.backgroundColor = currentUser.avatarColor || getRandomColor();
    }
}

function showAvatarModal() {
    selectedAvatar = currentUser.avatar;
    selectedAvatarColor = currentUser.avatarColor;
    
    const preview = document.getElementById('avatarPreview');
    if (selectedAvatar) {
        preview.style.backgroundImage = `url('${selectedAvatar}')`;
        preview.textContent = '';
    } else {
        preview.style.backgroundImage = '';
        preview.textContent = currentUser.name.charAt(0).toUpperCase();
        preview.style.backgroundColor = selectedAvatarColor || getRandomColor();
    }
    
    document.getElementById('avatarModal').classList.remove('hidden');
}

function closeAvatarModal() {
    document.getElementById('avatarModal').classList.add('hidden');
    document.getElementById('avatarUpload').value = '';
}

document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
    document.getElementById('avatarUpload').click();
});

document.getElementById('avatarUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        selectedAvatar = event.target.result;
        selectedAvatarColor = null;
        document.getElementById('avatarPreview').style.backgroundImage = `url('${selectedAvatar}')`;
        document.getElementById('avatarPreview').textContent = '';
    };
    reader.readAsDataURL(file);
});

document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', function() {
        selectedAvatar = null;
        selectedAvatarColor = this.dataset.color;
        document.getElementById('avatarPreview').style.backgroundImage = '';
        document.getElementById('avatarPreview').textContent = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('avatarPreview').style.backgroundColor = this.dataset.color;
    });
});

async function saveAvatar() {
    if (!selectedAvatar && !selectedAvatarColor) return;
    
    showLoading(true);
    try {
        if (!authError) {
            await updateDoc(doc(db, 'users', currentUser.id), {
                avatar: selectedAvatar || null,
                avatarColor: selectedAvatarColor || null
            });
        }
        
        currentUser.avatar = selectedAvatar;
        currentUser.avatarColor = selectedAvatarColor;
        
        if (authError) {
            localStorage.setItem('absgram_current_user', JSON.stringify(currentUser));
        }
        
        updateProfile();
        closeAvatarModal();
    } catch (error) {
        showNotification('Ошибка сохранения', 'error');
    } finally {
        showLoading(false);
    }
}

// ========== ЗАГРУЗКА ЧАТОВ ==========
async function loadChats() {
    if (!currentUser) return;
    
    if (authError) {
        // Локальный режим
        const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]')
            .filter(chat => chat.participants?.includes(currentUser.id));
        
        renderChats(chats);
        return;
    }
    
    const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUser.id)
    );
    
    unsubscribeChats = onSnapshot(q, async (snapshot) => {
        const chats = [];
        for (const doc of snapshot.docs) {
            const chat = { id: doc.id, ...doc.data() };
            if (!chat.isGroup && !chat.isChannel) {
                const otherUserId = chat.participants.find(id => id !== currentUser.id);
                if (otherUserId) {
                    const userDoc = await getDoc(doc(db, 'users', otherUserId));
                    if (userDoc.exists()) {
                        chat.otherUser = { id: otherUserId, ...userDoc.data() };
                    }
                }
            }
            chats.push(chat);
        }
        renderChats(chats);
    });
}

function renderChats(chats) {
    const container = document.getElementById('chatsList');
    if (!container) return;
    
    if (!chats.length) {
        container.innerHTML = '<div class="empty-state">Нет чатов</div>';
        return;
    }
    
    container.innerHTML = chats.map(chat => {
        const displayName = chat.isGroup ? chat.groupName : 
                           chat.isChannel ? chat.channelName : 
                           getUserDisplayName(chat.otherUser);
        
        const lastMsg = chat.lastMessage || '';
        const time = chat.updatedAt ? formatTime(chat.updatedAt) : '';
        
        return `
            <div class="chat-item" onclick="window.openChat('${chat.id}')">
                <div class="chat-avatar">${chat.isGroup ? '👥' : chat.isChannel ? '📢' : '👤'}</div>
                <div class="chat-info">
                    <div class="chat-name">${displayName}</div>
                    <div class="chat-last">${lastMsg}</div>
                    <div class="chat-time">${time}</div>
                </div>
            </div>
        `;
    }).join('');
}

window.openChat = async (chatId) => {
    if (authError) {
        const chat = JSON.parse(localStorage.getItem('absgram_chats') || '[]')
            .find(c => c.id === chatId);
        if (chat) openChat(chat);
        return;
    }
    
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (chatDoc.exists()) {
        openChat({ id: chatDoc.id, ...chatDoc.data() });
    }
};

async function openChat(chat) {
    if (!currentUser) return;
    
    currentChat = chat;
    
    if (!chat.isGroup && !chat.isChannel && chat.otherUser) {
        document.getElementById('chatTitle').textContent = getUserDisplayName(chat.otherUser);
        const isOnline = isUserOnline(chat.otherUser.lastActive);
        document.getElementById('chatStatus').innerHTML = isOnline ? '🟢 online' : '⚫ offline';
    } else if (chat.isGroup) {
        document.getElementById('chatTitle').textContent = chat.groupName + ' 👥';
        document.getElementById('chatStatus').innerHTML = chat.participants?.length + ' участников';
    } else {
        document.getElementById('chatTitle').textContent = chat.channelName + ' 📢';
        document.getElementById('chatStatus').innerHTML = chat.subscriberCount + ' подписчиков';
    }
    
    showScreen('chatScreen');
    loadMessages(chat.id);
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages(chatId) {
    if (unsubscribeMessages) unsubscribeMessages();
    
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<div class="empty-state"><div class="loading"></div></div>';
    
    if (authError) {
        const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]')
            .filter(m => m.chatId === chatId)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        container.innerHTML = '';
        messages.forEach(msg => addMessageToChat(msg));
        return;
    }
    
    const q = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId),
        orderBy('createdAt', 'asc')
    );
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        snapshot.forEach(doc => {
            addMessageToChat({ id: doc.id, ...doc.data() });
        });
        container.scrollTop = container.scrollHeight;
    });
}

function addMessageToChat(message) {
    const container = document.getElementById('messagesContainer');
    const isOwn = message.senderId === currentUser.id;
    
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'message-out' : 'message-in'}`;
    
    const time = message.createdAt ? formatTime(message.createdAt) : '';
    
    let content = '';
    
    // Обработка разных типов сообщений
    if (message.type === 'text') {
        content = `<div>${message.text}</div>`;
    } else if (message.type === 'image') {
        content = `
            <div>${message.text || 'Изображение'}</div>
            <div class="image-message" onclick="previewImage('${message.fileData}')">
                <img src="${message.fileData}" style="max-height: 200px;">
            </div>
        `;
    } else if (message.type === 'video') {
        content = `
            <div>${message.text || 'Видео'}</div>
            <div class="video-message" onclick="previewVideo('${message.fileData}')">
                <video src="${message.fileData}" style="max-height: 200px; width: 100%;" controls></video>
            </div>
            <button class="file-download-btn" onclick="downloadVideo('${message.fileData}', '${message.fileName}')">
                ⬇️ Скачать
            </button>
        `;
    } else if (message.type === 'voice') {
        content = `
            <div>Голосовое</div>
            <div class="voice-message" onclick="playVoice('${message.voiceData}')">
                <div class="voice-icon">🎤</div>
                <div class="voice-duration">${message.duration || 0}s</div>
                <div class="voice-wave"></div>
            </div>
        `;
    } else {
        content = `<div>${message.text || 'Сообщение'}</div>`;
    }
    
    // Добавляем reply если есть
    if (message.replyTo) {
        const replyDiv = document.createElement('div');
        replyDiv.className = 'reply-preview';
        replyDiv.innerHTML = `
            <div class="reply-sender">${message.replyTo.senderName}</div>
            <div class="reply-text">${message.replyTo.text || '...'}</div>
        `;
        div.appendChild(replyDiv);
    }
    
    div.innerHTML += `
        ${content}
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(div);
}

// ========== ОТПРАВКА СООБЩЕНИЙ ==========
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !currentChat || !currentUser) return;
    
    const btn = document.getElementById('sendMessageBtn');
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;
    
    try {
        const messageData = {
            chatId: currentChat.id,
            senderId: currentUser.id,
            text: text,
            type: 'text',
            createdAt: authError ? new Date().toISOString() : serverTimestamp(),
            read: false,
            replyTo: currentReplyTo ? {
                id: currentReplyTo.id,
                text: currentReplyTo.text,
                senderName: currentReplyTo.senderName
            } : null
        };
        
        if (authError) {
            const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
            messages.push({ id: 'msg_' + Date.now(), ...messageData });
            localStorage.setItem('absgram_messages', JSON.stringify(messages));
            
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const chatIndex = chats.findIndex(c => c.id === currentChat.id);
            if (chatIndex !== -1) {
                chats[chatIndex].lastMessage = text;
                chats[chatIndex].updatedAt = new Date().toISOString();
                localStorage.setItem('absgram_chats', JSON.stringify(chats));
            }
            
            addMessageToChat({ ...messageData, id: 'msg_' + Date.now() });
        } else {
            await addDoc(collection(db, 'messages'), messageData);
            await updateDoc(doc(db, 'chats', currentChat.id), {
                lastMessage: text,
                updatedAt: serverTimestamp()
            });
            
            // Отправляем push-уведомление через OneSignal
            if (pushEnabled && !currentChat.isGroup && currentChat.otherUser) {
                const userDoc = await getDoc(doc(db, 'users', currentChat.otherUser.id));
                if (userDoc.exists() && userDoc.data().onesignalId) {
                    await fetch('https://onesignal.com/api/v1/notifications', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Basic YOUR_REST_API_KEY'
                        },
                        body: JSON.stringify({
                            app_id: "33e5e9c7-33ae-457c-b759-9fcd28e77db4",
                            include_subscription_ids: [userDoc.data().onesignalId],
                            headings: { en: currentUser.name },
                            contents: { en: text },
                            web_url: window.location.origin
                        })
                    });
                }
            }
        }
        
        input.value = '';
        input.style.height = 'auto';
        cancelReply();
        
    } catch (error) {
        showNotification('Ошибка отправки', 'error');
    } finally {
        btn.innerHTML = '➤';
        btn.disabled = true;
    }
}

// ========== ВИДЕОСООБЩЕНИЯ ==========
async function startVideoRecording() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentCamera, width: 640, height: 480 },
            audio: true
        });
        
        document.getElementById('videoRecordingPreview').srcObject = videoStream;
        
        videoMediaRecorder = new MediaRecorder(videoStream);
        videoChunks = [];
        
        videoMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) videoChunks.push(e.data);
        };
        
        document.getElementById('videoRecordingModal').classList.remove('hidden');
        
    } catch (error) {
        showNotification('Ошибка доступа к камере', 'error');
    }
}

function startRecordingVideo() {
    if (!videoMediaRecorder) return;
    
    videoMediaRecorder.start(100);
    isVideoRecording = true;
    videoRecordingStartTime = Date.now();
    
    document.getElementById('recordStartBtn').style.display = 'none';
    document.getElementById('recordStopBtn').style.display = 'flex';
    document.getElementById('recordingIndicator').classList.remove('hidden');
    
    videoRecordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('videoRecordingTimer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (elapsed >= 60) stopRecordingVideo();
    }, 1000);
}

function stopRecordingVideo() {
    if (!videoMediaRecorder) return;
    
    videoMediaRecorder.stop();
    isVideoRecording = false;
    
    if (videoRecordingTimer) {
        clearInterval(videoRecordingTimer);
        videoRecordingTimer = null;
    }
    
    document.getElementById('recordStartBtn').style.display = 'flex';
    document.getElementById('recordStopBtn').style.display = 'none';
    document.getElementById('recordingIndicator').classList.add('hidden');
}

async function sendVideoMessage() {
    if (videoChunks.length === 0) {
        closeVideoRecordingModal();
        return;
    }
    
    showLoading(true);
    
    try {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const base64Video = e.target.result;
            const duration = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
            
            const messageData = {
                chatId: currentChat.id,
                senderId: currentUser.id,
                text: '📹 Видеосообщение',
                type: 'video',
                fileData: base64Video,
                fileName: `video_${Date.now()}.webm`,
                fileType: 'video/webm',
                fileSize: videoBlob.size,
                duration: duration,
                createdAt: authError ? new Date().toISOString() : serverTimestamp(),
                replyTo: currentReplyTo ? {
                    id: currentReplyTo.id,
                    text: currentReplyTo.text,
                    senderName: currentReplyTo.senderName
                } : null
            };
            
            if (authError) {
                const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
                messages.push({ id: 'msg_' + Date.now(), ...messageData });
                localStorage.setItem('absgram_messages', JSON.stringify(messages));
                
                const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
                const chatIndex = chats.findIndex(c => c.id === currentChat.id);
                if (chatIndex !== -1) {
                    chats[chatIndex].lastMessage = '📹 Видео';
                    chats[chatIndex].updatedAt = new Date().toISOString();
                    localStorage.setItem('absgram_chats', JSON.stringify(chats));
                }
                
                addMessageToChat({ ...messageData, id: 'msg_' + Date.now() });
            } else {
                await addDoc(collection(db, 'messages'), messageData);
                await updateDoc(doc(db, 'chats', currentChat.id), {
                    lastMessage: '📹 Видео',
                    updatedAt: serverTimestamp()
                });
            }
            
            closeVideoRecordingModal();
        };
        
        reader.readAsDataURL(videoBlob);
        
    } catch (error) {
        showNotification('Ошибка отправки видео', 'error');
        closeVideoRecordingModal();
    } finally {
        showLoading(false);
    }
}

function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        startVideoRecording();
    }
}

function closeVideoRecordingModal() {
    document.getElementById('videoRecordingModal').classList.add('hidden');
    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
    }
    if (videoRecordingTimer) {
        clearInterval(videoRecordingTimer);
        videoRecordingTimer = null;
    }
    document.getElementById('videoRecordingTimer').textContent = '00:00';
}

// ========== ПРЕДПРОСМОТР ВИДЕО ==========
function previewVideo(videoData) {
    const video = document.getElementById('previewedVideo');
    video.src = videoData;
    document.getElementById('videoPreviewModal').classList.remove('hidden');
    video.play().catch(e => console.log('Автовоспроизведение заблокировано'));
}

function previewImage(imageData) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <div class="image-preview-content">
            <img src="${imageData}" style="max-width: 90vw; max-height: 90vh;">
            <button class="image-preview-close">×</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.image-preview-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function downloadVideo(videoData, fileName) {
    const a = document.createElement('a');
    a.href = videoData;
    a.download = fileName || 'video.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotification('Скачивание началось');
}

function playVoice(audioData) {
    document.getElementById('audioPlayer').src = audioData;
    document.getElementById('audioPlayer').play();
}

// ========== ГОЛОСОВЫЕ СООБЩЕНИЯ ==========
function startVoiceRecording() {
    if (isRecording) return;
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                sendVoiceMessage(audioBlob);
                stream.getTracks().forEach(t => t.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            recordingStartTime = Date.now();
            
            document.getElementById('voiceBtn').classList.add('recording');
            document.getElementById('recordingTime').style.display = 'block';
            
            recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('recordingTime').textContent = 
                    `${minutes}:${seconds.toString().padStart(2, '0')}`;
                if (elapsed >= 120) stopVoiceRecording();
            }, 1000);
        })
        .catch(() => showNotification('Нет доступа к микрофону', 'error'));
}

function stopVoiceRecording() {
    if (!mediaRecorder) return;
    
    mediaRecorder.stop();
    isRecording = false;
    
    clearInterval(recordingTimer);
    document.getElementById('voiceBtn').classList.remove('recording');
    document.getElementById('recordingTime').style.display = 'none';
}

async function sendVoiceMessage(audioBlob) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Audio = e.target.result;
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        
        const messageData = {
            chatId: currentChat.id,
            senderId: currentUser.id,
            text: '🎤 Голосовое',
            type: 'voice',
            voiceData: base64Audio,
            duration: duration,
            createdAt: authError ? new Date().toISOString() : serverTimestamp(),
            replyTo: currentReplyTo
        };
        
        if (authError) {
            const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
            messages.push({ id: 'msg_' + Date.now(), ...messageData });
            localStorage.setItem('absgram_messages', JSON.stringify(messages));
            
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const chatIndex = chats.findIndex(c => c.id === currentChat.id);
            if (chatIndex !== -1) {
                chats[chatIndex].lastMessage = '🎤 Голосовое';
                chats[chatIndex].updatedAt = new Date().toISOString();
                localStorage.setItem('absgram_chats', JSON.stringify(chats));
            }
            
            addMessageToChat({ ...messageData, id: 'msg_' + Date.now() });
        } else {
            await addDoc(collection(db, 'messages'), messageData);
            await updateDoc(doc(db, 'chats', currentChat.id), {
                lastMessage: '🎤 Голосовое',
                updatedAt: serverTimestamp()
            });
        }
    };
    reader.readAsDataURL(audioBlob);
}

// ========== ОТВЕТЫ ==========
function setReply(messageId, text, senderName) {
    currentReplyTo = { id: messageId, text, senderName };
    document.getElementById('replyToText').textContent = `${senderName}: ${text.substring(0, 30)}...`;
    document.getElementById('replyingIndicator').classList.remove('hidden');
}

function cancelReply() {
    currentReplyTo = null;
    document.getElementById('replyingIndicator').classList.add('hidden');
}

// ========== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ==========
document.getElementById('singleSearchInput').addEventListener('input', async (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
        document.getElementById('singleSearchResults').innerHTML = '';
        return;
    }
    
    if (authError) {
        const users = JSON.parse(localStorage.getItem('absgram_users') || '[]')
            .filter(u => u.id !== currentUser.id && 
                   (u.name.toLowerCase().includes(query) || u.username.includes(query)));
        
        document.getElementById('singleSearchResults').innerHTML = users.map(u => `
            <div class="user-item" onclick="createChatWithUser('${u.id}')">
                <div class="user-avatar">${u.name.charAt(0)}</div>
                <div class="user-info">
                    <div class="user-name">${u.name}</div>
                    <div class="user-username">@${u.username}</div>
                </div>
            </div>
        `).join('');
        return;
    }
    
    const q = query(
        collection(db, 'users'),
        where('searchName', '>=', query),
        where('searchName', '<=', query + '\uf8ff'),
        limit(10)
    );
    
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        if (doc.id !== currentUser.id) {
            results.push({ id: doc.id, ...doc.data() });
        }
    });
    
    document.getElementById('singleSearchResults').innerHTML = results.map(u => `
        <div class="user-item" onclick="createChatWithUser('${u.id}')">
            <div class="user-avatar">${u.name.charAt(0)}</div>
            <div class="user-info">
                <div class="user-name">${u.name}</div>
                <div class="user-username">@${u.username}</div>
            </div>
        </div>
    `).join('');
});

window.createChatWithUser = async (userId) => {
    let user;
    
    if (authError) {
        user = JSON.parse(localStorage.getItem('absgram_users') || '[]').find(u => u.id === userId);
        if (!user) return;
        
        const chatId = 'chat_' + Date.now();
        const chat = {
            id: chatId,
            participants: [currentUser.id, userId],
            isGroup: false,
            otherUser: user,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
        chats.push(chat);
        localStorage.setItem('absgram_chats', JSON.stringify(chats));
        
        openChat(chat);
        document.getElementById('newChatModal').classList.add('hidden');
        return;
    }
    
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return;
    user = { id: userId, ...userDoc.data() };
    
    // Ищем существующий чат
    const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUser.id)
    );
    const snapshot = await getDocs(q);
    let existingChat = null;
    
    snapshot.forEach(doc => {
        const chat = doc.data();
        if (!chat.isGroup && chat.participants.includes(userId)) {
            existingChat = { id: doc.id, ...chat };
        }
    });
    
    if (existingChat) {
        openChat({ ...existingChat, otherUser: user });
    } else {
        const chatRef = await addDoc(collection(db, 'chats'), {
            participants: [currentUser.id, userId],
            isGroup: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        openChat({ id: chatRef.id, participants: [currentUser.id, userId], otherUser: user });
    }
    
    document.getElementById('newChatModal').classList.add('hidden');
};

// ========== СОЗДАНИЕ ГРУППЫ ==========
document.getElementById('groupSearchInput').addEventListener('input', async (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
        document.getElementById('groupSearchResults').innerHTML = '';
        return;
    }
    
    if (authError) {
        const users = JSON.parse(localStorage.getItem('absgram_users') || '[]')
            .filter(u => u.id !== currentUser.id && !groupMembers.has(u.id) &&
                   (u.name.toLowerCase().includes(query) || u.username.includes(query)));
        
        document.getElementById('groupSearchResults').innerHTML = users.map(u => `
            <div class="user-item" onclick="addToGroup('${u.id}')">
                <div class="user-avatar">${u.name.charAt(0)}</div>
                <div class="user-info">
                    <div class="user-name">${u.name}</div>
                    <div class="user-username">@${u.username}</div>
                </div>
            </div>
        `).join('');
        return;
    }
    
    const q = query(
        collection(db, 'users'),
        where('searchName', '>=', query),
        where('searchName', '<=', query + '\uf8ff'),
        limit(10)
    );
    
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        if (doc.id !== currentUser.id && !groupMembers.has(doc.id)) {
            results.push({ id: doc.id, ...doc.data() });
        }
    });
    
    document.getElementById('groupSearchResults').innerHTML = results.map(u => `
        <div class="user-item" onclick="addToGroup('${u.id}')">
            <div class="user-avatar">${u.name.charAt(0)}</div>
            <div class="user-info">
                <div class="user-name">${u.name}</div>
                <div class="user-username">@${u.username}</div>
            </div>
        </div>
    `).join('');
});

window.addToGroup = (userId) => {
    if (authError) {
        const user = JSON.parse(localStorage.getItem('absgram_users') || '[]').find(u => u.id === userId);
        if (user) {
            groupMembers.set(userId, user);
            updateGroupMembersList();
        }
        return;
    }
    
    getDoc(doc(db, 'users', userId)).then(doc => {
        if (doc.exists()) {
            groupMembers.set(userId, { id: userId, ...doc.data() });
            updateGroupMembersList();
        }
    });
};

window.removeFromGroup = (userId) => {
    groupMembers.delete(userId);
    updateGroupMembersList();
};

function updateGroupMembersList() {
    const container = document.getElementById('groupMembersList');
    container.innerHTML = Array.from(groupMembers.values()).map(user => `
        <div class="member-tag">
            ${user.name}
            <span class="remove" onclick="removeFromGroup('${user.id}')">×</span>
        </div>
    `).join('');
    
    document.getElementById('memberCount').textContent = groupMembers.size;
    document.getElementById('createGroupBtn').disabled = groupMembers.size < 2;
}

async function createGroup() {
    const name = document.getElementById('groupName').value.trim();
    if (!name || groupMembers.size < 2) return;
    
    showLoading(true);
    
    const participants = [currentUser.id, ...Array.from(groupMembers.keys())];
    
    if (authError) {
        const groupId = 'group_' + Date.now();
        const group = {
            id: groupId,
            participants,
            isGroup: true,
            groupName: name,
            groupAdmin: currentUser.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: 'Группа создана'
        };
        
        const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
        chats.push(group);
        localStorage.setItem('absgram_chats', JSON.stringify(chats));
        
        closeGroupModal();
        loadChats();
        showLoading(false);
        return;
    }
    
    await addDoc(collection(db, 'chats'), {
        participants,
        isGroup: true,
        groupName: name,
        groupAdmin: currentUser.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: 'Группа создана'
    });
    
    closeGroupModal();
    loadChats();
    showLoading(false);
}

function closeGroupModal() {
    document.getElementById('newChatModal').classList.add('hidden');
    groupMembers.clear();
    document.getElementById('groupName').value = '';
    document.getElementById('groupSearchInput').value = '';
    document.getElementById('groupSearchResults').innerHTML = '';
    document.getElementById('singleSearchInput').value = '';
    document.getElementById('singleSearchResults').innerHTML = '';
}

// ========== НАВИГАЦИЯ ==========
document.getElementById('profileBtn').addEventListener('click', () => {
    updateProfile();
    showScreen('profileScreen');
});

document.getElementById('backToChatsBtn').addEventListener('click', () => {
    if (unsubscribeMessages) unsubscribeMessages();
    showScreen('chatsScreen');
});

document.getElementById('backToChatsBtn2').addEventListener('click', () => {
    showScreen('chatsScreen');
});

document.getElementById('newChatBtn').addEventListener('click', () => {
    document.getElementById('newChatModal').classList.remove('hidden');
});

document.getElementById('cancelGroupBtn').addEventListener('click', closeGroupModal);

document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(this.dataset.tab + 'Tab').classList.add('active');
    });
});

document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);

document.getElementById('messageInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    document.getElementById('sendMessageBtn').disabled = !this.value.trim();
});

document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById('attachBtn').addEventListener('click', () => {
    document.getElementById('fileUpload').click();
});

document.getElementById('fileUpload').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const messageData = {
                    chatId: currentChat.id,
                    senderId: currentUser.id,
                    text: '🖼️ Изображение',
                    type: 'image',
                    fileData: event.target.result,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    createdAt: authError ? new Date().toISOString() : serverTimestamp(),
                    replyTo: currentReplyTo
                };
                
                if (authError) {
                    const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
                    messages.push({ id: 'msg_' + Date.now(), ...messageData });
                    localStorage.setItem('absgram_messages', JSON.stringify(messages));
                    
                    const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
                    const chatIndex = chats.findIndex(c => c.id === currentChat.id);
                    if (chatIndex !== -1) {
                        chats[chatIndex].lastMessage = '🖼️ Изображение';
                        chats[chatIndex].updatedAt = new Date().toISOString();
                        localStorage.setItem('absgram_chats', JSON.stringify(chats));
                    }
                    
                    addMessageToChat({ ...messageData, id: 'msg_' + Date.now() });
                } else {
                    await addDoc(collection(db, 'messages'), messageData);
                    await updateDoc(doc(db, 'chats', currentChat.id), {
                        lastMessage: '🖼️ Изображение',
                        updatedAt: serverTimestamp()
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    }
    e.target.value = '';
});

document.getElementById('voiceBtn').addEventListener('mousedown', startVoiceRecording);
document.getElementById('voiceBtn').addEventListener('mouseup', stopVoiceRecording);
document.getElementById('voiceBtn').addEventListener('mouseleave', stopVoiceRecording);

document.getElementById('videoMessageBtn').addEventListener('click', startVideoRecording);
document.getElementById('recordStartBtn').addEventListener('click', startRecordingVideo);
document.getElementById('recordStopBtn').addEventListener('click', stopRecordingVideo);
document.getElementById('cameraSwitchBtn').addEventListener('click', switchCamera);
document.getElementById('cancelVideoRecordingBtn').addEventListener('click', closeVideoRecordingModal);
document.getElementById('sendVideoMessageBtn').addEventListener('click', sendVideoMessage);

document.getElementById('closeVideoPreviewBtn').addEventListener('click', () => {
    document.getElementById('videoPreviewModal').classList.add('hidden');
    document.getElementById('previewedVideo').pause();
});

document.getElementById('showAvatarModalBtn').addEventListener('click', showAvatarModal);
document.getElementById('cancelAvatarBtn').addEventListener('click', closeAvatarModal);
document.getElementById('saveAvatarBtn').addEventListener('click', saveAvatar);

document.getElementById('editNameBtn').addEventListener('click', async () => {
    const newName = prompt('Новое имя:', currentUser.name);
    if (!newName || newName === currentUser.name) return;
    
    showLoading(true);
    try {
        if (!authError) {
            await updateDoc(doc(db, 'users', currentUser.id), { name: newName });
        }
        currentUser.name = newName;
        if (authError) {
            localStorage.setItem('absgram_current_user', JSON.stringify(currentUser));
        }
        updateProfile();
        showNotification('Имя изменено', 'success');
    } catch (error) {
        showNotification('Ошибка', 'error');
    } finally {
        showLoading(false);
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Выйти?')) return;
    
    if (!authError) {
        await setUserOffline();
        await signOut(auth);
    }
    
    localStorage.removeItem('absgram_current_user');
    localStorage.removeItem('absgram_push_enabled');
    currentUser = null;
    pushEnabled = false;
    updatePushUI();
    showScreen('authScreen');
});

// Push-уведомления
document.getElementById('enablePushBtn').addEventListener('click', enablePushNotifications);
document.getElementById('testPushBtn').addEventListener('click', testPushNotification);
document.getElementById('pushStatusBtn').addEventListener('click', enablePushNotifications);

// Закрытие модалок по клику вне
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
});

// ========== ЗАПУСК ==========
console.log('✅ Приложение готово');