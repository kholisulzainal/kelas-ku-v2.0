-- =========================================================
-- HYBRID TRACKING GOOGLE FORM & PENILAIAN SCHEMAS
-- Aplikasi: KELAS KU (SD & Kurikulum Merdeka)
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabel daftar_tugas (Tugas dari Guru dengan Link Google Form)
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

-- 2. Tabel tugas_siswa (Status Pengerjaan & Nilai Webhook Siswa)
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

-- Enable RLS & Grants
ALTER TABLE public.daftar_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tugas_siswa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access daftar_tugas" ON public.daftar_tugas;
CREATE POLICY "Public access daftar_tugas" ON public.daftar_tugas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access tugas_siswa" ON public.tugas_siswa;
CREATE POLICY "Public access tugas_siswa" ON public.tugas_siswa FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.daftar_tugas TO anon, authenticated, service_role;
GRANT ALL ON public.tugas_siswa TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
