# SPESIFIKASI SISTEM UTAMA & ARSITEKTUR KELAS KU
**Sistem Informasi Manajemen Sekolah Dasar (SIM-SD) & Kurikulum Merdeka Hub**
*Versi Sistem: 2.9.0 | Status: Siap Rilis (Production Ready & Vercel Compatible)*

---

## 1. Filosofi & Batasan Akses Sistem ("Kamar Privasi")
1. **Akses Berbasis Peran & Kamar Privasi Per Kelas**:
   - **Operator / Admin**: Memiliki hak akses penuh (*Full Administrator*) untuk mengelola profil sekolah, struktur kelas, master data guru & siswa, audit trail, serta pencadangan data global.
   - **Guru / Wali Kelas**: Mengelola siswa, absensi kehadiran, daftar tugas, perangkat ajar AI, serta matriks penilaian pada rombel kelas yang diwalikan atau mata pelajaran yang diampu. Guru dibatasi dari modifikasi data kelas lain.
   - **Siswa**: Mengakses tugas terintegrasi Google Form, melihat rekapitulasi nilai harian, memantau riwayat presensi, serta membuka perpustakaan buku digital & LKPD sesuai kelas terdaftar.
   - **Orang Tua / Wali**: Memantau rekap absensi, nilai asesmen, serta catatan perkembangan anak yang terhubung dengan akun orang tua secara transparan.

2. **Integritas Penilaian & Pencegahan Kecurangan**:
   - Input nilai kuis mandiri siswa ditiadakan dari dashboard siswa demi integritas data. Siswa mengerjakan tugas melalui formulir Google Form resmi.
   - Rekap nilai diserap secara otomatis melalui endpoint **Webhook Google Form** (`/api/webhooks/google-form`) dan dipetakan ke tabel `tugas_siswa` serta `penilaian`.

---

## 2. Arsitektur Data, Kompatibilitas Cloud & Serverless
- **Penyimpanan Lokal (Local-First Persistence)**:
  - Cache instan dan penyimpanan offline menggunakan `localStorage` terstruktur via `/src/services/db.ts`.
- **Multi-Cloud Database Synchronization**:
  - **Supabase (PostgreSQL Relational)**: Sinkronisasi dwiarah (*bi-directional*) real-time melalui `/src/services/supabase.ts` dengan dukungan migrasi SQL otomatis dan fungsi pemutusan koneksi (*disconnect*) instan.
  - **Firebase Firestore (NoSQL Cloud)**: Sinkronisasi paralel ke koleksi Firestore dengan proteksi rules dan mode fallback REST API.
- **Serverless & Standalone Backend Architecture**:
  - **Vercel Serverless Entry**: `/api/index.ts` mengekspor Express `apiApp` yang dioptimalkan untuk hosting serverless di Vercel.
  - **Standalone Mode**: `server.ts` menjalankan server Express terpadu (Port 3000) dengan middleware Vite saat di lingkungan lokal atau container Cloud Run.
  - **Fallback Cerdas**: Seluruh endpoint webhook dan API sinkronisasi menangani kondisi offline/unconfigured secara graceful tanpa menyebabkan crash.

---

## 3. Struktur Modul & Pembaruan Terkini
1. **AI Pembuat Soal Terpadu (Unified AI Generator & Automation)**:
   - Pembuatan soal pilihan ganda, isian, dan uraian berbasis AI Google Gemini.
   - Integrasi langsung script otomatisasi **Google Apps Script** dan **Webhook Receiver** dalam satu tampilan terpadu tanpa menu terpisah.
2. **AI Asisten Pedagogi & Perangkat Ajar**:
   - Generator TP, ATP, Promes, Prota, dan Modul Ajar Kurikulum Merdeka.
   - AI Tutor Guru untuk konsultasi strategi pembelajaran dan diferensiasi kelas.
3. **Manajemen Akademik & Presensi Digital**:
   - Pencatatan kehadiran harian (Hadir, Sakit, Izin, Alpa) dengan kalkulasi persentase otomatis dan ekspor PDF/Excel.
4. **Matriks Penilaian Kurikulum Merdeka**:
   - Penilaian Formatif, Sumatif Lingkup Materi, dan Sumatif Akhir Semester (SAS) yang terhubung langsung dengan pencetakan Rapor Digital.
5. **Manajemen Master Data & Kelas**:
   - Profil Sekolah, Direktori Guru & NIP, Data Siswa (NISN/NIS), dan Peta Rombel Kelas.
6. **Buku Digital & LKPD**:
   - Repositori materi bacaan dan LKPD interaktif berbasis PDF viewer per kelas.
7. **Kalender Pendidikan Indonesia**:
   - Jadwal kegiatan akademik dan hari libur nasional dengan opsi ekspor ke Google Calendar.
8. **Pusat Pengaturan & Keandalan Koneksi**:
   - Tombol *Disconnect* dan *Reset* yang responsif tanpa hambatan dialog browser di seluruh antarmuka.

---

## 4. Aturan Pemeliharaan & Standar Kode
- **Bahasa & Terminologi**: Menggunakan istilah baku Bahasa Indonesia untuk seluruh entitas domain pendidikan (`guru`, `siswa`, `penilaian`, `absensi`, `sekolah`).
- **Keamanan Kredensial**: Kunci API sensitif (Gemini API, Service Role) selalu diakses di sisi server (`process.env`).
- **Single Source of Truth**: Seluruh operasi mutasi data lokal dikontrol oleh `db.ts` dengan penyiaran event pembaruan reaktif.

---

## 5. Informasi Pengembang & Distribusi Terbuka
- **Pengembang Utama**: Kholisul Zainal Asfan Sholikh, S.Pd.
- **Dukungan AI**: Google AI Studio & Gemini API
- **Lisensi**: Open Source (Lisensi MIT) — Bebas dikembangkan dan disesuaikan untuk kemajuan ekosistem pendidikan di Indonesia.
