import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });
console.log('private_key:', process.env.private_key ? 'SET' : 'MISSING');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.project_id,
            clientEmail: process.env.client_email,
            privateKey: process.env.private_key!.replace(/\\n/g, '\n')
        })
    });
}

const db: Firestore = admin.firestore();

export { db };