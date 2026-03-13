import * as admin from "firebase-admin";

let app: admin.app.App | null = null;

export function getFirebaseAdmin() {
  if (app) {
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey && projectId) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    return app;
  }

  app = admin.initializeApp(projectId ? { projectId } : undefined);
  return app;
}
