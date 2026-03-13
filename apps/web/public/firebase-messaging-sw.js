importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'PLACEHOLDER',
  projectId: 'PLACEHOLDER',
  messagingSenderId: 'PLACEHOLDER',
  appId: 'PLACEHOLDER',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};

  if (title) {
    self.registration.showNotification(title, {
      body: body || '',
      icon: '/icon-192.png',
    });
  }
});
