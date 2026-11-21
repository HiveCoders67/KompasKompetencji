import { getApps, initializeApp } from 'firebase-admin/app';
import { DocumentReference, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { decode, encode, type FirestoreAdapter } from '@kompas/domain';

if (!getApps().length) initializeApp();
export const db = getFirestore();

export const adapter: FirestoreAdapter = {
  ref: (collection, id) => db.collection(collection).doc(id),
  isRef: (v): v is DocumentReference => v instanceof DocumentReference,
  timestamp: (d) => Timestamp.fromDate(d),
  isTimestamp: (v): v is Timestamp => v instanceof Timestamp,
};

export const toData = (value: unknown) => encode(adapter, value) as FirebaseFirestore.DocumentData;
export const fromSnap = <T>(snap: FirebaseFirestore.DocumentSnapshot): T => decode<T>(adapter, snap.data(), snap.id);
