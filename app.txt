 
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
    increment,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ========== FIREBASE КОНФИГУРАЦИЯ ==========
const firebaseConfig = {
    apiKey: "AIzaSyBRNl0xA5ie8EGcZ4UIdP0e1IJuacoMarE",
    authDomain: "gocklain-bf553.firebaseapp.com",
    projectId: "gocklain-bf553",
    storageBucket: "gocklain-bf553.firebasestorage.app",
    messagingSenderId: "747181228665",
    appId: "1:747181228665:web:bd9dd2cd60b1cd5bb8caa8",
    measurementId: "G-1LBP6KFPL9"
};

// ========== ИНИЦИАЛИЗАЦИЯ FIREBASE ==========
let app, auth, db;
let authError = false;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Firebase инициализирован");
} catch (error) {
    console.error("❌ Ошибка инициализации Firebase:", error);
    authError = true;
    showNotification("Ошибка подключения к серверу. Работаем в локальном режиме.", "warning");
}

// ========== ПЕРЕМЕННЫЕ СОСТОЯНИЯ ==========
let currentUser = null;
let currentChat = null;
let selectedAvatar = null;
let selectedAvatarColor = null;
let unsubscribeChats = null;
let unsubscribeMessages = null;
let allUsers = new Map();
let searchTimeout = null;
let allUsersCache = new Map();
let groupMembers = new Map();
let isSendingMessage = false;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;
let activeCall = null;
let callTimer = null;
let callStartTime = null;
let notificationPermissionAsked = false;
let userNicknames = new Map();
let viewedUserProfile = null;
let contextMenuTarget = null;
let notificationCheckInterval = null;
let onlineStatusInterval = null;
let selectedCallType = 'audio';
let unreadCounts = new Map();
let currentMessageSearch = { index: 0, results: [] };
let onlineStatusCheckInterval = null;
let userStatusListeners = new Map();

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let isMuted = false;
let isSpeakerOn = false;
let isVideoOn = true;
let currentCallId = null;
let isCallDisabled = false;
let speakingIndicatorInterval = null;
let callListeners = new Map();
let typingTimeouts = new Map();
let incomingCallData = null;

let videoMediaRecorder = null;
let videoChunks = [];
let isVideoRecording = false;
let videoRecordingStartTime = null;
let videoRecordingTimer = null;
let currentCamera = 'user';
let videoStream = null;
let maxVideoDuration = 60;
let maxVideoSize = 50 * 1024 * 1024;
let currentFileUploads = new Map();
let currentChunkedUploads = new Map();

let messageReactions = new Map();
let currentlyEditingMessage = null;
let channels = new Map();
let userSubscriptions = new Set();
let typingListeners = new Map();
let callRingingListeners = new Map();
let currentReplyTo = null;
let posts = new Map();
let currentChannelEditId = null;

let groupAvatarFile = null;
let channelAvatarFile = null;
let tempGroupAvatar = null;
let tempChannelAvatar = null;
let currentReactionMessageId = null;

// ========== ФУНКЦИИ ДЛЯ ОПРЕДЕЛЕНИЯ ОНЛАЙН-СТАТУСА ==========

/**
 * Проверяет, находится ли пользователь онлайн на основе времени последней активности
 * @param {any} lastActive - время последней активности (Timestamp или Date или строка)
 * @returns {boolean} - true если пользователь онлайн
 */ 
function isUserOnline(lastActive) {
    if (!lastActive) return false;
    
    try {
        // Преобразуем в Date объект
        const lastActiveDate = lastActive?.toDate ? lastActive.toDate() : new Date(lastActive);
        
        // Проверяем валидность даты
        if (isNaN(lastActiveDate.getTime())) return false;
        
        const now = new Date();
        const diffSeconds = Math.floor((now - lastActiveDate) / 1000);
        
        // Пользователь считается онлайн, если последняя активность была менее 30 секунд назад
        return diffSeconds < 30;
    } catch (error) {
        console.error('Ошибка определения онлайн-статуса:', error);
        return false;
    }
}

/**
 * Форматирует время последнего посещения в человекочитаемый вид
 * @param {any} date - дата последней активности
 * @returns {string} - отформатированная строка
 */
function formatLastSeen(date) {
    if (!date) return 'никогда';
    
    try {
        const lastActive = date?.toDate ? date.toDate() : new Date(date);
        
        // Проверяем валидность даты
        if (isNaN(lastActive.getTime())) return 'неизвестно';
        
        const now = new Date();
        const diffSeconds = Math.floor((now - lastActive) / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) {
            return 'только что';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} ${getMinutesWord(diffMinutes)} назад`;
        } else if (diffHours < 24) {
            return `${diffHours} ${getHoursWord(diffHours)} назад`;
        } else if (diffDays < 7) {
            return `${diffDays} ${getDaysWord(diffDays)} назад`;
        } else {
            return lastActive.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch (error) {
        console.error('Ошибка форматирования даты:', error);
        return 'неизвестно';
    }
}

function getMinutesWord(minutes) {
    if (minutes % 10 === 1 && minutes % 100 !== 11) return 'минуту';
    if ([2, 3, 4].includes(minutes % 10) && ![12, 13, 14].includes(minutes % 100)) return 'минуты';
    return 'минут';
}

function getHoursWord(hours) {
    if (hours % 10 === 1 && hours % 100 !== 11) return 'час';
    if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100)) return 'часа';
    return 'часов';
}

function getDaysWord(days) {
    if (days % 10 === 1 && days % 100 !== 11) return 'день';
    if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return 'дня';
    return 'дней';
}

// ========== ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ОНЛАЙН-СТАТУСА ==========

/**
 * Обновляет статус онлайн текущего пользователя в Firestore
 */
async function updateUserOnlineStatus() {
    if (!currentUser || authError) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
            isOnline: true,
            lastActive: serverTimestamp()
        });
        console.log('✅ Статус онлайн обновлен');
    } catch (error) {
        console.error('❌ Ошибка обновления статуса онлайн:', error);
    }
}

/**
 * Устанавливает статус офлайн при выходе
 */
async function setUserOffline() {
    if (!currentUser || authError) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
            isOnline: false,
            lastActive: serverTimestamp()
        });
        console.log('✅ Статус офлайн установлен');
    } catch (error) {
        console.error('❌ Ошибка установки статуса офлайн:', error);
    }
}

/**
 * Запускает периодическое обновление статуса онлайн
 */
function startOnlineStatusUpdater() {
    if (onlineStatusInterval) {
        clearInterval(onlineStatusInterval);
    }
    
    // Сразу обновляем статус
    updateUserOnlineStatus();
    
    // Обновляем каждые 20 секунд
    onlineStatusInterval = setInterval(updateUserOnlineStatus, 20000);
    
    // При закрытии страницы устанавливаем офлайн
    window.addEventListener('beforeunload', () => {
        setUserOffline();
    });
    
    // При размонтировании компонента
    window.addEventListener('unload', () => {
        setUserOffline();
    });
}

/**
 * Останавливает обновление статуса онлайн
 */
function stopOnlineStatusUpdater() {
    if (onlineStatusInterval) {
        clearInterval(onlineStatusInterval);
        onlineStatusInterval = null;
    }
}

/**
 * Подписывается на изменения статуса пользователя
 * @param {string} userId - ID пользователя
 * @param {Function} callback - функция обратного вызова
 */
function subscribeToUserStatus(userId, callback) {
    if (!userId || authError) return;
    
    // Отписываемся от предыдущей подписки
    if (userStatusListeners.has(userId)) {
        userStatusListeners.get(userId)();
        userStatusListeners.delete(userId);
    }
    
    try {
        const userRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                const isOnline = isUserOnline(userData.lastActive);
                callback(isOnline, userData.lastActive);
            }
        }, (error) => {
            console.error('❌ Ошибка подписки на статус пользователя:', error);
        });
        
        userStatusListeners.set(userId, unsubscribe);
        return unsubscribe;
    } catch (error) {
        console.error('❌ Ошибка подписки на статус пользователя:', error);
    }
}

// ========== ФУНКЦИИ УВЕДОМЛЕНИЙ ==========
function showNotification(message, type = 'info', isPersistent = false) {
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    if (!isPersistent) {
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

function showPushNotification(title, message) {
    if (!("Notification" in window)) {
        showNotification(message, 'info');
        return;
    }

    if (Notification.permission === "granted") {
        const pushNotification = document.createElement('div');
        pushNotification.className = 'push-notification';
        pushNotification.innerHTML = `
            <div class="push-notification-icon">🔔</div>
            <div class="push-notification-content">
                <div class="push-notification-title">${title}</div>
                <div class="push-notification-message">${message}</div>
            </div>
            <button class="push-notification-close">×</button>
        `;
        document.body.appendChild(pushNotification);
        
        pushNotification.querySelector('.push-notification-close').onclick = () => {
            pushNotification.remove();
        };
        
        setTimeout(() => {
            if (pushNotification.parentNode) {
                pushNotification.style.animation = 'slideInRight 0.3s ease reverse';
                setTimeout(() => pushNotification.remove(), 300);
            }
        }, 5000);
    } else {
        showNotification(`${title}: ${message}`, 'info');
    }
}

function showDownloadNotification(fileName) {
    const notification = document.createElement('div');
    notification.className = 'download-notification';
    notification.innerHTML = `
        <div class="download-notification-icon">✅</div>
        <div class="download-notification-text">Файл "${fileName}" сохранен</div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideInLeft 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('hidden', !show);
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
    }
}

function getRandomColor() {
    const colors = ['#FF6B35', '#FF8E53', '#FF9E6D', '#FFB347', '#FFCC99', '#FF7043'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function formatDate(date) {
    if (!date) return 'Не указана';
    try {
        const d = date?.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return 'Не указана';
        return d.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return 'Не указана';
    }
}

function formatTime(date) {
    if (!date) return '';
    try {
        const d = date?.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎬';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) return '📦';
    if (fileType.includes('doc') || fileType.includes('txt') || fileType.includes('text')) return '📝';
    if (fileType.includes('audio') || fileType.includes('music') || fileType.includes('sound')) return '🎵';
    return '📎';
}

function getUserDisplayName(user) {
    if (!user) return 'Неизвестный';
    const nickname = userNicknames.get(user.id);
    if (nickname) return nickname;
    return user.name || 'Неизвестный';
}

function saveUserNickname(userId, nickname) {
    if (!currentUser) return;
    
    try {
        const key = `absgram_nickname_${currentUser.id}_${userId}`;
        if (nickname) {
            localStorage.setItem(key, nickname);
            userNicknames.set(userId, nickname);
        } else {
            localStorage.removeItem(key);
            userNicknames.delete(userId);
        }
    } catch (error) {
        console.error('Ошибка сохранения никнейма:', error);
    }
}

function loadAllNicknames() {
    if (!currentUser) return;
    
    try {
        userNicknames.clear();
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`absgram_nickname_${currentUser.id}_`)) {
                const userId = key.replace(`absgram_nickname_${currentUser.id}_`, '');
                const nickname = localStorage.getItem(key);
                userNicknames.set(userId, nickname);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки никнеймов:', error);
    }
}

// ========== ФУНКЦИИ ДЛЯ PUSH-УВЕДОМЛЕНИЙ ==========
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push-уведомления не поддерживаются');
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: './'
        });
        console.log('✅ Service Worker зарегистрирован:', registration);

        if (!('Notification' in window)) {
            console.log('Notification API не поддерживается');
            return false;
        }

        if (Notification.permission === 'granted') {
            await subscribeToPush(registration);
            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Ошибка регистрации Service Worker:', error);
        return false;
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notification API не поддерживается');
        return false;
    }

    if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        await subscribeToPush(registration);
        return true;
    }

    if (Notification.permission === 'default' && !notificationPermissionAsked) {
        const permissionEl = document.getElementById('notificationPermission');
        if (permissionEl) {
            permissionEl.classList.remove('hidden');
        }
        notificationPermissionAsked = true;
    }

    return false;
}

async function subscribeToPush(registration) {
    try {
        const vapidPublicKey = 'BMUueTFOICuaMJDVdTnKuSp1Xdeg6DcgxdId52_qeF8kQWOuSO7_Lpmw5m_dZwKCotltQqkZ7nhyhBbtsnCPqQk';
        
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        console.log('✅ Подписка на push получена:', subscription);

        if (currentUser && !authError) {
            await savePushSubscriptionToFirestore(subscription);
        }

        return subscription;
    } catch (error) {
        console.error('❌ Ошибка подписки на push:', error);
        return null;
    }
}

async function savePushSubscriptionToFirestore(subscription) {
    try {
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
            pushSubscription: subscription.toJSON(),
            pushEnabled: true,
            pushUpdatedAt: serverTimestamp()
        });
        console.log('✅ Push-подписка сохранена в Firestore');
    } catch (error) {
        console.error('❌ Ошибка сохранения push-подписки:', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
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
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;

    try {
        if (authError) {
            // Локальный режим
            const localUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]');
            const user = localUsers.find(u => u.username === username);
            
            if (user && user.password === password) {
                currentUser = user;
                localStorage.setItem('absgram_user_local', JSON.stringify(user));
                showScreen('chatsScreen');
                await loadChats();
                loadAllNicknames();
                registerServiceWorker();
            } else {
                throw new Error('Неверный логин или пароль');
            }
        } else {
            console.log("🔑 Пробуем войти:", username);
            
            const usersQuery = query(collection(db, 'users'), where('username', '==', username));
            const querySnapshot = await getDocs(usersQuery);
            
            if (querySnapshot.empty) {
                throw new Error('Пользователь не найден');
            }
            
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const userEmail = userData.email;
            
            await signInWithEmailAndPassword(auth, userEmail, password);
            console.log("✅ Вход выполнен");
            
            localStorage.setItem('absgram_user', JSON.stringify({
                username: username,
                timestamp: Date.now()
            }));
            
            registerServiceWorker();
        }
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        let message = 'Ошибка входа';
        if (error.message.includes('не найден') || error.message.includes('Неверный')) {
            message = 'Неверный логин или пароль';
        }
        showNotification(message, 'error');
        btn.innerHTML = originalText;
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
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
        showNotification('Никнейм может содержать только латинские буквы, цифры и нижнее подчеркивание', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;

    try {
        if (authError) {
            // Локальный режим
            const localUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]');
            
            if (localUsers.some(u => u.username === username)) {
                throw new Error('Этот никнейм уже занят');
            }
            
            const newUser = {
                id: 'user_' + Date.now(),
                name: name,
                username: username,
                password: password,
                avatarColor: getRandomColor(),
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            };
            
            localUsers.push(newUser);
            localStorage.setItem('absgram_all_users', JSON.stringify(localUsers));
            
            currentUser = newUser;
            localStorage.setItem('absgram_user_local', JSON.stringify(newUser));
            
            showScreen('chatsScreen');
            
            await loadChats();
            loadAllNicknames();
            loadCallsDisabledState();
            registerServiceWorker();
            
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            return;
        }
        
        console.log("🚀 Начинаем регистрацию пользователя:", username);
        
        const usersQuery = query(collection(db, 'users'), where('username', '==', username));
        const querySnapshot = await getDocs(usersQuery);
        
        if (!querySnapshot.empty) {
            throw new Error('Этот никнейм уже занят');
        }
        
        const email = `${username}@absgram.com`;
        
        console.log("🔐 Создаем пользователя в Firebase Auth...");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("✅ Пользователь создан в Auth:", user.uid);
        
        console.log("💾 Создаем документ в Firestore...");
        const userData = {
            name: name,
            username: username,
            email: email,
            avatar: null,
            avatarColor: getRandomColor(),
            isOnline: true,
            lastActive: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            searchName: name.toLowerCase(),
            searchUsername: username.toLowerCase(),
            pushEnabled: false
        };
        
        await setDoc(doc(db, 'users', user.uid), userData);
        
        console.log("✅ Документ пользователя создан в Firestore");
        
        registerServiceWorker();
        
        btn.innerHTML = originalText;
        btn.disabled = false;
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        
        let message = 'Ошибка регистрации';
        
        if (error.message.includes('уже занят')) {
            message = 'Этот никнейм уже занят';
        } else if (error.code === 'auth/weak-password') {
            message = 'Пароль слишком слабый. Используйте не менее 6 символов.';
        } else if (error.code === 'auth/email-already-in-use') {
            message = 'Этот email уже используется';
        } else if (error.code === 'permission-denied') {
            message = 'Ошибка доступа к Firestore. Работаем в локальном режиме.';
            authError = true;
            await register();
            return;
        } else {
            message = `Ошибка: ${error.message}`;
        }
        
        showNotification(message, 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function loadUserData(userId) {
    try {
        console.log("📥 Загружаем данные пользователя из Firestore:", userId);
        
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUser = {
                id: userId,
                ...userData
            };
            
            // Проверяем онлайн-статус
            const isOnline = isUserOnline(userData.lastActive);
            
            console.log("✅ Данные пользователя загружены:", currentUser);
            console.log(`📊 Статус пользователя: ${isOnline ? '🟢 онлайн' : '⚫ офлайн'}`);
            
            updateProfile();
            
            // Запускаем обновление статуса онлайн
            startOnlineStatusUpdater();
        } else {
            console.error("❌ Документ пользователя не найден в Firestore!");
            showNotification('Ошибка загрузки данных пользователя', 'error');
            await signOut(auth);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки данных пользователя:', error);
        showNotification('Ошибка загрузки данных пользователя', 'error');
    }
}

function updateProfile() {
    if (!currentUser) return;
    
    console.log("👤 Обновляем профиль:", currentUser.name);
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileUsername').textContent = '@' + currentUser.username;
    document.getElementById('profileUsernameValue').textContent = '@' + currentUser.username;
    document.getElementById('profileId').textContent = currentUser.id.substring(0, 8) + '...';
    document.getElementById('profileDate').textContent = formatDate(currentUser.createdAt);
    
    const avatar = document.getElementById('profileAvatar');
    if (currentUser.avatar) {
        avatar.style.backgroundImage = `url('${currentUser.avatar}')`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        avatar.textContent = '';
        avatar.style.backgroundColor = '';
    } else {
        avatar.style.backgroundImage = '';
        avatar.textContent = currentUser.name.charAt(0).toUpperCase();
        avatar.style.backgroundColor = currentUser.avatarColor || getRandomColor();
    }

    const userPosts = posts.get(currentUser.id) || [];
    const postsContainer = document.getElementById('profilePostsList');
    if (postsContainer) {
        if (userPosts.length > 0) {
            postsContainer.innerHTML = userPosts.map(p => `
                <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 8px; width: 100%;">
                    <div style="color: var(--primary);">${p.text}</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">${formatTime(p.createdAt)}</div>
                </div>
            `).join('');
        } else {
            postsContainer.innerHTML = '<div style="color: var(--text-secondary); text-align: center; width: 100%;">У вас пока нет постов</div>';
        }
    }
    
    loadUserChatsCount();
}

async function loadUserChatsCount() {
    if (!currentUser) return;
    
    try {
        const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', currentUser.id)
        );
        const chatsSnapshot = await getDocs(chatsQuery);
        document.getElementById('profileChatsCount').textContent = chatsSnapshot.size;
    } catch (error) {
        console.error('❌ Ошибка загрузки количества чатов:', error);
        document.getElementById('profileChatsCount').textContent = '0';
    }
}

async function editName() {
    const newName = prompt('Введите новое имя:', currentUser.name);
    if (!newName || newName.trim() === '' || newName === currentUser.name) return;
    
    const name = newName.trim();
    
    showLoading(true);
    try {
        if (!authError) {
            await updateDoc(doc(db, 'users', currentUser.id), {
                name: name,
                searchName: name.toLowerCase(),
                updatedAt: serverTimestamp()
            });
        }
        
        currentUser.name = name;
        currentUser.searchName = name.toLowerCase();
        
        if (authError) {
            localStorage.setItem('absgram_user_local', JSON.stringify(currentUser));
            
            const allUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]');
            const userIndex = allUsers.findIndex(u => u.id === currentUser.id);
            if (userIndex !== -1) {
                allUsers[userIndex].name = name;
                localStorage.setItem('absgram_all_users', JSON.stringify(allUsers));
            }
        }
        
        updateProfile();
        loadChats();
        
        showNotification('Имя успешно изменено', 'success');
        
    } catch (error) {
        console.error('Ошибка изменения имени:', error);
        showNotification('Ошибка изменения имени', 'error');
    } finally {
        showLoading(false);
    }
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        // Устанавливаем статус офлайн
        setUserOffline().then(() => {
            // Останавливаем обновление статуса
            stopOnlineStatusUpdater();
            
            // Отписываемся от всех слушателей
            if (unsubscribeChats) unsubscribeChats();
            if (unsubscribeMessages) unsubscribeMessages();
            if (callListeners.size > 0) {
                callListeners.forEach(unsubscribe => unsubscribe());
                callListeners.clear();
            }
            if (typingListeners.size > 0) {
                typingListeners.forEach(unsubscribe => unsubscribe());
                typingListeners.clear();
            }
            if (callRingingListeners.size > 0) {
                callRingingListeners.forEach(unsubscribe => unsubscribe());
                callRingingListeners.clear();
            }
            if (userStatusListeners.size > 0) {
                userStatusListeners.forEach(unsubscribe => unsubscribe());
                userStatusListeners.clear();
            }
            
            signOut(auth).then(() => {
                currentUser = null;
                currentChat = null;
                allUsers.clear();
                allUsersCache.clear();
                userNicknames.clear();
                authError = false;
                localStorage.removeItem('absgram_user_local');
                localStorage.removeItem('absgram_user');
                showScreen('authScreen');
            }).catch(error => {
                console.error('Ошибка выхода:', error);
                showNotification('Ошибка выхода', 'error');
            });
        }).catch(error => {
            console.error('Ошибка установки статуса офлайн:', error);
        });
    }
}

function backToChats() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    if (typingListeners.has('current')) {
        clearTimeout(typingListeners.get('current'));
        typingListeners.delete('current');
    }
    
    document.getElementById('messageInput').value = '';
    document.getElementById('messageInput').style.height = 'auto';
    document.getElementById('sendMessageBtn').disabled = true;
    showScreen('chatsScreen');
    
    updateUnreadCounts();
}

function showProfile() {
    updateProfile();
    showScreen('profileScreen');
}

// ========== ФУНКЦИИ ДЛЯ ЧАТОВ ==========
function showNewChatModal() {
    groupMembers.clear();
    updateGroupMembersList();
    
    tempGroupAvatar = null;
    tempChannelAvatar = null;
    document.getElementById('groupAvatarPreview').style.backgroundImage = '';
    document.getElementById('groupAvatarPreview').textContent = '';
    document.getElementById('channelAvatarPreview').style.backgroundImage = '';
    document.getElementById('channelAvatarPreview').textContent = '';
    
    document.getElementById('newChatModal').classList.remove('hidden');
    switchTab('single');
    
    document.getElementById('singleSearchInput').focus();
}

function closeGroupModal() {
    document.getElementById('newChatModal').classList.add('hidden');
    document.getElementById('groupName').value = '';
    document.getElementById('channelName').value = '';
    document.getElementById('channelDescription').value = '';
    document.getElementById('groupSearchInput').value = '';
    document.getElementById('singleSearchInput').value = '';
    groupMembers.clear();
    document.getElementById('singleSearchResults').innerHTML = '';
    document.getElementById('groupSearchResults').innerHTML = '';
}

function switchTab(tabType) {
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.modal-tab[data-tab="${tabType}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabType + 'Tab').classList.add('active');

    if (tabType === 'group') {
        groupMembers.clear();
        updateGroupMembersList();
    }
}

async function loadAllUsersForSearch() {
    if (!currentUser) return;
    
    try {
        console.log("📥 Загружаем всех пользователей для поиска...");
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        
        allUsersCache.clear();
        snapshot.forEach(doc => {
            if (doc.id !== currentUser.id) {
                const userData = doc.data();
                const isOnline = isUserOnline(userData.lastActive);
                
                allUsersCache.set(doc.id, {
                    id: doc.id,
                    ...userData,
                    isOnline: isOnline
                });
                
                allUsers.set(doc.id, {
                    id: doc.id,
                    ...userData,
                    isOnline: isOnline
                });
            }
        });
        
        console.log("✅ Загружено пользователей для поиска:", allUsersCache.size);
    } catch (error) {
        console.error('❌ Ошибка загрузки всех пользователей:', error);
    }
}

async function createChatWithUser(user) {
    if (!currentUser) return;
    
    showLoading(true);
    try {
        if (authError) {
            // Локальный режим
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const existingChat = chats.find(chat => 
                !chat.isGroup && !chat.isChannel &&
                chat.participants && 
                chat.participants.includes(user.id) && 
                chat.participants.includes(currentUser.id)
            );
            
            if (existingChat) {
                openChat({
                    ...existingChat,
                    otherUser: user
                });
                showScreen('chatScreen');
            } else {
                const chatId = 'chat_' + Date.now();
                const chat = {
                    id: chatId,
                    participants: [currentUser.id, user.id],
                    isGroup: false,
                    isChannel: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastMessage: '',
                    unreadCount: 0,
                    otherUser: user
                };
                
                chats.push(chat);
                localStorage.setItem('absgram_chats', JSON.stringify(chats));
                
                openChat(chat);
                
                showScreen('chatScreen');
            }
            
            closeGroupModal();
            showLoading(false);
            return;
        }
        
        const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', currentUser.id)
        );
        
        const existingChats = await getDocs(chatsQuery);
        let existingChatId = null;
        
        existingChats.forEach(doc => {
            const chat = doc.data();
            if (chat.participants && chat.participants.includes(user.id) && !chat.isGroup && !chat.isChannel) {
                existingChatId = doc.id;
            }
        });
        
        if (existingChatId) {
            const chatDoc = await getDoc(doc(db, 'chats', existingChatId));
            openChat({
                id: existingChatId,
                ...chatDoc.data(),
                otherUser: user
            });
            showScreen('chatScreen');
        } else {
            const chatData = {
                participants: [currentUser.id, user.id],
                isGroup: false,
                isChannel: false,
                groupName: null,
                groupAdmin: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: '',
                unreadCount: 0
            };
            
            const chatRef = await addDoc(collection(db, 'chats'), chatData);
            
            openChat({
                id: chatRef.id,
                ...chatData,
                otherUser: user
            });
            
            showScreen('chatScreen');
        }
        
        closeGroupModal();
        
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        showNotification('Ошибка создания чата', 'error');
    } finally {
        showLoading(false);
    }
}

function showAvatarModal() {
    selectedAvatar = currentUser.avatar;
    selectedAvatarColor = currentUser.avatarColor;
    
    const preview = document.getElementById('avatarPreview');
    if (selectedAvatar) {
        preview.style.backgroundImage = `url('${selectedAvatar}')`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
        preview.textContent = '';
        preview.style.backgroundColor = '';
    } else {
        preview.style.backgroundImage = '';
        preview.textContent = currentUser.name.charAt(0).toUpperCase();
        preview.style.backgroundColor = selectedAvatarColor || getRandomColor();
    }
    
    document.getElementById('avatarModal').classList.remove('hidden');
}

function closeAvatarModal() {
    document.getElementById('avatarModal').classList.add('hidden');
    selectedAvatar = null;
    selectedAvatarColor = null;
    document.getElementById('avatarUpload').value = '';
}

function selectAvatar(color) {
    selectedAvatar = null;
    selectedAvatarColor = color;
    
    const preview = document.getElementById('avatarPreview');
    preview.style.backgroundImage = '';
    preview.textContent = currentUser.name.charAt(0).toUpperCase();
    preview.style.backgroundColor = color;
    
    document.querySelectorAll('.avatar-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    event.target.classList.add('selected');
}

function handleAvatarUpload(file) {
    if (!file) return;
    
    if (!file.type.match('image/(jpeg|jpg|png|gif|webp)')) {
        showNotification('Разрешены только изображения', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showNotification('Файл должен быть меньше 10MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        selectedAvatar = event.target.result;
        selectedAvatarColor = null;
        
        const preview = document.getElementById('avatarPreview');
        preview.style.backgroundImage = `url('${selectedAvatar}')`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
        preview.textContent = '';
        preview.style.backgroundColor = '';
    };
    reader.readAsDataURL(file);
}

async function saveAvatar() {
    if (!selectedAvatar && !selectedAvatarColor) {
        showNotification('Ничего не выбрано', 'error');
        return;
    }

    showLoading(true);
    try {
        if (!authError) {
            await updateDoc(doc(db, 'users', currentUser.id), {
                avatar: selectedAvatar || null,
                avatarColor: selectedAvatarColor || null,
                updatedAt: serverTimestamp()
            });
        }
        
        currentUser.avatar = selectedAvatar;
        currentUser.avatarColor = selectedAvatarColor;
        
        if (authError) {
            localStorage.setItem('absgram_user_local', JSON.stringify(currentUser));
        }
        
        updateProfile();
        closeAvatarModal();
    } catch (error) {
        console.error('Ошибка сохранения аватарки:', error);
        showNotification('Ошибка сохранения аватарки', 'error');
    } finally {
        showLoading(false);
    }
}

function addToGroup(user) {
    if (!groupMembers.has(user.id)) {
        groupMembers.set(user.id, user);
        updateGroupMembersList();
    }
}

function removeFromGroup(userId) {
    groupMembers.delete(userId);
    updateGroupMembersList();
}
window.removeFromGroup = removeFromGroup;

function updateGroupMembersList() {
    const container = document.getElementById('groupMembersList');
    const memberCount = document.getElementById('memberCount');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (groupMembers.size === 0) {
        container.innerHTML = `
            <div style="color: var(--text-secondary); text-align: center; padding: 15px;">
                Добавьте участников из списка выше
            </div>
        `;
        if (memberCount) memberCount.textContent = '0';
        return;
    }
    
    groupMembers.forEach(user => {
        const tag = document.createElement('div');
        tag.className = 'member-tag';
        tag.innerHTML = `
            ${getUserDisplayName(user)}
            <span class="remove" onclick="removeFromGroup('${user.id}')">×</span>
        `;
        container.appendChild(tag);
    });
    
    if (memberCount) memberCount.textContent = groupMembers.size;
    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) {
        createGroupBtn.disabled = groupMembers.size < 2;
    }
}

async function createGroup() {
    const groupName = document.getElementById('groupName').value.trim();
    
    if (!groupName) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    if (groupMembers.size < 2) {
        showNotification('Добавьте хотя бы 2 участника', 'error');
        return;
    }
    
    showLoading(true);
    try {
        const participants = [currentUser.id, ...Array.from(groupMembers.keys())];
        
        let groupAvatar = null;
        if (tempGroupAvatar) {
            groupAvatar = tempGroupAvatar;
        } else if (groupAvatarFile) {
            groupAvatar = await readFileAsBase64(groupAvatarFile);
        }
        
        if (authError) {
            // Локальный режим
            const groupId = 'group_' + Date.now();
            const group = {
                id: groupId,
                participants: participants,
                isGroup: true,
                isChannel: false,
                groupName: groupName,
                groupAvatar: groupAvatar,
                groupAdmin: currentUser.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMessage: 'Группа создана',
                unreadCount: 0
            };
            
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            chats.push(group);
            localStorage.setItem('absgram_chats', JSON.stringify(chats));
            
            closeGroupModal();
            loadChats();
            showLoading(false);
            return;
        }
        
        const groupData = {
            participants: participants,
            isGroup: true,
            isChannel: false,
            groupName: groupName,
            groupAvatar: groupAvatar,
            groupAdmin: currentUser.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: 'Группа создана',
            unreadCount: 0
        };
        
        console.log("Создаем группу с данными:", groupData);
        
        const groupRef = await addDoc(collection(db, 'chats'), groupData);
        console.log("Группа создана с ID:", groupRef.id);
        
        closeGroupModal();
        loadChats();
        
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        showNotification('Ошибка создания группы: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function searchUsersAndChannels(searchQuery) {
    const container = document.getElementById('chatsList');
    
    if (!searchQuery.trim()) {
        loadChats();
        return;
    }
    
    console.log("🔍 Поиск пользователей и каналов:", searchQuery);
    const searchHint = document.querySelector('.search-hint');
    if (searchHint) searchHint.style.display = 'none';

    if (searchQuery.startsWith('https://') || searchQuery.startsWith('absgram://')) {
        const parts = searchQuery.split('/');
        const channelId = parts[parts.length - 1];
        if (channelId) {
            try {
                const chatRef = doc(db, 'chats', channelId);
                const chatSnap = await getDoc(chatRef);
                if (chatSnap.exists() && chatSnap.data().isChannel) {
                    const chatData = chatSnap.data();
                    const isSubscribed = chatData.participants && chatData.participants.includes(currentUser.id);
                    
                    if (!isSubscribed && chatData.channelType === 'private') {
                        await subscribeToChannel(channelId);
                    }
                    
                    openChat({ id: channelId, ...chatData });
                    return;
                }
            } catch (e) {
                console.log('Не удалось найти канал по ссылке');
            }
        }
    }
    
    if (authError) {
        // Локальный режим
        const localUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]');
        const users = localUsers.filter(user => {
            const query = searchQuery.toLowerCase();
            const userName = user.name ? user.name.toLowerCase() : '';
            const userUsername = user.username ? user.username.toLowerCase() : '';
            
            return userName.includes(query) || 
                   userUsername.includes(query);
        });
        
        renderSearchResults(users);
        return;
    }
    
    const users = Array.from(allUsersCache.values()).filter(user => {
        const query = searchQuery.toLowerCase();
        const userName = user.name ? user.name.toLowerCase() : '';
        const userUsername = user.username ? user.username.toLowerCase() : '';
        
        return userName.includes(query) || 
               userUsername.includes(query);
    });
    
    try {
        const channelsQuery = query(
            collection(db, 'chats'),
            where('isChannel', '==', true),
            where('channelType', '==', 'public'),
            orderBy('channelName')
        );
        const channelsSnapshot = await getDocs(channelsQuery);
        channelsSnapshot.forEach(doc => {
            const channelData = doc.data();
            if (channelData.channelName && channelData.channelName.toLowerCase().includes(searchQuery.toLowerCase())) {
                users.push({
                    id: doc.id,
                    name: channelData.channelName,
                    username: channelData.channelName,
                    isChannel: true,
                    channelDesc: channelData.channelDesc,
                    avatar: channelData.channelAvatar,
                    avatarColor: getRandomColor(),
                    participantIds: channelData.participants || [channelData.channelOwner]
                });
            }
        });
    } catch (e) {
        console.warn('Ошибка поиска каналов:', e);
    }
    
    if (users.length > 0) {
        console.log("✅ Найдено:", users.length);
        renderSearchResults(users);
        return;
    } else {
        console.log("❌ Ничего не найдено");
        renderSearchResults([]);
    }
}

function renderSearchResults(users) {
    const container = document.getElementById('chatsList');
    
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">👤</div>
                <p>Пользователи или каналы не найдены</p>
                <p style="font-size: 13px; margin-top: 8px; color: var(--text-secondary);">
                    Попробуйте изменить запрос
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    users.sort((a, b) => {
        // Сортируем: сначала онлайн, потом по имени
        const aOnline = a.isOnline ? 1 : 0;
        const bOnline = b.isOnline ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return a.name.localeCompare(b.name);
    });
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        if (user.isChannel) {
            div.onclick = () => joinChannelById(user.id);
        } else {
            div.onclick = () => createChatWithUser(user);
        }
        
        const displayName = user.isChannel ? `📢 ${user.name}` : getUserDisplayName(user);
        
        let statusHTML = '';
        if (user.isChannel) {
            statusHTML = '<span class="user-status real-online">📢 Канал</span>';
        } else if (user.isOnline === true) {
            statusHTML = '<span class="user-status real-online">🟢 online</span>';
        } else if (user.lastActive) {
            const lastActive = user.lastActive?.toDate ? user.lastActive.toDate() : new Date(user.lastActive);
            statusHTML = `<span class="user-status real-offline">⚫ был(а) ${formatLastSeen(lastActive)}</span>`;
        } else {
            statusHTML = '<span class="user-status real-offline">⚫ не в сети</span>';
        }
        
        div.innerHTML = `
            <div class="user-avatar" style="background: ${user.isChannel ? getRandomColor() : user.avatarColor || getRandomColor()}; 
                 ${user.avatar ? `background-image: url('${user.avatar}'); background-size: cover; background-position: center;` : ''}">
                ${user.isChannel ? '📢' : (user.avatar ? '' : user.name.charAt(0).toUpperCase())}
            </div>
            <div class="user-info">
                <div class="user-name">${displayName}</div>
                <div class="user-username">${user.isChannel ? '' : '@' + user.username}</div>
                <div class="user-status">
                    ${statusHTML}
                </div>
            </div>
        `;
        
        container.appendChild(div);
    });
    
    const onlineCount = users.filter(u => u.isOnline === true).length;
    const stats = document.createElement('div');
    stats.className = 'search-hint';
    stats.innerHTML = `Найдено: ${users.length} элементов (${onlineCount} онлайн)`;
    container.appendChild(stats);
}

function searchUsersForChat(query, type) {
    if (!query.trim()) {
        if (type === 'single') {
            document.getElementById('singleSearchResults').innerHTML = '';
        } else {
            document.getElementById('groupSearchResults').innerHTML = '';
        }
        return;
    }
    
    if (authError) {
        // Локальный режим
        const localUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]')
            .filter(u => u.id !== currentUser.id);
        
        const filtered = localUsers.filter(user => {
            const queryLower = query.toLowerCase();
            return (user.name && user.name.toLowerCase().includes(queryLower)) || 
                   (user.username && user.username.toLowerCase().includes(queryLower));
        }).map(user => ({
            ...user,
            isOnline: false // В локальном режиме всегда офлайн
        }));
        
        if (type === 'single') {
            renderSingleChatResults(filtered);
        } else {
            renderGroupChatResults(filtered);
        }
        return;
    }
    
    const filtered = Array.from(allUsersCache.values()).filter(user => {
        const queryLower = query.toLowerCase();
        return (user.name && user.name.toLowerCase().includes(queryLower)) || 
               (user.username && user.username.toLowerCase().includes(queryLower));
    });
    
    if (type === 'single') {
        renderSingleChatResults(filtered);
    } else {
        renderGroupChatResults(filtered);
    }
}

function renderSingleChatResults(users) {
    const container = document.getElementById('singleSearchResults');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="height: 150px;">
                <div class="icon">👤</div>
                <p>Пользователи не найдены</p>
            </div>
        `;
        return;
    }
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => createChatWithUser(user);
        
        const displayName = getUserDisplayName(user);
        
        let statusHTML = '';
        if (user.isOnline === true) {
            statusHTML = '<span class="user-status real-online">🟢 online</span>';
        } else if (user.lastActive) {
            const lastActive = user.lastActive?.toDate ? user.lastActive.toDate() : new Date(user.lastActive);
            statusHTML = `<span class="user-status real-offline">⚫ был(а) ${formatLastSeen(lastActive)}</span>`;
        } else {
            statusHTML = '<span class="user-status real-offline">⚫ не в сети</span>';
        }
        
        div.innerHTML = `
            <div class="user-avatar" style="background: ${user.avatarColor || getRandomColor()}; 
                 ${user.avatar ? `background-image: url('${user.avatar}'); background-size: cover; background-position: center;` : ''}">
                ${user.avatar ? '' : user.name.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
                <div class="user-name">${displayName}</div>
                <div class="user-username">@${user.username}</div>
                <div class="user-status">
                    ${statusHTML}
                </div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

function renderGroupChatResults(users) {
    const container = document.getElementById('groupSearchResults');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="height: 120px;">
                <div class="icon">👤</div>
                <p>Пользователи не найдены</p>
            </div>
        `;
        return;
    }
    
    users.forEach(user => {
        if (groupMembers.has(user.id) || user.id === currentUser.id) return;
        
        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => addToGroup(user);
        
        const displayName = getUserDisplayName(user);
        
        let statusHTML = '';
        if (user.isOnline === true) {
            statusHTML = '<span class="user-status real-online">🟢 online</span>';
        } else if (user.lastActive) {
            const lastActive = user.lastActive?.toDate ? user.lastActive.toDate() : new Date(user.lastActive);
            statusHTML = `<span class="user-status real-offline">⚫ был(а) ${formatLastSeen(lastActive)}</span>`;
        } else {
            statusHTML = '<span class="user-status real-offline">⚫ не в сети</span>';
        }
        
        div.innerHTML = `
            <div class="user-avatar" style="background: ${user.avatarColor || getRandomColor()}; 
                 ${user.avatar ? `background-image: url('${user.avatar}'); background-size: cover; background-position: center;` : ''}">
                ${user.avatar ? '' : user.name.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
                <div class="user-name">${displayName}</div>
                <div class="user-username">@${user.username}</div>
                <div class="user-status">
                    ${statusHTML}
                </div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

function showGroupInfo() {
    if (!currentChat || !currentChat.isGroup) return;
    
    document.getElementById('groupInfoName').textContent = currentChat.groupName;
    document.getElementById('groupInfoMembers').textContent = currentChat.participants?.length + ' участников';
    
    const membersList = document.getElementById('groupInfoMembersList');
    membersList.innerHTML = '';
    
    loadGroupMembers().then(() => {
        document.getElementById('groupInfoModal').classList.remove('hidden');
    });
}

async function loadGroupMembers() {
    if (!currentChat || !currentChat.participants) return;
    
    const membersList = document.getElementById('groupInfoMembersList');
    if (!membersList) return;
    
    membersList.innerHTML = '';
    
    if (authError) {
        // Локальный режим
        currentChat.participants.forEach(userId => {
            if (userId === currentUser.id) {
                const memberItem = document.createElement('div');
                memberItem.className = 'group-member-item';
                memberItem.innerHTML = `
                    <div class="group-member-avatar" style="background: ${currentUser.avatarColor || getRandomColor()}; 
                         ${currentUser.avatar ? `background-image: url('${currentUser.avatar}'); background-size: cover; background-position: center;` : ''}">
                        ${currentUser.avatar ? '' : currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="group-member-name">
                        ${currentUser.name}
                        ${userId === currentChat.groupAdmin ? '<span class="admin-badge">👑</span>' : ''}
                    </div>
                `;
                membersList.appendChild(memberItem);
            } else {
                const memberItem = document.createElement('div');
                memberItem.className = 'group-member-item';
                memberItem.innerHTML = `
                    <div class="group-member-avatar" style="background: ${getRandomColor()}">
                        ?
                    </div>
                    <div class="group-member-name">
                        Неизвестный
                    </div>
                `;
                membersList.appendChild(memberItem);
            }
        });
        return;
    }
    
    for (const userId of currentChat.participants) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const user = userDoc.data();
                const isAdmin = userId === currentChat.groupAdmin;
                const isOnline = isUserOnline(user.lastActive);
                
                const memberItem = document.createElement('div');
                memberItem.className = 'group-member-item';
                memberItem.innerHTML = `
                    <div class="group-member-avatar" style="background: ${user.avatarColor || getRandomColor()}; 
                         ${user.avatar ? `background-image: url('${user.avatar}'); background-size: cover; background-position: center;` : ''}">
                        ${user.avatar ? '' : user.name.charAt(0).toUpperCase()}
                        ${isOnline ? '<div class="status-dot" style="position: absolute; bottom: 2px; right: 2px;"></div>' : ''}
                    </div>
                    <div class="group-member-name">
                        ${getUserDisplayName(user)}
                        ${isAdmin ? '<span class="admin-badge">👑</span>' : ''}
                    </div>
                `;
                
                membersList.appendChild(memberItem);
            }
        } catch (error) {
            console.error('Ошибка загрузки участника:', error);
        }
    }
}

function closeGroupInfoModal() {
    document.getElementById('groupInfoModal').classList.add('hidden');
}

function closeChannelInfoModal() {
    document.getElementById('channelInfoModal').classList.add('hidden');
}
window.closeChannelInfoModal = closeChannelInfoModal;

async function loadChats() {
    if (!currentUser) return;
    
    if (unsubscribeChats) unsubscribeChats();
    
    if (authError) {
        // Локальный режим
        const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
        const userChats = chats.filter(chat => 
            chat.participants && chat.participants.includes(currentUser.id)
        );
        
        userChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        const chatsWithInfo = userChats.map(chat => {
            if (!chat.isGroup && !chat.isChannel) {
                const otherUserId = chat.participants.find(id => id !== currentUser.id);
                const allUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]');
                const otherUser = allUsers.find(u => u.id === otherUserId);
                if (otherUser) {
                    chat.otherUser = {
                        ...otherUser,
                        isOnline: false // В локальном режиме всегда офлайн
                    };
                    chat.displayName = getUserDisplayName(otherUser);
                }
            }
            return chat;
        });
        
        renderChats(chatsWithInfo);
        return;
    }
    
    try {
        const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', currentUser.id)
        );
        
        unsubscribeChats = onSnapshot(chatsQuery, 
            async (snapshot) => {
                const chats = [];
                const chatPromises = [];
                
                snapshot.forEach(doc => {
                    const chat = {
                        id: doc.id,
                        ...doc.data()
                    };
                    chats.push(chat);
                    chatPromises.push(loadChatInfo(chat));
                });
                
                await Promise.all(chatPromises);
                chats.sort((a, b) => {
                    const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
                    const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
                    return dateB - dateA;
                });
                renderChats(chats);
            },
            (error) => {
                console.error('❌ Ошибка загрузки чатов:', error);
            }
        );
    } catch (error) {
        console.error('❌ Ошибка загрузки чатов:', error);
    }
}

async function loadChatInfo(chat) {
    if (chat.isGroup) {
        chat.displayName = chat.groupName;
        chat.isGroupChat = true;
        return;
    }
    
    if (chat.isChannel) {
        chat.displayName = chat.channelName;
        chat.isChannel = true;
        return;
    }
    
    if (!chat.participants || chat.participants.length !== 2) return;
    
    const otherUserId = chat.participants.find(id => id !== currentUser.id);
    if (!otherUserId) return;
    
    if (authError) {
        // Локальный режим
        const allUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]');
        const otherUser = allUsers.find(u => u.id === otherUserId);
        if (otherUser) {
            chat.otherUser = {
                ...otherUser,
                isOnline: false
            };
            chat.displayName = getUserDisplayName(otherUser);
        } else {
            chat.displayName = 'Неизвестный';
        }
        return;
    }
    
    if (allUsers.has(otherUserId)) {
        chat.otherUser = allUsers.get(otherUserId);
        chat.displayName = getUserDisplayName(chat.otherUser);
        return;
    }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const isOnline = isUserOnline(userData.lastActive);
            
            chat.otherUser = {
                id: otherUserId,
                ...userData,
                isOnline: isOnline
            };
            allUsers.set(otherUserId, chat.otherUser);
            chat.displayName = getUserDisplayName(chat.otherUser);
            
            if (!allUsersCache.has(otherUserId)) {
                allUsersCache.set(otherUserId, chat.otherUser);
            }
            
            // Подписываемся на обновления статуса
            subscribeToUserStatus(otherUserId, (isOnline, lastActive) => {
                if (chat.otherUser) {
                    chat.otherUser.isOnline = isOnline;
                    chat.otherUser.lastActive = lastActive;
                    
                    // Обновляем отображение в чате
                    if (currentChat && currentChat.id === chat.id) {
                        updateChatStatus(chat.otherUser);
                    }
                    
                    // Обновляем список чатов
                    renderChats([]); // Перерендерим список
                }
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки участника чата:', error);
    }
}

function updateChatStatus(otherUser) {
    if (!otherUser) return;
    
    const chatStatus = document.getElementById('chatStatus');
    if (!chatStatus) return;
    
    if (otherUser.isOnline) {
        chatStatus.innerHTML = '<span class="user-status real-online">🟢 online</span>';
        chatStatus.style.color = '#4CAF50';
    } else {
        const lastSeen = otherUser.lastActive ? formatLastSeen(otherUser.lastActive) : 'не в сети';
        chatStatus.innerHTML = `<span class="user-status real-offline">⚫ был(а) ${lastSeen}</span>`;
        chatStatus.style.color = '#aaa';
    }
}

function renderChats(chats) {
    const container = document.getElementById('chatsList');
    
    if (!container) return;
    
    const searchInput = document.getElementById('searchUsersInput');
    if (searchInput && searchInput.value.trim() !== '') {
        return;
    }
    
    if (!chats || chats.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">💬</div>
                <p>У вас пока нет чатов</p>
                <p style="font-size: 13px; margin-top: 8px; color: var(--text-secondary);">
                    Нажмите на кнопку "+" или введите имя в поиске
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.isGroup ? 'group-chat' : ''} ${chat.isChannel ? 'channel' : ''}`;
        div.dataset.chatId = chat.id;
        if (currentChat && currentChat.id === chat.id) {
            div.classList.add('active');
        }
        div.onclick = () => openChat(chat);
        
        const displayName = chat.displayName || (chat.isGroup ? chat.groupName : chat.isChannel ? chat.channelName : 'Неизвестный');
        const lastMessage = chat.lastMessage || 'Нет сообщений';
        const lastTime = chat.updatedAt ? formatTime(chat.updatedAt) : '';
        
        let avatarStyle = '';
        let avatarText = '';
        if (chat.isGroup) {
            if (chat.groupAvatar) {
                avatarStyle = `background-image: url('${chat.groupAvatar}'); background-size: cover; background-position: center;`;
            } else {
                avatarStyle = `background: ${getRandomColor()};`;
                avatarText = '👥';
            }
        } else if (chat.isChannel) {
            if (chat.channelAvatar) {
                avatarStyle = `background-image: url('${chat.channelAvatar}'); background-size: cover; background-position: center;`;
            } else {
                avatarStyle = `background: ${getRandomColor()};`;
                avatarText = '📢';
            }
        } else {
            if (chat.otherUser?.avatar) {
                avatarStyle = `background-image: url('${chat.otherUser.avatar}'); background-size: cover; background-position: center;`;
            } else {
                avatarStyle = `background: ${chat.otherUser?.avatarColor || getRandomColor()};`;
                avatarText = chat.otherUser?.name?.charAt(0).toUpperCase() || '?';
            }
        }
        
        let lastMessageIcon = '';
        if (lastMessage.includes('[Файл]') || lastMessage.includes('📎')) {
            lastMessageIcon = '📎 ';
        } else if (lastMessage.includes('[Голосовое]') || lastMessage.includes('🎤')) {
            lastMessageIcon = '🎤 ';
        } else if (lastMessage.includes('[Изображение]') || lastMessage.includes('🖼️')) {
            lastMessageIcon = '🖼️ ';
        } else if (lastMessage.includes('[Видео]') || lastMessage.includes('🎬')) {
            lastMessageIcon = '🎬 ';
        } else if (lastMessage.includes('[Аудио]') || lastMessage.includes('🎵')) {
            lastMessageIcon = '🎵 ';
        } else if (lastMessage.includes('📞')) {
            lastMessageIcon = '📞 ';
        }
        
        let statusIndicator = '';
        if (!chat.isGroup && !chat.isChannel && chat.otherUser?.isOnline) {
            statusIndicator = '<span class="status-dot" style="display: inline-block; width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; margin-left: 5px;"></span>';
        }
        
        div.innerHTML = `
            <div class="chat-avatar ${chat.isGroup ? 'group-avatar' : chat.isChannel ? 'channel-avatar' : ''}" style="${avatarStyle}">
                ${avatarText}
            </div>
            <div class="chat-info">
                <div class="chat-name">${displayName} ${chat.isGroup ? '👥' : ''} ${chat.isChannel ? '📢' : ''} ${statusIndicator}</div>
                <div class="chat-last">${lastMessageIcon}${lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage}</div>
                ${lastTime ? `<div class="chat-time">${lastTime}</div>` : ''}
            </div>
        `;
        
        const unreadCount = unreadCounts.get(chat.id) || 0;
        if (unreadCount > 0) {
            const badge = document.createElement('div');
            badge.className = 'chat-unread-badge';
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            const infoDiv = div.querySelector('.chat-info');
            if (infoDiv) {
                infoDiv.appendChild(badge);
            }
        }
        
        container.appendChild(div);
    });
}

async function openChat(chat) {
    if (!currentUser) return;
    
    currentChat = chat;
    
    await markMessagesAsRead(chat.id);
    
    if (!authError && !chat.isGroup && !chat.isChannel) {
        setupTypingListener(chat.id);
        setupCallRingingListener(chat.id);
    }
    
    if (chat.isGroup) {
        document.getElementById('chatTitle').textContent = chat.groupName + ' 👥';
        document.getElementById('chatStatus').textContent = chat.participants?.length + ' участников';
        document.getElementById('chatStatus').style.color = '#FFB347';
        document.getElementById('groupInfoBtn').style.display = 'block';
        document.getElementById('channelInfoBtn').style.display = 'none';
        document.getElementById('contactOptionsBtn').style.display = 'none';
        document.getElementById('callBtn').style.display = 'flex';
        document.getElementById('videoCallBtn').style.display = 'flex';
        document.getElementById('disableCallBtn').style.display = 'none';
        document.getElementById('videoMessageBtn').style.display = 'flex';
    } else if (chat.isChannel) {
        document.getElementById('chatTitle').textContent = chat.channelName + ' 📢';
        document.getElementById('chatStatus').textContent = `${chat.subscriberCount || 1} подписчиков`;
        document.getElementById('chatStatus').style.color = '#8BC34A';
        document.getElementById('groupInfoBtn').style.display = 'none';
        document.getElementById('channelInfoBtn').style.display = 'block';
        document.getElementById('contactOptionsBtn').style.display = 'none';
        document.getElementById('callBtn').style.display = 'none';
        document.getElementById('videoCallBtn').style.display = 'none';
        document.getElementById('disableCallBtn').style.display = 'none';
        document.getElementById('videoMessageBtn').style.display = chat.channelOwner === currentUser.id ? 'flex' : 'none';
    } else {
        const otherUser = chat.otherUser || {};
        const displayName = getUserDisplayName(otherUser);
        document.getElementById('chatTitle').textContent = displayName;
        
        // Обновляем статус
        updateChatStatus(otherUser);
        
        document.getElementById('groupInfoBtn').style.display = 'none';
        document.getElementById('channelInfoBtn').style.display = 'none';
        document.getElementById('contactOptionsBtn').style.display = 'flex';
        document.getElementById('disableCallBtn').style.display = 'flex';
        document.getElementById('videoMessageBtn').style.display = 'flex';
        
        updateCallButtonsVisibility();
        
        checkActiveCallsInChat();
        
        // Подписываемся на обновления статуса
        if (!authError && otherUser.id) {
            subscribeToUserStatus(otherUser.id, (isOnline, lastActive) => {
                if (currentChat && currentChat.id === chat.id) {
                    updateChatStatus({ ...otherUser, isOnline, lastActive });
                }
            });
        }
    }
    
    showScreen('chatScreen');
    
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.innerHTML = '<div class="empty-state"><div class="loading"></div><p style="margin-top: 8px;">Загрузка сообщений...</p></div>';
    }
    
    document.getElementById('sendMessageBtn').disabled = true;
    document.getElementById('messageInput').focus();
    
    loadMessages(chat.id);
}

async function checkActiveCallsInChat() {
    if (!currentChat || currentChat.isGroup || currentChat.isChannel) return;
    
    try {
        const callsQuery = query(
            collection(db, 'messages'),
            where('chatId', '==', currentChat.id),
            where('type', '==', 'call'),
            where('callActive', '==', true)
        );
        
        const snapshot = await getDocs(callsQuery);
        if (!snapshot.empty) {
            const callDoc = snapshot.docs.find(doc => doc.data().callActive === true);
            if (callDoc) {
                const callData = callDoc.data();
                currentCallId = callData.callId;
                
                if (callData.senderId !== currentUser.id && !activeCall) {
                    showNotification('В этом чате есть активный звонок. Нажмите кнопку присоединиться в сообщении.', 'info');
                }
            }
        }
    } catch (error) {
        console.error('Ошибка проверки активных звонков:', error);
    }
}

function addDateSeparators(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const oldSeparators = container.querySelectorAll('.date-separator');
    oldSeparators.forEach(el => el.remove());

    if (!messages || messages.length === 0) return;

    let lastDateStr = '';
    messages.forEach((msg, index) => {
        if (!msg.createdAt) return;
        const dateObj = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let displayDate;
        if (dateObj.toDateString() === today.toDateString()) {
            displayDate = 'Сегодня';
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
            displayDate = 'Вчера';
        } else {
            displayDate = dateObj.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        if (displayDate !== lastDateStr) {
            const separator = document.createElement('div');
            separator.className = 'date-separator';
            separator.innerHTML = `<span>${displayDate}</span>`;
            container.insertBefore(separator, document.getElementById(`message-${msg.id}`) || null);
            lastDateStr = displayDate;
        }
    });
}

function loadMessages(chatId) {
    if (unsubscribeMessages) unsubscribeMessages();
    
    if (authError) {
        // Локальный режим
        const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]')
            .filter(msg => msg.chatId === chatId)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const container = document.getElementById('messagesContainer');
        
        if (!container) return;
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">💭</div>
                    <p>Начните общение!</p>
                    <p style="font-size: 12px; margin-top: 8px; color: var(--text-secondary);">
                        Отправьте первое сообщение
                    </p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        messages.forEach(msg => {
            addMessageToChat(msg);
        });
        
        addDateSeparators(messages);
        
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
        
        return;
    }
    
    try {
        const messagesQuery = query(
            collection(db, 'messages'),
            where('chatId', '==', chatId),
            orderBy('createdAt', 'asc')
        );
        
        unsubscribeMessages = onSnapshot(messagesQuery, 
            (snapshot) => {
                const container = document.getElementById('messagesContainer');
                if (!container) return;
                
                const messages = [];
                
                snapshot.forEach(doc => {
                    const messageData = doc.data();
                    messages.push({
                        id: doc.id,
                        ...messageData
                    });
                });
                
                if (messages.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="icon">💭</div>
                            <p>Начните общение!</p>
                            <p style="font-size: 12px; margin-top: 8px; color: var(--text-secondary);">
                                Отправьте первое сообщение
                            </p>
                        </div>
                    `;
                    return;
                }
                
                container.innerHTML = '';
                
                const senderPromises = messages.map(async msg => {
                    if (msg.senderId === currentUser.id) {
                        msg.senderName = currentUser.name;
                    } else if (msg.senderId === 'system') {
                        msg.senderName = 'System';
                    } else {
                        if (allUsers.has(msg.senderId)) {
                            const user = allUsers.get(msg.senderId);
                            msg.senderName = getUserDisplayName(user);
                        } else {
                            try {
                                const userDoc = await getDoc(doc(db, 'users', msg.senderId));
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    allUsers.set(msg.senderId, {
                                        ...userData,
                                        isOnline: isUserOnline(userData.lastActive)
                                    });
                                    msg.senderName = getUserDisplayName(userData);
                                } else {
                                    msg.senderName = 'Неизвестный';
                                }
                            } catch (error) {
                                msg.senderName = 'Неизвестный';
                            }
                        }
                    }
                    return msg;
                });
                
                Promise.all(senderPromises).then(messagesWithSenders => {
                    messagesWithSenders.forEach(msg => {
                        addMessageToChat(msg);
                    });
                    addDateSeparators(messagesWithSenders);
                    setTimeout(() => {
                        container.scrollTop = container.scrollHeight;
                    }, 100);
                });
                
            },
            (error) => {
                console.error('❌ Ошибка загрузки сообщений:', error);
                
                const container = document.getElementById('messagesContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="icon">⚠️</div>
                            <p>Ошибка загрузки сообщений</p>
                            <p style="font-size: 12px; margin-top: 8px; color: var(--error);">
                                Код ошибки: ${error.code || 'неизвестно'}
                            </p>
                        </div>
                    `;
                }
            }
        );
    } catch (error) {
        console.error('Ошибка при подписке на сообщения:', error);
    }
}

function addMessageToChat(message) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const isOwn = message.senderId === currentUser.id;
    const isSystem = message.senderId === 'system';
    const messageId = message.id || 'msg_' + Date.now();
    
    if (document.getElementById(`message-${messageId}`)) {
        return;
    }
    
    const div = document.createElement('div');
    div.id = `message-${messageId}`;
    
    if (message.type === 'call') {
        if (isCallDisabled && !isOwn) {
            div.className = 'message call-disabled-message';
            div.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 22px; margin-bottom: 8px;">🔕</div>
                    <div>Звонок заблокирован (звонки отключены)</div>
                    <div style="font-size: 11px; margin-top: 5px;">${message.senderName || 'Неизвестный'} пытался позвонить</div>
                </div>
            `;
        } else {
            div.className = 'message call-message';
        }
    } else if (message.type === 'call_end') {
        div.className = 'message call-message';
    } else if (message.type === 'video' && message.isVideoCircle) {
        div.className = `message ${isOwn ? 'message-out' : 'message-in'} fade-in`;
        
        let content = '';
        if (message.fileId) {
            content = `
                <div>🎬 Видеосообщение</div>
                <div class="file-message" onclick="downloadLargeFile('${message.fileId}')">
                    <div class="file-icon">🎬</div>
                    <div class="file-info">
                        <div class="file-name">${message.fileName || 'videomessage.webm'}</div>
                        <div class="file-size">${formatFileSize(message.fileSize || 0)}</div>
                    </div>
                </div>
                <button class="file-download-btn" onclick="downloadLargeFile('${message.fileId}')">
                    ⬇️ Скачать видео
                </button>
            `;
        } else if (message.fileData) {
            content = `
                <div>🎬 Видеосообщение</div>
                <div class="video-circle-message" onclick="playVideoMessage('${message.fileData}', ${message.duration || 0})">
                    <div class="video-circle-play-btn">▶️</div>
                    <div class="video-circle-duration">${message.duration || 0}s</div>
                </div>
                <button class="file-download-btn" onclick="downloadFileFromMessage('${message.fileData}', '${message.fileName || 'videomessage.webm'}', '${message.fileType || 'video/webm'}')">
                    ⬇️ Скачать видео
                </button>
            `;
        } else {
            content = `<div>🎬 Видеосообщение</div>`;
        }
        
        div.innerHTML = content;
        
    } else if (message.type === 'file' || message.type === 'image' || (message.type === 'video' && !message.isVideoCircle)) {
        div.className = `message ${isOwn ? 'message-out' : 'message-in'} fade-in`;
    } else {
        div.className = `message ${isOwn ? 'message-out' : 'message-in'} fade-in`;
    }
    
    const time = message.createdAt ? formatTime(message.createdAt) : 'только что';
    
    let statusIcon = '';
    if (isOwn) {
        if (message.read) {
            statusIcon = '<span class="message-status status-read">✓✓</span>';
        } else {
            statusIcon = '<span class="message-status status-sent">✓</span>';
        }
    }
    
    let content = '';
    let reactionsHTML = '';
    
    if (message.reactions) {
        const reactions = [];
        for (const [emoji, users] of Object.entries(message.reactions)) {
            if (users && users.length > 0) {
                const count = users.length;
                const isOwnReaction = users.includes(currentUser.id);
                reactions.push(`
                    <div class="reaction-badge ${isOwnReaction ? 'own-reaction' : ''}" onclick="addReaction('${messageId}', '${emoji}')">
                        ${emoji} ${count}
                    </div>
                `);
            }
        }
        if (reactions.length > 0) {
            reactionsHTML = `<div class="message-reactions">${reactions.join('')}</div>`;
        }
    }

    let replyHTML = '';
    if (message.replyTo) {
        const replyText = message.replyTo.text || (message.replyTo.type === 'image' ? '📷 Изображение' : 'Сообщение');
        replyHTML = `
            <div class="reply-preview">
                <div class="reply-sender">${message.replyTo.senderName || 'Пользователь'}</div>
                <div class="reply-text">${replyText.length > 30 ? replyText.substring(0, 30) + '...' : replyText}</div>
            </div>
        `;
    }
    
    if (message.type === 'call' && !(isCallDisabled && !isOwn)) {
        const isActive = message.callActive === true;
        const canJoin = isActive && 
                      (message.senderId !== currentUser.id || 
                       (currentCallId === message.callId && activeCall));
        
        content = `
            ${replyHTML}
            <div style="text-align: center;">
                <div style="font-size: 22px; margin-bottom: 8px;">${message.callType === 'video' ? '📹' : '📞'}</div>
                <div>${message.text}</div>
                ${canJoin ? `
                    <button class="join-call-message-btn" data-call-id="${message.callId}" style="margin-top: 12px;">
                        📞 Присоединиться к звонку
                    </button>
                ` : ''}
            </div>
        `;
    } else if (message.type === 'call_end') {
        content = `
            ${replyHTML}
            <div style="text-align: center;">
                <div style="font-size: 22px; margin-bottom: 8px;">${message.text.includes('видео') ? '📹' : '📞'}</div>
                <div>${message.text}</div>
            </div>
        `;
    } else if (message.type === 'file' || message.type === 'image' || message.type === 'video') {
        if (message.type === 'image' && message.fileData && message.fileData.startsWith('data:image')) {
            content = `
                ${replyHTML}
                <div>${message.text || 'Изображение'}</div>
                <div class="image-message">
                    <img src="${message.fileData}" alt="${message.fileName}" style="max-height: 300px; cursor: zoom-in;" onclick="previewImage('${message.fileData}', '${message.fileName}')">
                </div>
                <button class="file-download-btn" onclick="downloadFileFromMessage('${message.fileData}', '${message.fileName}', '${message.fileType}')">
                    ⬇️ Скачать и сохранить
                </button>
            `;
        } else if (message.type === 'video' && !message.isVideoCircle && message.fileData && message.fileData.startsWith('data:video')) {
            content = `
                ${replyHTML}
                <div>${message.text || 'Видео'}</div>
                <div class="video-message" onclick="previewVideo('${message.fileData}', '${message.fileName}')">
                    <video style="width: 100%; max-height: 300px; border-radius: 8px;">
                        <source src="${message.fileData}" type="${message.fileType}">
                        Ваш браузер не поддерживает видео.
                    </video>
                    <div class="video-play-btn">▶️</div>
                </div>
                <button class="file-download-btn" onclick="downloadFileFromMessage('${message.fileData}', '${message.fileName}', '${message.fileType}')">
                    ⬇️ Скачать и сохранить
                </button>
            `;
        } else if (message.fileId) {
            const fileName = message.fileName || (message.type === 'image' ? 'image.jpg' : message.type === 'video' ? 'video.mp4' : 'file.bin');
            const fileSize = message.fileSize || 0;
            const fileType = message.fileType || (message.type === 'image' ? 'image/jpeg' : message.type === 'video' ? 'video/mp4' : 'application/octet-stream');
            
            content = `
                ${replyHTML}
                <div>${message.text || (message.type === 'image' ? 'Изображение' : message.type === 'video' ? 'Видео' : 'Файл')}</div>
                <div class="file-message" onclick="downloadLargeFile('${message.fileId}')">
                    <div class="file-icon">${getFileIcon(fileType)}</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <div class="file-size">${formatFileSize(fileSize)}</div>
                    </div>
                </div>
                <button class="file-download-btn" onclick="downloadLargeFile('${message.fileId}')">
                    ⬇️ Скачать и сохранить
                </button>
            `;
        } else {
            const fileName = message.fileName || (message.type === 'image' ? 'image.jpg' : message.type === 'video' ? 'video.mp4' : 'file.bin');
            const fileSize = message.fileSize || 0;
            const fileType = message.fileType || (message.type === 'image' ? 'image/jpeg' : message.type === 'video' ? 'video/mp4' : 'application/octet-stream');
            
            content = `
                ${replyHTML}
                <div>${message.text || (message.type === 'image' ? 'Изображение' : message.type === 'video' ? 'Видео' : 'Файл')}</div>
                <div class="file-message" onclick="downloadFileFromMessage('${message.fileData}', '${fileName}', '${fileType}')">
                    <div class="file-icon">${getFileIcon(fileType)}</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <div class="file-size">${formatFileSize(fileSize)}</div>
                    </div>
                </div>
                <button class="file-download-btn" onclick="downloadFileFromMessage('${message.fileData}', '${fileName}', '${fileType}')">
                    ⬇️ Скачать и сохранить
                </button>
            `;
        }
    } else if (message.type === 'audio') {
        const fileName = message.fileName || 'audio.mp3';
        const fileType = message.fileType || 'audio/mpeg';
        
        if (message.fileId) {
            content = `
                ${replyHTML}
                <div>${message.text || 'Аудио'}</div>
                <div class="file-message" onclick="downloadLargeFile('${message.fileId}')">
                    <div class="file-icon">🎵</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <div class="file-size">${formatFileSize(message.fileSize)}</div>
                    </div>
                </div>
                <button class="file-download-btn" onclick="downloadLargeFile('${message.fileId}')">
                    ⬇️ Скачать и сохранить
                </button>
            `;
        } else {
            content = `
                ${replyHTML}
                <div>${message.text || 'Аудио'}</div>
                <div class="file-message" onclick="downloadFileFromMessage('${message.fileData}', '${fileName}', '${fileType}')">
                    <div class="file-icon">🎵</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <div class="file-size">${formatFileSize(message.fileSize)}</div>
                    </div>
                </div>
                <button class="file-download-btn" onclick="downloadFileFromMessage('${message.fileData}', '${fileName}', '${fileType}')">
                    ⬇️ Скачать и сохранить
                </button>
            `;
        }
    } else if (message.type === 'voice') {
        const duration = message.duration ? Math.round(message.duration) : 0;
        content = `
            ${replyHTML}
            <div>Голосовое сообщение</div>
            <div class="voice-message" onclick="playVoiceMessage('${message.voiceData}')">
                <div class="voice-icon">🎤</div>
                <div class="voice-duration">${duration}s</div>
                <div class="voice-wave"></div>
            </div>
            <button class="file-download-btn" onclick="downloadVoiceMessage('${message.voiceData}', '${duration}')">
                ⬇️ Скачать аудио
            </button>
        `;
    } else {
        const text = message.text.replace(/\n/g, '<br>');
        const edited = message.edited ? ' <span style="font-size: 10px; opacity: 0.6;">(ред.)</span>' : '';
        content = `
            ${replyHTML}
            <div>${text}${edited}</div>
        `;
    }
    
    const actionsHTML = `
        <div class="message-actions">
            <button class="message-action-btn" onclick="setReply('${messageId}', '${message.text?.replace(/'/g, "\\'") || ''}', '${message.senderName || ''}', '${message.type || 'text'}')">↩️</button>
            ${isOwn ? `<button class="message-action-btn" onclick="showEditMessageModal('${messageId}', '${message.text?.replace(/'/g, "\\'") || ''}')">✏️</button>` : ''}
            <button class="message-action-btn" onclick="showCustomReactionModal('${messageId}')">➕</button>
            ${isOwn ? `<button class="message-action-btn" onclick="deleteMessage('${messageId}')">❌</button>` : ''}
        </div>
    `;
    
    if (!div.innerHTML.includes(content)) {
        if (currentChat && currentChat.isGroup && !isOwn && !isSystem) {
            div.innerHTML = `
                <div class="message-sender">${message.senderName || 'Неизвестный'}</div>
                ${content}
                ${reactionsHTML}
                <div class="message-time">${time} ${statusIcon}</div>
                ${actionsHTML}
            `;
        } else {
            div.innerHTML = `
                ${content}
                ${reactionsHTML}
                <div class="message-time">${time} ${statusIcon}</div>
                ${actionsHTML}
            `;
        }
    }
    
    container.appendChild(div);
    
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

async function sendMessage() {
    if (isSendingMessage) return;
    
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !currentChat || !currentUser) return;
    
    isSendingMessage = true;
    const btn = document.getElementById('sendMessageBtn');
    const btnText = btn.innerHTML;
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;
    
    try {
        const messageId = 'msg_' + Date.now();
        
        if (authError) {
            // Локальный режим
            const message = {
                id: messageId,
                chatId: currentChat.id,
                senderId: currentUser.id,
                text: text,
                type: 'text',
                createdAt: new Date().toISOString(),
                read: false,
                senderName: currentUser.name,
                sending: true,
                replyTo: currentReplyTo ? { id: currentReplyTo.id, text: currentReplyTo.text, senderName: currentReplyTo.senderName, type: currentReplyTo.type } : null
            };
            
            addMessageToChat(message);
            
            const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
            messages.push(message);
            localStorage.setItem('absgram_messages', JSON.stringify(messages));
            
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const chatIndex = chats.findIndex(c => c.id === currentChat.id);
            if (chatIndex !== -1) {
                chats[chatIndex].lastMessage = text.length > 50 ? text.substring(0, 50) + '...' : text;
                chats[chatIndex].updatedAt = new Date().toISOString();
                localStorage.setItem('absgram_chats', JSON.stringify(chats));
            }
            
            setTimeout(() => {
                const messageElement = document.getElementById(`message-${messageId}`);
                if (messageElement) {
                    const sendingIndicator = messageElement.querySelector('.sending-indicator');
                    if (sendingIndicator) {
                        sendingIndicator.remove();
                    }
                }
            }, 1000);
            
            input.value = '';
            input.style.height = 'auto';
            
            loadChats();
            
            btn.innerHTML = btnText;
            btn.disabled = true;
            isSendingMessage = false;
            input.focus();
            cancelReply();
            return;
        }
        
        const tempMessage = {
            id: messageId,
            chatId: currentChat.id,
            senderId: currentUser.id,
            text: text,
            type: 'text',
            createdAt: new Date(),
            senderName: currentUser.name,
            sending: true,
            replyTo: currentReplyTo ? { id: currentReplyTo.id, text: currentReplyTo.text, senderName: currentReplyTo.senderName, type: currentReplyTo.type } : null
        };
        
        addMessageToChat(tempMessage);
        
        const messageData = {
            chatId: currentChat.id,
            senderId: currentUser.id,
            text: text,
            type: 'text',
            createdAt: serverTimestamp(),
            read: false,
            replyTo: currentReplyTo ? {
                id: currentReplyTo.id,
                text: currentReplyTo.text,
                senderName: currentReplyTo.senderName,
                type: currentReplyTo.type
            } : null
        };
        
        const docRef = await addDoc(collection(db, 'messages'), messageData);
        
        await updateDoc(doc(db, 'chats', currentChat.id), {
            lastMessage: text.length > 50 ? text.substring(0, 50) + '...' : text,
            updatedAt: serverTimestamp()
        });
        
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            const sendingIndicator = messageElement.querySelector('.sending-indicator');
            if (sendingIndicator) {
                sendingIndicator.remove();
            }
        }
        
        input.value = '';
        input.style.height = 'auto';
        
        loadChats();
        
        if (!currentChat.isGroup && !currentChat.isChannel) {
            updateTypingStatus(false);
        }
        
        // Отправляем push-уведомление получателю
        if (!authError && currentChat.otherUser) {
            await sendPushNotification(currentChat.otherUser.id, currentUser.name, text);
        }
        
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error);
        showNotification('Ошибка отправки сообщения', 'error');
        
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            const sendingIndicator = messageElement.querySelector('.sending-indicator');
            if (sendingIndicator) {
                sendingIndicator.remove();
            }
        }
        
        btn.innerHTML = btnText;
        btn.disabled = false;
        isSendingMessage = false;
        return;
    }
    
    btn.innerHTML = btnText;
    btn.disabled = true;
    isSendingMessage = false;
    cancelReply();
    
    input.focus();
}

async function sendPushNotification(recipientId, senderName, messageText) {
    try {
        const userRef = doc(db, 'users', recipientId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists() && userDoc.data().pushSubscription) {
            const subscription = userDoc.data().pushSubscription;
            
            console.log('📱 Отправка push-уведомления:', {
                to: recipientId,
                from: senderName,
                message: messageText
            });
        }
    } catch (error) {
        console.error('Ошибка отправки push-уведомления:', error);
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Удалить это сообщение?')) return;
    
    try {
        if (authError) {
            // Локальный режим
            const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
            const index = messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                messages.splice(index, 1);
                localStorage.setItem('absgram_messages', JSON.stringify(messages));
                loadMessages(currentChat.id);
            }
            return;
        }
        
        const messageRef = doc(db, 'messages', messageId);
        await deleteDoc(messageRef);
        showNotification('Сообщение удалено', 'success');
    } catch (error) {
        console.error('Ошибка удаления сообщения:', error);
        showNotification('Ошибка удаления', 'error');
    }
}

function setReply(messageId, text, senderName, type) {
    currentReplyTo = { id: messageId, text: text, senderName: senderName, type: type };
    document.getElementById('replyToText').textContent = `${senderName}: ${text.length > 30 ? text.substring(0, 30) + '...' : text}`;
    document.getElementById('replyingIndicator').classList.remove('hidden');
    document.getElementById('messageInput').focus();
}

function cancelReply() {
    currentReplyTo = null;
    document.getElementById('replyingIndicator').classList.add('hidden');
}

function showEditMessageModal(messageId, currentText) {
    currentlyEditingMessage = messageId;
    const newText = prompt('Редактировать сообщение:', currentText);
    if (newText && newText.trim() !== '') {
        editMessage(messageId, newText.trim());
    }
}

async function editMessage(messageId, newText) {
    if (!currentUser || !currentChat) return;
    
    try {
        if (authError) {
            // Локальный режим
            const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
            const index = messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                messages[index].text = newText;
                messages[index].edited = true;
                messages[index].editedAt = new Date().toISOString();
                localStorage.setItem('absgram_messages', JSON.stringify(messages));
                loadMessages(currentChat.id);
                showNotification('Сообщение отредактировано', 'success');
            }
            return;
        }
        
        const messageRef = doc(db, 'messages', messageId);
        await updateDoc(messageRef, {
            text: newText,
            edited: true,
            editedAt: serverTimestamp()
        });
        
        showNotification('Сообщение отредактировано', 'success');
    } catch (error) {
        console.error('Ошибка редактирования:', error);
        showNotification('Ошибка редактирования', 'error');
    }
    currentlyEditingMessage = null;
}

async function addReaction(messageId, reaction) {
    if (!currentUser) return;
    
    try {
        if (authError) {
            // Локальный режим
            const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
            const index = messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                if (!messages[index].reactions) messages[index].reactions = {};
                if (!messages[index].reactions[reaction]) messages[index].reactions[reaction] = [];
                
                const userIndex = messages[index].reactions[reaction].indexOf(currentUser.id);
                if (userIndex === -1) {
                    messages[index].reactions[reaction].push(currentUser.id);
                } else {
                    messages[index].reactions[reaction].splice(userIndex, 1);
                    if (messages[index].reactions[reaction].length === 0) {
                        delete messages[index].reactions[reaction];
                    }
                }
                
                localStorage.setItem('absgram_messages', JSON.stringify(messages));
                loadMessages(currentChat.id);
            }
            return;
        }
        
        const messageRef = doc(db, 'messages', messageId);
        const messageDoc = await getDoc(messageRef);
        
        if (messageDoc.exists()) {
            const reactions = messageDoc.data().reactions || {};
            
            if (!reactions[reaction]) reactions[reaction] = [];
            
            const userIndex = reactions[reaction].indexOf(currentUser.id);
            if (userIndex === -1) {
                reactions[reaction].push(currentUser.id);
            } else {
                reactions[reaction].splice(userIndex, 1);
                if (reactions[reaction].length === 0) {
                    delete reactions[reaction];
                }
            }
            
            await updateDoc(messageRef, { reactions });
        }
    } catch (error) {
        console.error('Ошибка добавления реакции:', error);
    }
}

function showCustomReactionModal(messageId) {
    currentReactionMessageId = messageId;
    document.getElementById('customReactionModal').classList.remove('hidden');
}

// ========== ФУНКЦИИ ДЛЯ ФАЙЛОВ ==========
async function handleFileUpload(files) {
    if (!files || !currentChat || !currentUser) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            const fileType = file.type || 'application/octet-stream';
            const fileName = file.name;
            const fileSize = file.size;
            
            const messageType = fileType.startsWith('image/') ? 'image' : 
                              fileType.startsWith('video/') ? 'video' : 'file';
            
            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const base64Data = await readFileAsBase64(file);
            
            const messageText = fileType.startsWith('image/') ? '[Изображение]' :
                              fileType.startsWith('video/') ? '[Видео]' : '[Файл]';
            
            const messageData = {
                chatId: currentChat.id,
                senderId: currentUser.id,
                text: messageText,
                type: messageType,
                fileData: base64Data,
                fileName: fileName,
                fileType: fileType,
                fileSize: fileSize,
                createdAt: authError ? new Date().toISOString() : serverTimestamp(),
                read: false,
                isLargeFile: false,
                replyTo: currentReplyTo ? {
                    id: currentReplyTo.id,
                    text: currentReplyTo.text,
                    senderName: currentReplyTo.senderName,
                    type: currentReplyTo.type
                } : null
            };
            
            if (authError) {
                // Локальный режим
                const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
                messages.push({
                    id: messageId,
                    ...messageData,
                    createdAt: new Date().toISOString()
                });
                localStorage.setItem('absgram_messages', JSON.stringify(messages));
                
                addMessageToChat({ id: messageId, ...messageData, senderName: currentUser.name });
            } else {
                await addDoc(collection(db, 'messages'), messageData);
            }
            
            let lastMessage = messageText;
            if (messageType === 'image') {
                lastMessage = '🖼️ Изображение';
            } else if (messageType === 'video') {
                lastMessage = '🎬 Видео';
            } else {
                lastMessage = `📎 ${fileName.substring(0, 20)}${fileName.length > 20 ? '...' : ''}`;
            }
            
            if (authError) {
                // Локальный режим
                const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
                const chatIndex = chats.findIndex(c => c.id === currentChat.id);
                if (chatIndex !== -1) {
                    chats[chatIndex].lastMessage = lastMessage;
                    chats[chatIndex].updatedAt = new Date().toISOString();
                    localStorage.setItem('absgram_chats', JSON.stringify(chats));
                }
            } else {
                await updateDoc(doc(db, 'chats', currentChat.id), {
                    lastMessage: lastMessage,
                    updatedAt: serverTimestamp()
                });
            }
            
            showNotification('Файл отправлен', 'success');
            
        } catch (error) {
            console.error('Ошибка обработки файла:', error);
            showNotification(`Ошибка отправки файла "${file.name}": ${error.message}`, 'error');
        }
    }
    
    document.getElementById('fileUpload').value = '';
    cancelReply();
}

async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

function downloadFileFromMessage(fileDataOrUrl, fileName, fileType) {
    try {
        if (fileDataOrUrl && (fileDataOrUrl.startsWith('http') || fileDataOrUrl.startsWith('blob'))) {
            window.open(fileDataOrUrl, '_blank');
            return;
        }
        
        if (typeof fileDataOrUrl === 'string' && fileDataOrUrl.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = fileDataOrUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showDownloadNotification(fileName);
        } else {
            throw new Error('Неизвестный формат данных');
        }
    } catch (error) {
        console.error('Ошибка скачивания файла:', error);
        showNotification('Ошибка скачивания: ' + error.message, 'error');
    }
}

function downloadLargeFile(fileId) {
    showNotification('Функция скачивания больших файлов будет доступна в следующей версии', 'info');
}

function downloadLargeVideo(fileId) {
    downloadLargeFile(fileId);
}

function previewImage(base64Data, fileName) {
    document.getElementById('previewedImage').src = base64Data;
    document.getElementById('imagePreviewModal').classList.remove('hidden');
}

function previewVideo(base64Data, fileName) {
    const video = document.getElementById('previewedVideo');
    video.src = base64Data;
    document.getElementById('videoPreviewModal').classList.remove('hidden');
    video.play().catch(e => console.warn('Не удалось воспроизвести видео:', e));
}

function playVideoMessage(base64Data, duration) {
    const video = document.getElementById('videoMessagePreview');
    video.src = base64Data;
    document.getElementById('videoMessagePreviewModal').classList.remove('hidden');
    video.play().catch(e => console.warn('Не удалось воспроизвести видео:', e));
}

function playVoiceMessage(base64Data) {
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = base64Data;
    audioPlayer.play();
}

function downloadVoiceMessage(base64Data, duration) {
    downloadFileFromMessage(base64Data, `голосовое_сообщение_${duration}с.webm`, 'audio/webm');
}

function previewLargeFile(fileId, type) {
    showNotification('Функция предпросмотра больших файлов будет доступна в следующей версии', 'info');
}

// ========== ФУНКЦИИ ДЛЯ ЗВОНКОВ ==========
function showCallTypeModal() {
    if (!currentChat || currentChat.isGroup || currentChat.isChannel) {
        showNotification('Звонки доступны только в личных чатах', 'error');
        return;
    }

    if (activeCall) {
        showNotification('Уже есть активный звонок', 'warning');
        return;
    }

    document.querySelectorAll('.call-type-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    selectedCallType = 'audio';
    document.getElementById('audioCallOption').classList.add('selected');
    
    document.getElementById('callTypeModal').classList.remove('hidden');
}

async function startCall() {
    if (!currentChat || !currentChat.otherUser) return;
    
    if (isCallDisabled) {
        showNotification('Звонки отключены. Включите их в настройках.', 'warning');
        return;
    }

    try {
        showLoading(true);

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };

        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: selectedCallType === 'video' ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            } : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (selectedCallType === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }
            document.getElementById('videoContainer').style.display = 'block';
            document.getElementById('audioCallContainer').style.display = 'none';
        } else {
            document.getElementById('videoContainer').style.display = 'none';
            document.getElementById('audioCallContainer').style.display = 'block';
        }

        const callId = generateCallId();
        currentCallId = callId;

        const callMessage = {
            chatId: currentChat.id,
            senderId: currentUser.id,
            senderName: currentUser.name,
            type: 'call',
            callType: selectedCallType,
            callId: callId,
            text: selectedCallType === 'video' ? 
                `📹 ${currentUser.name} начал HD видеозвонок` : 
                `📞 ${currentUser.name} начал HD аудиозвонок`,
            createdAt: serverTimestamp(),
            callActive: true,
            recipientId: currentChat.otherUser.id
        };

        const callRef = await addDoc(collection(db, 'messages'), callMessage);

        activeCall = {
            id: callId,
            chatId: currentChat.id,
            userId: currentChat.otherUser.id,
            userName: getUserDisplayName(currentChat.otherUser),
            isIncoming: false,
            callType: selectedCallType,
            startTime: new Date(),
            messageId: callRef.id,
            stream: localStream
        };

        setupPeerConnection(configuration, true);

        showActiveCallScreen(activeCall);
        startCallTimer();

        await updateDoc(doc(db, 'chats', currentChat.id), {
            lastMessage: selectedCallType === 'video' ? '📹 Исходящий HD видеозвонок' : '📞 Исходящий HD звонок',
            updatedAt: serverTimestamp()
        });

        showLoading(false);
        showNotification('HD звонок начат', 'success');

    } catch (error) {
        console.error('Ошибка начала звонка:', error);
        showNotification('Ошибка: ' + error.message, 'error');
        showLoading(false);
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
    }
}

function setupPeerConnection(configuration, isInitiator) {
    if (peerConnection) {
        peerConnection.close();
    }
    
    peerConnection = new RTCPeerConnection(configuration);

    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log(`📹 Добавлен трек: ${track.kind}`);
        });
    }

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate && activeCall) {
            console.log('📞 Новый ICE кандидат');
            try {
                await addDoc(collection(db, 'call_signals'), {
                    callId: activeCall.id,
                    candidate: event.candidate.toJSON(),
                    from: currentUser.id,
                    to: activeCall.userId,
                    timestamp: serverTimestamp()
                });
            } catch (err) {
                console.warn('Не удалось отправить ICE кандидата:', err);
            }
        }
    };

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
            remoteVideo.srcObject = event.streams[0];
            remoteStream = event.streams[0];
            console.log('📞 Удаленный поток получен');
            showNotification('Собеседник подключился', 'success');
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('📞 Состояние соединения:', peerConnection.connectionState);
        const qualityEl = document.getElementById('connectionQuality');
        if (qualityEl) {
            if (peerConnection.connectionState === 'connected') {
                qualityEl.innerHTML = '📶 HD качество (P2P)';
                qualityEl.className = 'connection-quality good';
            } else if (peerConnection.connectionState === 'disconnected') {
                qualityEl.innerHTML = '📶 Соединение прервано';
                qualityEl.className = 'connection-quality poor';
            } else if (peerConnection.connectionState === 'failed') {
                qualityEl.innerHTML = '📶 Ошибка соединения';
                qualityEl.className = 'connection-quality poor';
            } else if (peerConnection.connectionState === 'connecting') {
                qualityEl.innerHTML = '📶 Устанавливаем соединение...';
                qualityEl.className = 'connection-quality fair';
            }
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log('📞 ICE состояние:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
            console.log('🔄 ICE соединение не удалось, пробуем переподключиться...');
            peerConnection.restartIce();
        }
    };

    if (isInitiator) {
        console.log('📞 Создаем оффер...');
        peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: selectedCallType === 'video',
            iceRestart: true
        })
            .then(offer => {
                console.log('✅ Оффер создан');
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log('📤 Отправляем оффер...');
                return addDoc(collection(db, 'call_signals'), {
                    callId: activeCall.id,
                    offer: peerConnection.localDescription.toJSON(),
                    from: currentUser.id,
                    to: activeCall.userId,
                    timestamp: serverTimestamp()
                });
            })
            .then(() => {
                console.log('✅ Оффер отправлен');
            })
            .catch(error => {
                console.error('❌ Ошибка создания оффера:', error);
                showNotification('Ошибка создания звонка', 'error');
            });
    }

    listenForSignals();
}

async function listenForSignals() {
    if (!activeCall) return;

    if (callListeners.has('signals')) {
        callListeners.get('signals')();
        callListeners.delete('signals');
    }

    const signalsQuery = query(
        collection(db, 'call_signals'),
        where('callId', '==', activeCall.id),
        orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(signalsQuery, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const signal = change.doc.data();
                
                if (signal.from === currentUser.id) return;

                try {
                    if (signal.offer && !peerConnection.currentRemoteDescription) {
                        console.log('📞 Получен оффер, создаем ответ...');
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
                        
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        
                        console.log('📤 Отправляем ответ...');
                        await addDoc(collection(db, 'call_signals'), {
                            callId: activeCall.id,
                            answer: peerConnection.localDescription.toJSON(),
                            from: currentUser.id,
                            to: signal.from,
                            timestamp: serverTimestamp()
                        });
                        console.log('✅ Ответ отправлен');
                    }
                    
                    else if (signal.answer && !peerConnection.currentRemoteDescription) {
                        console.log('📞 Получен ответ, устанавливаем соединение...');
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
                        console.log('✅ Соединение установлено!');
                    }
                    
                    else if (signal.candidate) {
                        console.log('📞 Получен ICE кандидат');
                        try {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
                            console.log('✅ ICE кандидат добавлен');
                        } catch (e) {
                            console.error('Ошибка добавления ICE кандидата:', e);
                        }
                    }
                } catch (error) {
                    console.error('❌ Ошибка обработки сигнала:', error);
                }
            }
        });
    }, (error) => {
        console.error('❌ Ошибка слушателя сигналов:', error);
    });
    
    callListeners.set('signals', unsubscribe);
}

function showActiveCallScreen(call) {
    document.getElementById('callActiveName').textContent = call.userName;
    document.getElementById('callActiveStatus').textContent = call.isIncoming ? 
        'Входящий HD звонок' : 'Исходящий HD звонок';
    document.getElementById('callActiveTimer').textContent = '00:00';

    const avatar = document.getElementById('callActiveAvatar');
    avatar.style.background = getRandomColor();
    avatar.textContent = call.userName.charAt(0).toUpperCase();

    if (call.callType === 'video') {
        document.getElementById('videoContainer').style.display = 'block';
        document.getElementById('audioCallContainer').style.display = 'none';
        document.getElementById('callTypeIcon').textContent = '📹';
    } else {
        document.getElementById('videoContainer').style.display = 'none';
        document.getElementById('audioCallContainer').style.display = 'block';
        document.getElementById('callTypeIcon').textContent = '📞';
    }

    document.getElementById('callActiveScreen').classList.remove('hidden');
    
    updateCallButtons();
    
    if (call.checkInterval) {
        clearInterval(call.checkInterval);
    }
    call.checkInterval = setInterval(checkCallStatus, 5000);
}

async function checkCallStatus() {
    if (!activeCall || !activeCall.messageId) return;
    
    try {
        const callDoc = await getDoc(doc(db, 'messages', activeCall.messageId));
        if (callDoc.exists()) {
            const callData = callDoc.data();
            if (!callData.callActive) {
                await endCall();
                showNotification('Собеседник завершил звонок', 'info');
            }
        } else {
            await endCall();
            showNotification('Звонок был завершен', 'info');
        }
    } catch (error) {
        console.error('Ошибка проверки статуса звонка:', error);
    }
}

function updateCallButtons() {
    const callBtn = document.getElementById('callBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');
    
    if (activeCall) {
        if (activeCall.callType === 'video') {
            videoCallBtn.classList.add('active-call');
            videoCallBtn.innerHTML = '📞';
            videoCallBtn.title = 'Завершить звонок';
            callBtn.style.display = 'none';
        } else {
            callBtn.classList.add('active-call');
            callBtn.innerHTML = '📞';
            callBtn.title = 'Завершить звонок';
            videoCallBtn.style.display = 'none';
        }
    } else {
        callBtn.classList.remove('active-call');
        videoCallBtn.classList.remove('active-call');
        callBtn.innerHTML = '📞';
        videoCallBtn.innerHTML = '📹';
        callBtn.title = 'HD Аудиозвонок';
        videoCallBtn.title = 'HD Видеозвонок';
        
        updateCallButtonsVisibility();
    }
}

function updateCallButtonsVisibility() {
    if (!currentChat) return;
    
    if (currentChat.isGroup || currentChat.isChannel || isCallDisabled) {
        document.getElementById('callBtn').style.display = 'none';
        document.getElementById('videoCallBtn').style.display = 'none';
    } else {
        document.getElementById('callBtn').style.display = 'flex';
        document.getElementById('videoCallBtn').style.display = 'flex';
    }
}

function toggleCallsDisabled() {
    isCallDisabled = !isCallDisabled;
    const disableBtn = document.getElementById('disableCallBtn');
    
    if (isCallDisabled) {
        disableBtn.classList.add('active');
        disableBtn.innerHTML = '🔕';
        disableBtn.title = 'Включить звонки';
        showNotification('Звонки отключены', 'warning');
        
        document.getElementById('callBtn').style.display = 'none';
        document.getElementById('videoCallBtn').style.display = 'none';
        
        if (activeCall) {
            endCall();
        }
    } else {
        disableBtn.classList.remove('active');
        disableBtn.innerHTML = '🔔';
        disableBtn.title = 'Отключить звонки';
        showNotification('Звонки включены', 'success');
        
        if (currentChat && !currentChat.isGroup && !currentChat.isChannel) {
            document.getElementById('callBtn').style.display = 'flex';
            document.getElementById('videoCallBtn').style.display = 'flex';
        }
    }
    
    saveCallsDisabledState();
}

function saveCallsDisabledState() {
    if (currentUser) {
        localStorage.setItem(`absgram_calls_disabled_${currentUser.id}`, isCallDisabled);
    }
}

function loadCallsDisabledState() {
    if (currentUser) {
        const saved = localStorage.getItem(`absgram_calls_disabled_${currentUser.id}`);
        if (saved !== null) {
            isCallDisabled = saved === 'true';
            const disableBtn = document.getElementById('disableCallBtn');
            
            if (isCallDisabled) {
                disableBtn.classList.add('active');
                disableBtn.innerHTML = '🔕';
                disableBtn.title = 'Включить звонки';
            } else {
                disableBtn.classList.remove('active');
                disableBtn.innerHTML = '🔔';
                disableBtn.title = 'Отключить звонки';
            }
        }
    }
}

async function endCall() {
    if (!activeCall) return;

    try {
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`🛑 Трек ${track.kind} остановлен`);
            });
            localStream = null;
        }
        
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            remoteStream = null;
        }

        const remoteVideo = document.getElementById('remoteVideo');
        const localVideo = document.getElementById('localVideo');
        
        if (remoteVideo) {
            remoteVideo.srcObject = null;
        }
        if (localVideo) {
            localVideo.srcObject = null;
        }

        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        if (callListeners.size > 0) {
            callListeners.forEach((unsubscribe, key) => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                    console.log(`🔇 Слушатель ${key} удален`);
                }
            });
            callListeners.clear();
        }

        if (activeCall.messageId) {
            try {
                await updateDoc(doc(db, 'messages', activeCall.messageId), {
                    callActive: false,
                    endedAt: serverTimestamp(),
                    duration: Math.floor((Date.now() - activeCall.startTime.getTime()) / 1000)
                });
            } catch (error) {
                console.log('Звонок уже завершен или удален');
            }
        }

        document.getElementById('callActiveScreen').classList.add('hidden');
        
        if (currentChat) {
            showScreen('chatScreen');
        } else {
            showScreen('chatsScreen');
        }

        activeCall = null;
        currentCallId = null;
        isMuted = false;
        isSpeakerOn = false;
        isVideoOn = true;
        incomingCallData = null;

        updateCallButtons();
        
        showNotification('HD звонок завершен', 'info');

    } catch (error) {
        console.error('Ошибка завершения звонка:', error);
        showNotification('Ошибка завершения звонка', 'error');
    }
}

function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    const audioTracks = localStream.getAudioTracks();
    
    audioTracks.forEach(track => {
        track.enabled = !isMuted;
    });
    
    const muteBtn = document.querySelector('.mute-call-btn');
    if (isMuted) {
        muteBtn.innerHTML = '🔇';
        muteBtn.style.background = 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)';
    } else {
        muteBtn.innerHTML = '🎤';
        muteBtn.style.background = 'linear-gradient(135deg, #666 0%, #444 100%)';
    }
}

function toggleSpeaker() {
    isSpeakerOn = !isSpeakerOn;
    
    const speakerBtn = document.querySelectorAll('.speaker-call-btn');
    speakerBtn.forEach(btn => {
        if (isSpeakerOn) {
            btn.innerHTML = '🔊';
            btn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)';
        } else {
            btn.innerHTML = '🔈';
            btn.style.background = 'linear-gradient(135deg, #666 0%, #444 100%)';
        }
    });
    
    showNotification(isSpeakerOn ? 'Включена громкая связь' : 'Выключена громкая связь', 'info');
}

function toggleVideo() {
    if (!localStream) return;
    
    isVideoOn = !isVideoOn;
    const videoTracks = localStream.getVideoTracks();
    
    videoTracks.forEach(track => {
        track.enabled = isVideoOn;
    });
    
    const videoBtn = document.getElementById('videoToggleBtn');
    if (isVideoOn) {
        videoBtn.innerHTML = '📹';
        videoBtn.style.background = 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)';
    } else {
        videoBtn.innerHTML = '🚫';
        videoBtn.style.background = 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)';
    }
}

function startCallTimer() {
    callStartTime = new Date();
    
    if (callTimer) {
        clearInterval(callTimer);
    }
    
    callTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('callActiveTimer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function generateCallId() {
    return 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function setupCallListeners() {
    if (!currentUser || authError) return;

    try {
        const callsQuery = query(
            collection(db, 'messages'),
            where('type', '==', 'call'),
            where('recipientId', '==', currentUser.id),
            where('callActive', '==', true)
        );

        const unsubscribe = onSnapshot(callsQuery, async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added' && !activeCall) {
                    const callData = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };

                    if (callData.senderId === currentUser.id) return;
                    if (callData.callActive !== true) return;
                    if (incomingCallData && incomingCallData.id === callData.id) return;

                    incomingCallData = callData;

                    if (currentChat && currentChat.id === callData.chatId) {
                        showCallRingingIndicator(callData);
                    } else {
                        showIncomingCallNotification(callData);
                    }
                }
            });
        }, (error) => {
            console.warn('Ошибка слушателя звонков:', error);
        });

        callListeners.set('main', unsubscribe);
        return unsubscribe;
    } catch (error) {
        console.error('Ошибка настройки слушателя звонков:', error);
    }
}

function showIncomingCallNotification(callData) {
    const notificationElement = document.getElementById('callNotification');
    if (!notificationElement) return;
    
    document.getElementById('callerName').textContent = callData.senderName;
    
    if (callData.callType === 'video') {
        document.getElementById('callNotificationIcon').textContent = '📹 Входящий HD видеозвонок';
        document.getElementById('callTypeText').textContent = 'HD Видеозвонок';
        notificationElement.classList.add('video');
    } else {
        document.getElementById('callNotificationIcon').textContent = '📞 Входящий HD звонок';
        document.getElementById('callTypeText').textContent = 'HD Аудиозвонок';
        notificationElement.classList.remove('video');
    }
    
    notificationElement.classList.remove('hidden');
    
    playRingtone();
    
    const timeoutId = setTimeout(async () => {
        if (notificationElement && !notificationElement.classList.contains('hidden')) {
            notificationElement.classList.add('hidden');
            stopRingtone();
            if (incomingCallData) {
                await rejectCall(incomingCallData);
                showNotification('Вызов не отвечен', 'info');
            }
        }
    }, 30000);
    
    callData._timeoutId = timeoutId;
}

async function answerCall(callData) {
    try {
        showLoading(true);

        const constraints = callData.callType === 'video' 
            ? { 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }, 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
              } 
            : { 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
              };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (callData.callType === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }
            document.getElementById('videoContainer').style.display = 'block';
            document.getElementById('audioCallContainer').style.display = 'none';
        } else {
            document.getElementById('videoContainer').style.display = 'none';
            document.getElementById('audioCallContainer').style.display = 'block';
        }

        currentCallId = callData.callId;

        await updateDoc(doc(db, 'messages', callData.id), {
            answered: true,
            answeredAt: serverTimestamp(),
            callActive: true
        });

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };

        activeCall = {
            id: callData.callId,
            chatId: callData.chatId,
            userId: callData.senderId,
            userName: callData.senderName,
            isIncoming: true,
            callType: callData.callType,
            startTime: new Date(),
            messageId: callData.id,
            stream: localStream
        };

        setupPeerConnection(configuration, false);

        document.getElementById('callNotification').classList.add('hidden');
        stopRingtone();
        hideCallRingingIndicator();

        showActiveCallScreen(activeCall);
        startCallTimer();

        await updateDoc(doc(db, 'chats', callData.chatId), {
            lastMessage: callData.callType === 'video' ? '📹 Принятый HD видеозвонок' : '📞 Принятый HD звонок',
            updatedAt: serverTimestamp()
        });

        showLoading(false);
        showNotification('HD звонок принят', 'success');

    } catch (error) {
        console.error('Ошибка принятия звонка:', error);
        showNotification('Ошибка принятия звонка', 'error');
        showLoading(false);
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
    }
}

async function rejectCall(callData) {
    try {
        if (callData._timeoutId) {
            clearTimeout(callData._timeoutId);
        }
        
        await updateDoc(doc(db, 'messages', callData.id), {
            callActive: false,
            rejected: true,
            rejectedAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'chats', callData.chatId), {
            lastMessage: callData.callType === 'video' ? '📹 Отклоненный HD видеозвонок' : '📞 Отклоненный HD звонок',
            updatedAt: serverTimestamp()
        });

        document.getElementById('callNotification').classList.add('hidden');
        stopRingtone();
        hideCallRingingIndicator();
        incomingCallData = null;

    } catch (error) {
        console.error('Ошибка отклонения звонка:', error);
    }
}

function playRingtone() {
    const ringtone = document.getElementById('ringtone');
    ringtone.volume = 0.3;
    ringtone.currentTime = 0;
    ringtone.play().catch(e => {
        console.log('Ошибка воспроизведения рингтона:', e);
        const callerName = document.getElementById('callerName')?.textContent || 'Неизвестный абонент';
        showPushNotification('Входящий HD звонок', callerName + ' звонит вам');
    });
}

function stopRingtone() {
    const ringtone = document.getElementById('ringtone');
    ringtone.pause();
    ringtone.currentTime = 0;
}

function showCallRingingIndicator(callData) {
    const ringingEl = document.getElementById('callRingingStatus');
    ringingEl.classList.remove('hidden');
}

function hideCallRingingIndicator() {
    const ringingEl = document.getElementById('callRingingStatus');
    ringingEl.classList.add('hidden');
}

function setupCallRingingListener(chatId) {
    if (!chatId || callRingingListeners.has(chatId) || authError) return;
    
    try {
        const callsQuery = query(
            collection(db, 'messages'),
            where('chatId', '==', chatId),
            where('type', '==', 'call'),
            where('callActive', '==', true)
        );
        
        const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const callData = change.doc.data();
                    if (callData.senderId !== currentUser.id && !activeCall) {
                        showCallRingingIndicator(callData);
                    }
                } else if (change.type === 'removed' || change.type === 'modified') {
                    hideCallRingingIndicator();
                }
            });
        }, (error) => {
            console.warn('Ошибка слушателя звонков:', error);
        });
        
        callRingingListeners.set(chatId, unsubscribe);
    } catch (error) {
        console.error('Ошибка настройки слушателя звонков:', error);
    }
}

// ========== ФУНКЦИИ ДЛЯ ГОЛОСОВЫХ СООБЩЕНИЙ ==========
function startVoiceRecording() {
    if (isRecording) return;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('Ваш браузер не поддерживает запись аудио', 'error');
        return;
    }
    
    navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
    })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                sendVoiceMessage(audioBlob);
                
                stream.getTracks().forEach(track => track.stop());
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
                
                if (elapsed >= 120) {
                    stopVoiceRecording();
                }
            }, 1000);
        })
        .catch(error => {
            console.error('Ошибка доступа к микрофону:', error);
            showNotification('Не удалось получить доступ к микрофону', 'error');
        });
}

function stopVoiceRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    mediaRecorder.stop();
    isRecording = false;
    
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    document.getElementById('voiceBtn').classList.remove('recording');
    document.getElementById('recordingTime').style.display = 'none';
}

async function sendVoiceMessage(audioBlob) {
    if (!currentChat || !currentUser) return;
    
    showLoading(true);
    
    try {
        const reader = new FileReader();
        reader.onload = async function(event) {
            const base64Audio = event.target.result;
            const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
            
            if (authError) {
                // Локальный режим
                const messageId = 'msg_' + Date.now();
                const message = {
                    id: messageId,
                    chatId: currentChat.id,
                    senderId: currentUser.id,
                    text: '[Голосовое сообщение]',
                    type: 'voice',
                    voiceData: base64Audio,
                    duration: duration,
                    createdAt: new Date().toISOString(),
                    read: false,
                    senderName: currentUser.name,
                    replyTo: currentReplyTo ? { id: currentReplyTo.id, text: currentReplyTo.text, senderName: currentReplyTo.senderName, type: currentReplyTo.type } : null
                };
                
                const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
                messages.push(message);
                localStorage.setItem('absgram_messages', JSON.stringify(messages));
                
                const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
                const chatIndex = chats.findIndex(c => c.id === currentChat.id);
                if (chatIndex !== -1) {
                    chats[chatIndex].lastMessage = '🎤 Голосовое сообщение';
                    chats[chatIndex].updatedAt = new Date().toISOString();
                    localStorage.setItem('absgram_chats', JSON.stringify(chats));
                }
                
                addMessageToChat(message);
                loadChats();
                showNotification('Голосовое сообщение отправлено', 'success');
                showLoading(false);
                return;
            }
            
            const messageData = {
                chatId: currentChat.id,
                senderId: currentUser.id,
                text: '[Голосовое сообщение]',
                type: 'voice',
                voiceData: base64Audio,
                duration: duration,
                createdAt: serverTimestamp(),
                read: false,
                replyTo: currentReplyTo ? {
                    id: currentReplyTo.id,
                    text: currentReplyTo.text,
                    senderName: currentReplyTo.senderName,
                    type: currentReplyTo.type
                } : null
            };
            
            await addDoc(collection(db, 'messages'), messageData);
            
            await updateDoc(doc(db, 'chats', currentChat.id), {
                lastMessage: '🎤 Голосовое сообщение',
                updatedAt: serverTimestamp()
            });
            
            showNotification('Голосовое сообщение отправлено', 'success');
            loadChats();
            showLoading(false);
        };
        
        reader.readAsDataURL(audioBlob);
        
    } catch (error) {
        console.error('Ошибка отправки голосового сообщения:', error);
        showNotification('Ошибка отправки голосового сообщения', 'error');
        showLoading(false);
    }
    cancelReply();
}

// ========== ФУНКЦИИ ДЛЯ ВИДЕОСООБЩЕНИЙ ==========
async function startVideoRecording() {
    try {
        const constraints = {
            video: {
                facingMode: currentCamera,
                width: { ideal: 640, max: 1280 },
                height: { ideal: 640, max: 720 },
                frameRate: { ideal: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const preview = document.getElementById('videoRecordingPreview');
        if (preview) {
            preview.srcObject = videoStream;
        }
        
        // Пробуем разные кодеки
        let options = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            options = { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 2500000 };
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 2000000 };
        } else {
            options = { videoBitsPerSecond: 2000000 };
        }
        
        try {
            videoMediaRecorder = new MediaRecorder(videoStream, options);
        } catch (e) {
            console.log('Не поддерживается выбранный кодек, пробуем стандартный:', e);
            videoMediaRecorder = new MediaRecorder(videoStream);
        }
        
        videoChunks = [];
        
        videoMediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                videoChunks.push(event.data);
            }
        };
        
        document.getElementById('videoRecordingModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        showNotification('Не удалось получить доступ к камере', 'error');
    }
}

function startRecordingVideo() {
    if (!videoMediaRecorder) return;
    
    videoMediaRecorder.start(100); // Собираем данные каждые 100ms
    isVideoRecording = true;
    videoRecordingStartTime = Date.now();
    
    document.getElementById('recordStartBtn').classList.add('recording');
    document.getElementById('recordStartBtn').style.display = 'none';
    document.getElementById('recordStopBtn').style.display = 'flex';
    document.getElementById('recordingIndicator').style.display = 'flex';
    
    videoRecordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('videoRecordingTimer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (elapsed >= maxVideoDuration) {
            stopRecordingVideo();
        }
    }, 1000);
}

function stopRecordingVideo() {
    if (!isVideoRecording || !videoMediaRecorder) return;
    
    videoMediaRecorder.stop();
    isVideoRecording = false;
    
    if (videoRecordingTimer) {
        clearInterval(videoRecordingTimer);
        videoRecordingTimer = null;
    }
    
    document.getElementById('recordStartBtn').classList.remove('recording');
    document.getElementById('recordStartBtn').style.display = 'flex';
    document.getElementById('recordStopBtn').style.display = 'none';
    document.getElementById('recordingIndicator').style.display = 'none';
}

async function sendVideoMessage() {
    if (videoChunks.length === 0) {
        showNotification('Видеосообщение пустое', 'error');
        closeVideoRecordingModal();
        return;
    }
    
    showLoading(true);
    
    try {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        const duration = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
        
        const reader = new FileReader();
        reader.onload = async function(event) {
            const base64Video = event.target.result;
            
            if (authError) {
                // Локальный режим
                const messageId = 'msg_' + Date.now();
                const message = {
                    id: messageId,
                    chatId: currentChat.id,
                    senderId: currentUser.id,
                    text: '[Видеосообщение]',
                    type: 'video',
                    fileData: base64Video,
                    fileName: `videomessage_${Date.now()}.webm`,
                    fileType: 'video/webm',
                    fileSize: videoBlob.size,
                    duration: duration,
                    createdAt: new Date().toISOString(),
                    read: false,
                    senderName: currentUser.name,
                    isVideoCircle: true,
                    replyTo: currentReplyTo ? { id: currentReplyTo.id, text: currentReplyTo.text, senderName: currentReplyTo.senderName, type: currentReplyTo.type } : null
                };
                
                const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
                messages.push(message);
                localStorage.setItem('absgram_messages', JSON.stringify(messages));
                
                const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
                const chatIndex = chats.findIndex(c => c.id === currentChat.id);
                if (chatIndex !== -1) {
                    chats[chatIndex].lastMessage = '🎬 Видеосообщение';
                    chats[chatIndex].updatedAt = new Date().toISOString();
                    localStorage.setItem('absgram_chats', JSON.stringify(chats));
                }
                
                addMessageToChat(message);
                loadChats();
                showNotification('Видеосообщение отправлено', 'success');
                return;
            }
            
            const messageData = {
                chatId: currentChat.id,
                senderId: currentUser.id,
                text: '[Видеосообщение]',
                type: 'video',
                fileData: base64Video,
                fileName: `videomessage_${Date.now()}.webm`,
                fileType: 'video/webm',
                fileSize: videoBlob.size,
                duration: duration,
                createdAt: serverTimestamp(),
                read: false,
                isVideoCircle: true,
                replyTo: currentReplyTo ? {
                    id: currentReplyTo.id,
                    text: currentReplyTo.text,
                    senderName: currentReplyTo.senderName,
                    type: currentReplyTo.type
                } : null
            };
            
            await addDoc(collection(db, 'messages'), messageData);
            
            await updateDoc(doc(db, 'chats', currentChat.id), {
                lastMessage: '🎬 Видеосообщение',
                updatedAt: serverTimestamp()
            });
            
            showNotification('Видеосообщение отправлено', 'success');
            loadChats();
        };
        
        reader.readAsDataURL(videoBlob);
        
    } catch (error) {
        console.error('Ошибка отправки видеосообщения:', error);
        showNotification('Ошибка отправки видеосообщения', 'error');
    } finally {
        showLoading(false);
        closeVideoRecordingModal();
    }
    cancelReply();
}

function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
    
    startVideoRecording();
}

function closeVideoRecordingModal() {
    document.getElementById('videoRecordingModal').classList.add('hidden');
    
    if (isVideoRecording) {
        stopRecordingVideo();
    }
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    if (videoRecordingTimer) {
        clearInterval(videoRecordingTimer);
        videoRecordingTimer = null;
    }
    
    document.getElementById('videoRecordingTimer').textContent = '00:00';
    document.getElementById('recordStartBtn').classList.remove('recording');
    document.getElementById('recordStartBtn').style.display = 'flex';
    document.getElementById('recordStopBtn').style.display = 'none';
    document.getElementById('recordingIndicator').style.display = 'none';
}

// ========== ФУНКЦИИ ДЛЯ КАНАЛОВ ==========
async function createChannel() {
    const channelName = document.getElementById('channelName').value.trim();
    const channelDesc = document.getElementById('channelDescription').value.trim();
    const channelType = document.getElementById('channelType').value;
    
    if (!channelName) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    showLoading(true);
    try {
        let channelAvatar = null;
        if (tempChannelAvatar) {
            channelAvatar = tempChannelAvatar;
        } else if (channelAvatarFile) {
            channelAvatar = await readFileAsBase64(channelAvatarFile);
        }
        
        if (authError) {
            // Локальный режим
            const channelId = 'channel_' + Date.now();
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const chat = {
                id: channelId,
                participants: [currentUser.id],
                isChannel: true,
                channelName: channelName,
                channelDesc: channelDesc,
                channelOwner: currentUser.id,
                channelType: channelType,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMessage: 'Канал создан',
                subscriberCount: 1,
                channelAvatar: channelAvatar
            };
            chats.push(chat);
            localStorage.setItem('absgram_chats', JSON.stringify(chats));
            
            closeGroupModal();
            loadChats();
            showLoading(false);
            return;
        }
        
        const chatData = {
            participants: [currentUser.id],
            isChannel: true,
            channelName: channelName,
            channelDesc: channelDesc,
            channelOwner: currentUser.id,
            channelType: channelType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: 'Канал создан',
            subscriberCount: 1,
            channelAvatar: channelAvatar,
            admins: [currentUser.id],
            onlyAdminsCanPost: false
        };
        
        const chatRef = await addDoc(collection(db, 'chats'), chatData);
        channels.set(chatRef.id, { id: chatRef.id, ...chatData });
        userSubscriptions.add(chatRef.id);
        
        showNotification('Канал создан!', 'success');
        closeGroupModal();
        loadChats();
        
    } catch (error) {
        console.error('Ошибка создания канала:', error);
        showNotification('Ошибка создания канала', 'error');
    } finally {
        showLoading(false);
    }
}

async function joinChannelById(channelId) {
    try {
        const chatDoc = await getDoc(doc(db, 'chats', channelId));
        if (chatDoc.exists() && chatDoc.data().isChannel) {
            const chatData = chatDoc.data();
            const isSubscribed = chatData.participants && chatData.participants.includes(currentUser.id);
            
            if (!isSubscribed && chatData.channelType === 'public') {
                await subscribeToChannel(channelId);
            }
            
            openChat({ id: channelId, ...chatData });
        } else {
            showNotification('Канал не найден', 'error');
        }
    } catch (error) {
        console.error('Ошибка присоединения к каналу:', error);
        showNotification('Ошибка присоединения к каналу', 'error');
    }
}

async function showChannelInfo() {
    if (!currentChat || !currentChat.isChannel) return;
    
    document.getElementById('channelInfoName').textContent = currentChat.channelName;
    document.getElementById('channelInfoDescription').textContent = currentChat.channelDesc || 'Нет описания';
    document.getElementById('channelInfoSubscribers').innerHTML = `👥 ${currentChat.subscriberCount || 1} подписчиков`;
    
    let postsCount = 0;
    if (!authError) {
        const postsQuery = query(
            collection(db, 'messages'),
            where('chatId', '==', currentChat.id)
        );
        const postsSnapshot = await getDocs(postsQuery);
        postsCount = postsSnapshot.size;
    } else {
        const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
        postsCount = messages.filter(m => m.chatId === currentChat.id).length;
    }
    document.getElementById('channelInfoPosts').innerHTML = `📝 ${postsCount} постов`;
    
    const isOwner = currentChat.channelOwner === currentUser.id;
    const isSubscribed = currentChat.participants?.includes(currentUser.id);
    
    document.getElementById('channelAdminSection').style.display = isOwner ? 'block' : 'none';
    document.getElementById('channelSubscribeBtn').style.display = isOwner || isSubscribed ? 'none' : 'inline-block';
    document.getElementById('channelUnsubscribeBtn').style.display = isOwner || !isSubscribed ? 'none' : 'inline-block';
    
    if (currentChat.channelType === 'private') {
        const inviteLink = `absgram://channel/${currentChat.id}`;
        document.getElementById('channelInviteLink').textContent = `🔗 Ссылка: ${inviteLink}`;
    } else {
        document.getElementById('channelInviteLink').textContent = '';
    }

    if (isOwner) {
        await loadChannelMembers();
    }
    
    document.getElementById('channelInfoModal').classList.remove('hidden');
}

async function loadChannelMembers() {
    if (!currentChat || !currentChat.participants) return;
    
    const membersList = document.getElementById('channelMembersList');
    const adminSelect = document.getElementById('makeAdminSelect');
    if (!membersList || !adminSelect) return;
    
    membersList.innerHTML = '';
    adminSelect.innerHTML = '<option value="">Выберите пользователя</option>';
    
    const admins = currentChat.admins || [];
    
    for (const userId of currentChat.participants) {
        if (userId === currentUser.id) continue;
        
        try {
            let userData;
            if (authError) {
                const localUsers = JSON.parse(localStorage.getItem('absgram_all_users') || '[]');
                userData = localUsers.find(u => u.id === userId);
            } else {
                const userDoc = await getDoc(doc(db, 'users', userId));
                userData = userDoc.exists() ? userDoc.data() : null;
            }
            
            if (userData) {
                const isAdmin = admins.includes(userId);
                const isOnline = isUserOnline(userData.lastActive);
                
                const memberRow = document.createElement('div');
                memberRow.className = 'member-row';
                memberRow.innerHTML = `
                    <div class="member-info">
                        <div class="member-avatar-small" style="background: ${userData.avatarColor || getRandomColor()}; 
                             ${userData.avatar ? `background-image: url('${userData.avatar}'); background-size: cover; background-position: center;` : ''}">
                            ${userData.avatar ? '' : userData.name.charAt(0).toUpperCase()}
                            ${isOnline ? '<div class="status-dot" style="position: absolute; bottom: 2px; right: 2px;"></div>' : ''}
                        </div>
                        <span class="member-name">${userData.name}</span>
                        ${isAdmin ? '<span class="member-badge">Админ</span>' : ''}
                    </div>
                    <button class="member-action-btn" onclick="removeFromChannel('${userId}')">Удалить</button>
                `;
                membersList.appendChild(memberRow);
                
                const option = document.createElement('option');
                option.value = userId;
                option.textContent = userData.name;
                if (isAdmin) option.disabled = true;
                adminSelect.appendChild(option);
            }
        } catch (error) {
            console.error('Ошибка загрузки участника:', error);
        }
    }
}

async function removeFromChannel(userId) {
    if (!currentChat || currentChat.channelOwner !== currentUser.id) {
        showNotification('Только владелец канала может удалять подписчиков', 'error');
        return;
    }
    
    if (!confirm('Удалить этого подписчика из канала?')) return;
    
    try {
        showLoading(true);
        
        if (authError) {
            // Локальный режим
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const idx = chats.findIndex(c => c.id === currentChat.id);
            if (idx !== -1) {
                chats[idx].participants = chats[idx].participants.filter(id => id !== userId);
                chats[idx].subscriberCount = chats[idx].participants.length;
                localStorage.setItem('absgram_chats', JSON.stringify(chats));
                currentChat.participants = chats[idx].participants;
                currentChat.subscriberCount = chats[idx].subscriberCount;
            }
        } else {
            await updateDoc(doc(db, 'chats', currentChat.id), {
                participants: arrayRemove(userId),
                subscriberCount: increment(-1),
                admins: arrayRemove(userId)
            });
        }
        
        showNotification('Подписчик удален', 'success');
        showChannelInfo();
        loadChats();
        
    } catch (error) {
        console.error('Ошибка удаления подписчика:', error);
        showNotification('Ошибка удаления подписчика', 'error');
    } finally {
        showLoading(false);
    }
}
window.removeFromChannel = removeFromChannel;

async function subscribeToChannel(channelId) {
    if (!currentUser) return;
    
    try {
        if (authError) {
            // Локальный режим
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const chat = chats.find(c => c.id === channelId);
            if (chat) {
                chat.participants.push(currentUser.id);
                chat.subscriberCount = chat.participants.length;
                localStorage.setItem('absgram_chats', JSON.stringify(chats));
            }
            
            userSubscriptions.add(channelId);
            showNotification('Вы подписались на канал', 'success');
            return;
        }
        
        const chatRef = doc(db, 'chats', channelId);
        const chatDoc = await getDoc(chatRef);
        if (!chatDoc.exists()) {
            throw new Error('Канал не найден');
        }
        
        await updateDoc(chatRef, {
            participants: arrayUnion(currentUser.id),
            subscriberCount: increment(1),
            updatedAt: serverTimestamp()
        });
        
        userSubscriptions.add(channelId);
        showNotification('Вы подписались на канал', 'success');
        loadChats();
        
    } catch (error) {
        console.error('Ошибка подписки на канал:', error);
        showNotification('Ошибка подписки', 'error');
    }
}

async function unsubscribeFromChannel(channelId) {
    if (!currentUser) return;
    
    try {
        if (authError) {
            // Локальный режим
            const chats = JSON.parse(localStorage.getItem('absgram_chats') || '[]');
            const chatIndex = chats.findIndex(c => c.id === channelId);
            if (chatIndex !== -1) {
                chats[chatIndex].participants = chats[chatIndex].participants.filter(id => id !== currentUser.id);
                chats[chatIndex].subscriberCount = chats[chatIndex].participants.length;
                localStorage.setItem('absgram_chats', JSON.stringify(chats));
            }
            
            userSubscriptions.delete(channelId);
            showNotification('Вы отписались от канала', 'info');
            return;
        }
        
        const chatRef = doc(db, 'chats', channelId);
        await updateDoc(chatRef, {
            participants: arrayRemove(currentUser.id),
            subscriberCount: increment(-1),
            updatedAt: serverTimestamp()
        });
        
        userSubscriptions.delete(channelId);
        showNotification('Вы отписались от канала', 'info');
        loadChats();
        
    } catch (error) {
        console.error('Ошибка отписки от канала:', error);
        showNotification('Ошибка отписки', 'error');
    }
}

// ========== ФУНКЦИИ ДЛЯ ПОИСКА ==========
function searchMessages(query) {
    if (!query.trim()) {
        currentMessageSearch = { index: 0, results: [] };
        document.getElementById('searchMessagesCount').textContent = '';
        return;
    }

    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const messages = Array.from(container.children).filter(el => 
        el.classList.contains('message') && !el.classList.contains('call-message')
    );

    const results = [];
    const queryLower = query.toLowerCase();

    messages.forEach((msg, idx) => {
        const textEl = msg.querySelector('div:first-child');
        if (textEl && textEl.textContent.toLowerCase().includes(queryLower)) {
            results.push(idx);
            const originalText = textEl.textContent;
            const regex = new RegExp(`(${query})`, 'gi');
            textEl.innerHTML = originalText.replace(regex, '<mark style="background: var(--primary); color: white; padding: 2px 4px; border-radius: 3px;">$1</mark>');
        } else {
            const originalText = textEl?.textContent;
            if (textEl && originalText) {
                textEl.innerHTML = originalText;
            }
        }
    });

    currentMessageSearch = { index: 0, results };
    if (results.length > 0) {
        highlightSearchResult(results[0]);
    }
    document.getElementById('searchMessagesCount').textContent = results.length > 0 
        ? `${currentMessageSearch.index + 1}/${results.length}` 
        : '0';
}

function highlightSearchResult(index) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const messages = Array.from(container.children).filter(el => el.classList.contains('message'));
    messages.forEach(msg => msg.classList.remove('search-highlight'));
    if (messages[index]) {
        messages[index].classList.add('search-highlight');
        messages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function nextSearchResult() {
    if (currentMessageSearch.results.length === 0) return;
    currentMessageSearch.index = (currentMessageSearch.index + 1) % currentMessageSearch.results.length;
    highlightSearchResult(currentMessageSearch.results[currentMessageSearch.index]);
    document.getElementById('searchMessagesCount').textContent = 
        `${currentMessageSearch.index + 1}/${currentMessageSearch.results.length}`;
}

function prevSearchResult() {
    if (currentMessageSearch.results.length === 0) return;
    currentMessageSearch.index = (currentMessageSearch.index - 1 + currentMessageSearch.results.length) % currentMessageSearch.results.length;
    highlightSearchResult(currentMessageSearch.results[currentMessageSearch.index]);
    document.getElementById('searchMessagesCount').textContent = 
        `${currentMessageSearch.index + 1}/${currentMessageSearch.results.length}`;
}

// ========== ФУНКЦИИ ДЛЯ СТАТУСА ПОЛЬЗОВАТЕЛЯ ==========
function setupChatUserStatusListener() {
    if (!currentChat || currentChat.isGroup || currentChat.isChannel || !currentChat.otherUser) return;
    
    try {
        const userRef = doc(db, 'users', currentChat.otherUser.id);
        
        const unsubscribe = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                const isOnline = isUserOnline(userData.lastActive);
                
                if (currentChat && currentChat.otherUser) {
                    currentChat.otherUser.isOnline = isOnline;
                    currentChat.otherUser.lastActive = userData.lastActive;
                    updateChatStatus(currentChat.otherUser);
                }
            }
        });
        
        return unsubscribe;
    } catch (error) {
        console.error('Ошибка слушателя статуса пользователя:', error);
    }
}

function setupTypingListener(chatId) {
    if (!chatId || typingListeners.has(chatId) || authError) return;
    
    try {
        const typingRef = collection(db, 'typing');
        const q = query(typingRef, where('chatId', '==', chatId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const data = change.doc.data();
                if (data.userId !== currentUser.id) {
                    if (change.type === 'added' || change.type === 'modified') {
                        showTypingIndicator(data.userId, data.isTyping);
                    } else if (change.type === 'removed') {
                        hideTypingIndicator(data.userId);
                    }
                }
            });
        }, (error) => {
            console.warn('Ошибка слушателя набора текста:', error);
        });
        
        typingListeners.set(chatId, unsubscribe);
    } catch (error) {
        console.error('Ошибка настройки слушателя набора текста:', error);
    }
}

function showTypingIndicator(userId, isTyping) {
    if (!currentChat || currentChat.isGroup || currentChat.isChannel) return;
    
    const typingEl = document.getElementById('typingStatus');
    if (isTyping) {
        const userName = getUserDisplayName({ id: userId, name: 'Пользователь' });
        typingEl.querySelector('span').textContent = `${userName} печатает`;
        typingEl.classList.remove('hidden');
    } else {
        typingEl.classList.add('hidden');
    }
}

function hideTypingIndicator(userId) {
    const typingEl = document.getElementById('typingStatus');
    typingEl.classList.add('hidden');
}

async function updateTypingStatus(isTyping) {
    if (!currentChat || !currentUser || authError) return;
    
    if (typingTimeouts.has(currentChat.id)) {
        clearTimeout(typingTimeouts.get(currentChat.id));
    }
    
    try {
        const typingRef = collection(db, 'typing');
        const q = query(
            typingRef,
            where('chatId', '==', currentChat.id),
            where('userId', '==', currentUser.id)
        );
        
        const snapshot = await getDocs(q);
        
        if (isTyping) {
            if (snapshot.empty) {
                await addDoc(typingRef, {
                    chatId: currentChat.id,
                    userId: currentUser.id,
                    isTyping: true,
                    timestamp: serverTimestamp()
                });
            } else {
                snapshot.forEach(async (doc) => {
                    await updateDoc(doc.ref, {
                        isTyping: true,
                        timestamp: serverTimestamp()
                    });
                });
            }
            
            const timeout = setTimeout(() => {
                updateTypingStatus(false);
            }, 3000);
            typingTimeouts.set(currentChat.id, timeout);
            
        } else {
            snapshot.forEach(async (doc) => {
                await deleteDoc(doc.ref);
            });
        }
    } catch (error) {
        console.warn('Ошибка обновления статуса набора:', error);
    }
}

// ========== ФУНКЦИИ ДЛЯ НЕПРОЧИТАННЫХ СООБЩЕНИЙ ==========
function updateUnreadCounts() {
    if (!currentUser) return;
    
    if (authError) {
        // Локальный режим
        const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
        const unreadMap = new Map();
        
        messages.forEach(msg => {
            if (msg.senderId !== currentUser.id && !msg.read && msg.chatId) {
                unreadMap.set(msg.chatId, (unreadMap.get(msg.chatId) || 0) + 1);
            }
        });
        
        unreadCounts = unreadMap;
        updateChatListUnreadBadges();
        return;
    }
    
    try {
        const messagesQuery = query(
            collection(db, 'messages'),
            where('read', '==', false)
        );
        
        onSnapshot(messagesQuery, (snapshot) => {
            const unreadMap = new Map();
            
            snapshot.forEach(doc => {
                const message = doc.data();
                if (message.senderId !== currentUser.id && message.chatId) {
                    unreadMap.set(message.chatId, (unreadMap.get(message.chatId) || 0) + 1);
                }
            });
            
            unreadCounts = unreadMap;
            updateChatListUnreadBadges();
        });
    } catch (error) {
        console.error('Ошибка обновления непрочитанных сообщений:', error);
    }
}

function updateChatListUnreadBadges() {
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        if (item.dataset.chatId) {
            const chatId = item.dataset.chatId;
            const unreadCount = unreadCounts.get(chatId) || 0;
            
            const oldBadge = item.querySelector('.chat-unread-badge');
            if (oldBadge) {
                oldBadge.remove();
            }
            
            if (unreadCount > 0) {
                const badge = document.createElement('div');
                badge.className = 'chat-unread-badge';
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                const infoDiv = item.querySelector('.chat-info');
                if (infoDiv) {
                    infoDiv.appendChild(badge);
                }
            }
        }
    });
}

async function markMessagesAsRead(chatId) {
    if (!currentUser) return;
    
    try {
        if (authError) {
            // Локальный режим
            const messages = JSON.parse(localStorage.getItem('absgram_messages') || '[]');
            let updated = false;
            
            const updatedMessages = messages.map(msg => {
                if (msg.chatId === chatId && msg.senderId !== currentUser.id && !msg.read) {
                    msg.read = true;
                    updated = true;
                }
                return msg;
            });
            
            if (updated) {
                localStorage.setItem('absgram_messages', JSON.stringify(updatedMessages));
                unreadCounts.delete(chatId);
                updateChatListUnreadBadges();
            }
            return;
        }
        
        const messagesQuery = query(
            collection(db, 'messages'),
            where('chatId', '==', chatId),
            where('senderId', '!=', currentUser.id),
            where('read', '==', false)
        );
        
        const snapshot = await getDocs(messagesQuery);
        const updatePromises = [];
        
        snapshot.forEach(doc => {
            updatePromises.push(updateDoc(doc.ref, { read: true }));
        });
        
        await Promise.all(updatePromises);
        
        unreadCounts.delete(chatId);
        updateChatListUnreadBadges();
        
    } catch (error) {
        console.error('Ошибка пометки сообщений как прочитанных:', error);
    }
}

// ========== ФУНКЦИИ ДЛЯ ПОСТОВ ==========
async function createPost() {
    const postText = prompt('Введите текст поста (до 200 символов):');
    if (!postText || postText.trim() === '') return;
    
    showLoading(true);
    
    try {
        const post = {
            text: postText.trim(),
            createdAt: authError ? new Date().toISOString() : serverTimestamp(),
            userId: currentUser.id
        };
        
        if (authError) {
            // Локальный режим
            const localPosts = JSON.parse(localStorage.getItem('absgram_posts') || '[]');
            const newPost = {
                id: 'post_' + Date.now(),
                ...post,
                createdAt: new Date().toISOString()
            };
            localPosts.push(newPost);
            localStorage.setItem('absgram_posts', JSON.stringify(localPosts));
            
            const userPosts = posts.get(currentUser.id) || [];
            userPosts.unshift(newPost);
            if (userPosts.length > 10) userPosts.pop();
            posts.set(currentUser.id, userPosts);
        } else {
            await addDoc(collection(db, 'posts'), post);
            await loadUserPosts(currentUser.id);
        }
        
        updateProfile();
        showNotification('Пост добавлен в историю', 'success');
        
    } catch (error) {
        console.error('Ошибка создания поста:', error);
        showNotification('Ошибка создания поста', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadUserPosts(userId) {
    try {
        if (authError) {
            const localPosts = JSON.parse(localStorage.getItem('absgram_posts') || '[]');
            const userPosts = localPosts
                .filter(p => p.userId === userId)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 10);
            posts.set(userId, userPosts);
            return userPosts;
        } else {
            const postsQuery = query(
                collection(db, 'posts'),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const snapshot = await getDocs(postsQuery);
            const userPosts = [];
            snapshot.forEach(doc => {
                userPosts.push({ id: doc.id, ...doc.data() });
            });
            posts.set(userId, userPosts);
            return userPosts;
        }
    } catch (error) {
        console.error('Ошибка загрузки постов:', error);
        return [];
    }
}

// ========== ФУНКЦИИ ДЛЯ КОНТЕКСТНОГО МЕНЮ ==========
function showContextMenu(e) {
    const menu = document.getElementById('contextMenu');
    const buttonRect = e.target.getBoundingClientRect();
    const menuHeight = 200;
    const menuWidth = 250;
    
    let top = buttonRect.bottom + 5;
    let left = buttonRect.left;
    
    if (top + menuHeight > window.innerHeight) {
        top = buttonRect.top - menuHeight - 5;
    }
    
    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
    }
    
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.classList.remove('hidden');
}

async function viewUserProfile() {
    if (!currentChat || !currentChat.otherUser) return;
    
    try {
        showLoading(true);
        
        const userDoc = await getDoc(doc(db, 'users', currentChat.otherUser.id));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            viewedUserProfile = {
                id: currentChat.otherUser.id,
                ...userData
            };
            
            const container = document.getElementById('userProfileContent');
            const displayName = getUserDisplayName(viewedUserProfile);
            const isOnline = isUserOnline(userData.lastActive);
            
            let statusHTML = '';
            if (isOnline) {
                statusHTML = '<span class="user-status real-online">🟢 online</span>';
            } else if (userData.lastActive) {
                statusHTML = `<span class="user-status real-offline">⚫ был(а) ${formatLastSeen(userData.lastActive)}</span>`;
            } else {
                statusHTML = '<span class="user-status real-offline">⚫ не в сети</span>';
            }
            
            const userPosts = posts.get(viewedUserProfile.id) || [];
            let postsHTML = '';
            if (userPosts.length > 0) {
                postsHTML = userPosts.map(p => `
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 8px;">
                        <div style="color: var(--primary);">${p.text}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">${formatTime(p.createdAt)}</div>
                    </div>
                `).join('');
            } else {
                postsHTML = '<div style="color: var(--text-secondary);">У пользователя пока нет постов</div>';
            }
            
            const avatarStyle = userData.avatar 
                ? `background-image: url('${userData.avatar}'); background-size: cover; background-position: center;` 
                : `background: ${userData.avatarColor || getRandomColor()};`;
            
            container.innerHTML = `
                <div class="profile-header">
                    <div class="profile-avatar-container">
                        <div class="profile-avatar" style="${avatarStyle}">
                            ${userData.avatar ? '' : (userData.name || '?').charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div class="profile-name">${displayName}</div>
                    <div class="profile-username">@${userData.username}</div>
                    <div class="profile-status">
                        ${statusHTML}
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>Информация</h3>
                    <div class="info-item">
                        <div class="info-label">Имя</div>
                        <div class="info-value">${userData.name || 'Не указано'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Никнейм</div>
                        <div class="info-value">@${userData.username}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">ID пользователя</div>
                        <div class="info-value">${viewedUserProfile.id.substring(0, 8)}...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Дата регистрации</div>
                        <div class="info-value">${formatDate(userData.createdAt)}</div>
                    </div>
                </div>

                <div class="info-section">
                    <h3>📝 История</h3>
                    <div id="userPostsList">${postsHTML}</div>
                </div>
                
                <button class="btn" style="width: 100%; margin-top: 15px;" id="changeNicknameBtn">
                    ✏️ Изменить имя для себя
                </button>
            `;
            
            document.getElementById('changeNicknameBtn').addEventListener('click', () => {
                editContactNickname();
            });
            
            showScreen('userProfileScreen');
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showNotification('Ошибка загрузки профиля', 'error');
    } finally {
        showLoading(false);
    }
}

function editContactNickname() {
    if (!currentChat || !currentChat.otherUser) return;
    
    document.getElementById('contextMenu').classList.add('hidden');
    
    const currentNickname = getUserDisplayName(currentChat.otherUser);
    const newNickname = prompt('Введите новое имя для этого контакта (только для вас):', currentNickname);
    
    if (newNickname === null) return;
    
    if (newNickname.trim() === '') {
        saveUserNickname(currentChat.otherUser.id, null);
        showNotification('Имя удалено, будет отображаться оригинальное имя', 'info');
    } else {
        saveUserNickname(currentChat.otherUser.id, newNickname.trim());
        showNotification('Имя изменено', 'success');
    }
    
    if (currentChat) {
        document.getElementById('chatTitle').textContent = getUserDisplayName(currentChat.otherUser);
    }
    
    if (viewedUserProfile) {
        viewUserProfile();
    }
    
    loadChats();
}

async function clearChat() {
    document.getElementById('contextMenu').classList.add('hidden');
    
    if (!currentChat || !confirm('Очистить историю чата? Это действие нельзя отменить.')) return;
    
    try {
        showLoading(true);
        
        const messagesQuery = query(
            collection(db, 'messages'),
            where('chatId', '==', currentChat.id)
        );
        
        const snapshot = await getDocs(messagesQuery);
        const deletePromises = [];
        
        snapshot.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
        
        await updateDoc(doc(db, 'chats', currentChat.id), {
            lastMessage: 'Чат очищен',
            updatedAt: serverTimestamp()
        });
        
        showNotification('Чат очищен', 'success');
        
        loadMessages(currentChat.id);
        
    } catch (error) {
        console.error('Ошибка очистки чата:', error);
        showNotification('Ошибка очистки чата', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteChat() {
    document.getElementById('contextMenu').classList.add('hidden');
    
    if (!currentChat || !confirm('Удалить чат? Это действие нельзя отменить.')) return;
    
    try {
        showLoading(true);
        
        const messagesQuery = query(
            collection(db, 'messages'),
            where('chatId', '==', currentChat.id)
        );
        
        const snapshot = await getDocs(messagesQuery);
        const deletePromises = [];
        
        snapshot.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        
        deletePromises.push(deleteDoc(doc(db, 'chats', currentChat.id)));
        
        await Promise.all(deletePromises);
        
        showNotification('Чат удален', 'success');
        
        backToChats();
        loadChats();
        
    } catch (error) {
        console.error('Ошибка удаления чата:', error);
        showNotification('Ошибка удаления чата', 'error');
    } finally {
        showLoading(false);
    }
}

// ========== ФУНКЦИЯ ДЛЯ ПРИСОЕДИНЕНИЯ К ЗВОНКУ ==========
async function joinExistingCall(callId) {
    if (!callId) {
        showNotification('Неверный ID звонка', 'error');
        return;
    }
    
    if (activeCall) {
        showNotification('У вас уже есть активный звонок', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const callsQuery = query(
            collection(db, 'messages'),
            where('callId', '==', callId),
            where('type', '==', 'call'),
            limit(1)
        );
        
        const snapshot = await getDocs(callsQuery);
        if (snapshot.empty) {
            throw new Error('Звонок не найден');
        }
        
        const callDoc = snapshot.docs[0];
        const callData = { id: callDoc.id, ...callDoc.data() };
        
        const freshDoc = await getDoc(doc(db, 'messages', callDoc.id));
        if (!freshDoc.exists()) {
            throw new Error('Звонок не найден');
        }
        
        const freshData = freshDoc.data();
        if (!freshData.callActive) {
            throw new Error('Этот звонок уже завершен');
        }
        
        if (callData.senderId === currentUser.id) {
            showNotification('Это ваш собственный звонок', 'info');
            return;
        }
        
        const constraints = callData.callType === 'video' 
            ? { 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }, 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
              } 
            : { 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
              };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (callData.callType === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }
            document.getElementById('videoContainer').style.display = 'block';
            document.getElementById('audioCallContainer').style.display = 'none';
        } else {
            document.getElementById('videoContainer').style.display = 'none';
            document.getElementById('audioCallContainer').style.display = 'block';
        }
        
        currentCallId = callId;
        
        activeCall = {
            id: callId,
            chatId: callData.chatId,
            userId: callData.senderId,
            userName: callData.senderName,
            isIncoming: true,
            callType: callData.callType,
            startTime: new Date(),
            messageId: callData.id,
            stream: localStream
        };
        
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };
        
        setupPeerConnection(configuration, false);
        
        showActiveCallScreen(activeCall);
        startCallTimer();
        
        await updateDoc(doc(db, 'messages', callData.id), {
            answered: true,
            answeredAt: serverTimestamp(),
            callActive: true
        });
        
        showNotification('Вы присоединились к звонку', 'success');
        
    } catch (error) {
        console.error('Ошибка присоединения к звонку:', error);
        showNotification('Ошибка присоединения к звонку: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function init() {
    console.log("🚀 Инициализация AbSgram 8.0 HD...");
    initEventListeners();
    
    if (authError) {
        console.log("⚠️ Работаем в локальном режиме (офлайн)");
        const savedUser = localStorage.getItem('absgram_user_local');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showScreen('chatsScreen');
            loadChats();
            loadAllNicknames();
            updateUnreadCounts();
            loadCallsDisabledState();
        } else {
            showScreen('authScreen');
        }
        return;
    }
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("👤 Пользователь аутентифицирован:", user.uid);
            await loadUserData(user.uid);
            
            if (currentUser) {
                console.log("✅ Пользователь загружен успешно");
                showScreen('chatsScreen');
                await loadAllUsersForSearch();
                await loadChats();
                loadAllNicknames();
                requestNotificationPermission();
                setupCallListeners();
                updateUnreadCounts();
                loadCallsDisabledState();
                
                // Запускаем обновление статуса онлайн
                startOnlineStatusUpdater();
            }
        } else {
            console.log("🔒 Пользователь не аутентифицирован");
            
            const savedUser = localStorage.getItem('absgram_user');
            if (savedUser) {
                const userData = JSON.parse(savedUser);
                const now = Date.now();
                const savedTime = userData.timestamp;
                
                if (now - savedTime < 24 * 60 * 60 * 1000) {
                    console.log("📱 Используем локально сохраненного пользователя");
                    authError = true;
                    
                    const localUser = localStorage.getItem('absgram_user_local');
                    if (localUser) {
                        currentUser = JSON.parse(localUser);
                        showScreen('chatsScreen');
                        await loadChats();
                        loadAllNicknames();
                        updateUnreadCounts();
                        loadCallsDisabledState();
                    } else {
                        showScreen('authScreen');
                    }
                } else {
                    showScreen('authScreen');
                }
            } else {
                showScreen('authScreen');
            }
        }
    });
    
    console.log("✅ Инициализация завершена");
}

function initEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('showRegisterBtn').addEventListener('click', showRegister);
    document.getElementById('showLoginBtn').addEventListener('click', showLogin);

    document.getElementById('profileBtn').addEventListener('click', showProfile);
    document.getElementById('newChatBtn').addEventListener('click', showNewChatModal);
    document.getElementById('backToChatsBtn').addEventListener('click', backToChats);
    document.getElementById('backToChatsBtn2').addEventListener('click', backToChats);
    document.getElementById('backFromUserProfileBtn').addEventListener('click', () => {
        showScreen('chatScreen');
    });

    document.getElementById('searchUsersInput').addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(() => {
            searchUsersAndChannels(query);
        }, 300);
    });

    document.getElementById('singleSearchInput').addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(() => {
            searchUsersForChat(query, 'single');
        }, 300);
    });

    document.getElementById('groupSearchInput').addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(() => {
            searchUsersForChat(query, 'group');
        }, 300);
    });

    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    document.getElementById('attachBtn').addEventListener('click', () => {
        document.getElementById('fileUpload').click();
    });

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            
            const sendBtn = document.getElementById('sendMessageBtn');
            sendBtn.disabled = this.value.trim() === '';
            
            if (!authError && currentChat && !currentChat.isGroup && !currentChat.isChannel) {
                updateTypingStatus(this.value.trim() !== '');
            }
        });

        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    document.getElementById('videoMessageBtn').addEventListener('click', startVideoRecording);
    document.getElementById('recordStartBtn').addEventListener('click', startRecordingVideo);
    document.getElementById('recordStopBtn').addEventListener('click', stopRecordingVideo);
    document.getElementById('cameraSwitchBtn').addEventListener('click', switchCamera);
    document.getElementById('cancelVideoRecordingBtn').addEventListener('click', closeVideoRecordingModal);
    document.getElementById('sendVideoMessageBtn').addEventListener('click', sendVideoMessage);

    document.getElementById('editNameBtn').addEventListener('click', editName);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('showAvatarModalBtn').addEventListener('click', showAvatarModal);
    document.getElementById('createPostBtn').addEventListener('click', createPost);

    document.getElementById('avatarUpload').addEventListener('change', function(e) {
        handleAvatarUpload(e.target.files[0]);
    });

    document.getElementById('fileUpload').addEventListener('change', function(e) {
        handleFileUpload(e.target.files);
    });

    document.getElementById('cancelAvatarBtn').addEventListener('click', closeAvatarModal);
    document.getElementById('saveAvatarBtn').addEventListener('click', saveAvatar);
    document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
        document.getElementById('avatarUpload').click();
    });

    document.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function() {
            selectAvatar(this.dataset.color);
        });
    });

    document.getElementById('createGroupBtn').addEventListener('click', createGroup);
    document.getElementById('createChannelBtn').addEventListener('click', createChannel);
    document.getElementById('cancelGroupBtn').addEventListener('click', closeGroupModal);
    document.getElementById('groupInfoBtn').addEventListener('click', showGroupInfo);
    document.getElementById('channelInfoBtn').addEventListener('click', showChannelInfo);
    document.getElementById('closeGroupInfoBtn').addEventListener('click', closeGroupInfoModal);
    document.getElementById('closeChannelInfoBtn').addEventListener('click', closeChannelInfoModal);
    
    document.getElementById('uploadGroupAvatarBtn').addEventListener('click', () => {
        document.getElementById('groupAvatarUpload').click();
    });
    document.getElementById('groupAvatarUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showNotification('Разрешены только изображения', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showNotification('Файл должен быть меньше 10MB', 'error');
            return;
        }
        groupAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            tempGroupAvatar = event.target.result;
            const preview = document.getElementById('groupAvatarPreview');
            preview.style.backgroundImage = `url('${tempGroupAvatar}')`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    });
    
    document.getElementById('uploadChannelAvatarBtn').addEventListener('click', () => {
        document.getElementById('channelAvatarUpload').click();
    });
    document.getElementById('channelAvatarUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showNotification('Разрешены только изображения', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showNotification('Файл должен быть меньше 10MB', 'error');
            return;
        }
        channelAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            tempChannelAvatar = event.target.result;
            const preview = document.getElementById('channelAvatarPreview');
            preview.style.backgroundImage = `url('${tempChannelAvatar}')`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    });

    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabType = this.dataset.tab;
            switchTab(tabType);
        });
    });

    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.addEventListener('mousedown', startVoiceRecording);
        voiceBtn.addEventListener('touchstart', startVoiceRecording);
        voiceBtn.addEventListener('mouseup', stopVoiceRecording);
        voiceBtn.addEventListener('touchend', stopVoiceRecording);
        voiceBtn.addEventListener('mouseleave', stopVoiceRecording);
    }

    document.getElementById('disableCallBtn').addEventListener('click', toggleCallsDisabled);

    document.getElementById('callBtn').addEventListener('click', () => {
        if (isCallDisabled) {
            showNotification('Звонки отключены. Включите их в настройках.', 'warning');
            return;
        }
        showCallTypeModal();
    });

    document.getElementById('videoCallBtn').addEventListener('click', () => {
        if (isCallDisabled) {
            showNotification('Звонки отключены. Включите их в настройках.', 'warning');
            return;
        }
        selectedCallType = 'video';
        showCallTypeModal();
    });

    document.querySelectorAll('.call-type-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.call-type-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
            selectedCallType = this.dataset.type;
        });
    });

    document.getElementById('startCallWithTypeBtn').addEventListener('click', async () => {
        if (!currentChat || currentChat.isGroup || currentChat.isChannel) {
            showNotification('Звонки доступны только в личных чатах', 'error');
            return;
        }

        document.getElementById('callTypeModal').classList.add('hidden');
        await startCall();
    });

    document.getElementById('cancelCallTypeBtn').addEventListener('click', () => {
        document.getElementById('callTypeModal').classList.add('hidden');
    });

    document.getElementById('acceptCallBtn').addEventListener('click', async () => {
        if (incomingCallData) {
            await answerCall(incomingCallData);
            stopRingtone();
        }
    });

    document.getElementById('rejectCallBtn').addEventListener('click', async () => {
        if (incomingCallData) {
            await rejectCall(incomingCallData);
            stopRingtone();
        }
    });

    document.getElementById('endCallActiveBtnVideo').addEventListener('click', endCall);
    document.getElementById('endCallActiveBtnAudio').addEventListener('click', endCall);

    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('join-call-message-btn') || 
            e.target.closest('.join-call-message-btn')) {
            const btn = e.target.classList.contains('join-call-message-btn') ? 
                e.target : e.target.closest('.join-call-message-btn');
            const callId = btn.dataset.callId;
            
            if (callId && !activeCall) {
                await joinExistingCall(callId);
            }
        }
    });

    document.getElementById('contactOptionsBtn').addEventListener('click', function(e) {
        showContextMenu(e);
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#contextMenu') && !e.target.closest('#contactOptionsBtn')) {
            document.getElementById('contextMenu').classList.add('hidden');
        }
    });

    document.getElementById('viewProfileBtn').addEventListener('click', viewUserProfile);
    document.getElementById('editNicknameBtn').addEventListener('click', editContactNickname);
    document.getElementById('clearChatBtn').addEventListener('click', clearChat);
    document.getElementById('deleteChatBtn').addEventListener('click', deleteChat);

    document.getElementById('allowNotificationsBtn').addEventListener('click', async () => {
        const permission = await Notification.requestPermission();
        
        if (permission === "granted") {
            showPushNotification('Уведомления включены', 'Теперь вы будете получать уведомления о новых сообщениях и звонках');
            const registration = await navigator.serviceWorker.ready;
            await subscribeToPush(registration);
        }
        
        document.getElementById('notificationPermission').classList.add('hidden');
    });

    document.getElementById('laterNotificationsBtn').addEventListener('click', () => {
        document.getElementById('notificationPermission').classList.add('hidden');
        setTimeout(() => {
            notificationPermissionAsked = false;
        }, 24 * 60 * 60 * 1000);
    });

    document.getElementById('closeImagePreviewBtn').addEventListener('click', () => {
        document.getElementById('imagePreviewModal').classList.add('hidden');
    });

    document.getElementById('closeVideoPreviewBtn').addEventListener('click', () => {
        const video = document.getElementById('previewedVideo');
        video.pause();
        document.getElementById('videoPreviewModal').classList.add('hidden');
    });

    document.getElementById('closeVideoMessagePreviewBtn').addEventListener('click', () => {
        const video = document.getElementById('videoMessagePreview');
        video.pause();
        document.getElementById('videoMessagePreviewModal').classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });

    const searchInput = document.getElementById('searchMessagesInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchMessages(e.target.value);
            }, 500);
        });
    }
    document.getElementById('prevSearchBtn').addEventListener('click', prevSearchResult);
    document.getElementById('nextSearchBtn').addEventListener('click', nextSearchResult);

    document.getElementById('channelSubscribeBtn')?.addEventListener('click', async () => {
        const channelId = currentChat?.id;
        if (channelId) await subscribeToChannel(channelId);
    });
    document.getElementById('channelUnsubscribeBtn')?.addEventListener('click', async () => {
        const channelId = currentChat?.id;
        if (channelId) await unsubscribeFromChannel(channelId);
    });

    document.getElementById('muteCallBtnVideo').addEventListener('click', toggleMute);
    document.getElementById('muteCallBtnAudio').addEventListener('click', toggleMute);
    document.getElementById('speakerCallBtnVideo').addEventListener('click', toggleSpeaker);
    document.getElementById('speakerCallBtnAudio').addEventListener('click', toggleSpeaker);
    document.getElementById('videoToggleBtn').addEventListener('click', toggleVideo);

    document.getElementById('cancelReplyBtn').addEventListener('click', cancelReply);
    document.getElementById('profileAvatarContainer').addEventListener('click', () => {
        if (currentUser && currentUser.avatar) {
            previewImage(currentUser.avatar, 'Аватарка');
        }
    });

    // Обработчики для кастомных реакций
    document.getElementById('customReactionInput')?.addEventListener('input', function(e) {});
    document.getElementById('applyCustomReactionBtn')?.addEventListener('click', () => {
        const customReaction = document.getElementById('customReactionInput').value.trim();
        if (customReaction && currentReactionMessageId) {
            addReaction(currentReactionMessageId, customReaction);
        }
        document.getElementById('customReactionModal').classList.add('hidden');
        document.getElementById('customReactionInput').value = '';
    });
    document.getElementById('cancelCustomReactionBtn')?.addEventListener('click', () => {
        document.getElementById('customReactionModal').classList.add('hidden');
        document.getElementById('customReactionInput').value = '';
    });
    
    document.querySelectorAll('.custom-reaction-item').forEach(item => {
        item.addEventListener('click', function() {
            const emoji = this.textContent;
            document.getElementById('customReactionInput').value = emoji;
        });
    });
}

// Экспортируем функции для глобального доступа
window.playVoiceMessage = playVoiceMessage;
window.downloadVoiceMessage = downloadVoiceMessage;
window.downloadFileFromMessage = downloadFileFromMessage;
window.previewImage = previewImage;
window.previewVideo = previewVideo;
window.playVideoMessage = playVideoMessage;
window.downloadLargeFile = downloadLargeFile;
window.downloadLargeVideo = downloadLargeVideo;
window.previewLargeFile = previewLargeFile;
window.showEditMessageModal = showEditMessageModal;
window.addReaction = addReaction;
window.setReply = setReply;
window.deleteMessage = deleteMessage;
window.showCustomReactionModal = showCustomReactionModal;
window.saveFileToDevice = downloadFileFromMessage;
window.removeFromChannel = removeFromChannel;
window.closeChannelInfoModal = closeChannelInfoModal;

// Запуск приложения
init();
 