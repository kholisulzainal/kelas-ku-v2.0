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
  { dbName: 'notifikasi', localName: 'notifikasi', isArray: true },
  { dbName: 'application_settings', localName: 'app_settings', isArray: false },
  { dbName: 'buku_digital', localName: 'buku_digital', isArray: true },
  { dbName: 'operator_credentials', localName: 'operator_credentials', isArray: true }
];

export function startRealtimeSync() {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Realtime Sync] Supabase Client is not active or credentials are not configured.');
    return null;
  }

  console.log('[Realtime Sync] Starting real-time Postgres changes channel subscription...');

  try {
    const channel = client.channel('supabase-realtime-sync-channel')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const { table, eventType, new: newRow, old: oldRow } = payload;
        console.log(`[Realtime Sync] Change detected on "${table}" (${eventType})`);

        const config = TABLES_CONFIG.find(t => t.dbName === table);
        if (!config) return;

        const localKey = config.localName;
        const isArray = config.isArray;

        try {
          if (!isArray) {
            if (eventType === 'DELETE') {
              // Gracefully keep default or remove
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

            if (eventType === 'INSERT' || eventType === 'UPDATE') {
              const { created_at, ...cleaned } = newRow || {};
              const camelRow = transformKeysToCamelCase(cleaned);
              
              const matchKey = (item: any) => {
                if (camelRow.id && item.id && item.id === camelRow.id) return true;
                if (camelRow.nisn && item.nisn && item.nisn === camelRow.nisn) return true;
                if (camelRow.nip && item.nip && item.nip === camelRow.nip) return true;
                if (camelRow.kodeMapel && item.kodeMapel && item.kodeMapel === camelRow.kodeMapel) return true;
                if (camelRow.username && item.username && item.username === camelRow.username) return true;
                return false;
              };

              const existingIdx = currentArray.findIndex(matchKey);
              if (existingIdx > -1) {
                currentArray[existingIdx] = camelRow;
              } else {
                currentArray.push(camelRow);
              }
            } else if (eventType === 'DELETE') {
              const oldId = oldRow?.id || oldRow?.nisn || oldRow?.NISN || oldRow?.nip || oldRow?.NIP || oldRow?.username;
              if (oldId) {
                currentArray = currentArray.filter((item: any) => {
                  const itemId = item.id || item.nisn || item.NISN || item.nip || item.NIP || item.username;
                  return String(itemId) !== String(oldId);
                });
              }
            }

            localStorage.setItem(localKey, JSON.stringify(currentArray));
          }

          // Update delta sync hash to prevent echo loops
          try {
            const rawHashes = localStorage.getItem('_supabase_sync_hashes');
            const syncHashes = rawHashes ? JSON.parse(rawHashes) : {};
            const activeRow = (newRow || oldRow) as any;
            if (activeRow) {
              const rowId = activeRow.id || 'singleton';
              const rowKey = `${table}:${rowId}`;
              if (eventType === 'DELETE') {
                delete syncHashes[rowKey];
              } else {
                syncHashes[rowKey] = JSON.stringify(activeRow);
              }
              localStorage.setItem('_supabase_sync_hashes', JSON.stringify(syncHashes));
            }
          } catch {
            // Delta hash update error is non-critical
          }

          // Dispatch a global event to trigger local state updates across components
          window.dispatchEvent(
            new CustomEvent('supabase-data-updated', { detail: { tableName: localKey } })
          );
        } catch (e) {
          console.warn('[Realtime Sync] Failed to process payload in localStorage:', e);
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime Sync] Realtime channel connected and active.');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime Sync] Channel subscription notice:', err?.message || status);
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime Sync] Subscription timed out, will retry on reconnection.');
        }
      });

    return () => {
      console.log('[Realtime Sync] Removing real-time Postgres changes channel subscription...');
      try {
        client.removeChannel(channel);
      } catch (e) {
        console.warn('[Realtime Sync] Error during channel removal:', e);
      }
    };
  } catch (err) {
    console.warn('[Realtime Sync] Exception initializing realtime subscription:', err);
    return null;
  }
}
