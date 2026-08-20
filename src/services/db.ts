import {
  ProfilSekolah,
  Guru,
  Siswa,
  OrangTua,
  MataPelajaran,
  JadwalPelajaran,
  Absensi,
  DaftarTugas,
  TugasSiswa,
  Penilaian,
  TipePenilaian,
  Asesmen,
  TemuanKhusus,
  Notifikasi,
  BukuDigital,
  UserRole
} from '../types';
import { syncRowToSupabase, deleteRowFromSupabase, saveOperatorCredentialsToSupabase } from './supabase';
import { syncRowToFirebase, deleteRowFromFirebase } from './firebase';
import { uploadFileToSupabaseStorage } from './storage.service';
import { generateStandardMapelCode, extractGradeNumber } from '../utils/mapelUtils';
import { isSameClassLevel } from '../utils/classMatcher';
import { getWibDateString, getWibIsoString } from '../utils/dateUtils';

// Empty default data structures (No hardcoded dummy/sample records)
const defaultProfilSekolah: ProfilSekolah = {
  id: 'sch-001',
  namaSekolah: '',
  npsn: '',
  alamat: '',
  akreditasi: 'A',
  kepalaSekolah: '',
  nipKepalaSekolah: '',
  logoUrl: '',
  tahunPelajaran: '2025/2026',
  jalan: '',
  rtRw: '',
  dusun: '',
  desa: '',
  kecamatan: '',
  kabupaten: '',
  provinsi: '',
  kodePos: ''
};

const defaultGuru: Guru[] = [];
const defaultSiswa: Siswa[] = [];
const defaultOrangTua: OrangTua[] = [];
const defaultMataPelajaran: MataPelajaran[] = [];
const defaultJadwalPelajaran: JadwalPelajaran[] = [];
const defaultAbsensi: Absensi[] = [];
const defaultDaftarTugas: DaftarTugas[] = [];
const defaultTugasSiswa: TugasSiswa[] = [];
const defaultAsesmen: Asesmen[] = [];
const defaultTemuanKhusus: TemuanKhusus[] = [];
const defaultNotifikasi: Notifikasi[] = [];

// Default digital library collection (Kemendikbudristek Kurikulum Merdeka)
const defaultBukuDigital: BukuDigital[] = [
  {
    id: 'book-sd-1-bindo',
    judul: 'Bahasa Indonesia: Aku Bisa! Kelas I',
    kelas: 'Kelas 1',
    kategoriBuku: 'buku_siswa',
    mapelNama: 'Bahasa Indonesia',
    fileUrl: 'https://buku.kemdikbud.go.id/catalogue/pdf/bahasa-indonesia-kelas-1-bs.pdf',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    deskripsi: 'Buku Teks Siswa Bahasa Indonesia SD Kelas 1 Kurikulum Merdeka Kemendikbudristek.',
    penulis: 'Eti Nurhayati & Widia Pekerti',
    createdAt: '2025-01-10T08:00:00.000Z'
  },
  {
    id: 'book-sd-4-mtk',
    judul: 'Matematika Vol 1 SD Kelas IV',
    kelas: 'Kelas 4',
    kategoriBuku: 'buku_siswa',
    mapelNama: 'Matematika',
    fileUrl: 'https://buku.kemdikbud.go.id/catalogue/pdf/matematika-kelas-4-bs.pdf',
    coverUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=600&q=80',
    deskripsi: 'Buku Teks Utama Matematika Volume 1 SD Kelas 4 Kurikulum Merdeka.',
    penulis: 'Tim Gakko Tosho',
    createdAt: '2025-01-11T09:30:00.000Z'
  },
  {
    id: 'book-sd-5-ipas',
    judul: 'Ilmu Pengetahuan Alam dan Sosial (IPAS) Kelas V',
    kelas: 'Kelas 5',
    kategoriBuku: 'buku_siswa',
    mapelNama: 'IPAS',
    fileUrl: 'https://buku.kemdikbud.go.id/catalogue/pdf/ipas-kelas-5-bs.pdf',
    coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80',
    deskripsi: 'Buku Teks Siswa IPAS SD Kelas 5 Kurikulum Merdeka.',
    penulis: 'Amalia Fitri dkk.',
    createdAt: '2025-01-12T10:15:00.000Z'
  },
  {
    id: 'book-nonteks-01',
    judul: 'Literasi Bacaan Anak: Si Kancil dan Pohon Rindang',
    kelas: 'Semua Kelas',
    kategoriBuku: 'buku_non_teks',
    mapelNama: 'Cerita & Literasi',
    fileUrl: 'https://buku.kemdikbud.go.id/catalogue/pdf/literasi-bacaan-anak.pdf',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
    deskripsi: 'Buku cerita non-teks pendukung program Gerakan Literasi Sekolah (GLS).',
    penulis: 'Tim Literasi Kemendikbud',
    createdAt: '2025-01-13T11:00:00.000Z'
  },
  {
    id: 'book-bg-4-bindo',
    judul: 'Buku Panduan Guru Bahasa Indonesia Kelas IV',
    kelas: 'Kelas 4',
    kategoriBuku: 'buku_guru',
    mapelNama: 'Bahasa Indonesia',
    fileUrl: 'https://buku.kemdikbud.go.id/catalogue/pdf/bahasa-indonesia-kelas-4-bg.pdf',
    coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    deskripsi: 'Buku Pegangan Guru Bahasa Indonesia SD Kelas 4 (Privat Guru & Operator).',
    penulis: 'Eva Y. Nukman & Cicilia Erni Setyowati',
    createdAt: '2025-01-14T14:20:00.000Z'
  },
  {
    id: 'book-bg-1-mtk',
    judul: 'Buku Panduan Guru Matematika Kelas I',
    kelas: 'Kelas 1',
    kategoriBuku: 'buku_guru',
    mapelNama: 'Matematika',
    fileUrl: 'https://buku.kemdikbud.go.id/catalogue/pdf/matematika-kelas-1-bg.pdf',
    coverUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80',
    deskripsi: 'Buku Panduan Guru Matematika SD Kelas 1 Kurikulum Merdeka.',
    penulis: 'Tim Gakko Tosho',
    createdAt: '2025-01-15T16:45:00.000Z'
  },
  {
    id: 'book-lkpd-1-ipas',
    judul: 'LKPD IPAS Kelas V: Lembar Kerja Praktikum Eksperimen',
    kelas: 'Kelas 5',
    kategoriBuku: 'lkpd',
    mapelNama: 'IPAS',
    fileUrl: 'https://buku.kemdikbud.go.id/catalogue/pdf/ipas-kelas-5-bs.pdf',
    coverUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80',
    deskripsi: 'Lembar Kerja Peserta Didik (LKPD) mandiri & kelompok untuk kegiatan pembelajaran IPAS.',
    penulis: 'Tim Guru IPAS',
    createdAt: '2026-02-01T08:00:00.000Z'
  }
];

// Database state initializer (Strictly without dummy data injections)
const initDatabase = () => {
  if (!localStorage.getItem('profil_sekolah')) {
    localStorage.setItem('profil_sekolah', JSON.stringify(defaultProfilSekolah));
  }
  if (!localStorage.getItem('guru')) {
    localStorage.setItem('guru', '[]');
  }
  if (!localStorage.getItem('siswa')) {
    localStorage.setItem('siswa', '[]');
  }
  if (!localStorage.getItem('orang_tua')) {
    localStorage.setItem('orang_tua', '[]');
  }
  if (!localStorage.getItem('mata_pelajaran')) {
    localStorage.setItem('mata_pelajaran', '[]');
  }
  if (!localStorage.getItem('jadwal_pelajaran')) {
    localStorage.setItem('jadwal_pelajaran', '[]');
  }
  if (!localStorage.getItem('absensi')) {
    localStorage.setItem('absensi', '[]');
  }
  if (!localStorage.getItem('daftar_tugas')) {
    localStorage.setItem('daftar_tugas', '[]');
  }
  if (!localStorage.getItem('tugas_siswa')) {
    localStorage.setItem('tugas_siswa', '[]');
  }
  if (!localStorage.getItem('penilaian')) {
    localStorage.setItem('penilaian', '[]');
  }
  if (!localStorage.getItem('temuan_khusus')) {
    localStorage.setItem('temuan_khusus', '[]');
  }
  if (!localStorage.getItem('notifikasi')) {
    localStorage.setItem('notifikasi', '[]');
  }
  if (!localStorage.getItem('buku_digital')) {
    localStorage.setItem('buku_digital', JSON.stringify(defaultBukuDigital));
  }
  if (!localStorage.getItem('current_user_role')) {
    localStorage.setItem('current_user_role', 'operator');
  }
  if (!localStorage.getItem('current_user_id')) {
    localStorage.setItem('current_user_id', 'operator-id'); 
  }
  if (!localStorage.getItem('is_logged_in')) {
    localStorage.setItem('is_logged_in', 'false');
  }
};

initDatabase();

export const normalizeScoreNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  let num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.,]/g, '').replace(',', '.'));
  if (isNaN(num)) return 0;
  if (num > 0 && num <= 1) num = Math.round(num * 100);
  return Math.min(100, Math.max(0, Math.round(num)));
};

export const db = {
  // Utility to clear / reset database
  resetToDefault: () => {
    localStorage.removeItem('profil_sekolah');
    localStorage.removeItem('guru');
    localStorage.removeItem('siswa');
    localStorage.removeItem('orang_tua');
    localStorage.removeItem('mata_pelajaran');
    localStorage.removeItem('jadwal_pelajaran');
    localStorage.removeItem('absensi');
    localStorage.removeItem('daftar_tugas');
    localStorage.removeItem('tugas_siswa');
    localStorage.removeItem('penilaian');
    localStorage.removeItem('asesmen');
    localStorage.removeItem('temuan_khusus');
    localStorage.removeItem('notifikasi');
    localStorage.removeItem('daftar_kelas');
    initDatabase();
    window.location.reload();
  },

  // Active User / Role Simulation API
  getCurrentUser: () => {
    const role = localStorage.getItem('current_user_role') as UserRole || 'guru';
    const id = localStorage.getItem('current_user_id') || 'guru-1';
    const isLoggedIn = localStorage.getItem('is_logged_in') === 'true';
    let name = 'Kholisul Zainal Asfan Sholikh, S.Pd.';
    let detailId = id;

    if (role === 'operator') {
      name = 'Staf Operator Sekolah';
    } else if (role === 'guru') {
      const g = db.guru.getAll().find(item => item.id === id);
      name = g ? g.namaGuru : 'Guru';
    } else if (role === 'siswa') {
      const s = db.siswa.getAll().find(item => item.id === id);
      name = s ? s.namaSiswa : 'Siswa';
    } else if (role === 'orang_tua') {
      const o = db.orangTua.getAll().find(item => item.id === id);
      name = o ? o.namaOrtu : 'Orang Tua';
    }

    return { role, id, name, detailId, isLoggedIn };
  },

  isLoggedIn: () => {
    return localStorage.getItem('is_logged_in') === 'true';
  },

  logout: () => {
    localStorage.setItem('is_logged_in', 'false');
    window.dispatchEvent(new CustomEvent('user-session-changed'));
  },

  login: (role: UserRole, id: string) => {
    localStorage.setItem('is_logged_in', 'true');
    db.setCurrentUser(role, id);
    window.dispatchEvent(new CustomEvent('user-session-changed'));
  },

  setCurrentUser: (role: UserRole, id: string) => {
    localStorage.setItem('current_user_role', role);
    localStorage.setItem('current_user_id', id);
    window.dispatchEvent(new CustomEvent('user-session-changed'));
  },

  operatorCredentials: {
    get: () => {
      let u = localStorage.getItem('operator_username') || 'operator';
      let p = localStorage.getItem('operator_password') || 'operator123';
      const raw = localStorage.getItem('operator_credentials');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const item = Array.isArray(parsed) ? parsed[0] : parsed;
          if (item) {
            if (item.username) u = item.username;
            if (item.password) p = item.password;
          }
        } catch (e) {}
      }
      return { username: u, password: p };
    },
    update: (username: string, password?: string) => {
      const cleanUsername = username.trim().toLowerCase();
      const cleanPassword = password ? password.trim() : undefined;
      localStorage.setItem('operator_username', cleanUsername);
      if (cleanPassword) {
        localStorage.setItem('operator_password', cleanPassword);
      }
      const currentP = cleanPassword || localStorage.getItem('operator_password') || 'operator123';
      const arr = [{
        id: 'op-001',
        username: cleanUsername,
        password: currentP,
        nama_operator: 'Operator Utama SD',
        is_active: true,
        updated_at: new Date().toISOString()
      }];
      localStorage.setItem('operator_credentials', JSON.stringify(arr));
      saveOperatorCredentialsToSupabase(cleanUsername, cleanPassword).catch(err => console.warn('Sync operator error:', err));
      syncRowToFirebase('operator_credentials', 'op-001', arr[0]).catch(() => {});
    }
  },

  // 1. Profil Sekolah
  profilSekolah: {
    get: (): ProfilSekolah => {
      const data = localStorage.getItem('profil_sekolah');
      if (!data) return defaultProfilSekolah;
      try {
        const parsed = JSON.parse(data);
        return {
          id: parsed.id || 'sch-001',
          namaSekolah: parsed.namaSekolah !== undefined ? parsed.namaSekolah : 'SD NEGERI KITA',
          npsn: parsed.npsn || '',
          alamat: parsed.alamat || '',
          akreditasi: parsed.akreditasi || 'A',
          kepalaSekolah: parsed.kepalaSekolah || '',
          nipKepalaSekolah: parsed.nipKepalaSekolah || '',
          logoUrl: parsed.logoUrl || '',
          tahunPelajaran: parsed.tahunPelajaran || '2025/2026',
          jalan: parsed.jalan || '',
          rtRw: parsed.rtRw || '',
          dusun: parsed.dusun || '',
          desa: parsed.desa || '',
          kecamatan: parsed.kecamatan || '',
          kabupaten: parsed.kabupaten || '',
          provinsi: parsed.provinsi || '',
          kodePos: parsed.kodePos || '',
          ttdKepalaSekolahOpsi: parsed.ttdKepalaSekolahOpsi || 'qr_code',
          ttdKepalaSekolahGambar: parsed.ttdKepalaSekolahGambar || '',
          ttdKepalaSekolahCustomQr: parsed.ttdKepalaSekolahCustomQr || '',
          ttdGuruDefaultOpsi: parsed.ttdGuruDefaultOpsi || 'qr_code',
          ttdGuruDefaultGambar: parsed.ttdGuruDefaultGambar || '',
          ttdGuruDefaultCustomQr: parsed.ttdGuruDefaultCustomQr || '',
          ttdTampilkanVerifikasiDigital: parsed.ttdTampilkanVerifikasiDigital !== false
        };
      } catch (e) {
        return defaultProfilSekolah;
      }
    },
    update: (updated: ProfilSekolah) => {
      localStorage.setItem('profil_sekolah', JSON.stringify(updated));
      syncRowToSupabase('profil_sekolah', updated);
      syncRowToFirebase('sekolah_profile', updated.id || 'sch-001', updated);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'profil_sekolah' } }));
    }
  },

  // 2. Guru
  guru: {
    getAll: (): Guru[] => {
      const data = localStorage.getItem('guru');
      return data ? JSON.parse(data) : [];
    },
    save: (items: Guru[]) => {
      localStorage.setItem('guru', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
    },
    upsert: (item: Guru) => {
      const list = db.guru.getAll();
      const finalItem = { ...item, id: item.id || `guru-${Date.now()}` };
      const idx = list.findIndex(g => g.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.guru.save(list);
      syncRowToSupabase('guru', finalItem);
      syncRowToFirebase('guru', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
    },
    delete: (id: string) => {
      const list = db.guru.getAll().filter(g => g.id !== id);
      db.guru.save(list);
      deleteRowFromSupabase('guru', id);
      deleteRowFromFirebase('guru', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
    }
  },

  // 3. Siswa
  siswa: {
    getAll: (): Siswa[] => {
      const data = localStorage.getItem('siswa');
      const list: Siswa[] = data ? JSON.parse(data) : [];
      return list.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa));
    },
    save: (items: Siswa[]) => {
      localStorage.setItem('siswa', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'siswa' } }));
    },
    upsert: (item: Siswa) => {
      const list = db.siswa.getAll();
      const finalItem = { ...item, id: item.id || `siswa-${Date.now()}` };
      const idx = list.findIndex(s => s.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.siswa.save(list);
      syncRowToSupabase('siswa', finalItem);
      syncRowToFirebase('siswa', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'siswa' } }));
    },
    delete: (id: string) => {
      const list = db.siswa.getAll().filter(s => s.id !== id);
      db.siswa.save(list);
      deleteRowFromSupabase('siswa', id);
      deleteRowFromFirebase('siswa', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'siswa' } }));
    }
  },

  // 4. Orang Tua
  orangTua: {
    getAll: (): OrangTua[] => {
      const data = localStorage.getItem('orang_tua');
      return data ? JSON.parse(data) : [];
    },
    save: (items: OrangTua[]) => {
      localStorage.setItem('orang_tua', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'orang_tua' } }));
    },
    upsert: (item: OrangTua) => {
      const list = db.orangTua.getAll();
      const finalItem = { ...item, id: item.id || `ortu-${Date.now()}` };
      const idx = list.findIndex(o => o.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.orangTua.save(list);
      syncRowToSupabase('orang_tua', finalItem);
      syncRowToFirebase('orang_tua', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'orang_tua' } }));
    },
    delete: (id: string) => {
      const list = db.orangTua.getAll().filter(o => o.id !== id);
      db.orangTua.save(list);
      deleteRowFromSupabase('orang_tua', id);
      deleteRowFromFirebase('orang_tua', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'orang_tua' } }));
    }
  },

  // 5. Mata Pelajaran
  mataPelajaran: {
    getAll: (): MataPelajaran[] => {
      const data = localStorage.getItem('mata_pelajaran');
      let list: MataPelajaran[] = data ? JSON.parse(data) : [];
      if (list.length === 0) return defaultMataPelajaran;

      // Auto-sanitize mismatched kodeMapel vs kelas in local database
      let updated = false;
      list = list.map(m => {
        if (!m.kodeMapel || m.kodeMapel.startsWith('MP-')) {
          const stdCode = generateStandardMapelCode(m.namaMapel, m.kelas);
          updated = true;
          return { ...m, kodeMapel: stdCode };
        }
        const codeGrade = extractGradeNumber(m.kodeMapel);
        const kelasGrade = extractGradeNumber(m.kelas);
        if (codeGrade !== null && kelasGrade !== null && codeGrade !== kelasGrade) {
          const stdCode = generateStandardMapelCode(m.namaMapel, m.kelas);
          updated = true;
          return { ...m, kodeMapel: stdCode };
        }
        return m;
      });

      // Auto-deduplicate mapels with identical ID or identical (namaMapel + kelas)
      const seenIds = new Set<string>();
      const seenCombo = new Set<string>();
      const deduped: MataPelajaran[] = [];

      for (const m of list) {
        if (!m.id || seenIds.has(m.id)) {
          updated = true;
          continue;
        }
        const normName = (m.namaMapel || '').trim().toLowerCase();
        const normKelas = (m.kelas || '').trim().toLowerCase();
        const comboKey = `${normName}__${normKelas}`;

        if (seenCombo.has(comboKey)) {
          updated = true;
          continue;
        }

        seenIds.add(m.id);
        seenCombo.add(comboKey);
        deduped.push(m);
      }
      list = deduped;

      if (updated) {
        localStorage.setItem('mata_pelajaran', JSON.stringify(list));
      }

      return list.sort((a, b) => a.namaMapel.localeCompare(b.namaMapel));
    },
    getByKelas: (kelas?: string): MataPelajaran[] => {
      const all = db.mataPelajaran.getAll();
      if (!kelas || kelas === 'Semua' || kelas === 'Semua Kelas') return all;
      return all.filter(m => !m.kelas || m.kelas === 'Semua' || m.kelas === 'Semua Kelas' || isSameClassLevel(m.kelas, kelas));
    },
    getDistinctNames: (kelas?: string): string[] => {
      const matching = db.mataPelajaran.getByKelas(kelas);
      const names = new Set<string>();
      matching.forEach(m => {
        if (m.namaMapel && m.namaMapel.trim()) {
          names.add(m.namaMapel.trim());
        }
      });
      return Array.from(names).sort((a, b) => a.localeCompare(b));
    },
    save: (items: MataPelajaran[]) => {
      localStorage.setItem('mata_pelajaran', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'mata_pelajaran' } }));
    },
    upsert: (item: MataPelajaran) => {
      const list = db.mataPelajaran.getAll();
      const finalItem = { ...item, id: item.id || `mapel-${Date.now()}` };
      const idx = list.findIndex(m => m.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.mataPelajaran.save(list);
      syncRowToSupabase('mata_pelajaran', finalItem);
      syncRowToFirebase('mata_pelajaran', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'mata_pelajaran' } }));
    },
    delete: (id: string) => {
      const list = db.mataPelajaran.getAll().filter(m => m.id !== id);
      db.mataPelajaran.save(list);
      deleteRowFromSupabase('mata_pelajaran', id);
      deleteRowFromFirebase('mata_pelajaran', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'mata_pelajaran' } }));
    }
  },

  // 6. Jadwal Pelajaran
  jadwalPelajaran: {
    getAll: (): JadwalPelajaran[] => {
      const data = localStorage.getItem('jadwal_pelajaran');
      const list: JadwalPelajaran[] = data ? JSON.parse(data) : [];
      if (list.length === 0) return defaultJadwalPelajaran;
      return list;
    },
    save: (items: JadwalPelajaran[]) => {
      localStorage.setItem('jadwal_pelajaran', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'jadwal_pelajaran' } }));
    },
    upsert: (item: JadwalPelajaran) => {
      const list = db.jadwalPelajaran.getAll();
      const finalItem = { ...item, id: item.id || `jadwal-${Date.now()}` };
      const idx = list.findIndex(j => j.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.jadwalPelajaran.save(list);
      syncRowToSupabase('jadwal_pelajaran', finalItem);
      syncRowToFirebase('jadwal_pelajaran', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'jadwal_pelajaran' } }));
    },
    delete: (id: string) => {
      const list = db.jadwalPelajaran.getAll().filter(j => j.id !== id);
      db.jadwalPelajaran.save(list);
      deleteRowFromSupabase('jadwal_pelajaran', id);
      deleteRowFromFirebase('jadwal_pelajaran', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'jadwal_pelajaran' } }));
    }
  },

  // 7. Absensi
  absensi: {
    getAll: (): Absensi[] => {
      const data = localStorage.getItem('absensi');
      return data ? JSON.parse(data) : [];
    },
    save: (items: Absensi[]) => {
      localStorage.setItem('absensi', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'absensi' } }));
    },
    bulkUpsert: (items: Absensi[]) => {
      const list = db.absensi.getAll();
      const syncedItems: Absensi[] = [];
      items.forEach(item => {
        const idx = list.findIndex(a => a.siswaId === item.siswaId && a.tanggal === item.tanggal);
        const finalItem = { ...item, id: item.id || (idx > -1 ? list[idx].id : `abs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`) };
        if (idx > -1) {
          list[idx] = { ...list[idx], ...finalItem };
        } else {
          list.push(finalItem);
        }
        syncedItems.push(list[idx > -1 ? idx : list.length - 1]);
      });
      db.absensi.save(list);
      syncedItems.forEach(item => {
        syncRowToSupabase('absensi', item);
        syncRowToFirebase('kehadiran', item.id, item);
      });
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'absensi' } }));
    },
    upsert: (item: Absensi) => {
      const list = db.absensi.getAll();
      const idx = list.findIndex(a => a.id === item.id || (a.siswaId === item.siswaId && a.tanggal === item.tanggal));
      const finalItem = { ...item, id: item.id || (idx > -1 ? list[idx].id : `abs-${Date.now()}`) };
      if (idx > -1) {
        list[idx] = { ...list[idx], ...finalItem };
      } else {
        list.push(finalItem);
      }
      db.absensi.save(list);
      syncRowToSupabase('absensi', finalItem);
      syncRowToFirebase('kehadiran', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'absensi' } }));
    },
    clearAll: () => {
      const existing = db.absensi.getAll();
      existing.forEach(item => {
        deleteRowFromSupabase('absensi', item.id);
        deleteRowFromFirebase('kehadiran', item.id);
      });
      localStorage.setItem('absensi', '[]');
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'absensi' } }));
    }
  },

  // 8. Daftar Tugas
  daftarTugas: {
    getAll: (): DaftarTugas[] => {
      const data = localStorage.getItem('daftar_tugas');
      return data ? JSON.parse(data) : [];
    },
    save: (items: DaftarTugas[]) => {
      localStorage.setItem('daftar_tugas', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'daftar_tugas' } }));
    },
    upsert: (item: DaftarTugas) => {
      const list = db.daftarTugas.getAll();
      const finalItem = { ...item, id: item.id || `tugas-${Date.now()}` };
      const idx = list.findIndex(t => t.id === finalItem.id);
      const isNew = idx === -1;
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.daftarTugas.save(list);
      syncRowToSupabase('daftar_tugas', finalItem);
      syncRowToFirebase('daftar_tugas', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'daftar_tugas' } }));

      // If new, automatically create tugas_siswa rows for all students (status: false)
      if (isNew) {
        const students = db.siswa.getAll();
        students.forEach(std => {
          db.tugasSiswa.upsert({
            id: `ts-${finalItem.id}-${std.id}`,
            tugasId: finalItem.id,
            siswaId: std.id,
            statusPengerjaan: false
          });
        });

        // Trigger notifications to Students and Parents
        const mapel = db.mataPelajaran.getAll().find(m => m.id === finalItem.mapelId);
        const mapelName = mapel ? mapel.namaMapel : 'Mata Pelajaran';

        // Student Notification
        db.notifikasi.add({
          penerimaRole: 'siswa',
          judul: `Tugas Baru: ${finalItem.judulTugas}`,
          pesan: `Tugas baru untuk mata pelajaran ${mapelName} telah diberikan. Klik untuk mengerjakan menggunakan Google Form!`,
          tugasId: finalItem.id
        });

        // Parent Notification
        db.notifikasi.add({
          penerimaRole: 'orang_tua',
          judul: `Tugas Baru bagi Siswa`,
          pesan: `Siswa mendapat tugas baru "${finalItem.judulTugas}" (${mapelName}). Silakan awasi penyelesaiannya.`,
          tugasId: finalItem.id
        });
      }
    },
    delete: (id: string) => {
      const list = db.daftarTugas.getAll().filter(t => t.id !== id);
      db.daftarTugas.save(list);
      // Clean up child task states
      const childList = db.tugasSiswa.getAll().filter(ts => ts.tugasId !== id);
      db.tugasSiswa.save(childList);
      deleteRowFromSupabase('daftar_tugas', id);
      deleteRowFromFirebase('daftar_tugas', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'daftar_tugas' } }));
    }
  },

  // 9. Tugas Siswa (Pengerjaan individual)
  tugasSiswa: {
    getAll: (): TugasSiswa[] => {
      const data = localStorage.getItem('tugas_siswa');
      return data ? JSON.parse(data) : [];
    },
    save: (items: TugasSiswa[]) => {
      localStorage.setItem('tugas_siswa', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'tugas_siswa' } }));
    },
    delete: (id: string) => {
      const list = db.tugasSiswa.getAll().filter(ts => ts.id !== id);
      db.tugasSiswa.save(list);
    },
    upsert: (item: TugasSiswa) => {
      const list = db.tugasSiswa.getAll();
      const finalItem = { ...item, id: item.id || `ts-${Date.now()}` };
      const idx = list.findIndex(ts => ts.id === finalItem.id || (ts.tugasId === finalItem.tugasId && ts.siswaId === finalItem.siswaId));
      if (idx > -1) {
        list[idx] = { ...list[idx], ...finalItem };
      } else {
        list.push(finalItem);
      }
      const savedItem = list[idx > -1 ? idx : list.length - 1];
      db.tugasSiswa.save(list);
      syncRowToSupabase('tugas_siswa', savedItem);
      syncRowToFirebase('tugas_siswa', savedItem.id, savedItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'tugas_siswa' } }));
    },
    // Simulate Automatic Grading and submit from student
    submitTask: (tugasId: string, siswaId: string, customScore?: number) => {
      const list = db.tugasSiswa.getAll();
      const student = db.siswa.getAll().find(s => s.id === siswaId);
      const studentNisn = student?.nisn?.trim();
      const studentEmail = student?.email?.trim().toLowerCase();

      const candidateIds = Array.from(new Set([
        siswaId,
        studentNisn,
        studentEmail
      ].filter(Boolean) as string[]));

      const task = db.daftarTugas.getAll().find(t => t.id === tugasId);
      const finalScore = customScore != null ? customScore : undefined;
      const nowIso = getWibIsoString();
      const todayStr = getWibDateString();

      // Find all matching indices for candidate student IDs
      const matchingIndices: number[] = [];
      list.forEach((ts, idx) => {
        if (ts.tugasId === tugasId && (candidateIds.includes(ts.siswaId) || candidateIds.includes(ts.id.replace(`ts-${tugasId}-`, '')))) {
          matchingIndices.push(idx);
        }
      });

      const primaryId = matchingIndices.length > 0 ? list[matchingIndices[0]].id : `ts-${tugasId}-${siswaId}`;
      const existingStartedAt = matchingIndices.length > 0 ? list[matchingIndices[0]].startedAt : null;

      const submitted: TugasSiswa = {
        id: primaryId,
        tugasId,
        siswaId,
        statusPengerjaan: true,
        status: 'SELESAI',
        startedAt: existingStartedAt || nowIso,
        submittedAt: nowIso,
        tanggalDikerjakan: todayStr,
        nilai: finalScore,
        score: finalScore ?? null,
        umpanBalik: finalScore != null ? 'Tugas diselesaikan melalui Google Form (Nilai tersinkron otomatis).' : 'Tugas dikirim. Menunggu sinkronisasi nilai dari Webhook Google Form.'
      };

      // Filter out all candidate entries and insert unified submitted record
      const newList = list.filter((_, idx) => !matchingIndices.includes(idx));
      newList.push(submitted);

      db.tugasSiswa.save(newList);
      syncRowToSupabase('tugas_siswa', submitted, true).catch(() => {});
      syncRowToFirebase('tugas_siswa', submitted.id, submitted).catch(() => {});

      // Save into formal Penilaian (harian) as well if score exists!
      if (task && finalScore != null) {
        db.penilaian.upsert({
          id: `as-auto-${tugasId}-${siswaId}`,
          siswaId,
          mapelId: task.mapelId,
          tipe: 'harian',
          namaPenilaian: task.judulTugas || 'Kuis Google Form',
          nilai: finalScore,
          deskripsiKompetensi: `Nilai dari pengerjaan tugas ${task.judulTugas || ''}`,
          tanggalPenilaian: todayStr,
          dinilaiOlehId: task.dibuatOlehId || 'guru-1',
          kelas: student?.kelas || task.kelas || 'Kelas 4-A'
        });
        window.dispatchEvent(new Event('penilaians-updated'));
      }

      // Add parent notification
      const parent = db.orangTua.getAll().find(p => p.siswaId === siswaId);
      if (student && parent && task) {
        db.notifikasi.add({
          penerimaRole: 'orang_tua',
          penerimaUserId: parent.id,
          judul: `Ananda Selesai Mengerjakan Tugas`,
          pesan: finalScore != null 
            ? `${student.namaSiswa} telah menyelesaikan tugas "${task.judulTugas}". Nilai diperoleh: ${finalScore}.`
            : `${student.namaSiswa} telah menyelesaikan tugas "${task.judulTugas}". Menunggu sinkronisasi nilai dari Google Form.`,
          tugasId: task.id
        });
      }

      // Fire global update events to sync across all dashboards
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'tugas_siswa' } }));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));
      window.dispatchEvent(new Event('penilaians-updated'));
    }
  },

  // 10. Penilaian (d/h Asesmen)
  penilaian: {
    getAll: (): Penilaian[] => {
      const data = localStorage.getItem('penilaian') || localStorage.getItem('asesmen');
      let list: Penilaian[] = data ? JSON.parse(data) : [];

      // Auto-merge scored submissions from tugas_siswa if missing
      try {
        const tsData = localStorage.getItem('tugas_siswa');
        if (tsData) {
          const tugasSiswaList: TugasSiswa[] = JSON.parse(tsData);
          const daftarTugasList: DaftarTugas[] = db.daftarTugas.getAll();
          const siswaList: Siswa[] = db.siswa.getAll();

          for (const ts of tugasSiswaList) {
            const rawScoreVal = ts.score ?? ts.nilai;
            if (rawScoreVal != null) {
              const scoreVal = normalizeScoreNumber(rawScoreVal);
              const autoId = `as-${ts.tugasId}-${ts.siswaId}`;
              const exists = list.some(p => p.id === autoId || (p.siswaId === ts.siswaId && p.namaPenilaian.includes(ts.tugasId)));
              if (!exists) {
                const task = daftarTugasList.find(t => t.id === ts.tugasId);
                const student = siswaList.find(s => s.id === ts.siswaId);
                list.push({
                  id: autoId,
                  siswaId: ts.siswaId,
                  mapelId: task?.mapelId || 'mapel-1',
                  tipe: 'harian',
                  namaPenilaian: task?.judulTugas || 'Kuis Google Form',
                  nilai: scoreVal,
                  deskripsiKompetensi: `Nilai dari pengerjaan tugas ${task?.judulTugas || ''}`,
                  tanggalPenilaian: ts.tanggalDikerjakan || new Date().toISOString().split('T')[0],
                  dinilaiOlehId: task?.dibuatOlehId || 'guru-1',
                  kelas: student?.kelas || task?.kelas || 'Kelas 4-A'
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error computing automatic Penilaian from tugasSiswa:', err);
      }

      // Deduplicate list: normalize as-gform- and as-form- to standard as- IDs & normalize nilai <= 1
      const uniqueMap = new Map<string, Penilaian>();
      for (const item of list) {
        const normId = (item.id || '').replace('as-gform-', 'as-').replace('as-form-', 'as-');
        const normName = (item.namaPenilaian || '').replace(/^Google Form:\s*/i, '');
        const normNilai = item.nilai != null ? normalizeScoreNumber(item.nilai) : 0;
        const normItem: Penilaian = {
          ...item,
          id: normId,
          namaPenilaian: normName,
          nilai: normNilai
        };

        const existing = uniqueMap.get(normId);
        if (!existing || (!item.id.includes('as-gform-') && !item.id.includes('as-form-'))) {
          uniqueMap.set(normId, normItem);
        }
      }

      return Array.from(uniqueMap.values());
    },
    save: (items: Penilaian[]) => {
      localStorage.setItem('penilaian', JSON.stringify(items));
      localStorage.setItem('asesmen', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));
      window.dispatchEvent(new Event('penilaians-updated'));
      window.dispatchEvent(new Event('asesmens-updated'));
    },
    upsert: (item: Penilaian) => {
      const list = db.penilaian.getAll();
      const finalItem = { ...item, id: item.id || `pnl-${Date.now()}` };
      const idx = list.findIndex(a => a.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.penilaian.save(list);
      syncRowToSupabase('penilaian', finalItem);
      syncRowToFirebase('penilaian', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));
      window.dispatchEvent(new Event('penilaians-updated'));
      window.dispatchEvent(new Event('asesmens-updated'));
    },
    delete: (id: string) => {
      const list = db.penilaian.getAll().filter(a => a.id !== id);
      db.penilaian.save(list);
      deleteRowFromSupabase('penilaian', id);
      deleteRowFromFirebase('penilaian', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));
      window.dispatchEvent(new Event('penilaians-updated'));
      window.dispatchEvent(new Event('asesmens-updated'));
    }
  },

  get asesmen() {
    return this.penilaian;
  },

  // 11. Temuan Khusus
  temuanKhusus: {
    getAll: (): TemuanKhusus[] => {
      const data = localStorage.getItem('temuan_khusus');
      return data ? JSON.parse(data) : [];
    },
    save: (items: TemuanKhusus[]) => {
      localStorage.setItem('temuan_khusus', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'temuan_khusus' } }));
    },
    upsert: (item: TemuanKhusus) => {
      const list = db.temuanKhusus.getAll();
      const finalItem = { ...item, id: item.id || `tk-${Date.now()}` };
      const idx = list.findIndex(t => t.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.temuanKhusus.save(list);
      syncRowToSupabase('temuan_khusus', finalItem);
      syncRowToFirebase('temuan_khusus', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'temuan_khusus' } }));
    },
    delete: (id: string) => {
      const list = db.temuanKhusus.getAll().filter(t => t.id !== id);
      db.temuanKhusus.save(list);
      deleteRowFromSupabase('temuan_khusus', id);
      deleteRowFromFirebase('temuan_khusus', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'temuan_khusus' } }));
    }
  },

  // 12. Notifikasi
  notifikasi: {
    getAll: (): Notifikasi[] => {
      const data = localStorage.getItem('notifikasi');
      return data ? JSON.parse(data) : [];
    },
    save: (items: Notifikasi[]) => {
      localStorage.setItem('notifikasi', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'notifikasi' } }));
    },
    add: (item: Omit<Notifikasi, 'id' | 'tanggal' | 'dibaca'>) => {
      const list = db.notifikasi.getAll();
      const newItem: Notifikasi = {
        ...item,
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tanggal: new Date().toISOString().split('T')[0],
        dibaca: false
      };
      list.unshift(newItem); // Newest first
      db.notifikasi.save(list);
      syncRowToSupabase('notifikasi', newItem);
      syncRowToFirebase('notifikasi', newItem.id, newItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'notifikasi' } }));
    },
    markAsRead: (id: string) => {
      const list = db.notifikasi.getAll();
      const idx = list.findIndex(n => n.id === id);
      if (idx > -1) {
        list[idx].dibaca = true;
        db.notifikasi.save(list);
      }
    },
    markAllAsRead: (role: UserRole) => {
      const list = db.notifikasi.getAll();
      const updated = list.map(n => n.penerimaRole === role ? { ...n, dibaca: true } : n);
      db.notifikasi.save(updated);
    },
    clearAll: () => {
      db.notifikasi.save([]);
      localStorage.removeItem('notifikasi');
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'notifikasi' } }));
      window.dispatchEvent(new CustomEvent('notifikasi-updated'));
    }
  },

  // Helper Pembersih Cache & Performance Optimizer
  clearCacheAndLogs: () => {
    try {
      // Clear accumulated notifications & logs
      localStorage.setItem('notifikasi', '[]');
      
      // Clear non-essential temp cache keys
      const tempKeys = ['temp_form_submission', 'draft_quiz', 'exambrowser_state', 'active_session_cache'];
      tempKeys.forEach(k => localStorage.removeItem(k));

      // Trigger custom update events to refresh views and release memory
      window.dispatchEvent(new CustomEvent('notifikasi-updated'));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'all' } }));

      console.log('✅ [Cache Optimizer] Cleaned up temporary logs, notification cache, and browser storage.');
      return true;
    } catch (e) {
      console.warn('[Cache Optimizer Error]:', e);
      return false;
    }
  },

  // 13. Buku Digital
  bukuDigital: {
    getAll: (): BukuDigital[] => {
      const data = localStorage.getItem('buku_digital');
      if (!data) {
        localStorage.setItem('buku_digital', JSON.stringify(defaultBukuDigital));
        return defaultBukuDigital;
      }
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
        // If empty array, seed defaults so books are always available on fresh Vercel deployments
        localStorage.setItem('buku_digital', JSON.stringify(defaultBukuDigital));
        return defaultBukuDigital;
      } catch (e) {
        return defaultBukuDigital;
      }
    },
    save: (items: BukuDigital[]) => {
      localStorage.setItem('buku_digital', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'buku_digital' } }));
    },
    upsert: (item: BukuDigital) => {
      const list = db.bukuDigital.getAll();
      const finalItem = {
        ...item,
        id: item.id || `book-${Date.now()}`,
        createdAt: item.createdAt || new Date().toISOString()
      };
      const idx = list.findIndex(b => b.id === finalItem.id);
      if (idx > -1) {
        list[idx] = finalItem;
      } else {
        list.push(finalItem);
      }
      db.bukuDigital.save(list);
      syncRowToSupabase('buku_digital', finalItem);
      syncRowToFirebase('buku_digital', finalItem.id, finalItem);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'buku_digital' } }));
    },
    delete: (id: string) => {
      const list = db.bukuDigital.getAll().filter(b => b.id !== id);
      db.bukuDigital.save(list);
      deleteRowFromSupabase('buku_digital', id);
      deleteRowFromFirebase('buku_digital', id);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'buku_digital' } }));
    }
  },

  // Direct upload to Supabase Storage Bucket returning public persistent URL
  uploadPhoto: async (file: File, bucketName: string = 'avatars'): Promise<string> => {
    try {
      const res = await uploadFileToSupabaseStorage(bucketName, file);
      if (res.success && res.url) {
        return res.url;
      }
      throw new Error(res.error || 'Gagal mengunggah file ke Supabase Storage');
    } catch (err) {
      console.error('[DB UploadPhoto] Error uploading to Supabase Storage:', err);
      throw err;
    }
  }
};
