importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBRNl0xA5ie8EGcZ4UIdP0e1IJuacoMarE",
    authDomain: "gocklain-bf553.firebaseapp.com",
    projectId: "gocklain-bf553",
    storageBucket: "gocklain-bf553.firebasestorage.app",
    messagingSenderId: "747181228665",
    appId: "1:747181228665:web:bd9dd2cd60b1cd5bb8caa8",
    measurementId: "G-1LBP6KFPL9"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('📨 Получено фоновое сообщение:', payload);
    
    const notificationTitle = payload.notification?.title || '📱 AbSgram';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое сообщение',
        icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%23FF6B35\'/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%23FF6B35\'/%3E%3C/svg%3E',
        vibrate: [200, 100, 200],
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});