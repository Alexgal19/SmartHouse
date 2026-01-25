
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: "studio-6821761262-fdf39",
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
     console.error("Missing Firebase Admin credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY)");
  } else {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://studio-6821761262-fdf39-default-rtdb.europe-west1.firebasedatabase.app"
      });
  }
}

export const adminMessaging = admin.apps.length ? admin.messaging() : null;
