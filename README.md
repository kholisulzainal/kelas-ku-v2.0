# 📚 KELAS KU (Aplikasi Manajemen Sekolah & LMS Digital)

> **Dokumen Kontrol Alur Database, Arsitektur Sistem, dan Panduan Penggunaan & Instalasi**  
> *Versi Rilis: 2.7.0 | Framework: React 18 + Vite + Express + Supabase PostgreSQL | Timezone: WIB (Asia/Jakarta)*

---

## 1. 📐 BLUEPRINT APLIKASI & KERANGKA DASAR

**KELAS KU** adalah platform *School Management System* (SMS) dan *Learning Management System* (LMS) modern yang dirancang khusus untuk sekolah tingkat SD, SMP, SMA, dan SMK di Indonesia. Sistem ini mengintegrasikan manajemen akademik sekolah, penilaian kurikulum, presensi harian, modul buku digital & LKPD, pengaturan tema visual independen per user, serta pelacakan nilai tugas otomatis via Google Form Webhook secara real-time.

```
+-----------------------------------------------------------------------------------+
|                                 FRONTEND CLIENT                                  |
|         React 18 (TypeScript) + Vite + Tailwind CSS + Lucide Icons               |
|   +-------------------+    +--------------------+    +------------------------+   |
|   |   Portal Siswa    |    |    Portal Guru     |    |   Portal Admin/Kepsek  |   |
|   +-------------------+    +--------------------+    +------------------------+   |
|                            |  Portal Orang Tua  |                                 |
|                            +--------------------+                                 |
+------------------------------------------+----------------------------------------+
                                           |
                                     HTTP / REST API
                                           v
+-----------------------------------------------------------------------------------+
|                                  BACKEND SERVER                                   |
|                  Node.js + Express (Port 3000) [TZ: Asia/Jakarta]                |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  | /api/webhooks/gform|   | /api/ai/tutor         |   | /api/health            |  |
|  +--------------------+   +-----------------------+   +------------------------+  |
+---------------------+-------------------------------------------------------------+
                      |
        +-------------+-------------+
        |                           |
        v                           v
+---------------+           +---------------+
|   DATABASE    |           | EXTERNAL HOOK |
|   Supabase    |           | Google Apps   |
| (PostgreSQL)  |           | Script (GAS)  |
+---------------+           +---------------+
```

### Stack Teknologi Utama:
* **Frontend UI**: React 18, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti.
* **Backend Runtime**: Node.js, Express JS, TSX / ESBuild CJS bundler (`dist/server.cjs`).
* **Database Layer**: Supabase PostgreSQL (Row Level Security & Real-time Broadcast) dengan fallback *Local Persistence DB* (Offline-first support).
* **AI Engine Integration**: Gemini API (`@google/genai` SDK) server-side proxy route untuk AI Tutor & Asisten Guru.
* **Integrasi Eksternal**: Google Apps Script (GAS) Webhook untuk kuis Google Form, Google Workspace Generator (Docs/Drive).
* **Standar Waktu**: WIB (Asia/Jakarta / UTC+7) tersinkronisasi presisi antara Server, Webhook, dan Supabase.

---

## 2. 🤖 RENCANA PENGEMBANGAN FITUR INTEGRASI AI (GEMINI AI)

Aplikasi KELAS KU mengintegrasikan teknologi Google Gemini AI server-side secara bertahap untuk membantu efisiensi kerja guru dan kualitas pembelajaran:

1. **🤖 Fitur 2 (Tahap 1 - Aktif): AI Tutor & Asisten Pedagogi Guru**
   * Asisten AI interaktif bagi guru untuk berkonsultasi mengenai metode pengajaran, strategi penanganan kelas, solusi masalah pembelajaran siswa, pendekatan diferensiasi Kurikulum Merdeka, serta saran pembuatan asesmen.
   * Dilengkapi dengan rekomendasi prompt cepat, riwayat konsultasi, serta penyesuaian konteks mata pelajaran dan jenjang kelas.

2. **📝 Fitur 3 (Tahap 2 - Planned): AI Generator Google Form via Google Apps Script**
   * Guru mengunggah file soal (PDF/Doc/Teks) -> AI secara otomatis menyusun dan menghasilkan kode **Google Apps Script**.
   * Kode script siap dipasang untuk secara otomatis membuat **Google Form Kuis** lengkap dengan opsi standar (Isian Nama, NISN, tanpa kumpulkan email, tampilkan skor, batasi 1x pengerjaan, pertanyaan wajib isi, dan kunci jawaban/skor per soal).

3. **📚 Fitur 1 (Tahap 3 - Planned): AI Pembuat Perangkat Ajar Otomatis (TP, ATP, Prota, Promes, Modul Ajar)**
   * Pembuat perangkat ajar Kurikulum Merdeka secara otomatis.
   * Guru cukup memilih Mata Pelajaran dan memasukkan Capaian Pembelajaran (CP), lalu AI merumuskan Tujuan Pembelajaran (TP), Alur Tujuan Pembelajaran (ATP), Program Tahunan (Prota), Program Semester (Promes), hingga Modul Ajar/RPP secara komprehensif.

---

## 3. 👥 PETUNJUK PENGGUNA & HAK AKSES PER ROLE

### 👨‍🎓 1. Panduan untuk Siswa (Role: `STUDENT`)
* **Dasbor & Ringkasan Akademik**:
  * Menampilkan statistik kehadiran, tugas aktif, dan rekap nilai rata-rata.
* **Mengerjakan Tugas & Kuis Google Form**:
  * Klik **"Kerjakan Tugas"** untuk membuka kuis Google Form di dalam pengerjaan tertanam (iframe).
  * Status tugas berubah dari `BELUM_DIKERJAKAN` menjadi `SEDANG_MENGERJAKAN`.
  * Setelah mengirimkan Form, nilai kuis akan tersinkronisasi otomatis secara real-time via Webhook dan berubah status menjadi `SELESAI`.
* **Akses Buku Digital & LKPD**:
  * Membaca Buku Teks Siswa, Buku Bacaan, dan Lembar Kerja Peserta Didik (LKPD) langsung via PDF Reader built-in.
* **Pengaturan Tema Visual Mandiri**:
  * Mengatur tema tampilan (Terang/Gelap/Sistem) secara bebas tanpa mempengaruhi tampilan akun pengguna lain.

### 👨‍🏫 2. Panduan untuk Guru (Role: `TEACHER`)
* **AI Tutor Guru / Asisten Pedagogi**:
  * Berdiskusi dan berkonsultasi 24/7 dengan AI Tutor untuk memecahkan masalah pembelajaran, menyusun ide esktrakurikuler, menyusun rubrik, atau menyusun strategi siswa inklusif.
* **Manajemen Tugas & Google Form**:
  * Buat tugas baru dan tautkan link Google Form.
  * Gunakan modal **"Salin Skrip Webhook"** untuk mengunduh kode Google Apps Script yang siap dipasang di Google Form / Sheets.
* **Buku Digital, Modul & Buku Pegangan Guru**:
  * Mengunggah dan mengelola Buku Siswa, Buku Bacaan, LKPD, serta Buku Pegangan Guru (Privat Guru).
* **Matrix Nilai & Asesmen**:
  * Penginputan nilai Formatif, Sumatif Lingkup Materi, dan Sumatif Akhir Semester (SAS).

### 👨‍👩‍👧 3. Panduan untuk Orang Tua (Role: `PARENT`)
* **Pemantauan Nilai & Perkembangan**:
  * Orang tua dapat memantau perolehan nilai kuis dan tugas harian anak secara terorganisir.
* **Monitoring Kehadiran & Buku Digital**:
  * Rekapitulasi absensi harian dan akses bacaan Buku Digital anak di rumah.

### 🏫 4. Panduan untuk Admin / Kepala Sekolah (Role: `ADMIN` / `KEPSEK`)
* **Pengaturan Profil Sekolah & Aplikasi**:
  * Kelola nama sekolah, NPSN, logo, alamat, nama Kepala Sekolah, NIP, serta pengaturan tema global/sistem.
* **Data Master & Laporan Rapor**:
  * Kelola data guru, siswa, kelas, dan cetak Laporan Rapor & Rekapitulasi Sekolah (Excel/PDF).

---

## 4. 🔄 ALUR KERJA INTEGRASI GOOGLE FORM & WEBHOOK

1. **Pembuatan Tugas**: Guru membuat tugas kuis Google Form di Dasbor Guru -> Sistem menghasilkan `ID Tugas` unik (contoh: `tugas-1785329248256`).
2. **Pemasangan Script**: Guru menyalin kode Google Apps Script dari modal aplikasi dan menempelkannya pada Google Sheets/Form kuis.
3. **Pengiriman Jawaban**: Siswa menyelesaikan Google Form -> Trigger `onFormSubmit` di Apps Script berjalan secara otomatis.
4. **Proses Webhook Backend**:
   * Endpoint `/api/webhooks/google-form` menerima payload berisi email/NISN siswa, ID tugas, dan nilai.
   * Sistem menormalisasi ID Penilaian menjadi ID standar tunggal (`as-{tugasId}-{siswaId}`) untuk **mencegah duplikasi nilai**.
   * Nilai dan timestamp waktu lokal WIB (Asia/Jakarta) disimpan ke tabel `tugas_siswa` dan `penilaian` di Supabase & Local DB.
5. **Real-Time Event Dispatch**: Frontend mendeteksi event `penilaians-updated` dan `asesmens-updated`, sehingga nilai siswa langsung diperbarui di portal Guru, Siswa, dan Orang Tua tanpa reload halaman.

---

## 5. ⚙️ STRUKTUR DATABASE SUPABASE & MAPPING TABEL

| Nama Tabel Supabase | Deskripsi & Fungsi |
| :--- | :--- |
| `profil_sekolah` | Menyimpan profil dasar sekolah, NPSN, semester aktif, dan kop surat. |
| `data_guru` | Data NIP, nama guru, mata pelajaran diampu, dan kredensial login. |
| `data_siswa` | Data NISN, nama siswa, kelas, jenis kelamin, dan data orang tua. |
| `daftar_tugas` | Informasi tugas, judul, deskripsi, tenggat waktu, dan link Google Form. |
| `tugas_siswa` | Status pengerjaan tugas (`BELUM_DIKERJAKAN`, `SEDANG_MENGERJAKAN`, `SELESAI`), waktu submit (WIB), dan nilai kuis. |
| `penilaian` | Rekapitulasi nilai harian, kuis Google Form, formatif, dan sumatif siswa. |
| `presensi_siswa` | Catatan kehadiran harian siswa (Hadir, Sakit, Izin, Alpa) dan waktu scan QR. |
| `buku_digital` | Perpustakaan digital (Buku Siswa, Buku Bacaan, LKPD, Buku Pegangan Guru). |
| `catatan_karakter` | Jurnal temuan khusus perkembangan perilaku dan kedisiplinan siswa. |

---

## 6. 💻 PETUNJUK INSTALASI & DEPLOYMENT

### 🛠️ A. Instalasi di Lingkungan Localhost

**Prasyarat**: Node.js (v18.x atau v20.x), NPM.

1. **Clone Proyek**:
   ```bash
   git clone <repository-url>
   cd kelas-ku
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables (`.env`)**:
   Buat file `.env` di root direktori proyek:
   ```env
   PORT=3000
   TZ=Asia/Jakarta
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

4. **Jalankan Aplikasi Mode Dev**:
   ```bash
   npm run dev
   ```
   Buka browser di `http://localhost:3000`.

---

### 🌐 B. Deployment Production (Cloud Run / VPS / Vercel)

Proyek ini dikompilasi menggunakan bundler ESBuild untuk server Express CommonJS (`dist/server.cjs`):

1. **Build Production**:
   ```bash
   npm run build
   ```
   *Perintah ini akan menjalankan `vite build` dan mengompilasi `server.ts` menjadi `dist/server.cjs`.*

2. **Jalankan Production Server**:
   ```bash
   npm start
   ```
   *Aplikasi akan berjalan di port `3000` dengan dukungan waktu lokal WIB.*

---

## 7. 📜 LISENSI & KETENTUAN HAK CIPTA

```
MIT License

Hak Cipta (c) 2026 KELAS KU - Sistem Manajemen Sekolah & LMS Digital.

Dengan ini diberikan izin, secara gratis, kepada siapa pun yang memperoleh salinan
perangkat lunak ini dan file dokumentasi terkait ("Perangkat Lunak"), untuk menggunakan,
mengubah, menggabungkan, memublikasikan, mendistribusikan, dan/atau menjual salinan Perangkat Lunak.
```
