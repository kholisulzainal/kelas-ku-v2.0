# 📚 KELAS KU (Sistem Manajemen Sekolah & LMS Digital)

> **Dokumentasi Arsitektur, Struktur Direktori, Alur Database, dan Panduan Penggunaan**  
> *Versi Rilis: 2.8.0 | Stack: React 19 + TypeScript + Vite + Express + Firebase Firestore & Supabase | Zona Waktu: WIB (Asia/Jakarta)*

---

## 1. 📐 GAMBARAN UMUM & ARSITEKTUR SISTEM

**KELAS KU** adalah aplikasi *School Management System* (SMS) dan *Learning Management System* (LMS) modern untuk institusi pendidikan (SD, SMP, SMA/SMK) di Indonesia. Aplikasi ini mendukung Kurikulum Merdeka dan Kurikulum 2013 dengan fitur manajemen data sekolah, penilaian asesmen (Formatif, Sumatif, SAS), presensi digital, perpustakaan buku digital & LKPD, integrasi AI Google Gemini, serta sinkronisasi multi-cloud (Firebase Cloud Firestore & Supabase PostgreSQL).

```
+-----------------------------------------------------------------------------------+
|                                 FRONTEND CLIENT                                  |
|         React 19 (TypeScript) + Vite + Tailwind CSS + Lucide Icons + Motion       |
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
+---------------------+---------------------+---------------------------------------+
                      |                     |
        +-------------+-------------+       +-------------+
        |                           |                     |
        v                           v                     v
+---------------+           +---------------+     +---------------+
|   FIREBASE    |           |   SUPABASE    |     | EXTERNAL HOOK |
|   Firestore   |           | (PostgreSQL)  |     | Google Apps   |
| (Multi-Device)|           |  (Relational) |     | Script (GAS)  |
+---------------+           +---------------+     +---------------+
```

---

## 2. 🗂️ STRUKTUR DASAR DIREKTORI PROYEK

Struktur direktori aplikasi disusun secara modular untuk memisahkan antarmuka (UI), logika bisnis (Services), perutean peran (Pages), dan backend Express:

```
kelas-ku/
├── .env.example                  # Template konfigurasi environment variables
├── index.html                    # Entry point HTML utama
├── metadata.json                 # Metadata aplikasi & konfigurasi kapabilitas
├── package.json                  # Manifest dependensi dan script build/dev
├── server.ts                     # Server backend Express (API endpoints, Gemini AI, Webhook)
├── tsconfig.json                 # Konfigurasi TypeScript
├── vite.config.ts                # Konfigurasi bundler Vite & plugin Tailwind CSS
│
└── src/
    ├── main.tsx                  # Entry point React (DOM Mount)
    ├── App.tsx                   # Komponen induk navigasi peran (Role-based Routing)
    ├── index.css                 # Global styling & Tailwind CSS directives
    ├── types.ts                  # Deklarasi global TypeScript interfaces, types, & enums
    │
    ├── components/               # Komponen antarmuka modular (UI Components)
    │   ├── Header.tsx            # Bilah navigasi atas (Profil, Notifikasi, Cloud, Tema)
    │   ├── Sidebar.tsx           # Navigasi samping menu akademik & administratif
    │   ├── Footer.tsx            # Footer informasi aplikasi & status sinkronisasi
    │   ├── ThemeContext.tsx      # State manager tema tampilan (Terang / Gelap / Otomatis)
    │   ├── ThemeControlMenu.tsx  # Dropdown pemilih tema visual
    │   ├── FirebaseSyncModal.tsx # Modal sinkronisasi Google Cloud Firebase Firestore
    │   ├── FirebaseSettingsTab.tsx # Pengaturan konfigurasi kredensial Firebase
    │   ├── SupabaseSyncModal.tsx # Modal sinkronisasi database Supabase PostgreSQL
    │   ├── AsesmenMatrixTable.tsx# Tabel input & rekapitulasi matriks nilai siswa
    │   ├── BukuDigitalView.tsx   # Pembaca PDF & repositori materi digital/LKPD
    │   ├── AiTutorGuruView.tsx   # Asisten AI Pedagogi Guru berbasis Gemini API
    │   ├── AiPerangkatAjarView.tsx # AI Generator TP, ATP, Prota, Promes, & Modul Ajar
    │   ├── AiGeneratorSoalView.tsx # AI Penyusun naskah soal & script Google Form
    │   ├── GoogleAppsScriptModal.tsx # Modal penyedia script otomatisasi Google Form
    │   ├── GoogleSheetsSyncPanel.tsx # Panel integrasi & sinkronisasi Google Spreadsheet
    │   ├── GoogleWorkspaceModal.tsx  # Pengaturan akun Google Workspace / OAuth
    │   ├── NotificationCenter.tsx    # Pusat notifikasi & pemberitahuan sistem
    │   ├── AutoLogoutManager.tsx     # Pengaman auto-lock sesi tidak aktif
    │   ├── IndonesianCalendar.tsx    # Kalender akademik dan hari libur nasional
    │   └── StudentAssignmentCard.tsx # Kartu interaktif daftar tugas pengerjaan siswa
    │
    ├── pages/                    # Halaman portal pengguna per peran (Role Portals)
    │   ├── Login.tsx             # Halaman autentikasi multi-peran
    │   ├── GuruDashboard.tsx     # Dasbor Guru & Wali Kelas (Akademik, Nilai, Presensi)
    │   ├── SiswaDashboard.tsx    # Portal Siswa (Tugas, Absensi, Rapor, Buku)
    │   └── OrangTuaDashboard.tsx # Portal Wali Murid (Monitoring nilai & kehadiran anak)
    │
    ├── services/                 # Layer data & konektivitas cloud (Data Access Layer)
    │   ├── db.ts                 # Database controller lokal (Local Storage persistence)
    │   ├── firebase.ts           # Service integrasi Firebase Firestore (Push, Pull, Realtime)
    │   ├── firebaseClient.ts     # Inisialisasi Firebase App & Firestore SDK client
    │   ├── supabase.ts           # Service integrasi Supabase PostgreSQL
    │   ├── supabaseClient.ts     # Inisialisasi Supabase SDK client
    │   ├── realtimeSync.ts       # Broadcast & event listener pembaruan lintas tab
    │   ├── googleServices.ts     # Integrasi Google Form, Webhook receiver, & Apps Script
    │   ├── googleAuth.ts         # Otentikasi Google OAuth2 / GIS
    │   ├── googleWorkspace.ts    # Integrasi Google Drive & Dokumen Workspace
    │   ├── storage.service.ts    # Manajemen penyimpanan file & aset media
    │   ├── sekolah.service.ts    # Service profil sekolah, kop surat, & tahun ajaran
    │   ├── guru.service.ts       # Service manajemen data pendidik & tenaga kependidikan
    │   ├── siswa.service.ts      # Service manajemen data peserta didik & rombel
    │   ├── tugas.service.ts      # Service manajemen tugas, kuis, & penugasan Google Form
    │   ├── attendance.service.ts # Service presensi harian siswa (QR & manual)
    │   └── settings.service.ts   # Service konfigurasi aplikasi & preferensi
    │
    └── utils/                    # Utilitas pendukung & helper functions
        └── formatters.ts         # Pemformat tanggal WIB, angka, kurikulum, & string
```

---

## 3. 👥 HAK AKSES & PERAN PENGGUNA (ROLE MATRIX)

| Role | Portal / Page | Fitur Utama |
| :--- | :--- | :--- |
| **Kepala Sekolah / Admin** | `GuruDashboard` (Admin Mode) | Profil sekolah, master data (Guru, Siswa, Kelas), sinkronisasi cloud, rekapitulasi rapor, export Excel/PDF. |
| **Guru / Wali Kelas** | `GuruDashboard` | Penilaian asesmen formatif/sumatif, presensi kelas, pembuatan tugas Google Form, modul ajar AI, buku guru. |
| **Siswa** | `SiswaDashboard` | Pengerjaan tugas tertanam (embedded kuis), rekap nilai harian, presensi mandiri, perpustakaan buku digital & LKPD. |
| **Orang Tua / Wali** | `OrangTuaDashboard` | Pemantauan perkembangan belajar anak, histori kehadiran, nilai rapor, dan transparansi tugas sekolah. |

---

## 4. 🔄 ALUR MANAJEMEN DATA & SINKRONISASI CLOUD

Aplikasi menerapkan arsitektur **Offline-First dengan Multi-Cloud Sync**:

1. **Local Storage First**: Setiap operasi tulis/baca disimpan seketika ke `localStorage` melalui `db.ts`, menjamin aplikasi tetap bekerja responsif walau tanpa internet.
2. **Cloud Firebase Firestore**:
   * **Push All**: Mengunggah seluruh koleksi lokal ke Google Cloud Firestore.
   * **Pull All**: Mengunduh seluruh dokumen Firestore untuk menyelaraskan perangkat lain secara paralel (didukung REST API fallback).
   * **Realtime Listener**: Memperbarui status data lokal secara instan ketika ada perubahan di cloud.
3. **Google Form & Webhook Receiver**:
   * Siswa mengirim respons kuis Google Form -> Google Apps Script mengirim payload nilai ke endpoint backend `/api/webhooks/google-form`.
   * Nilai tersimpan secara unik (`as-{tugasId}-{siswaId}`) dan otomatis memicu event pembaruan UI secara real-time.

---

## 5. 🎨 SISTEM TEMA & KUSTOMISASI TAMPILAN

* **Pilihan Mode**:
  * ☀️ **Terang (Light)**: Latar bersih dan kontras tinggi untuk kenyamanan siang hari.
  * 🌙 **Gelap (Dark)**: Latar gelap ramah mata untuk penggunaan malam hari.
  * 💻 **Otomatis (System)**: Menyesuaikan secara dinamis dengan preferensi sistem operasi perangkat pengguna.
* **Aksen Warna Tema**: Mendukung ragam palet (Biru Samudra, Hijau Zamrud, Ungu Lavender, Merah Rose, Kuning Amber, Nila Indigo, Sian, dan Slate).

---

## 6. 🚀 PANDUAN MENJALANKAN APLIKASI

### Mode Pengembangan (Development)
```bash
# Menjalankan Express backend + Vite dev server di port 3000
npm run dev
```

### Memeriksa Integritas Tipe (Lint)
```bash
npm run lint
```

### Membangun Versi Produksi (Production Build)
```bash
# Mengompilasi frontend ke dist/ dan server backend ke dist/server.cjs via ESBuild
npm run build

# Menjalankan server produksi
npm start
```

---

## 7. 📄 LISENSI
Hak Cipta (c) 2026 **KELAS KU** - Sistem Manajemen Sekolah & LMS Digital. Berlisensi di bawah ketentuan lisensi MIT.
