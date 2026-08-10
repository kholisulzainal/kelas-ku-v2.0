-- ==============================================================================
-- SKEMA DATABASE SUPABASE UNTUK APLIKASI "KELAS KU"
-- Kurikulum Merdeka - Presensi, Nilai, Jadwal, Google Form Webhook, & Storage
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & ROLES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('operator', 'guru_mapel', 'wali_kelas', 'siswa', 'ortu');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. HAPUS TABEL USANG / DEPRECATED
DROP TABLE IF EXISTS public.student_assignments CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.ppdb CASCADE;
DROP TABLE IF EXISTS public.news CASCADE;
DROP TABLE IF EXISTS public.gallery CASCADE;

-- 4. TABEL UTAMA APLIKASI

-- A. Profil Sekolah
CREATE TABLE IF NOT EXISTS public.profil_sekolah (
    id TEXT PRIMARY KEY DEFAULT 'sch-001',
    nama_sekolah TEXT NOT NULL,
    npsn TEXT UNIQUE,
    alamat TEXT,
    akreditasi TEXT DEFAULT 'A',
    kepala_sekolah TEXT,
    nip_kepala_sekolah TEXT,
    logo_url TEXT,
    tahun_pelajaran TEXT DEFAULT '2025/2026',
    jalan TEXT,
    rt_rw TEXT,
    dusun TEXT,
    desa TEXT,
    kecamatan TEXT,
    kabupaten TEXT,
    provinsi TEXT,
    kode_pos TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- B. Data Guru
CREATE TABLE IF NOT EXISTS public.guru (
    id TEXT PRIMARY KEY DEFAULT ('guru-' || extract(epoch from now())::bigint),
    nip TEXT UNIQUE NOT NULL,
    nama_guru TEXT NOT NULL,
    gelar TEXT,
    mata_pelajaran_utama TEXT,
    foto_url TEXT,
    status_kepegawaian TEXT DEFAULT 'PNS/P3K/Honor',
    password TEXT NOT NULL DEFAULT 'guru123',
    is_wali_kelas BOOLEAN DEFAULT FALSE,
    kelas_wali TEXT,
    google_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- C. Data Kelas
CREATE TABLE IF NOT EXISTS public.data_kelas (
    id TEXT PRIMARY KEY DEFAULT ('kelas-' || extract(epoch from now())::bigint),
    nama_kelas TEXT UNIQUE NOT NULL,
    tingkat INTEGER DEFAULT 4,
    wali_kelas_id TEXT REFERENCES public.guru(id) ON DELETE SET NULL,
    tahun_ajaran TEXT DEFAULT '2025/2026',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- D. Data Siswa
CREATE TABLE IF NOT EXISTS public.siswa (
    id TEXT PRIMARY KEY DEFAULT ('siswa-' || extract(epoch from now())::bigint),
    nisn TEXT UNIQUE NOT NULL,
    nis TEXT UNIQUE,
    nama_siswa TEXT NOT NULL,
    jenis_kelamin TEXT CHECK (jenis_kelamin IN ('L', 'P')),
    kelas TEXT NOT NULL DEFAULT 'Kelas 4-A',
    kelas_id TEXT REFERENCES public.data_kelas(id) ON DELETE SET NULL,
    alamat TEXT,
    foto_url TEXT,
    nama_ayah TEXT,
    nama_ibu TEXT,
    no_telepon_ortu TEXT,
    email TEXT,
    password TEXT NOT NULL DEFAULT 'siswa123',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- E. Data Orang Tua
CREATE TABLE IF NOT EXISTS public.orang_tua (
    id TEXT PRIMARY KEY DEFAULT ('ortu-' || extract(epoch from now())::bigint),
    nama_ortu TEXT NOT NULL,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    hubungan TEXT DEFAULT 'Ayah/Ibu/Wali',
    no_telepon TEXT,
    email TEXT,
    password TEXT NOT NULL DEFAULT 'ortu123',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- F. Mata Pelajaran
CREATE TABLE IF NOT EXISTS public.mata_pelajaran (
    id TEXT PRIMARY KEY DEFAULT ('mapel-' || extract(epoch from now())::bigint),
    kode_mapel TEXT UNIQUE NOT NULL,
    nama_mapel TEXT NOT NULL,
    kkm INTEGER NOT NULL DEFAULT 75,
    guru_pengampu_id TEXT REFERENCES public.guru(id) ON DELETE SET NULL,
    kelas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- G. Jadwal Pelajaran
CREATE TABLE IF NOT EXISTS public.jadwal_pelajaran (
    id TEXT PRIMARY KEY DEFAULT ('jadwal-' || extract(epoch from now())::bigint),
    mapel_id TEXT REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
    hari TEXT NOT NULL,
    jam_mulai TEXT NOT NULL,
    jam_selesai TEXT NOT NULL,
    ruangan TEXT DEFAULT 'Ruang Kelas',
    kelas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- H. Absensi Siswa
CREATE TABLE IF NOT EXISTS public.absensi (
    id TEXT PRIMARY KEY DEFAULT ('abs-' || extract(epoch from now())::bigint),
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
    tanggal TEXT NOT NULL,
    status TEXT NOT NULL,
    keterangan TEXT,
    dicatat_oleh_id TEXT REFERENCES public.guru(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_siswa_tanggal UNIQUE (siswa_id, tanggal)
);

-- I. Daftar Tugas (Integrasi Google Form Webhook)
CREATE TABLE IF NOT EXISTS public.daftar_tugas (
    id TEXT PRIMARY KEY DEFAULT ('tugas-' || extract(epoch from now())::bigint),
    mapel_id TEXT REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
    judul_tugas TEXT NOT NULL,
    deskripsi TEXT,
    google_form_url TEXT NOT NULL,
    tanggal_diberikan TEXT NOT NULL,
    tenggat_waktu TEXT,
    dibuat_oleh_id TEXT REFERENCES public.guru(id) ON DELETE SET NULL,
    kelas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- J. Tugas Siswa (Pengerjaan, Status, & Nilai Webhook Google Form)
CREATE TABLE IF NOT EXISTS public.tugas_siswa (
    id TEXT PRIMARY KEY DEFAULT ('ts-' || extract(epoch from now())::bigint),
    tugas_id TEXT REFERENCES public.daftar_tugas(id) ON DELETE CASCADE NOT NULL,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
    status_pengerjaan BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'BELUM_DIKERJAKAN',
    score NUMERIC,
    nilai NUMERIC,
    started_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    tanggal_dikerjakan TEXT,
    umpan_balik TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_tugas_siswa UNIQUE (tugas_id, siswa_id)
);

-- K. Penilaian & Asesmen Kurikulum Merdeka (Tangkapan Webhook & Input Guru)
CREATE TABLE IF NOT EXISTS public.penilaian (
    id TEXT PRIMARY KEY DEFAULT ('as-' || extract(epoch from now())::bigint),
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
    mapel_id TEXT REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
    tipe TEXT NOT NULL DEFAULT 'harian',
    nama_penilaian TEXT NOT NULL,
    nilai NUMERIC NOT NULL CHECK (nilai >= 0 AND nilai <= 100),
    deskripsi_kompetensi TEXT,
    tanggal_penilaian TEXT NOT NULL,
    dinilai_oleh_id TEXT REFERENCES public.guru(id) ON DELETE SET NULL,
    kelas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alias Tabel Asesmen (Mengarah ke skema sama untuk kompatibilitas penuh)
CREATE TABLE IF NOT EXISTS public.asesmen (
    id TEXT PRIMARY KEY DEFAULT ('as-' || extract(epoch from now())::bigint),
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
    mapel_id TEXT REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
    tipe TEXT NOT NULL DEFAULT 'harian',
    nama_penilaian TEXT NOT NULL,
    nilai NUMERIC NOT NULL CHECK (nilai >= 0 AND nilai <= 100),
    deskripsi_kompetensi TEXT,
    tanggal_penilaian TEXT NOT NULL,
    dinilai_oleh_id TEXT REFERENCES public.guru(id) ON DELETE SET NULL,
    kelas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- L. Temuan Khusus (Catatan Perilaku Siswa)
CREATE TABLE IF NOT EXISTS public.temuan_khusus (
    id TEXT PRIMARY KEY DEFAULT ('tk-' || extract(epoch from now())::bigint),
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE NOT NULL,
    tanggal TEXT NOT NULL,
    kategori TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    tindakan_lanjut TEXT,
    dilaporkan_oleh_id TEXT REFERENCES public.guru(id) ON DELETE SET NULL,
    kelas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- M. Notifikasi Real-Time
CREATE TABLE IF NOT EXISTS public.notifikasi (
    id TEXT PRIMARY KEY DEFAULT ('notif-' || extract(epoch from now())::bigint),
    penerima_role TEXT NOT NULL,
    penerima_user_id TEXT,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    dibaca BOOLEAN DEFAULT FALSE,
    tugas_id TEXT REFERENCES public.daftar_tugas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- N. Application Settings
CREATE TABLE IF NOT EXISTS public.application_settings (
    id TEXT PRIMARY KEY DEFAULT 'app-settings-001',
    theme TEXT DEFAULT 'light',
    primary_color TEXT,
    secondary_color TEXT,
    website_title TEXT,
    footer_text TEXT,
    vision TEXT,
    mission TEXT,
    welcome_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- O. Buku Digital
CREATE TABLE IF NOT EXISTS public.buku_digital (
    id TEXT PRIMARY KEY DEFAULT ('book-' || extract(epoch from now())::bigint),
    judul TEXT NOT NULL,
    kelas TEXT NOT NULL DEFAULT 'Kelas 1',
    kategori_buku TEXT DEFAULT 'buku_siswa',
    mapel_id TEXT,
    mapel_nama TEXT NOT NULL,
    file_url TEXT NOT NULL,
    cover_url TEXT,
    deskripsi TEXT,
    penulis TEXT,
    uploaded_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. KONFIGURASI SUPABASE STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('logos', 'logos', true),
  ('teachers', 'teachers', true),
  ('students', 'students', true),
  ('documents', 'documents', true),
  ('assignments', 'assignments', true),
  ('buku_digital', 'buku_digital', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Kebijakan Akses Public Storage
DROP POLICY IF EXISTS "Public Storage Read Access" ON storage.objects;
CREATE POLICY "Public Storage Read Access" ON storage.objects
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Storage Uploads" ON storage.objects;
CREATE POLICY "Allow Storage Uploads" ON storage.objects
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Storage Updates" ON storage.objects;
CREATE POLICY "Allow Storage Updates" ON storage.objects
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow Storage Deletes" ON storage.objects;
CREATE POLICY "Allow Storage Deletes" ON storage.objects
  FOR DELETE USING (true);

-- 6. INDEXES PERFORMA
CREATE INDEX IF NOT EXISTS idx_guru_nip ON public.guru(nip);
CREATE INDEX IF NOT EXISTS idx_siswa_nisn ON public.siswa(nisn);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON public.siswa(kelas);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl ON public.absensi(siswa_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_tugas ON public.tugas_siswa(tugas_id);
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_siswa ON public.tugas_siswa(siswa_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_siswa ON public.penilaian(siswa_id);
CREATE INDEX IF NOT EXISTS idx_asesmen_siswa ON public.asesmen(siswa_id);

-- 7. HAK AKSES & ROW LEVEL SECURITY (RLS)
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
    'penilaian','asesmen','temuan_khusus','notifikasi','application_settings','buku_digital'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Public access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
