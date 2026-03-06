// Простой Service Worker для Push-уведомлений
self.addEventListener('install', (event) => {
    console.log('✅ SW устанавливается');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ SW активирован');
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('📨 Получен push');
    
    let data = {
        title: '📱 AbSgram',
        body: 'Новое сообщение',
        icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%23FF6B35\'/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%23FF6B35\'/%3E%3C/svg%3E',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            { action: 'open', title: '📱 Открыть' },
            { action: 'close', title: '❌ Закрыть' }
        ]
    };
    
    if (event.data) {
        try {
            const pushData = event.data.json();
            data.title = pushData.title || data.title;
            data.body = pushData.body || data.body;
            data.tag = pushData.tag || 'absgram-' + Date.now();
            data.data = pushData.data || {};
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, data)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    const urlToOpen = new URL('/', self.location.origin).href;
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});