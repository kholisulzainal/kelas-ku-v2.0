import { getSupabaseClient, syncRowToSupabase, deleteRowFromSupabase, isSupabaseDisconnected } from './supabase';
import { isFirebaseConfigured, syncRowToFirebase, deleteRowFromFirebase } from './firebase';

/**
 * Unified Table & Collection Name Mapping between Supabase (PostgreSQL) and Firebase (Firestore)
 */
export const TABLE_MAPPINGS: Record<string, { supabase: string; firebase: string }> = {
  profil_sekolah: { supabase: 'profil_sekolah', firebase: 'sekolah_profile' },
  sekolah_profile: { supabase: 'profil_sekolah', firebase: 'sekolah_profile' },
  guru: { supabase: 'guru', firebase: 'guru' },
  siswa: { supabase: 'siswa', firebase: 'siswa' },
  orang_tua: { supabase: 'orang_tua', firebase: 'orang_tua' },
  mata_pelajaran: { supabase: 'mata_pelajaran', firebase: 'mata_pelajaran' },
  jadwal_pelajaran: { supabase: 'jadwal_pelajaran', firebase: 'jadwal_pelajaran' },
  absensi: { supabase: 'absensi', firebase: 'kehadiran' },
  kehadiran: { supabase: 'absensi', firebase: 'kehadiran' },
  daftar_tugas: { supabase: 'daftar_tugas', firebase: 'daftar_tugas' },
  tugas_siswa: { supabase: 'tugas_siswa', firebase: 'tugas_siswa' },
  penilaian: { supabase: 'penilaian', firebase: 'penilaian' },
  asesmen: { supabase: 'penilaian', firebase: 'penilaian' },
  temuan_khusus: { supabase: 'temuan_khusus', firebase: 'temuan_khusus' },
  notifikasi: { supabase: 'notifikasi', firebase: 'notifikasi' },
  application_settings: { supabase: 'application_settings', firebase: 'application_settings' },
  app_settings: { supabase: 'application_settings', firebase: 'application_settings' },
  buku_digital: { supabase: 'buku_digital', firebase: 'buku_digital' },
  operator_credentials: { supabase: 'operator_credentials', firebase: 'operator_credentials' }
};

export interface SyncResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
  backends: {
    supabase?: { success: boolean; error?: string; skipped?: boolean };
    firebase?: { success: boolean; error?: string };
  };
}

/**
 * Check which remote database backends are currently configured and connected
 */
export function getActiveBackends() {
  const isSupabaseActive = !isSupabaseDisconnected() && getSupabaseClient() !== null;
  const isFirebaseActive = isFirebaseConfigured();

  let mode: 'supabase' | 'firebase' | 'both' | 'local' = 'local';
  if (isSupabaseActive && isFirebaseActive) {
    mode = 'both';
  } else if (isSupabaseActive) {
    mode = 'supabase';
  } else if (isFirebaseActive) {
    mode = 'firebase';
  }

  return {
    isSupabase: isSupabaseActive,
    isFirebase: isFirebaseActive,
    mode
  };
}

/**
 * Universal syncRow: Automatically dispatches row updates to the active database (Supabase, Firebase, or both).
 * Ensures googleFormUrl and googleSheetUrl are safely preserved in data.
 */
export async function syncRow(tableName: string, data: any, force = false): Promise<SyncResult> {
  const mapping = TABLE_MAPPINGS[tableName] || { supabase: tableName, firebase: tableName };
  const { isSupabase, isFirebase } = getActiveBackends();

  const result: SyncResult = {
    success: true,
    backends: {}
  };

  // Safe clone to prevent mutating the original caller's data
  const safeData = { ...data };

  // For daftar_tugas: explicitly preserve both links if provided
  if (mapping.supabase === 'daftar_tugas') {
    if (safeData.googleFormUrl) {
      safeData.googleFormUrl = String(safeData.googleFormUrl).trim();
    }
    if (safeData.googleSheetUrl !== undefined && safeData.googleSheetUrl !== null) {
      safeData.googleSheetUrl = String(safeData.googleSheetUrl).trim();
    }
  }

  // 1. Sync to Supabase if active
  if (isSupabase) {
    try {
      const spRes = await syncRowToSupabase(mapping.supabase, safeData, force);
      result.backends.supabase = {
        success: spRes.success,
        error: spRes.error,
        skipped: spRes.skipped
      };
      if (!spRes.success && spRes.error) {
        result.success = false;
        result.error = spRes.error;
      }
    } catch (err: any) {
      console.warn(`[Unified Sync] Supabase sync error on ${tableName}:`, err);
      result.backends.supabase = {
        success: false,
        error: err?.message || String(err)
      };
    }
  }

  // 2. Sync to Firebase Firestore if active
  if (isFirebase) {
    try {
      const docId = safeData.id || safeData.nisn || safeData.nip || 'singleton';
      const fbSuccess = await syncRowToFirebase(mapping.firebase, docId, safeData);
      result.backends.firebase = {
        success: fbSuccess,
        error: fbSuccess ? undefined : 'Gagal menyimpan dokumen ke Firebase Firestore'
      };
      if (!fbSuccess) {
        // If Supabase wasn't configured, mark overall result as failure
        if (!isSupabase) {
          result.success = false;
          result.error = 'Gagal menyimpan ke Firebase Firestore';
        }
      }
    } catch (err: any) {
      console.warn(`[Unified Sync] Firebase sync error on ${tableName}:`, err);
      result.backends.firebase = {
        success: false,
        error: err?.message || String(err)
      };
    }
  }

  // Dispatch custom sync event for UI components to listen to
  try {
    window.dispatchEvent(new CustomEvent('database-synced', {
      detail: {
        tableName,
        data: safeData,
        result
      }
    }));
    window.dispatchEvent(new CustomEvent('supabase-data-updated', {
      detail: { tableName: mapping.supabase }
    }));
  } catch (e) {
    // Ignore event dispatch errors in headless / non-DOM contexts
  }

  return result;
}

/**
 * Universal deleteRow: Deletes a document from whichever database backend is active
 */
export async function deleteRow(tableName: string, id: string | number): Promise<{ success: boolean; error?: string }> {
  const mapping = TABLE_MAPPINGS[tableName] || { supabase: tableName, firebase: tableName };
  const { isSupabase, isFirebase } = getActiveBackends();

  let overallSuccess = true;
  let errorMsg: string | undefined;

  if (isSupabase) {
    try {
      const spRes = await deleteRowFromSupabase(mapping.supabase, String(id));
      if (!spRes.success) {
        overallSuccess = false;
        errorMsg = spRes.error;
      }
    } catch (err: any) {
      console.warn(`[Unified Sync] Supabase delete error on ${tableName}:`, err);
    }
  }

  if (isFirebase) {
    try {
      const fbSuccess = await deleteRowFromFirebase(mapping.firebase, id);
      if (!fbSuccess && !isSupabase) {
        overallSuccess = false;
        errorMsg = 'Gagal menghapus dari Firebase Firestore';
      }
    } catch (err: any) {
      console.warn(`[Unified Sync] Firebase delete error on ${tableName}:`, err);
    }
  }

  try {
    window.dispatchEvent(new CustomEvent('database-synced', {
      detail: {
        tableName,
        deletedId: id
      }
    }));
    window.dispatchEvent(new CustomEvent('supabase-data-updated', {
      detail: { tableName: mapping.supabase }
    }));
  } catch (e) {}

  return { success: overallSuccess, error: errorMsg };
}
