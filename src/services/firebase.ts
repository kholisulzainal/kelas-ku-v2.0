import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { getDb, getCustomFirebaseConfig, resetFirebaseInstances, isFirebaseDisconnected, FirebaseCustomConfig } from './firebaseClient';
import { db } from './db';

export function isFirebaseConfigured(): boolean {
  if (isFirebaseDisconnected()) return false;
  const custom = getCustomFirebaseConfig();
  if (custom && custom.projectId && custom.projectId.trim()) return true;
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

export function getStoredFirebaseConfig(): FirebaseCustomConfig | null {
  return getCustomFirebaseConfig();
}

// Convert Firestore Document ID safe string
export function sanitizeDocId(id: string | number): string {
  return String(id).replace(/[\/\#\?\[\]]/g, '_');
}

/**
 * Timeout wrapper for Promise to prevent hanging on Firestore network stalls
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function formatFirebaseError(err: any): string {
  if (!err) return 'Terjadi kesalahan pada koneksi Firestore.';
  const msg = String(err?.message || err);
  const code = String(err?.code || '');

  if (code.includes('permission-denied') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient permissions')) {
    return 'Izin Ditolak (Security Rules): Database Firestore belum mengizinkan akses. Solusi: Buka Firebase Console > Firestore Database > Rules, ubah menjadi "allow read, write: if true;" lalu klik Publish.';
  }
  if (code.includes('not-found') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('database does not exist') || msg.toLowerCase().includes('project not found')) {
    return 'Database atau Project ID tidak ditemukan di Firebase Console. Pastikan Anda sudah membuat Firestore Database pada menu Build > Firestore Database di Firebase Console.';
  }
  if (code.includes('unauthenticated') || code.includes('invalid-api-key') || msg.toLowerCase().includes('api key not valid')) {
    return 'API Key tidak valid atau Project ID salah. Silakan periksa kembali Web API Key di Project Settings Firebase Console.';
  }
  if (code.includes('unavailable') || msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('failed to get document') || msg.toLowerCase().includes('channel closed')) {
    return 'Koneksi ke Firestore terputus atau ditolak. Pastikan database Firestore sudah dibuat di Firebase Console dan rules mengizinkan akses.';
  }
  if (code.includes('resource-exhausted')) {
    return 'Batas kuota harian Firebase Firestore terlampaui (Resource Exhausted).';
  }
  if (msg.includes('Timeout') || msg.includes('timeout') || msg.includes('Waktu koneksi habis')) {
    return 'Waktu koneksi habis (Timeout). Penyebab umum: Database Firestore belum dibuat di Firebase Console, atau Security Rules belum diatur (allow read, write: if true;), atau Project ID belum terdaftar.';
  }
  if (msg.includes('network') || msg.toLowerCase().includes('fetch')) {
    return 'Gagal terhubung ke jaringan Firestore (Network Error). Pastikan Project ID benar dan database Firestore sudah dibuat di Firebase Console.';
  }
  return msg;
}

/**
 * Ping/Test connection to Firebase Firestore with fast REST check + SDK fallback
 */
export async function testFirebaseConnection(timeoutMs = 5000): Promise<{ success: boolean; latencyMs?: number; message: string }> {
  if (isFirebaseDisconnected()) {
    return {
      success: false,
      message: 'Firebase dalam status terputus (Disconnected / Mode Lokal Offline).'
    };
  }
  const startTime = Date.now();
  const customConfig = getCustomFirebaseConfig();
  const projectId = customConfig?.projectId || (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '';
  const apiKey = customConfig?.apiKey || (import.meta.env.VITE_FIREBASE_API_KEY as string) || '';

  if (!projectId || !projectId.trim()) {
    return {
      success: false,
      message: 'Firebase belum terkonfigurasi. Masukkan Project ID di tab Konfigurasi lalu klik Simpan.'
    };
  }

  // 1. Fast HTTP REST check to directly query Firestore endpoint and get instant, accurate diagnosis
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(timeoutMs, 4000));

    const restUrl = apiKey
      ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId.trim())}/databases/(default)/documents?key=${encodeURIComponent(apiKey.trim())}`
      : `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId.trim())}/databases/(default)/documents`;

    const res = await fetch(restUrl, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;

    if (res.status === 200) {
      return {
        success: true,
        latencyMs: latency,
        message: `Koneksi Firestore Berhasil & Siap Digunakan (${latency} ms)`
      };
    } else if (res.status === 403 || res.status === 401) {
      const errorJson = await res.json().catch(() => null);
      const errMsg = errorJson?.error?.message || '';
      if (errMsg.toLowerCase().includes('api key not valid')) {
        return {
          success: false,
          message: 'API Key tidak valid. Silakan periksa kembali Web API Key di Project Settings Firebase Console.'
        };
      }
      return {
        success: false,
        message: 'Izin Ditolak (Security Rules): Database Firestore belum mengizinkan akses baca/tulis. Buka Firebase Console > Firestore Database > Rules, ubah menjadi "allow read, write: if true;" lalu klik Publish.'
      };
    } else if (res.status === 404) {
      return {
        success: false,
        message: `Database Firestore belum dibuat untuk project "${projectId}". Buka Firebase Console > Build > Firestore Database > klik Create Database.`
      };
    }
  } catch (restErr: any) {
    if (restErr.name === 'AbortError') {
      return {
        success: false,
        message: 'Waktu koneksi habis (Timeout). Pastikan Project ID benar dan database Firestore sudah dibuat di Firebase Console.'
      };
    }
    // Continue to SDK fallback test if network fetch encountered CORS
  }

  // 2. SDK Test fallback
  const firestore = getDb();
  if (!firestore) {
    return {
      success: false,
      message: 'Gagal menginisialisasi instance Firestore SDK. Pastikan Project ID benar.'
    };
  }

  try {
    const pingDocRef = doc(firestore, '_system_health', 'ping');
    const testPayload = {
      lastPing: new Date().toISOString(),
      status: 'online',
      clientVersion: 'kelas-ku-v2.0',
      timestamp: Date.now()
    };

    // Test Write with timeout
    await withTimeout(
      setDoc(pingDocRef, testPayload, { merge: true }),
      timeoutMs,
      'Waktu koneksi habis (Timeout). Pastikan Project ID benar, database Firestore sudah diaktifkan di Firebase Console, dan Rules mengizinkan write.'
    );

    const latency = Date.now() - startTime;
    return {
      success: true,
      latencyMs: latency,
      message: `Koneksi Firestore Berhasil (${latency} ms)`
    };
  } catch (err: any) {
    console.warn('[Firebase Test Connection Diagnostic]:', err?.message || err);
    return {
      success: false,
      message: formatFirebaseError(err)
    };
  }
}

/**
 * Sync single row / object to Firebase Firestore collection
 */
export async function syncRowToFirebase(collectionName: string, docId: string | number, data: any): Promise<boolean> {
  const firestore = getDb();
  if (!firestore) return false;

  try {
    const cleanId = sanitizeDocId(docId || data.id || data.nisn || data.NISN || data.nip || data.NIP || Date.now());
    const docRef = doc(firestore, collectionName, cleanId);
    
    // Clean undefined values which Firestore disallows
    const cleanData = JSON.parse(JSON.stringify({
      ...data,
      _syncedAt: new Date().toISOString()
    }));

    await withTimeout(
      setDoc(docRef, cleanData, { merge: true }),
      5000,
      `Timeout syncing document to ${collectionName}`
    );
    return true;
  } catch (error) {
    console.warn(`[Firebase Sync Notice] ${collectionName}/${docId}:`, error);
    return false;
  }
}

/**
 * Delete a document from Firestore
 */
export async function deleteRowFromFirebase(collectionName: string, docId: string | number): Promise<boolean> {
  const firestore = getDb();
  if (!firestore) return false;

  try {
    const cleanId = sanitizeDocId(docId);
    const docRef = doc(firestore, collectionName, cleanId);
    await withTimeout(
      deleteDoc(docRef),
      5000,
      `Timeout deleting document from ${collectionName}`
    );
    return true;
  } catch (error) {
    console.warn(`[Firebase Delete Notice] ${collectionName}/${docId}:`, error);
    return false;
  }
}

/**
 * Upload all local database collections to Firebase Firestore in batches
 */
export async function pushAllToFirebase(): Promise<{ success: boolean; details: Record<string, number>; error?: string }> {
  const firestore = getDb();
  if (!firestore) {
    return { success: false, details: {}, error: 'Firebase Firestore belum terhubung. Periksa konfigurasi proyek.' };
  }

  const collectionsData: Record<string, any[]> = {
    sekolah_profile: [db.profilSekolah.get()],
    guru: db.guru.getAll(),
    siswa: db.siswa.getAll(),
    orang_tua: db.orangTua.getAll(),
    kelas: (() => {
      const stored = localStorage.getItem('daftar_kelas');
      if (stored) {
        try {
          return JSON.parse(stored).map((k: string, idx: number) => ({ id: `k-${idx}`, namaKelas: k }));
        } catch (e) {}
      }
      return [];
    })(),
    mata_pelajaran: db.mataPelajaran.getAll(),
    jadwal_pelajaran: db.jadwalPelajaran.getAll(),
    kehadiran: db.absensi.getAll(),
    daftar_tugas: db.daftarTugas.getAll(),
    tugas_siswa: db.tugasSiswa.getAll(),
    asesmen: db.asesmen.getAll(),
    penilaian: db.penilaian.getAll(),
    temuan_khusus: db.temuanKhusus.getAll(),
    buku_digital: db.bukuDigital.getAll(),
    operator_credentials: [{
      id: 'op-001',
      username: db.operatorCredentials.get().username,
      password: db.operatorCredentials.get().password,
      nama_operator: 'Operator Utama SD',
      updated_at: new Date().toISOString()
    }]
  };

  const details: Record<string, number> = {};

  try {
    for (const [colName, rows] of Object.entries(collectionsData)) {
      if (!Array.isArray(rows) || rows.length === 0) {
        details[colName] = 0;
        continue;
      }

      // Process in batches of 300 to avoid Firestore limits & buffer overflow
      const chunkSize = 300;
      let count = 0;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);
        let batchHasItems = false;

        for (const item of chunk) {
          if (!item) continue;
          const rawId = item.id || item.nisn || item.NISN || item.nip || item.NIP || `item-${count}`;
          const cleanId = sanitizeDocId(rawId);
          if (!cleanId) continue;

          const docRef = doc(firestore, colName, cleanId);

          const safeData = JSON.parse(JSON.stringify({
            ...item,
            _syncedAt: new Date().toISOString()
          }));

          try {
            batch.set(docRef, safeData, { merge: true });
            batchHasItems = true;
            count++;
          } catch (itemErr) {
            // If individual doc fails, try direct setDoc as fallback
            try {
              await setDoc(docRef, safeData, { merge: true });
              count++;
            } catch (singleErr) {
              console.warn(`[Firebase Doc Sync Fallback Failed] ${colName}/${cleanId}:`, singleErr);
            }
          }
        }

        if (batchHasItems) {
          try {
            await withTimeout(
              batch.commit(),
              10000,
              `Timeout mengunggah batch ke koleksi ${colName}`
            );
          } catch (commitErr: any) {
            console.warn(`[Firebase Batch Commit Warning on ${colName}]:`, commitErr);
            // Fallback: Individual setDoc
            for (const item of chunk) {
              const cId = sanitizeDocId(item.id || item.nisn || item.nip || `f-${Date.now()}`);
              const dRef = doc(firestore, colName, cId);
              await setDoc(dRef, JSON.parse(JSON.stringify(item)), { merge: true });
            }
          }
        }
      } // end batch chunk

      details[colName] = count;
    }

    return { success: true, details };
  } catch (error: any) {
    console.error('[Firebase Push All Error]:', error);
    return { success: false, details, error: formatFirebaseError(error) };
  }
}

/**
 * Helper to parse Firestore REST documents to plain JavaScript objects
 */
function parseFirestoreRestDoc(docObj: any): any {
  if (!docObj) return null;
  const id = docObj.name ? docObj.name.split('/').pop() : undefined;
  const data = parseFirestoreRestFields(docObj.fields || {});
  return { id, ...data };
}

function parseFirestoreRestFields(fields: any): any {
  if (!fields || typeof fields !== 'object') return {};
  const obj: any = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = parseFirestoreRestValue(val);
  }
  return obj;
}

function parseFirestoreRestValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) return parseFirestoreRestFields(val.mapValue?.fields || {});
  if ('arrayValue' in val) {
    const values = val.arrayValue?.values || [];
    return values.map((v: any) => parseFirestoreRestValue(v));
  }
  return val;
}

/**
 * Fetch operator credentials directly from Firebase Firestore
 */
export async function getOperatorCredentialsFromFirebase(): Promise<{ username: string; password: string; namaOperator?: string } | null> {
  const firestore = getDb();
  const customConfig = getCustomFirebaseConfig();
  const projectId = customConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
  const apiKey = customConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '';

  // 1. Try SDK getDoc
  if (firestore) {
    try {
      const docRef = doc(firestore, 'operator_credentials', 'op-001');
      const docSnap = await withTimeout(getDoc(docRef), 3500, 'Timeout getting operator credential');
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          username: data.username || 'operator',
          password: data.password || 'operator123',
          namaOperator: data.nama_operator || 'Operator Utama SD'
        };
      }
    } catch (e) {
      console.warn('[Firebase] SDK operator fetch warning:', e);
    }
  }

  // 2. Try REST API fallback
  if (projectId) {
    try {
      const restItems = await fetchCollectionViaRest('operator_credentials', projectId, apiKey);
      if (restItems.length > 0) {
        const item = restItems[0];
        return {
          username: item.username || 'operator',
          password: item.password || 'operator123',
          namaOperator: item.nama_operator || 'Operator Utama SD'
        };
      }
    } catch (e) {
      console.warn('[Firebase] REST operator fetch warning:', e);
    }
  }

  return null;
}

/**
 * Fetch a collection via Firestore REST API as a robust fallback
 */
async function fetchCollectionViaRest(colName: string, projectId: string, apiKey?: string): Promise<any[]> {
  try {
    const cleanProject = projectId.trim();
    const restUrl = apiKey
      ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cleanProject)}/databases/(default)/documents/${encodeURIComponent(colName)}?key=${encodeURIComponent(apiKey.trim())}`
      : `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cleanProject)}/databases/(default)/documents/${encodeURIComponent(colName)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(restUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.status === 200) {
      const data = await res.json();
      if (Array.isArray(data.documents)) {
        return data.documents.map((d: any) => parseFirestoreRestDoc(d)).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn(`[Firebase REST Pull Warning] ${colName}:`, err);
  }
  return [];
}

/**
 * Pull all collections from Firestore and populate local storage
 */
export async function pullAllFromFirebase(): Promise<{ success: boolean; details: Record<string, number>; error?: string }> {
  const customConfig = getCustomFirebaseConfig();
  const projectId = customConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
  const apiKey = customConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '';

  if (!projectId || !projectId.trim()) {
    return { success: false, details: {}, error: 'Firebase Firestore belum terhubung. Periksa konfigurasi Project ID.' };
  }

  const firestore = getDb();

  const collections = [
    'sekolah_profile',
    'guru',
    'siswa',
    'orang_tua',
    'kelas',
    'mata_pelajaran',
    'jadwal_pelajaran',
    'kehadiran',
    'daftar_tugas',
    'tugas_siswa',
    'asesmen',
    'penilaian',
    'temuan_khusus',
    'buku_digital',
    'operator_credentials'
  ];

  const details: Record<string, number> = {};

  try {
    // Fetch all collections in parallel for fast execution
    const pullPromises = collections.map(async (colName) => {
      let items: any[] = [];

      // 1. Try SDK getDocs
      if (firestore) {
        try {
          const colRef = collection(firestore, colName);
          const snapshot = await withTimeout(
            getDocs(colRef),
            5000,
            `Timeout SDK on ${colName}`
          );
          snapshot.forEach(docSnap => {
            items.push({ id: docSnap.id, ...docSnap.data() });
          });
        } catch (sdkErr) {
          console.warn(`[Firebase SDK Pull Notice] ${colName}:`, sdkErr);
        }
      }

      // 2. If SDK returned 0 items or failed, try REST API fallback
      if (items.length === 0 && projectId) {
        const restItems = await fetchCollectionViaRest(colName, projectId, apiKey);
        if (restItems.length > 0) {
          items = restItems;
        }
      }

      // Check alternate collection names if still empty
      if (items.length === 0) {
        const altName = colName === 'sekolah_profile' ? 'profil_sekolah' :
                        colName === 'kehadiran' ? 'absensi' :
                        colName === 'kelas' ? 'daftar_kelas' : null;
        if (altName) {
          if (firestore) {
            try {
              const altRef = collection(firestore, altName);
              const snapshot = await withTimeout(getDocs(altRef), 3000, `Timeout SDK on ${altName}`);
              snapshot.forEach(docSnap => {
                items.push({ id: docSnap.id, ...docSnap.data() });
              });
            } catch (e) {}
          }
          if (items.length === 0 && projectId) {
            const restItems = await fetchCollectionViaRest(altName, projectId, apiKey);
            if (restItems.length > 0) items = restItems;
          }
        }
      }

      return { colName, items };
    });

    const results = await Promise.allSettled(pullPromises);

    let totalFetched = 0;
    for (const res of results) {
      if (res.status === 'fulfilled') {
        const { colName, items } = res.value;
        details[colName] = items.length;
        totalFetched += items.length;

        if (items.length > 0) {
          if (colName === 'sekolah_profile' || colName === 'profil_sekolah') {
            const prof = items[0];
            localStorage.setItem('profil_sekolah', JSON.stringify(prof));
          } else if (colName === 'guru') {
            localStorage.setItem('guru', JSON.stringify(items));
          } else if (colName === 'siswa') {
            localStorage.setItem('siswa', JSON.stringify(items));
          } else if (colName === 'orang_tua') {
            localStorage.setItem('orang_tua', JSON.stringify(items));
          } else if (colName === 'kelas' || colName === 'daftar_kelas') {
            const classNames = items
              .map((k: any) => k.namaKelas || k.nama || k.name || (typeof k === 'string' ? k : null))
              .filter(Boolean);
            if (classNames.length > 0) {
              localStorage.setItem('daftar_kelas', JSON.stringify(classNames));
            }
          } else if (colName === 'mata_pelajaran') {
            localStorage.setItem('mata_pelajaran', JSON.stringify(items));
          } else if (colName === 'jadwal_pelajaran') {
            localStorage.setItem('jadwal_pelajaran', JSON.stringify(items));
          } else if (colName === 'kehadiran' || colName === 'absensi') {
            localStorage.setItem('absensi', JSON.stringify(items));
          } else if (colName === 'daftar_tugas') {
            localStorage.setItem('daftar_tugas', JSON.stringify(items));
          } else if (colName === 'tugas_siswa') {
            localStorage.setItem('tugas_siswa', JSON.stringify(items));
          } else if (colName === 'asesmen' || colName === 'penilaian') {
            localStorage.setItem('penilaian', JSON.stringify(items));
            localStorage.setItem('asesmen', JSON.stringify(items));
          } else if (colName === 'temuan_khusus') {
            localStorage.setItem('temuan_khusus', JSON.stringify(items));
          } else if (colName === 'buku_digital') {
            localStorage.setItem('buku_digital', JSON.stringify(items));
          } else if (colName === 'operator_credentials') {
            localStorage.setItem('operator_credentials', JSON.stringify(items));
          }
        }
      }
    }

    // Trigger local update events to instantly re-render UI
    window.dispatchEvent(new Event('school-profile-updated'));
    window.dispatchEvent(new Event('penilaians-updated'));
    window.dispatchEvent(new Event('asesmens-updated'));
    window.dispatchEvent(new CustomEvent('user-session-changed'));
    window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'all' } }));

    return { success: true, details };
  } catch (error: any) {
    console.error('[Firebase Pull All Error]:', error);
    return { success: false, details, error: formatFirebaseError(error) };
  }
}

const FIREBASE_REALTIME_STORAGE_KEY = 'firebase_realtime_sync_enabled';

export function isFirebaseRealtimeEnabled(): boolean {
  try {
    const val = localStorage.getItem(FIREBASE_REALTIME_STORAGE_KEY);
    if (val === null) return true; // Default to true if configured
    return val === 'true';
  } catch {
    return true;
  }
}

export function setFirebaseRealtimeEnabled(enabled: boolean) {
  try {
    localStorage.setItem(FIREBASE_REALTIME_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('firebase-realtime-status-changed', { detail: { enabled } }));
  } catch (e) {
    console.warn('Could not save firebase realtime preference:', e);
  }
}

let activeListeners: Unsubscribe[] = [];

export function isFirebaseRealtimeRunning(): boolean {
  return activeListeners.length > 0;
}

/**
 * Start listening to real-time changes in Firestore collections
 */
export function startFirebaseRealtimeSync(onUpdate?: (collection: string) => void): () => void {
  stopFirebaseRealtimeSync();

  const firestore = getDb();
  if (!firestore) return () => {};

  const collections = [
    'sekolah_profile',
    'siswa',
    'guru',
    'orang_tua',
    'mata_pelajaran',
    'jadwal_pelajaran',
    'kehadiran',
    'daftar_tugas',
    'tugas_siswa',
    'penilaian',
    'temuan_khusus',
    'notifikasi',
    'buku_digital',
    'operator_credentials'
  ];

  collections.forEach(colName => {
    try {
      const colRef = collection(firestore, colName);
      const unsub = onSnapshot(colRef, (snapshot) => {
        let hasChanges = false;

        snapshot.docChanges().forEach(change => {
          hasChanges = true;
          const data: any = { id: change.doc.id, ...change.doc.data() };

          if (colName === 'sekolah_profile') {
            if (change.type !== 'removed') {
              localStorage.setItem('profil_sekolah', JSON.stringify(data));
              window.dispatchEvent(new Event('school-profile-updated'));
            }
          } else if (colName === 'operator_credentials') {
            if (change.type !== 'removed') {
              localStorage.setItem('operator_credentials', JSON.stringify([data]));
            }
          } else if (colName === 'siswa') {
            const current = db.siswa.getAll();
            if (change.type === 'removed') {
              db.siswa.save(current.filter(s => s.id !== data.id));
            } else {
              const idx = current.findIndex(s => s.id === data.id || (data.nisn && s.nisn === data.nisn));
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.siswa.save(current);
            }
          } else if (colName === 'guru') {
            const current = db.guru.getAll();
            if (change.type === 'removed') {
              db.guru.save(current.filter(g => g.id !== data.id));
            } else {
              const idx = current.findIndex(g => g.id === data.id || (data.nip && g.nip === data.nip));
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.guru.save(current);
            }
          } else if (colName === 'orang_tua') {
            const current = db.orangTua.getAll();
            if (change.type === 'removed') {
              db.orangTua.save(current.filter(o => o.id !== data.id));
            } else {
              const idx = current.findIndex(o => o.id === data.id || (data.siswaId && o.siswaId === data.siswaId));
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.orangTua.save(current);
            }
          } else if (colName === 'mata_pelajaran') {
            const current = db.mataPelajaran.getAll();
            if (change.type === 'removed') {
              db.mataPelajaran.save(current.filter(m => m.id !== data.id));
            } else {
              const idx = current.findIndex(m => m.id === data.id || (data.kodeMapel && m.kodeMapel === data.kodeMapel));
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.mataPelajaran.save(current);
            }
          } else if (colName === 'jadwal_pelajaran') {
            const current = db.jadwalPelajaran.getAll();
            if (change.type === 'removed') {
              db.jadwalPelajaran.save(current.filter(j => j.id !== data.id));
            } else {
              const idx = current.findIndex(j => j.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.jadwalPelajaran.save(current);
            }
          } else if (colName === 'kehadiran') {
            const current = db.absensi.getAll();
            if (change.type === 'removed') {
              db.absensi.save(current.filter(a => a.id !== data.id));
            } else {
              const idx = current.findIndex(a => a.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.absensi.save(current);
            }
          } else if (colName === 'daftar_tugas') {
            const current = db.daftarTugas.getAll();
            if (change.type === 'removed') {
              db.daftarTugas.save(current.filter(t => t.id !== data.id));
            } else {
              const idx = current.findIndex(t => t.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.daftarTugas.save(current);
            }
          } else if (colName === 'tugas_siswa') {
            const current = db.tugasSiswa.getAll();
            if (change.type === 'removed') {
              db.tugasSiswa.save(current.filter(ts => ts.id !== data.id));
            } else {
              const idx = current.findIndex(ts => ts.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.tugasSiswa.save(current);
            }
          } else if (colName === 'penilaian') {
            const current = db.penilaian.getAll();
            if (change.type === 'removed') {
              db.penilaian.save(current.filter(p => p.id !== data.id));
            } else {
              const idx = current.findIndex(p => p.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.penilaian.save(current);
            }
            window.dispatchEvent(new Event('penilaians-updated'));
            window.dispatchEvent(new Event('asesmens-updated'));
          } else if (colName === 'temuan_khusus') {
            const current = db.temuanKhusus.getAll();
            if (change.type === 'removed') {
              db.temuanKhusus.save(current.filter(tk => tk.id !== data.id));
            } else {
              const idx = current.findIndex(tk => tk.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.temuanKhusus.save(current);
            }
          } else if (colName === 'notifikasi') {
            const current = db.notifikasi.getAll();
            if (change.type === 'removed') {
              db.notifikasi.save(current.filter(n => n.id !== data.id));
            } else {
              const idx = current.findIndex(n => n.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.notifikasi.save(current);
            }
          } else if (colName === 'buku_digital') {
            const current = db.bukuDigital.getAll();
            if (change.type === 'removed') {
              db.bukuDigital.save(current.filter(b => b.id !== data.id));
            } else {
              const idx = current.findIndex(b => b.id === data.id);
              if (idx >= 0) {
                current[idx] = { ...current[idx], ...data };
              } else {
                current.push(data);
              }
              db.bukuDigital.save(current);
            }
          }
        });

        if (hasChanges) {
          if (onUpdate) onUpdate(colName);
          window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: colName } }));
        }
      }, (error) => {
        console.warn(`[Firebase Realtime Listener Notice] ${colName}:`, error.message);
      });

      activeListeners.push(unsub);
    } catch (e) {
      console.warn(`[Firebase Listener Setup Error] ${colName}:`, e);
    }
  });

  return () => stopFirebaseRealtimeSync();
}

export function stopFirebaseRealtimeSync() {
  activeListeners.forEach(unsub => {
    try {
      unsub();
    } catch (e) {}
  });
  activeListeners = [];
}
