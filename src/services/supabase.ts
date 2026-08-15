import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define configuration storage keys
const URL_KEY = 'supabase_project_url';
const ANON_KEY = 'supabase_anon_key';

// Default Supabase credentials fallback (Empty by default unless user configures custom credentials)
export const DEFAULT_SUPABASE_URL = '';
export const DEFAULT_SUPABASE_ANON_KEY = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  let url = localStorage.getItem(URL_KEY) || '';
  let anonKey = localStorage.getItem(ANON_KEY) || '';

  // Fallback ONLY to real environment variables if localStorage is empty
  if (!url) {
    const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || 
                   ((import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL as string) || 
                   (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.NEXT_PUBLIC_SUPABASE_URL)) || '';
    if (envUrl) {
      url = envUrl;
    }
  }

  if (url) {
    url = url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
  }

  if (!anonKey) {
    const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || 
                   ((import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) || 
                   ((import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) || 
                   (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) || '';
    if (envKey) {
      anonKey = envKey;
    }
  }

  return {
    url: url.trim(),
    anonKey: anonKey.trim()
  };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  const oldUrl = localStorage.getItem(URL_KEY) || '';
  const oldKey = localStorage.getItem(ANON_KEY) || '';

  let formattedUrl = (config.url || '').trim();
  if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  if (formattedUrl) localStorage.setItem(URL_KEY, formattedUrl);
  else localStorage.removeItem(URL_KEY);

  if (config.anonKey) localStorage.setItem(ANON_KEY, config.anonKey.trim());
  else localStorage.removeItem(ANON_KEY);

  // If the credentials changed, reset the delta sync cache to force a full initial sync
  if (oldUrl.trim() !== formattedUrl || oldKey.trim() !== (config.anonKey || '').trim()) {
    console.log('[Delta Sync] Supabase configuration changed. Clearing delta sync cache.');
    localStorage.removeItem('_supabase_sync_hashes');
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseConfig();
  if (url && anonKey) {
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      const parsed = new URL(formattedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      supabaseInstance = createClient(formattedUrl, anonKey, {
        auth: {
          persistSession: false
        },
        global: {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`
          }
        }
      });
      return supabaseInstance;
    } catch (e) {
      console.warn('[Supabase] Client initialization skipped due to invalid URL or credentials:', e);
      return null;
    }
  }
  return null;
}

export function resetSupabaseInstance() {
  supabaseInstance = null;
}

// SQL Script generator for the user to copy-paste into Supabase SQL Editor
export const MIGRATION_SQL = `-- SKEMA DATABASE SUPABASE PRODUKSI "KELAS KU"
-- Copy script ini, buka Dashboard Supabase -> SQL Editor -> klik "New query" -> Paste & Run!

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('operator', 'guru_mapel', 'wali_kelas', 'siswa', 'ortu');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1. Profil Sekolah
CREATE TABLE IF NOT EXISTS public.profil_sekolah (
  id text PRIMARY KEY DEFAULT 'sch-001',
  nama_sekolah text NOT NULL,
  npsn text UNIQUE,
  alamat text,
  akreditasi text DEFAULT 'A',
  kepala_sekolah text,
  nip_kepala_sekolah text,
  logo_url text,
  tahun_pelajaran text DEFAULT '2025/2026',
  jalan text,
  rt_rw text,
  dusun text,
  desa text,
  kecamatan text,
  kabupaten text,
  provinsi text,
  kode_pos text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. Cleaning up Deprecated Tables
DROP TABLE IF EXISTS public.student_assignments CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.ppdb CASCADE;
DROP TABLE IF EXISTS public.news CASCADE;
DROP TABLE IF EXISTS public.gallery CASCADE;

-- 2. Data Guru
CREATE TABLE IF NOT EXISTS public.guru (
  id text PRIMARY KEY DEFAULT ('guru-' || extract(epoch from now())::bigint),
  nip text UNIQUE NOT NULL,
  nama_guru text NOT NULL,
  gelar text,
  mata_pelajaran_utama text,
  foto_url text,
  status_kepegawaian text DEFAULT 'PNS/P3K/Honor',
  password text NOT NULL DEFAULT 'guru123',
  is_wali_kelas boolean DEFAULT false,
  kelas_wali text,
  google_email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Data Kelas
CREATE TABLE IF NOT EXISTS public.data_kelas (
  id text PRIMARY KEY DEFAULT ('kelas-' || extract(epoch from now())::bigint),
  nama_kelas text UNIQUE NOT NULL,
  tingkat integer DEFAULT 4,
  wali_kelas_id text REFERENCES public.guru(id) ON DELETE SET NULL,
  tahun_ajaran text DEFAULT '2025/2026',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Data Siswa
CREATE TABLE IF NOT EXISTS public.siswa (
  id text PRIMARY KEY DEFAULT ('siswa-' || extract(epoch from now())::bigint),
  nisn text UNIQUE NOT NULL,
  nis text UNIQUE,
  nama_siswa text NOT NULL,
  jenis_kelamin text CHECK (jenis_kelamin IN ('L', 'P')),
  kelas text NOT NULL DEFAULT 'Kelas 4-A',
  kelas_id text REFERENCES public.data_kelas(id) ON DELETE SET NULL,
  alamat text,
  foto_url text,
  nama_ayah text,
  nama_ibu text,
  no_telepon_ortu text,
  email text,
  password text NOT NULL DEFAULT 'siswa123',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Data Orang Tua
CREATE TABLE IF NOT EXISTS public.orang_tua (
  id text PRIMARY KEY DEFAULT ('ortu-' || extract(epoch from now())::bigint),
  nama_ortu text NOT NULL,
  siswa_id text REFERENCES public.siswa(id) ON DELETE CASCADE,
  hubungan text DEFAULT 'Ayah/Ibu/Wali',
  no_telepon text,
  password text NOT NULL DEFAULT 'ortu123',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Mata Pelajaran
CREATE TABLE IF NOT EXISTS public.mata_pelajaran (
  id text PRIMARY KEY DEFAULT ('mapel-' || extract(epoch from now())::bigint),
  kode_mapel text UNIQUE NOT NULL,
  nama_mapel text NOT NULL,
  kkm integer NOT NULL DEFAULT 75,
  guru_pengampu_id text REFERENCES public.guru(id) ON DELETE SET NULL,
  kelas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Jadwal Pelajaran
CREATE TABLE IF NOT EXISTS public.jadwal_pelajaran (
  id text PRIMARY KEY DEFAULT ('jadwal-' || extract(epoch from now())::bigint),
  mapel_id text REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
  hari text NOT NULL,
  jam_mulai text NOT NULL,
  jam_selesai text NOT NULL,
  ruangan text DEFAULT 'Ruang Kelas',
  kelas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Absensi Siswa
CREATE TABLE IF NOT EXISTS public.absensi (
  id text PRIMARY KEY DEFAULT ('abs-' || extract(epoch from now())::bigint),
  siswa_id text REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
  tanggal text NOT NULL,
  status text NOT NULL,
  keterangan text,
  dicatat_oleh_id text REFERENCES public.guru(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_siswa_tanggal UNIQUE (siswa_id, tanggal)
);

-- 9. Daftar Tugas
CREATE TABLE IF NOT EXISTS public.daftar_tugas (
  id text PRIMARY KEY DEFAULT ('tugas-' || extract(epoch from now())::bigint),
  mapel_id text REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
  judul_tugas text NOT NULL,
  deskripsi text,
  google_form_url text NOT NULL,
  tanggal_diberikan text NOT NULL,
  tenggat_waktu text,
  dibuat_oleh_id text REFERENCES public.guru(id) ON DELETE SET NULL,
  kelas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Tugas Siswa
CREATE TABLE IF NOT EXISTS public.tugas_siswa (
  id text PRIMARY KEY DEFAULT ('ts-' || extract(epoch from now())::bigint),
  tugas_id text REFERENCES public.daftar_tugas(id) ON DELETE CASCADE NOT NULL,
  siswa_id text REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
  status_pengerjaan boolean DEFAULT false,
  status text DEFAULT 'BELUM_DIKERJAKAN',
  score numeric,
  nilai numeric,
  started_at timestamp with time zone,
  submitted_at timestamp with time zone,
  tanggal_dikerjakan text,
  umpan_balik text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_tugas_siswa UNIQUE (tugas_id, siswa_id)
);

-- 11. Penilaian (Substansi & Matrix Nilai Rapor)
CREATE TABLE IF NOT EXISTS public.penilaian (
  id text PRIMARY KEY DEFAULT ('pnl-' || extract(epoch from now())::bigint),
  siswa_id text REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
  mapel_id text REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
  tipe text NOT NULL DEFAULT 'harian',
  nama_penilaian text NOT NULL,
  nilai numeric NOT NULL CHECK (nilai >= 0 AND nilai <= 100),
  deskripsi_kompetensi text,
  tanggal_penilaian text NOT NULL,
  dinilai_oleh_id text REFERENCES public.guru(id) ON DELETE SET NULL,
  kelas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Temuan Khusus
CREATE TABLE IF NOT EXISTS public.temuan_khusus (
  id text PRIMARY KEY DEFAULT ('tk-' || extract(epoch from now())::bigint),
  siswa_id text REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
  tanggal text NOT NULL,
  kategori text NOT NULL,
  deskripsi text NOT NULL,
  tindakan_lanjut text,
  dilaporkan_oleh_id text REFERENCES public.guru(id) ON DELETE SET NULL,
  kelas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Notifikasi
CREATE TABLE IF NOT EXISTS public.notifikasi (
  id text PRIMARY KEY DEFAULT ('notif-' || extract(epoch from now())::bigint),
  penerima_role text NOT NULL,
  penerima_user_id text,
  judul text NOT NULL,
  pesan text NOT NULL,
  tanggal text NOT NULL,
  dibaca boolean DEFAULT false,
  tugas_id text REFERENCES public.daftar_tugas(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Application Settings
CREATE TABLE IF NOT EXISTS public.application_settings (
  id text PRIMARY KEY DEFAULT 'app-settings-001',
  theme text DEFAULT 'light',
  primary_color text,
  secondary_color text,
  website_title text,
  footer_text text,
  vision text,
  mission text,
  welcome_message text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Buku Digital
CREATE TABLE IF NOT EXISTS public.buku_digital (
  id text PRIMARY KEY DEFAULT ('book-' || extract(epoch from now())::bigint),
  judul text NOT NULL,
  kelas text NOT NULL DEFAULT 'Kelas 1',
  kategori_buku text DEFAULT 'buku_siswa',
  mapel_id text,
  mapel_nama text NOT NULL,
  file_url text NOT NULL,
  cover_url text,
  deskripsi text,
  penulis text,
  uploaded_by text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. Operator Credentials
CREATE TABLE IF NOT EXISTS public.operator_credentials (
  id text PRIMARY KEY DEFAULT 'op-001',
  username text UNIQUE NOT NULL DEFAULT 'operator',
  password text NOT NULL DEFAULT 'operator123',
  nama_operator text DEFAULT 'Operator Sekolah',
  email text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.operator_credentials (id, username, password, nama_operator)
VALUES ('op-001', 'operator', 'operator123', 'Operator Utama SD')
ON CONFLICT (id) DO NOTHING;

-- SUPABASE STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('logos', 'logos', true),
  ('teachers', 'teachers', true),
  ('students', 'students', true),
  ('documents', 'documents', true),
  ('assignments', 'assignments', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- GRANT PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profil_sekolah','guru','data_kelas','siswa','orang_tua',
    'mata_pelajaran','jadwal_pelajaran','absensi','daftar_tugas','tugas_siswa',
    'penilaian','temuan_khusus','notifikasi','application_settings','buku_digital','operator_credentials'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Public access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
`;

const VALID_COLUMNS: { [key: string]: string[] } = {
  profil_sekolah: [
    'id', 'nama_sekolah', 'npsn', 'alamat', 'akreditasi', 'kepala_sekolah', 'nip_kepala_sekolah', 'logo_url', 'daftar_kelas',
    'tahun_pelajaran', 'jalan', 'rt_rw', 'dusun', 'desa', 'kecamatan', 'kabupaten', 'provinsi', 'kode_pos'
  ],
  guru: ['id', 'nip', 'nama_guru', 'gelar', 'mata_pelajaran_utama', 'foto_url', 'status_kepegawaian', 'password', 'is_wali_kelas', 'kelas_wali', 'google_email'],
  siswa: ['id', 'nisn', 'nis', 'nama_siswa', 'jenis_kelamin', 'kelas', 'alamat', 'foto_url', 'nama_ayah', 'nama_ibu', 'no_telepon_ortu', 'password', 'email'],
  orang_tua: ['id', 'nama_ortu', 'siswa_id', 'hubungan', 'no_telepon', 'password', 'email'],
  profiles: ['id', 'full_name', 'email', 'username', 'role'],
  mata_pelajaran: ['id', 'kode_mapel', 'nama_mapel', 'kkm', 'guru_pengampu_id', 'kelas'],
  jadwal_pelajaran: ['id', 'mapel_id', 'hari', 'jam_mulai', 'jam_selesai', 'ruangan', 'kelas'],
  absensi: ['id', 'siswa_id', 'tanggal', 'status', 'keterangan', 'dicatat_oleh_id'],
  daftar_tugas: ['id', 'mapel_id', 'judul_tugas', 'deskripsi', 'google_form_url', 'tanggal_diberikan', 'tenggat_waktu', 'dibuat_oleh_id', 'kelas'],
  tugas_siswa: ['id', 'tugas_id', 'siswa_id', 'status_pengerjaan', 'status', 'started_at', 'submitted_at', 'score', 'tanggal_dikerjakan', 'nilai', 'umpan_balik'],
  penilaian: ['id', 'siswa_id', 'mapel_id', 'tipe', 'nama_penilaian', 'nilai', 'deskripsi_kompetensi', 'tanggal_penilaian', 'dinilai_oleh_id', 'kelas'],
  asesmen: ['id', 'siswa_id', 'mapel_id', 'tipe', 'nama_penilaian', 'nilai', 'deskripsi_kompetensi', 'tanggal_penilaian', 'dinilai_oleh_id', 'kelas'],
  temuan_khusus: ['id', 'siswa_id', 'tanggal', 'kategori', 'deskripsi', 'tindakan_lanjut', 'dilaporkan_oleh_id', 'kelas'],
  notifikasi: ['id', 'penerima_role', 'penerima_user_id', 'judul', 'pesan', 'tanggal', 'dibaca', 'tugas_id'],
  application_settings: ['id', 'theme', 'primary_color', 'secondary_color', 'website_title', 'footer_text', 'vision', 'mission', 'welcome_message'],
  buku_digital: ['id', 'judul', 'kelas', 'kategori_buku', 'mapel_id', 'mapel_nama', 'file_url', 'cover_url', 'deskripsi', 'penulis', 'uploaded_by', 'created_at'],
  operator_credentials: ['id', 'username', 'password', 'nama_operator', 'email', 'is_active', 'updated_at']
};

const DEFAULT_SISWA_NISNS: { [id: string]: string } = {
  'siswa-1': '0123456781',
  'siswa-2': '0123456782',
  'siswa-3': '0123456783',
  'siswa-4': '0123456784',
  'siswa-5': '0123456785'
};

export function getCanonicalSiswaId(siswaId: string): string {
  const rawSiswa = localStorage.getItem('siswa');
  if (!rawSiswa) return siswaId;

  try {
    const siswas = JSON.parse(rawSiswa);
    if (!Array.isArray(siswas)) return siswaId;

    // 1. Determine the NISN for the requested siswaId
    let targetNisn = '';
    const foundSiswa = siswas.find(s => s.id === siswaId);
    if (foundSiswa && foundSiswa.nisn) {
      targetNisn = foundSiswa.nisn.trim();
    } else {
      // Fallback: Check if the ID is a default ID known to map to a default NISN
      const fallbackNisn = DEFAULT_SISWA_NISNS[siswaId];
      if (fallbackNisn) {
        targetNisn = fallbackNisn.trim();
      }
    }

    if (!targetNisn) return siswaId;

    // 2. Find all students in local storage sharing this NISN
    const matchingSiswas = siswas.filter(s => s.nisn && s.nisn.trim() === targetNisn);
    if (matchingSiswas.length === 0) {
      return siswaId;
    }

    // 3. Sort matching students to pick the canonical one
    // We prefer a short ID starting with 'siswa-' and length < 10 (e.g. 'siswa-1')
    const sortedSiswas = [...matchingSiswas].sort((a, b) => {
      const aIsDefault = a.id && a.id.startsWith('siswa-') && a.id.length < 10;
      const bIsDefault = b.id && b.id.startsWith('siswa-') && b.id.length < 10;
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return a.id.localeCompare(b.id);
    });

    return sortedSiswas[0].id;
  } catch (e) {
    console.error('Error in getCanonicalSiswaId:', e);
    return siswaId;
  }
}

interface DbCache {
  siswas: { id: string; nisn: string; nama_siswa: string; email?: string }[];
  gurus: { id: string; nip: string; nama_guru: string }[];
  mapels: { id: string; kode_mapel: string; nama_mapel: string }[];
  tugases: { id: string; judul_tugas: string }[];
  lastFetch: number;
}

let dbCache: DbCache | null = null;

async function refreshDbCache(force = false): Promise<DbCache | null> {
  const now = Date.now();
  if (dbCache && !force && (now - dbCache.lastFetch < 10000)) {
    return dbCache;
  }

  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [siswasRes, gurusRes, mapelsRes, tugasesRes] = await Promise.all([
      client.from('siswa').select('id, nisn, nama_siswa, email'),
      client.from('guru').select('id, nip, nama_guru'),
      client.from('mata_pelajaran').select('id, kode_mapel, nama_mapel'),
      client.from('daftar_tugas').select('id, judul_tugas')
    ]);

    if (
      siswasRes.error?.code === 'PGRST205' ||
      gurusRes.error?.code === 'PGRST205' ||
      mapelsRes.error?.code === 'PGRST205' ||
      tugasesRes.error?.code === 'PGRST205'
    ) {
      console.warn('[Supabase Sync] Database tables do not exist in Supabase yet. SQL schema migration is required.');
      return null;
    }

    dbCache = {
      siswas: (siswasRes.data || []) as any[],
      gurus: (gurusRes.data || []) as any[],
      mapels: (mapelsRes.data || []) as any[],
      tugases: (tugasesRes.data || []) as any[],
      lastFetch: Date.now()
    };
    return dbCache;
  } catch (e) {
    console.warn('[Supabase Sync] Could not refresh DB cache:', e);
    return null;
  }
}

// Resilient upsert that automatically retries if a column is missing from the database schema
async function resilientUpsert(tableName: string, rawData: any, client: any): Promise<{ error: any }> {
  const validCols = VALID_COLUMNS[tableName];
  let pgData = { ...rawData };
  if (validCols) {
    const filtered: any = {};
    for (const col of validCols) {
      if (pgData[col] !== undefined) {
        filtered[col] = pgData[col];
      }
    }
    pgData = filtered;
  }

  const MAX_RETRIES = 10;
  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    attempts++;
    const { error } = await client.from(tableName).upsert(pgData);
    if (!error) {
      return { error: null };
    }

    // Stop immediately if table does not exist in schema cache
    if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
      return { error };
    }

    // Handle PGRST204 (Missing column in schema cache)
    if (error.code === 'PGRST204' || (error.message && error.message.includes("Could not find the") && error.message.includes("column"))) {
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (match) {
        const missingCol = match[1];
        console.warn(`Resilient Sync [${tableName}]: Stripping missing column '${missingCol}' from payload and retrying.`);
        delete pgData[missingCol];
        
        // Update valid columns list to avoid future attempts
        if (VALID_COLUMNS[tableName]) {
          VALID_COLUMNS[tableName] = VALID_COLUMNS[tableName].filter(c => c !== missingCol);
        }
        continue;
      }
    }

    return { error };
  }

  return { error: { message: `Max retries exceeded while stripping missing columns for ${tableName}` } };
}

async function ensureGuruExists(guruId: string, localGurus: any[]): Promise<string> {
  const cache = await refreshDbCache();
  if (!cache) return guruId;

  if (cache.gurus.some(g => g.id === guruId)) {
    return guruId;
  }

  const localGuru = localGurus.find(g => g.id === guruId);
  const localNip = localGuru?.nip?.trim();
  const localName = localGuru?.namaGuru?.trim();

  if (localNip) {
    const matchByNip = cache.gurus.find(g => g.nip && g.nip.trim() === localNip);
    if (matchByNip) return matchByNip.id;
  }

  if (localName) {
    const matchByName = cache.gurus.find(g => g.nama_guru && g.nama_guru.trim().toLowerCase() === localName.toLowerCase());
    if (matchByName) return matchByName.id;
  }

  const client = getSupabaseClient();
  if (client) {
    const placeholderNip = localNip || `TEMP-GURU-${Date.now()}`;
    const placeholderName = localName || `Guru Terhapus (${guruId})`;
    
    console.log(`Inserting placeholder guru ${guruId} (${placeholderName}) into DB...`);
    const { error } = await resilientUpsert('guru', {
      id: guruId,
      nip: placeholderNip,
      nama_guru: placeholderName,
      gelar: localGuru?.gelar || '',
      mata_pelajaran_utama: localGuru?.mataPelajaranUtama || '',
      status_kepegawaian: localGuru?.statusKepegawaian || 'GTT',
      password: localGuru?.password || 'guru123',
      is_wali_kelas: localGuru?.isWaliKelas || false
    }, client);

    if (!error) {
      cache.gurus.push({ id: guruId, nip: placeholderNip, nama_guru: placeholderName });
      return guruId;
    }
  }

  return guruId;
}

async function ensureSiswaExists(siswaId: string, localSiswas: any[]): Promise<string> {
  const cache = await refreshDbCache();
  if (!cache) return siswaId;

  // 1. Check if siswaId exists in database
  if (cache.siswas.some(s => s.id === siswaId)) {
    return siswaId;
  }

  // 2. Find local student info
  const localSiswa = localSiswas.find(s => s.id === siswaId);
  const localNisn = localSiswa?.nisn?.trim();
  const localName = localSiswa?.namaSiswa?.trim();
  const localEmail = localSiswa?.email?.trim().toLowerCase();

  // 3. Try matching by Email
  if (localEmail) {
    const matchByEmail = cache.siswas.find(s => s.email && s.email.trim().toLowerCase() === localEmail);
    if (matchByEmail) {
      console.log(`Matched local siswa_id ${siswaId} to DB siswa_id ${matchByEmail.id} by Email ${localEmail}`);
      return matchByEmail.id;
    }
  }

  // 4. Try matching by NISN
  if (localNisn) {
    const matchByNisn = cache.siswas.find(s => s.nisn && s.nisn.trim() === localNisn);
    if (matchByNisn) {
      console.log(`Matched local siswa_id ${siswaId} to DB siswa_id ${matchByNisn.id} by NISN ${localNisn}`);
      return matchByNisn.id;
    }
  }

  // 5. Try matching by Name
  if (localName) {
    const matchByName = cache.siswas.find(s => s.nama_siswa && s.nama_siswa.trim().toLowerCase() === localName.toLowerCase());
    if (matchByName) {
      console.log(`Matched local siswa_id ${siswaId} to DB siswa_id ${matchByName.id} by Name "${localName}"`);
      return matchByName.id;
    }
  }

  // 6. If not found, dynamically insert a placeholder student record in the DB
  const client = getSupabaseClient();
  if (client) {
    const placeholderNisn = localNisn || `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const placeholderName = localName || `Siswa Terhapus (${siswaId})`;
    
    console.log(`Inserting placeholder student ${siswaId} (${placeholderName}) into DB...`);
    const { error } = await resilientUpsert('siswa', {
      id: siswaId,
      nisn: placeholderNisn,
      nama_siswa: placeholderName,
      kelas: localSiswa?.kelas || 'Kelas 4-A',
      jenis_kelamin: localSiswa?.jenisKelamin || 'L',
      alamat: localSiswa?.alamat || '',
      nama_ayah: localSiswa?.namaAyah || '',
      nama_ibu: localSiswa?.namaIbu || '',
      no_telepon_ortu: localSiswa?.noTeleponOrtu || '',
      password: localSiswa?.password || 'siswa123',
      email: localEmail || `${siswaId}@sd.id`
    }, client);

    if (!error) {
      cache.siswas.push({ id: siswaId, nisn: placeholderNisn, nama_siswa: placeholderName });
      return siswaId;
    } else {
      if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
        console.warn(`[Supabase Sync] Skip inserting placeholder student ${siswaId}: table 'siswa' does not exist in Supabase yet.`);
      } else if (error.code === '42501' || (error.message && error.message.includes('row-level security policy'))) {
        console.warn(`[Supabase Sync] Skip inserting placeholder student ${siswaId}: RLS policy restriction on table 'siswa'.`);
      } else {
        console.warn(`[Supabase Sync] Skip inserting placeholder student ${siswaId}:`, error.message || error);
      }
    }
  }

  return siswaId;
}

async function ensureMapelExists(mapelId: string, localMapels: any[]): Promise<string> {
  const cache = await refreshDbCache();
  if (!cache) return mapelId;

  if (cache.mapels.some(m => m.id === mapelId)) {
    return mapelId;
  }

  const localMapel = localMapels.find(m => m.id === mapelId);
  const localKode = localMapel?.kodeMapel?.trim();
  const localName = localMapel?.namaMapel?.trim();

  if (localKode) {
    const matchByKode = cache.mapels.find(m => m.kode_mapel && m.kode_mapel.trim() === localKode);
    if (matchByKode) return matchByKode.id;
  }

  if (localName) {
    const matchByName = cache.mapels.find(m => m.nama_mapel && m.nama_mapel.trim().toLowerCase() === localName.toLowerCase());
    if (matchByName) return matchByName.id;
  }

  const client = getSupabaseClient();
  if (client) {
    const placeholderKode = localKode || `TEMP-MAPEL-${Date.now()}`;
    const placeholderName = localName || `Mapel Terhapus (${mapelId})`;
    
    const rawGuru = localStorage.getItem('guru');
    const localGurus = rawGuru ? JSON.parse(rawGuru) : [];
    let finalGuruId = localMapel?.guruPengampuId;
    if (finalGuruId) {
      finalGuruId = await ensureGuruExists(finalGuruId, localGurus);
    }

    console.log(`Inserting placeholder mapel ${mapelId} (${placeholderName}) into DB...`);
    const { error } = await resilientUpsert('mata_pelajaran', {
      id: mapelId,
      kode_mapel: placeholderKode,
      nama_mapel: placeholderName,
      kkm: localMapel?.kkm || 75,
      guru_pengampu_id: finalGuruId || null
    }, client);

    if (!error) {
      cache.mapels.push({ id: mapelId, kode_mapel: placeholderKode, nama_mapel: placeholderName });
      return mapelId;
    }
  }

  return mapelId;
}

async function ensureTugasExists(tugasId: string, localTugases: any[]): Promise<string> {
  const cache = await refreshDbCache();
  if (!cache) return tugasId;

  if (cache.tugases.some(t => t.id === tugasId)) {
    return tugasId;
  }

  const localTugas = localTugases.find(t => t.id === tugasId);
  const localTitle = localTugas?.judulTugas?.trim();

  if (localTitle) {
    const matchByTitle = cache.tugases.find(t => t.judul_tugas && t.judul_tugas.trim().toLowerCase() === localTitle.toLowerCase());
    if (matchByTitle) return matchByTitle.id;
  }

  const client = getSupabaseClient();
  if (client) {
    const placeholderTitle = localTitle || `Tugas Terhapus (${tugasId})`;
    
    const rawMapel = localStorage.getItem('mata_pelajaran');
    const localMapels = rawMapel ? JSON.parse(rawMapel) : [];
    let finalMapelId = localTugas?.mapelId;
    if (finalMapelId) {
      finalMapelId = await ensureMapelExists(finalMapelId, localMapels);
    }

    const rawGuru = localStorage.getItem('guru');
    const localGurus = rawGuru ? JSON.parse(rawGuru) : [];
    let finalGuruId = localTugas?.dibuatOlehId;
    if (finalGuruId) {
      finalGuruId = await ensureGuruExists(finalGuruId, localGurus);
    }

    console.log(`Inserting placeholder tugas ${tugasId} (${placeholderTitle}) into DB...`);
    const { error } = await resilientUpsert('daftar_tugas', {
      id: tugasId,
      mapel_id: finalMapelId || null,
      judul_tugas: placeholderTitle,
      deskripsi: localTugas?.deskripsi || '',
      google_form_url: localTugas?.googleFormUrl || 'https://forms.google.com',
      tanggal_diberikan: localTugas?.tanggalDiberikan || new Date().toISOString().split('T')[0],
      tenggat_waktu: localTugas?.tenggatWaktu || '',
      dibuat_oleh_id: finalGuruId || null
    }, client);

    if (!error) {
      cache.tugases.push({ id: tugasId, judul_tugas: placeholderTitle });
      return tugasId;
    }
  }

  return tugasId;
}

// Dynamic database upsert helper to sync a single row to a Supabase table with Delta Sync
export async function syncRowToSupabase(tableName: string, data: any, force = false): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Koneksi Supabase tidak diinisialisasi atau tidak aktif.' };

  try {
    // Convert camelCase keys to snake_case for PostgreSQL compatibility
    let pgData = transformKeysToSnakeCase(data);
    
    // Filter out columns that do not exist in the database table schema
    const validCols = VALID_COLUMNS[tableName];
    if (validCols) {
      const filteredData: any = {};
      for (const col of validCols) {
        if (pgData[col] !== undefined) {
          filteredData[col] = pgData[col];
        }
      }
      pgData = filteredData;
    }

    const rowKey = `${tableName}:${pgData.id || 'singleton'}`;
    const pgDataString = JSON.stringify(pgData);

    // Delta Sync Check: skip if data matches stored hash
    if (!force) {
      try {
        const rawHashes = localStorage.getItem('_supabase_sync_hashes');
        const syncHashes = rawHashes ? JSON.parse(rawHashes) : {};
        if (syncHashes[rowKey] === pgDataString) {
          console.log(`[Delta Sync] Skipping ${rowKey} - data unchanged.`);
          return { success: true, skipped: true };
        }
      } catch (e) {
        console.warn('Error reading delta sync hashes:', e);
      }
    }

    // Skip syncing duplicate non-canonical student records to avoid constraint conflicts and cascade deletes
    if (tableName === 'siswa' && pgData.id) {
      const canonicalId = getCanonicalSiswaId(pgData.id);
      if (canonicalId !== pgData.id) {
        console.log(`Skipping sync of non-canonical student record ${pgData.id} (canonical is ${canonicalId})`);
        return { success: true };
      }
    }

    // Map any student ID foreign keys to their canonical IDs and guarantee presence in the DB before database upsert
    if (pgData.siswa_id) {
      const rawSiswa = localStorage.getItem('siswa');
      const localSiswas = rawSiswa ? JSON.parse(rawSiswa) : [];
      const canonicalId = getCanonicalSiswaId(pgData.siswa_id);
      pgData.siswa_id = await ensureSiswaExists(canonicalId, localSiswas);
    }

    // Ensure referenced guru exists in database
    const guruIdKey = ['guru_pengampu_id', 'dicatat_oleh_id', 'dibuat_oleh_id', 'dinilai_oleh_id', 'dilaporkan_oleh_id'].find(k => pgData[k] !== undefined);
    if (guruIdKey && pgData[guruIdKey]) {
      const rawGuru = localStorage.getItem('guru');
      const localGurus = rawGuru ? JSON.parse(rawGuru) : [];
      pgData[guruIdKey] = await ensureGuruExists(pgData[guruIdKey], localGurus);
    }

    // Ensure referenced mapel exists in database
    if (pgData.mapel_id) {
      const rawMapel = localStorage.getItem('mata_pelajaran');
      const localMapels = rawMapel ? JSON.parse(rawMapel) : [];
      pgData.mapel_id = await ensureMapelExists(pgData.mapel_id, localMapels);
    }

    // Ensure referenced tugas exists in database
    if (pgData.tugas_id) {
      const rawTugas = localStorage.getItem('daftar_tugas');
      const localTugases = rawTugas ? JSON.parse(rawTugas) : [];
      pgData.tugas_id = await ensureTugasExists(pgData.tugas_id, localTugases);
    }

    // Resolve unique constraint conflicts before upserting (e.g. unique columns: nisn, nip, kode_mapel)
    if (tableName === 'siswa' && pgData.nisn) {
      const { data: existing, error: existingErr } = await client
        .from('siswa')
        .select('id')
        .eq('nisn', pgData.nisn)
        .maybeSingle();
      if (existingErr) {
        console.warn('Error checking existing student NISN:', existingErr);
      }
      if (existing && existing.id !== pgData.id) {
        console.log(`Resolving unique constraint conflict for siswa: nisn ${pgData.nisn} is already used by id ${existing.id}. Deleting old record...`);
        const { error: deleteErr } = await client.from('siswa').delete().eq('id', existing.id);
        if (deleteErr) console.error('Error deleting old student record:', deleteErr);
      }
    } else if (tableName === 'guru' && pgData.nip) {
      const { data: existing, error: existingErr } = await client
        .from('guru')
        .select('id')
        .eq('nip', pgData.nip)
        .maybeSingle();
      if (existingErr) {
        console.warn('Error checking existing guru NIP:', existingErr);
      }
      if (existing && existing.id !== pgData.id) {
        console.log(`Resolving unique constraint conflict for guru: nip ${pgData.nip} is already used by id ${existing.id}. Deleting old record...`);
        const { error: deleteErr } = await client.from('guru').delete().eq('id', existing.id);
        if (deleteErr) console.error('Error deleting old guru record:', deleteErr);
      }
    } else if (tableName === 'mata_pelajaran' && pgData.kode_mapel) {
      const { data: existing, error: existingErr } = await client
        .from('mata_pelajaran')
        .select('id')
        .eq('kode_mapel', pgData.kode_mapel)
        .maybeSingle();
      if (existingErr) {
        console.warn('Error checking existing mapel kode_mapel:', existingErr);
      }
      if (existing && existing.id !== pgData.id) {
        console.log(`Resolving unique constraint conflict for mata_pelajaran: kode_mapel ${pgData.kode_mapel} is already used by id ${existing.id}. Deleting old record...`);
        const { error: deleteErr } = await client.from('mata_pelajaran').delete().eq('id', existing.id);
        if (deleteErr) console.error('Error deleting old mapel record:', deleteErr);
      }
    }

    const { error } = await resilientUpsert(tableName, pgData, client);
    if (error) {
      if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
        console.warn(`[Supabase Sync] Tabel '${tableName}' belum dibuat di Supabase. Silakan jalankan Skema SQL di Supabase SQL Editor.`);
        return { success: false, error: `Tabel '${tableName}' belum ada di Supabase. Jalankan skema SQL terlebih dahulu.` };
      }
      if (error.code === '42501' || (error.message && error.message.includes('row-level security policy'))) {
        console.warn(`[Supabase Sync] Penulisan ke tabel '${tableName}' dibatasi oleh kebijakan Row Level Security (RLS) di Supabase.`);
        return { success: false, error: `Row Level Security (RLS) di tabel '${tableName}' membatasi akses.` };
      }
      if (error.message && error.message.includes('Failed to fetch')) {
        console.warn(`[Supabase Sync] Gagal terhubung ke server Supabase untuk tabel '${tableName}': Network Error.`);
        return { success: false, error: 'Gagal terhubung ke Supabase (network error).' };
      }
      const errorMsg = `[Supabase Sync] Warning syncing row to ${tableName}: ${error.message || ''} | Details: ${error.details || ''} | Code: ${error.code || ''}`;
      console.warn(errorMsg, error);
      return { success: false, error: error.message || 'API Error' };
    }

    // Save delta sync hash on successful push
    try {
      const rawHashes = localStorage.getItem('_supabase_sync_hashes');
      const syncHashes = rawHashes ? JSON.parse(rawHashes) : {};
      syncHashes[rowKey] = pgDataString;
      localStorage.setItem('_supabase_sync_hashes', JSON.stringify(syncHashes));
    } catch (e) {
      console.warn('Error writing delta sync hash:', e);
    }

    return { success: true };
  } catch (e: any) {
    const errorMsg = `[Supabase Sync] Exception syncing row to ${tableName}: ${e?.message || ''}`;
    console.warn(errorMsg, e);
    return { success: false, error: e?.message || 'Exception occurred' };
  }
}

// Dynamic database delete helper to delete a single row from a Supabase table
export async function deleteRowFromSupabase(tableName: string, id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Koneksi Supabase tidak diinisialisasi atau tidak aktif.' };

  try {
    const { error } = await client.from(tableName).delete().eq('id', id);
    if (error) {
      if (error.code === '42501' || (error.message && error.message.includes('row-level security policy'))) {
        console.warn(`[Supabase Sync] Penghapusan baris di '${tableName}' dibatasi oleh RLS policy.`);
      } else {
        console.warn(`[Supabase Sync] Warning deleting row from ${tableName} with id ${id}:`, error.message);
      }
      return { success: false, error: error.message };
    }

    // Remove deleted row from sync hashes cache
    try {
      const rawHashes = localStorage.getItem('_supabase_sync_hashes');
      if (rawHashes) {
        const syncHashes = JSON.parse(rawHashes);
        const rowKey = `${tableName}:${id}`;
        if (syncHashes[rowKey]) {
          delete syncHashes[rowKey];
          localStorage.setItem('_supabase_sync_hashes', JSON.stringify(syncHashes));
        }
      }
    } catch (e) {
      console.warn('Error removing deleted row hash:', e);
    }

    return { success: true };
  } catch (e: any) {
    console.warn(`[Supabase Sync] Exception deleting row from ${tableName} with id ${id}:`, e?.message);
    return { success: false, error: e?.message || 'Exception occurred' };
  }
}

// Transform camelCase object to snake_case keys for database matching
function transformKeysToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => transformKeysToSnakeCase(v));
  } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      result[snakeKey] = transformKeysToSnakeCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

export interface SyncResults {
  [key: string]: { success: number; failed: number; total: number; skipped?: number; errors?: string[] };
}

export async function syncAllToSupabase(): Promise<{ success: boolean; results?: SyncResults; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Koneksi Supabase tidak aktif. Silakan periksa URL dan API Key Anda.' };
  }

  const tablesToSync = [
    { name: 'profil_sekolah', isArray: false },
    { name: 'guru', isArray: true },
    { name: 'siswa', isArray: true },
    { name: 'orang_tua', isArray: true },
    { name: 'mata_pelajaran', isArray: true },
    { name: 'jadwal_pelajaran', isArray: true },
    { name: 'absensi', isArray: true },
    { name: 'daftar_tugas', isArray: true },
    { name: 'tugas_siswa', isArray: true },
    { name: 'penilaian', isArray: true },
    { name: 'temuan_khusus', isArray: true },
    { name: 'notifikasi', isArray: true },
    { name: 'application_settings', isArray: false },
    { name: 'buku_digital', isArray: true },
    { name: 'operator_credentials', isArray: true }
  ];

  const results: SyncResults = {};
  let overallSuccess = true;

  console.log('Starting sync of all tables to Supabase with Delta Sync...');
  
  // Force-refresh the DB cache of existing records to guarantee up-to-date validation
  await refreshDbCache(true);

  for (const table of tablesToSync) {
    results[table.name] = { success: 0, failed: 0, total: 0, skipped: 0, errors: [] };
    const rawData = localStorage.getItem(table.name);
    if (!rawData) {
      console.warn(`Sync skipped for table "${table.name}": no data found in localStorage.`);
      continue;
    }

    try {
      const parsed = JSON.parse(rawData);
      if (table.isArray && Array.isArray(parsed)) {
        results[table.name].total = parsed.length;
        console.log(`Syncing table "${table.name}" with ${parsed.length} rows...`);
        for (const item of parsed) {
          const res = await syncRowToSupabase(table.name, item);
          if (res.success) {
            results[table.name].success++;
            if (res.skipped) {
              results[table.name].skipped = (results[table.name].skipped || 0) + 1;
            }
          } else {
            results[table.name].failed++;
            overallSuccess = false;
            if (res.error && !results[table.name].errors?.includes(res.error)) {
              results[table.name].errors?.push(res.error);
            }
          }
        }
        console.log(`Finished table "${table.name}": ${results[table.name].success} succeeded (${results[table.name].skipped} unchanged), ${results[table.name].failed} failed.`);
      } else if (!table.isArray && parsed && typeof parsed === 'object') {
        results[table.name].total = 1;
        console.log(`Syncing single object for table "${table.name}"...`);
        const res = await syncRowToSupabase(table.name, parsed);
        if (res.success) {
          results[table.name].success++;
          if (res.skipped) {
            results[table.name].skipped = 1;
          }
          console.log(`Finished table "${table.name}": succeeded.`);
        } else {
          results[table.name].failed++;
          overallSuccess = false;
          if (res.error && !results[table.name].errors?.includes(res.error)) {
            results[table.name].errors?.push(res.error);
          }
          console.log(`Finished table "${table.name}": failed.`);
        }
      } else {
        console.warn(`Sync skipped for table "${table.name}": data format is invalid (expected ${table.isArray ? 'array' : 'object'}).`);
      }
    } catch (e: any) {
      console.error(`Error parsing or syncing local storage key '${table.name}':`, e);
      overallSuccess = false;
      results[table.name].errors?.push(e?.message || 'JSON Parse Error');
    }
  }

  console.log(`Sync completed. Overall success: ${overallSuccess}`);
  return { success: overallSuccess, results };
}

// Transform snake_case keys back to camelCase keys for localStorage matching
export function transformKeysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => transformKeysToCamelCase(v));
  } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = transformKeysToCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

// Download/pull all tables from Supabase database to synchronize local application storage
export async function pullAllFromSupabase(options?: { overwriteIfEmpty?: boolean }): Promise<{
  success: boolean;
  pulledCount?: number;
  details?: Record<string, number>;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Koneksi Supabase tidak aktif. Silakan periksa URL dan API Key Anda.' };
  }

  const tablesToPull = [
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
    { dbName: 'temuan_khusus', localName: 'temuan_khusus', isArray: true },
    { dbName: 'notifikasi', localName: 'notifikasi', isArray: true },
    { dbName: 'application_settings', localName: 'app_settings', isArray: false },
    { dbName: 'buku_digital', localName: 'buku_digital', isArray: true },
    { dbName: 'operator_credentials', localName: 'operator_credentials', isArray: true }
  ];

  let totalPulledRecords = 0;
  const details: Record<string, number> = {};
  const errors: string[] = [];
  let successfulTables = 0;

  try {
    for (const table of tablesToPull) {
      try {
        const { data, error } = await client.from(table.dbName).select('*');
        if (error) {
          console.warn(`[Supabase Pull] Table "${table.dbName}" notice:`, error.message || error);
          // Don't treat missing non-critical table (e.g. PGRST205) as fatal to all
          errors.push(`${table.dbName}: ${error.message || 'Gagal query'}`);
          continue;
        }

        successfulTables++;

        if (data !== null && data !== undefined) {
          // Strip out metadata fields like 'created_at' if any
          const cleanedData = Array.isArray(data)
            ? data.map(({ created_at, ...rest }) => rest)
            : data;

          const transformed = transformKeysToCamelCase(cleanedData);

          if (table.isArray) {
            const count = Array.isArray(transformed) ? transformed.length : 0;
            details[table.dbName] = count;
            totalPulledRecords += count;

            if (Array.isArray(transformed) && transformed.length > 0) {
              localStorage.setItem(table.localName, JSON.stringify(transformed));
            } else if (options?.overwriteIfEmpty) {
              localStorage.setItem(table.localName, '[]');
            } else {
              // If remote table is empty and overwriteIfEmpty is false, check if local already has data
              const existing = localStorage.getItem(table.localName);
              if (!existing || existing === '[]') {
                localStorage.setItem(table.localName, '[]');
              } else {
                console.log(`[Supabase Pull] Preserved existing local data for "${table.localName}" because remote table is empty.`);
              }
            }
          } else {
            // Single object table (e.g. profil_sekolah, app_settings)
            if (Array.isArray(transformed) && transformed.length > 0) {
              details[table.dbName] = 1;
              totalPulledRecords += 1;
              localStorage.setItem(table.localName, JSON.stringify(transformed[0]));
            } else if (transformed && typeof transformed === 'object' && Object.keys(transformed).length > 0) {
              details[table.dbName] = 1;
              totalPulledRecords += 1;
              localStorage.setItem(table.localName, JSON.stringify(transformed));
            } else {
              details[table.dbName] = 0;
            }
          }

          // Update delta sync hashes for the pulled data to prevent redundant future pushes
          try {
            const rawHashes = localStorage.getItem('_supabase_sync_hashes');
            const syncHashes = rawHashes ? JSON.parse(rawHashes) : {};
            const items = Array.isArray(cleanedData) ? cleanedData : [cleanedData];
            
            for (const item of items) {
              if (!item) continue;
              const validCols = VALID_COLUMNS[table.dbName];
              let filteredItem: any = {};
              if (validCols) {
                for (const col of validCols) {
                  if (item[col] !== undefined) {
                    filteredItem[col] = item[col];
                  }
                }
              } else {
                filteredItem = item;
              }
              const rowKey = `${table.dbName}:${filteredItem.id || 'singleton'}`;
              syncHashes[rowKey] = JSON.stringify(filteredItem);
            }
            localStorage.setItem('_supabase_sync_hashes', JSON.stringify(syncHashes));
          } catch (e) {
            console.warn(`Error updating delta sync hashes for pulled table: ${table.dbName}`, e);
          }
        }
      } catch (tableErr: any) {
        console.warn(`[Supabase Pull] Exception pulling table ${table.dbName}:`, tableErr);
        errors.push(`${table.dbName}: ${tableErr?.message || 'Error'}`);
      }
    }

    // Refresh memory cache so internal references stay updated
    try {
      await refreshDbCache(true);
    } catch {
      // Non-blocking
    }

    if (successfulTables === 0 && errors.length > 0) {
      return {
        success: false,
        error: `Gagal menarik data: ${errors[0] || 'Koneksi ke Supabase terputus.'}`,
        details
      };
    }

    return {
      success: true,
      pulledCount: totalPulledRecords,
      details
    };
  } catch (e: any) {
    console.error('Exception during pull from Supabase:', e);
    return { success: false, error: e?.message || 'Terjadi kesalahan saat mengunduh data dari Supabase.' };
  }
}

export const OPERATOR_SQL_SCRIPT = `-- SCRIPT SKEMA TABEL OPERATOR SUPABASE
-- Salin script ini, buka Dashboard Supabase -> SQL Editor -> Klik "New Query" -> Paste & Run!

CREATE TABLE IF NOT EXISTS public.operator_credentials (
  id text PRIMARY KEY DEFAULT 'op-001',
  username text UNIQUE NOT NULL DEFAULT 'operator',
  password text NOT NULL DEFAULT 'operator123',
  nama_operator text DEFAULT 'Operator Sekolah',
  email text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Akun Operator Default
INSERT INTO public.operator_credentials (id, username, password, nama_operator)
VALUES ('op-001', 'operator', 'operator123', 'Operator Utama SD')
ON CONFLICT (id) DO NOTHING;

-- Kebijakan Keamanan (Row Level Security)
ALTER TABLE public.operator_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public operator access" ON public.operator_credentials;
CREATE POLICY "Public operator access" ON public.operator_credentials FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
`;

export async function getOperatorCredentialsFromSupabase(): Promise<{ username: string; password: string; namaOperator?: string } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('operator_credentials')
      .select('*')
      .limit(1);

    if (!error && data && data.length > 0) {
      return {
        username: data[0].username || 'operator',
        password: data[0].password || 'operator123',
        namaOperator: data[0].nama_operator || 'Operator Sekolah'
      };
    }
  } catch (e) {
    console.warn('[Supabase] Fetch operator_credentials error:', e);
  }
  return null;
}

export async function saveOperatorCredentialsToSupabase(username: string, password?: string, namaOperator?: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password ? password.trim() : undefined;

    const payload: any = {
      id: 'op-001',
      username: cleanUsername,
      updated_at: new Date().toISOString()
    };
    if (cleanPassword) payload.password = cleanPassword;
    if (namaOperator) payload.nama_operator = namaOperator;

    let { error } = await client
      .from('operator_credentials')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      // Fallback try direct update
      const resUpdate = await client
        .from('operator_credentials')
        .update(payload)
        .eq('id', 'op-001');
      error = resUpdate.error;
    }

    if (!error) {
      console.log('✅ Operator credentials synced to Supabase successfully.');
      return true;
    } else {
      console.warn('Gagal menyimpan operator credentials ke Supabase:', error.message);
    }
  } catch (e) {
    console.warn('Exception saveOperatorCredentialsToSupabase:', e);
  }
  return false;
}
