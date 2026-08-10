import { getSupabaseClient, transformKeysToCamelCase } from './supabase';

const TABLES_CONFIG = [
  { dbName: 'profil_sekolah', localName: 'profil_sekolah', isArray: false },
  { dbName: 'guru', localName: 'guru', isArray: true },
  { dbName: 'siswa', localName: 'siswa', isArray: true },
  { dbName: 'orang_tua', localName: 'orang_tua', isArray: true },
  { dbName: 'mata_pelajaran', localName: 'mata_pelajaran', isArray: true },
  { dbName: 'jadwal_pelajaran', localName: 'jadwal_pelajaran', isArray: true },
  { dbName: 'absensi', localName: 'absensi', isArray: true },
  { dbName: 'daftar_tugas', localName: 'daftar_tugas', isArray: true },
  { dbName: 'tugas_siswa', localName: 'tugas_siswa', isArray: true },
  { dbName: 'penilaian', localName: 'penilaian', isArray: true },
  { dbName: 'asesmen', localName: 'penilaian', isArray: true },
  { dbName: 'temuan_khusus', localName: 'temuan_khusus', isArray: true },
  { dbName: 'notifikasi', localName: 'notifikasi', isArray: true }
];

export function startRealtimeSync() {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Realtime Sync] Supabase Client is not active or credentials are not configured.');
    return null;
  }

  console.log('[Realtime Sync] Starting real-time Postgres changes channel subscription...');

  const channel = client.channel('supabase-realtime-sync-channel')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      const { table, eventType, new: newRow, old: oldRow } = payload;
      console.log(`[Realtime Sync] Change detected on "${table}" (${eventType}):`, payload);

      const config = TABLES_CONFIG.find(t => t.dbName === table);
      if (!config) return;

      const localKey = config.localName;
      const isArray = config.isArray;

      try {
        if (!isArray) {
          if (eventType === 'DELETE') {
            localStorage.removeItem(localKey);
          } else {
            const { created_at, ...cleaned } = newRow || {};
            const camelRow = transformKeysToCamelCase(cleaned);
            localStorage.setItem(localKey, JSON.stringify(camelRow));
          }
        } else {
          const currentDataRaw = localStorage.getItem(localKey);
          let currentArray = currentDataRaw ? JSON.parse(currentDataRaw) : [];
          if (!Array.isArray(currentArray)) currentArray = [];

          if (eventType === 'INSERT') {
            const { created_at, ...cleaned } = newRow || {};
            const camelRow = transformKeysToCamelCase(cleaned);
            const existingIdx = currentArray.findIndex((item: any) => item.id === camelRow.id);
            if (existingIdx > -1) {
              currentArray[existingIdx] = camelRow;
            } else {
              currentArray.push(camelRow);
            }
          } else if (eventType === 'UPDATE') {
            const { created_at, ...cleaned } = newRow || {};
            const camelRow = transformKeysToCamelCase(cleaned);
            const idx = currentArray.findIndex((item: any) => item.id === camelRow.id);
            if (idx > -1) {
              currentArray[idx] = camelRow;
            } else {
              currentArray.push(camelRow);
            }
          } else if (eventType === 'DELETE') {
            const oldId = oldRow?.id || oldRow?.NISN; // Handle primary keys appropriately
            if (oldId) {
              currentArray = currentArray.filter((item: any) => {
                const itemId = item.id || item.nisn;
                return String(itemId) !== String(oldId);
              });
            }
          }

          localStorage.setItem(localKey, JSON.stringify(currentArray));
        }

        // Dispatch a global event to trigger local state updates across components
        window.dispatchEvent(
          new CustomEvent('supabase-data-updated', { detail: { tableName: localKey } })
        );
      } catch (e) {
        console.error('[Realtime Sync] Failed to process payload in localStorage:', e);
      }
    })
    .subscribe((status) => {
      console.log(`[Realtime Sync] Subscription status: ${status}`);
    });

  return () => {
    console.log('[Realtime Sync] Removing real-time Postgres changes channel subscription...');
    client.removeChannel(channel);
  };
}
