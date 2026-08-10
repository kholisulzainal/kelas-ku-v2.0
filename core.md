# SPESIFIKASI SISTEM UTAMA & ARSITEKTUR KELAS KU
**Sistem Informasi Manajemen Sekolah Dasar (SIM-SD) & Kurikulum Merdeka Hub**

---

## 1. Filosofi & Batasan Utama Sistem ("Kamar Privasi")
1. **Akses Berbasis Peran & Kamar Privasi Per Kelas**:
   - **Operator**: Memiliki akses penuh (*Full Admin*) terhadap seluruh konfigurasi sekolah, manajemen akun guru & siswa, cadangan database, serta modul global.
   - **Guru / Wali Kelas**: Mengelola siswa, absensi, daftar tugas, serta penilaian pada kelas yang diwalikan atau mata pelajaran yang diampu. Guru tidak dapat mengubah data kelas lain.
   - **Siswa**: Melihat daftar tugas Google Form, status pengerjaan & nilai, absensi, serta buku digital khusus untuk kelas siswa bersangkutan.
   - **Orang Tua**: Memantau perkembangan, rekap kehadiran, serta nilai ananda yang terhubung dengan akun orang tua.

2. **Keamanan Input Nilai & Mencegah Kecurangan**:
   - Muka input nilai kuis/tugas **DIHAPUS DARI HALAMAN SISWA**. Siswa mengerjakan tugas kuis melalui Google Form resmi.
   - Rekap & sinkronisasi nilai dikontrol secara otomatis melalui **Webhook Google Form** langsung ke tabel `tugas_siswa` dan `penilaian` di Supabase & Aplikasi.

---

## 2. Arsitektur Data & Alur Sinkronisasi Database
- **Penyimpanan Lokal (Local Persistence)**: Menggunakan `localStorage` terstruktur melalui `/src/services/db.ts` sebagai cache instan di browser.
- **Sinkronisasi Supabase Cloud**: Sinkronisasi dua arah (*bi-directional*) real-time ke tabel PostgreSQL Supabase (`profil_sekolah`, `guru`, `siswa`, `orang_tua`, `daftar_tugas`, `tugas_siswa`, `penilaian`, `absensi`, `buku_digital`, dll.) melalui `/src/services/supabase.ts`.
- **Layanan API Terstruktur**:
  - `/src/services/guru.service.ts` -> Layanan data Guru
  - `/src/services/siswa.service.ts` -> Layanan data Siswa
  - `/src/services/tugas.service.ts` -> Layanan data Daftar Tugas & Tugas Siswa
  - `/src/services/sekolah.service.ts` -> Layanan data Profil Sekolah
  - `/src/services/storage.service.ts` -> Layanan unggah berkas Supabase Storage (`logos`, `teachers`, `students`, `documents`, `assignments`, `buku_digital`, `avatars`)

---

## 3. Struktur Modul & Fungsi Fitur
1. **Profil Sekolah & Pengaturan Aplikasi**:
   - Identitas Sekolah (NPSN, Nama, Akreditasi, Alamat, Kepala Sekolah).
   - Backup, Restore, & Audit Trail Database.
2. **Manajemen Guru**:
   - Pendataan NIP, Nama Guru, Gelar, Status Kepegawaian, Google Email, dan Penugasan Kelas Wali.
3. **Manajemen Siswa & Orang Tua**:
   - Pendataan NISN, NIS, Nama Siswa, Kelas, Orang Tua/Wali, dan Kredensial Login.
4. **Mata Pelajaran & Jadwal Pelajaran**:
   - Pemetaan KKM, Kode Mapel, Jam Pelajaran, dan Ruangan.
5. **Absensi & Kehadiran Siswa**:
   - Catatan Hadir, Sakit, Izin, Alpa dengan perhitungan rekap persentase kehadiran otomatis.
6. **Penilaian & Asesmen Kurikulum Merdeka (Matrix Nilai Rapor)**:
   - Nama Siswa & NISN.
   - Mata Pelajaran.
   - Nilai Formatif Harian & Sumatif (STS/SAS).
   - Terhubung otomatis dengan pengerjaan tugas & Webhook Google Form.
7. **Daftar Tugas & Webhook Google Form**:
   - Pembuatan tugas per kelas dengan tautan Google Form resmi.
   - Penilaian otomatis melalui Webhook Google Form server (`/api/webhooks/google-form`).
8. **Buku Digital**:
   - Media belajar siswa berbasis Web View/Embedded PDF per kelas.
9. **Temuan Khusus**:
   - Catatan bimbingan konseling dan pengembangan karakter siswa.
10. **Kalender Akademik Indonesia**:
    - Agenda sekolah, hari libur nasional, dan jadwal kegiatan akademik.

---

## 4. Aturan Pemeliharaan & Kode
- **Terminologi Bahasa Indonesia**: Menggunakan istilah konsisten (`guru`, `siswa`, `tugas`, `sekolah`).
- **Port Ingress**: Dev server berjalan pada Port 3000.
- **Satu Sumber Kebenaran Data**: Semua operasi data lokal menggunakan `/src/services/db.ts`.
