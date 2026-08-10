export type UserRole = 'operator' | 'guru' | 'siswa' | 'orang_tua';

export type StatusKehadiran = 'hadir' | 'sakit' | 'izin' | 'alfa';

export type TipePenilaian = 'harian' | 'sts' | 'sas' | 'kokurikuler';
export type TipeAsesmen = TipePenilaian;

export interface Penilaian {
  id: string;
  siswaId: string;
  mapelId: string;
  tipe: TipePenilaian;
  namaPenilaian: string; // PH 1, STS Genap, etc.
  nilai: number;
  deskripsiKompetensi?: string;
  tanggalPenilaian: string; // YYYY-MM-DD
  dinilaiOlehId?: string; // Relasi ke Guru
  kelas?: string; // Spesifik kelas (e.g. "Kelas I", "Kelas IV", etc)
}

export type Asesmen = Penilaian;

export interface ProfilSekolah {
  id: string;
  namaSekolah: string;
  npsn: string;
  alamat: string;
  akreditasi: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  logoUrl?: string;
  tahunPelajaran?: string;
  jalan?: string;
  rtRw?: string;
  dusun?: string;
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  kodePos?: string;
}

export interface Profile {
  id: string;
  email: string;
  namaLengkap: string;
  role: UserRole;
  avatarUrl?: string;
  noTelepon?: string;
}

export interface Guru {
  id: string;
  profileId?: string;
  nip: string;
  namaGuru: string;
  gelar: string;
  mataPelajaranUtama: string;
  fotoUrl?: string;
  statusKepegawaian: string;
  password?: string;
  isWaliKelas?: boolean;
  kelasWali?: string; // Spesifik kelas yang diwalikan (e.g. "Kelas 1", "Kelas 4", etc)
  googleEmail?: string;
}

export interface Siswa {
  id: string;
  profileId?: string;
  email?: string;
  nisn: string;
  nis: string;
  namaSiswa: string;
  jenisKelamin: 'L' | 'P';
  kelas: string;
  alamat: string;
  fotoUrl?: string;
  namaAyah: string;
  namaIbu: string;
  noTeleponOrtu: string;
  password?: string;
}

export interface OrangTua {
  id: string;
  profileId?: string;
  namaOrtu: string;
  siswaId: string; // Relasi ke Siswa
  hubungan: string;
  noTelepon: string;
  password?: string;
}

export interface MataPelajaran {
  id: string;
  kodeMapel: string;
  namaMapel: string;
  kkm: number;
  guruPengampuId?: string; // Relasi ke Guru
  kelas?: string; // Spesifik Kelas
  kategori?: string;
  kelompok?: string;
}

export interface JadwalPelajaran {
  id: string;
  mapelId: string; // Relasi ke Mapel
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  jamMulai: string; // "07:30"
  jamSelesai: string; // "09:00"
  ruangan: string;
  kelas?: string; // Spesifik Kelas
}

export interface Absensi {
  id: string;
  siswaId: string;
  tanggal: string; // YYYY-MM-DD
  status: StatusKehadiran;
  keterangan?: string;
  dicatatOlehId?: string; // Relasi ke Guru
}

export type AssignmentStatus = 'BELUM_DIKERJAKAN' | 'SEDANG_MENGERJAKAN' | 'SELESAI';

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  class_id?: string;
  subject_id?: string;
  teacher_id?: string;
  google_form_url: string;
  created_at?: string;
}

export interface StudentAssignment {
  id: string;
  assignment_id: string;
  student_id: string;
  status: AssignmentStatus;
  score?: number | null;
  started_at?: string | null;
  submitted_at?: string | null;
}

export interface DaftarTugas {
  id: string;
  mapelId: string;
  judulTugas: string;
  deskripsi: string;
  googleFormUrl: string;
  googleSheetUrl?: string;
  tanggalDiberikan: string; // YYYY-MM-DD
  tenggatWaktu: string; // YYYY-MM-DDTHH:mm
  dibuatOlehId?: string; // Relasi ke Guru
  kelas?: string; // Spesifik kelas (e.g. "Kelas I", "Kelas IV", etc)
}

export interface TugasSiswa {
  id: string;
  tugasId: string;
  siswaId: string;
  statusPengerjaan: boolean;
  status?: AssignmentStatus;
  startedAt?: string | null;
  submittedAt?: string | null;
  tanggalDikerjakan?: string;
  nilai?: number;
  score?: number | null;
  umpanBalik?: string;
}

export interface TemuanKhusus {
  id: string;
  siswaId: string;
  tanggal: string; // YYYY-MM-DD
  kategori: string; // Positif, Perlu Bimbingan, etc.
  deskripsi: string;
  tindakanLanjut?: string;
  dilaporkanOlehId?: string; // Relasi ke Guru
  kelas?: string; // Spesifik kelas (e.g. "Kelas I", "Kelas IV", etc)
}

export interface Notifikasi {
  id: string;
  penerimaRole: UserRole;
  penerimaUserId?: string; // opsional, spesifik ke user
  judul: string;
  pesan: string;
  tanggal: string;
  dibaca: boolean;
  tugasId?: string;
}

export interface BukuDigital {
  id: string;
  judul: string;
  kelas: string; // e.g., "Kelas 1", "Kelas 4", "Semua Kelas"
  kategoriBuku?: 'buku_siswa' | 'buku_guru' | 'buku_non_teks' | 'lkpd';
  mapelId?: string;
  mapelNama: string;
  fileUrl: string; // PDF URL or Google Drive embed URL
  coverUrl?: string;
  deskripsi?: string;
  penulis?: string;
  uploadedBy?: string;
  createdAt: string;
}
