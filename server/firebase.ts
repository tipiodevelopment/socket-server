import admin from 'firebase-admin';

let app: admin.app.App;

export function getFirebaseApp() {
  console.log("***** getFirebaseApp *****")
  if (!admin.apps.length) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });

    console.log('✅ Firebase initialized');
  } else {
    app = admin.app();
  }

  return app;
}