import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Shield,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Server,
  Globe,
  Lock,
  Save,
  School,
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Users,
  BookOpen,
  UserCheck,
  AlertCircle,
  X,
  Palette,
  Sun,
  Moon,
  Laptop,
  Flame,
  Camera,
  Image,
  MapPin,
  Building,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { useTheme } from './ThemeContext';
import { pullAllFromSupabase, getSupabaseConfig, syncRowToSupabase } from '../services/supabase';
import { isFirebaseConfigured, getStoredFirebaseConfig } from '../services/firebase';
import { FirebaseSettingsTab } from './FirebaseSettingsTab';
import { SupabaseSettingsTab } from './SupabaseSettingsTab';
import { exportToExcel } from '../utils/export';
import { Guru, Siswa, Absensi, ProfilSekolah } from '../types';

// Helper for sorting classes numerically and by roman numerals
const romanToNum = (roman: string): number => {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let num = 0;
  const str = roman.toUpperCase();
  for (let i = 0; i < str.length; i++) {
    const current = map[str[i]] || 0;
    const next = map[str[i + 1]] || 0;
    if (current < next) {
      num -= current;
    } else {
      num += current;
    }
  }
  return num || 999;
};

const getSortKey = (className: string) => {
  const clean = className.trim();
  const matchRoman = clean.match(/Kelas\s+([IVXLCDM]+)(.*)/i);
  if (matchRoman) {
    return { num: romanToNum(matchRoman[1]), suffix: matchRoman[2] || '' };
  }
  const matchNum = clean.match(/Kelas\s+(\d+)(.*)/i);
  if (matchNum) {
    return { num: parseInt(matchNum[1], 10), suffix: matchNum[2] || '' };
  }
  return { num: 999, suffix: clean };
};

const sortClasses = (classes: string[]): string[] => {
  return Array.from(new Set(classes)).sort((a, b) => {
    const keyA = getSortKey(a);
    const keyB = getSortKey(b);
    if (keyA.num !== keyB.num) {
      return keyA.num - keyB.num;
    }
    return keyA.suffix.localeCompare(keyB.suffix);
  });
};

export function AplikasiSetting() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // 1. Profil Sekolah State
  const [profil, setProfil] = useState<ProfilSekolah>(() => db.profilSekolah.get());
  const [isSavingProfil, setIsSavingProfil] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // 2. Manajemen Kelas State
  const [classList, setClassList] = useState<string[]>(() => {
    const saved = localStorage.getItem('daftar_kelas');
    if (saved) {
      try {
        return sortClasses(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
    const initialClasses = Array.from(new Set(db.siswa.getAll().map(s => s.kelas).filter(Boolean)));
    const defaults = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'];
    return sortClasses([...defaults, ...initialClasses]);
  });

  const [siswas, setSiswas] = useState<Siswa[]>(() => db.siswa.getAll());
  const [gurus, setGurus] = useState<Guru[]>(() => db.guru.getAll());
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editingClassName, setEditingClassName] = useState('');
  const [editClassNameInput, setEditClassNameInput] = useState('');

  // 3. Operator Credentials State
  const [opUsername, setOpUsername] = useState(() => db.operatorCredentials.get().username);
  const [opPassword, setOpPassword] = useState(() => db.operatorCredentials.get().password);
  const [opSuccessMsg, setOpSuccessMsg] = useState('');
  const [opErrorMsg, setOpErrorMsg] = useState('');

  // 4. Supabase & Firebase State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const supabaseConfig = getSupabaseConfig();
  const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
  const hasFirebaseConfig = isFirebaseConfigured();

  // 5. Modal Import Result
  const [showImportResultModal, setShowImportResultModal] = useState(false);
  const [importResult, setImportResult] = useState<{
    title: string;
    success: boolean;
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    details: string[];
  } | null>(null);

  useEffect(() => {
    const handleDataUpdate = () => {
      setProfil(db.profilSekolah.get());
      setSiswas(db.siswa.getAll());
      setGurus(db.guru.getAll());
      
      const saved = localStorage.getItem('daftar_kelas');
      if (saved) {
        try {
          setClassList(sortClasses(JSON.parse(saved)));
        } catch (e) {}
      }
    };
    window.addEventListener('supabase-data-updated', handleDataUpdate);
    return () => window.removeEventListener('supabase-data-updated', handleDataUpdate);
  }, []);

  // --- HANDLERS: SECTION 1 (PROFIL SEKOLAH & LOGO) ---
  const handleSchoolLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file logo terlalu besar. Harap pilih gambar di bawah 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        setProfil(prev => ({ ...prev, logoUrl: base64Data }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setProfil(prev => ({ ...prev, logoUrl: '' }));
  };

  const handleSaveProfil = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingProfil(true);

    const parts = [
      profil.jalan,
      profil.rtRw,
      profil.dusun,
      profil.desa,
      profil.kecamatan ? (profil.kecamatan.toLowerCase().startsWith('kec') ? profil.kecamatan : `Kec. ${profil.kecamatan}`) : '',
      profil.kabupaten,
      profil.provinsi,
      profil.kodePos
    ].filter(Boolean);

    const fullAlamat = parts.length > 0 ? parts.join(', ') : (profil.alamat || '');

    const updatedProfil: ProfilSekolah = {
      ...profil,
      alamat: fullAlamat
    };

    db.profilSekolah.update(updatedProfil);
    setProfil(updatedProfil);
    syncRowToSupabase('profil_sekolah', updatedProfil);

    setTimeout(() => {
      setIsSavingProfil(false);
      setSaveMessage('Profil sekolah & logo instansi berhasil disimpan dan disinkronkan!');
      setTimeout(() => setSaveMessage(''), 3500);
      window.dispatchEvent(new Event('school-profile-updated'));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'profil_sekolah' } }));
    }, 400);
  };

  // --- HANDLERS: SECTION 2 (MANAJEMEN KELAS) ---
  const handleCreateClassConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClassNameInput && newClassNameInput.trim()) {
      const trimmed = newClassNameInput.trim();
      if (classList.includes(trimmed)) {
        alert(`Kelas "${trimmed}" sudah terdaftar di sistem!`);
        return;
      }
      const updated = sortClasses([...classList, trimmed]);
      setClassList(updated);
      localStorage.setItem('daftar_kelas', JSON.stringify(updated));
      setShowAddClassModal(false);
      setNewClassNameInput('');
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'daftar_kelas' } }));
    }
  };

  const handleOpenEditClassModal = (clsName: string) => {
    setEditingClassName(clsName);
    setEditClassNameInput(clsName);
    setShowEditClassModal(true);
  };

  const handleSaveEditedClassConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editClassNameInput.trim();
    if (!trimmed || !editingClassName) return;

    if (trimmed === editingClassName) {
      setShowEditClassModal(false);
      return;
    }

    if (classList.includes(trimmed)) {
      alert(`Kelas "${trimmed}" sudah terdaftar di sistem!`);
      return;
    }

    const updated = sortClasses(classList.map(c => c === editingClassName ? trimmed : c));
    setClassList(updated);
    localStorage.setItem('daftar_kelas', JSON.stringify(updated));

    // Update siswa records with old class name
    const currentSiswas = db.siswa.getAll();
    let updatedCount = 0;
    currentSiswas.forEach(s => {
      if (s.kelas === editingClassName) {
        db.siswa.upsert({ ...s, kelas: trimmed });
        updatedCount++;
      }
    });

    setSiswas(db.siswa.getAll());
    setShowEditClassModal(false);
    setEditingClassName('');
    setEditClassNameInput('');
    alert(`Nama kelas "${editingClassName}" berhasil diubah menjadi "${trimmed}" (${updatedCount} data siswa diperbarui).`);
    window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'siswa' } }));
  };

  const handleDeleteClassConfirm = (clsName: string) => {
    const studentCount = siswas.filter(s => s.kelas === clsName).length;
    if (studentCount > 0) {
      if (!window.confirm(`Kelas "${clsName}" memiliki ${studentCount} siswa terdaftar. Yakin ingin menghapus kelas ini?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Yakin ingin menghapus kelas "${clsName}" dari sistem?`)) {
        return;
      }
    }

    const updated = classList.filter(c => c !== clsName);
    setClassList(updated);
    localStorage.setItem('daftar_kelas', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'daftar_kelas' } }));
  };

  // --- HANDLERS: SECTION 3 (TEMPLATE & IMPORT EXCEL) ---
  const handleDownloadTemplateSiswa = () => {
    const data = siswas.map(s => ({
      'Nama Siswa': s.namaSiswa,
      'NISN': s.nisn,
      'NIS': s.nis,
      'Jenis Kelamin': s.jenisKelamin,
      'Kelas': s.kelas,
      'Alamat': s.alamat,
      'Nama Ayah': s.namaAyah,
      'Nama Ibu': s.namaIbu,
      'No Telepon Ortu': s.noTeleponOrtu
    }));

    if (data.length === 0) {
      data.push(
        {
          'Nama Siswa': 'Ahmad Fauzi',
          'NISN': '0123456781',
          'NIS': '232404001',
          'Jenis Kelamin': 'L',
          'Kelas': classList[0] || 'Kelas 1',
          'Alamat': 'Perum Geriya Indah Blok C3',
          'Nama Ayah': 'Pak Joko Fauzi',
          'Nama Ibu': 'Ibu Ratna Fauzi',
          'No Telepon Ortu': '081234567890'
        },
        {
          'Nama Siswa': 'Siti Aminah',
          'NISN': '0123456782',
          'NIS': '232404002',
          'Jenis Kelamin': 'P',
          'Kelas': classList[0] || 'Kelas 1',
          'Alamat': 'Jl. Merdeka No. 12',
          'Nama Ayah': 'Pak Ahmad',
          'Nama Ibu': 'Ibu Aminah',
          'No Telepon Ortu': '081234567891'
        }
      );
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 18 }
    ];
    worksheet['!views'] = [{ showGridLines: true }];
    worksheet['!dataValidation'] = [
      {
        sqref: 'D2:D500',
        type: 'list',
        allowBlank: true,
        formula1: '"L,P"'
      },
      {
        sqref: 'E2:E500',
        type: 'list',
        allowBlank: true,
        formula1: `"${classList.join(',')}"`
      }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');
    XLSX.writeFile(workbook, 'Template_Import_Siswa.xlsx');
  };

  const handleDownloadTemplateAbsensi = () => {
    const today = new Date().toISOString().split('T')[0];
    const data = siswas.map(s => ({
      'Nama Siswa': s.namaSiswa,
      'NISN': s.nisn,
      'NIS': s.nis,
      'Tanggal': today,
      'Status': 'Hadir',
      'Keterangan': ''
    }));

    if (data.length === 0) {
      data.push({
        'Nama Siswa': 'Ahmad Fauzi',
        'NISN': '0123456781',
        'NIS': '232404001',
        'Tanggal': today,
        'Status': 'Hadir',
        'Keterangan': 'Masuk'
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 35 }
    ];
    worksheet['!views'] = [{ showGridLines: true }];
    worksheet['!dataValidation'] = [
      {
        sqref: 'E2:E1000',
        type: 'list',
        allowBlank: true,
        formula1: '"Hadir,Sakit,Izin,Alfa"'
      }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Absensi');
    XLSX.writeFile(workbook, 'Template_Import_Absensi.xlsx');
  };

  const handleDownloadTemplateGuru = () => {
    const data = gurus.map(g => ({
      'NIP': g.nip,
      'Nama Guru': g.namaGuru,
      'Gelar': g.gelar,
      'Mata Pelajaran Utama': g.mataPelajaranUtama,
      'Status Kepegawaian': g.statusKepegawaian,
      'Is Wali Kelas': g.isWaliKelas ? 'Ya' : 'Tidak',
      'Kelas Wali': g.isWaliKelas ? g.kelasWali : 'GURU MAPEL'
    }));

    if (data.length === 0) {
      data.push({
        'NIP': '198503142011012009',
        'Nama Guru': 'Kholisul Zainal Asfan Sholikh, S.Pd.',
        'Gelar': 'S.Pd. (Sarjana Pendidikan)',
        'Mata Pelajaran Utama': 'Tematik & Matematika',
        'Status Kepegawaian': 'PNS',
        'Is Wali Kelas': 'Ya',
        'Kelas Wali': 'Kelas 4'
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }
    ];
    worksheet['!views'] = [{ showGridLines: true }];
    worksheet['!dataValidation'] = [
      {
        sqref: 'E2:E200',
        type: 'list',
        allowBlank: true,
        formula1: '"PNS,P3K,Honorer"'
      },
      {
        sqref: 'F2:F200',
        type: 'list',
        allowBlank: true,
        formula1: '"Ya,Tidak"'
      },
      {
        sqref: 'G2:G200',
        type: 'list',
        allowBlank: true,
        formula1: `"${['GURU MAPEL', ...classList].join(',')}"`
      }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Guru');
    XLSX.writeFile(workbook, 'Template_Import_Guru.xlsx');
  };

  const handleImportGuruExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          alert('File Excel kosong atau format tidak sesuai.');
          return;
        }

        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const details: string[] = [];

        rows.forEach((row, i) => {
          const nip = String(row['NIP'] || row['nip'] || '').trim();
          const namaGuru = String(row['Nama Guru'] || row['namaGuru'] || '').trim();

          if (!namaGuru) {
            skippedCount++;
            details.push(`Baris ${i + 2}: Nama Guru kosong (Dilewati)`);
            return;
          }

          const isWaliRaw = String(row['Is Wali Kelas'] || row['isWaliKelas'] || '').trim().toLowerCase();
          const isWaliKelas = isWaliRaw === 'ya' || isWaliRaw === 'true' || isWaliRaw === '1';
          const kelasWali = String(row['Kelas Wali'] || row['kelasWali'] || '').trim();

          const existing = gurus.find(g => (nip && g.nip === nip) || g.namaGuru.toLowerCase() === namaGuru.toLowerCase());
          const newGuru: Guru = {
            id: existing?.id || `guru-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            nip: nip || existing?.nip || '',
            namaGuru,
            gelar: String(row['Gelar'] || row['gelar'] || existing?.gelar || '-').trim(),
            mataPelajaranUtama: String(row['Mata Pelajaran Utama'] || row['mataPelajaranUtama'] || existing?.mataPelajaranUtama || '-').trim(),
            statusKepegawaian: (row['Status Kepegawaian'] || row['statusKepegawaian'] || existing?.statusKepegawaian || 'PNS') as any,
            fotoUrl: existing?.fotoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
            password: existing?.password || 'guru123',
            isWaliKelas,
            kelasWali: isWaliKelas ? (kelasWali || 'Kelas 1') : ''
          };

          db.guru.upsert(newGuru);
          if (existing) {
            updatedCount++;
            details.push(`Baris ${i + 2}: Diperbarui - ${namaGuru}`);
          } else {
            addedCount++;
            details.push(`Baris ${i + 2}: Ditambahkan - ${namaGuru}`);
          }
        });

        setGurus(db.guru.getAll());
        setImportResult({
          title: 'Hasil Impor Data Guru via Excel',
          success: true,
          addedCount,
          updatedCount,
          skippedCount,
          details
        });
        setShowImportResultModal(true);
        window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
      } catch (err: any) {
        alert('Gagal membaca file Excel Guru: ' + (err.message || 'Format tidak valid'));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // --- HANDLERS: SECTION 4 (KREDENSIAL OPERATOR) ---
  const handleUpdateOperatorCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setOpSuccessMsg('');
    setOpErrorMsg('');

    if (!opUsername.trim() || !opPassword.trim()) {
      setOpErrorMsg('Username dan password tidak boleh kosong.');
      return;
    }

    try {
      db.operatorCredentials.update(opUsername, opPassword);
      setOpSuccessMsg('Kredensial Operator berhasil diperbarui!');
      setTimeout(() => setOpSuccessMsg(''), 4000);
    } catch (err: any) {
      setOpErrorMsg('Gagal memperbarui kredensial: ' + (err.message || 'Kesalahan sistem'));
    }
  };

  // --- HANDLERS: SECTION 5 (DATABASE & BACKUP) ---
  const handleForceSyncSupabase = async () => {
    if (!isSupabaseConfigured) return;
    setIsSyncing(true);
    setSyncStatus('Sedang menyingkronkan dengan database Supabase...');
    try {
      const pullRes = await pullAllFromSupabase();
      if (pullRes.success) {
        setSyncStatus('Singkronisasi berhasil! Data lokal dan Supabase telah diperbarui.');
      } else {
        setSyncStatus(`Perhatian: ${pullRes.error || 'Gagal tersambung ke Supabase'}`);
      }
    } catch (err: any) {
      setSyncStatus(`Error: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const [cacheClearMsg, setCacheClearMsg] = useState('');
  const handleCleanAppCacheAndLogs = () => {
    db.clearCacheAndLogs();
    setCacheClearMsg('✅ Cache, log pemberitahuan, dan memori sementara aplikasi berhasil dibersihkan! Beban CPU & memori dioptimalkan.');
    setTimeout(() => setCacheClearMsg(''), 5000);
  };

  const handleBackupJSON = () => {
    const backupData = {
      profil_sekolah: db.profilSekolah.get(),
      guru: db.guru.getAll(),
      siswa: db.siswa.getAll(),
      orang_tua: db.orangTua.getAll(),
      mata_pelajaran: db.mataPelajaran.getAll(),
      jadwal_pelajaran: db.jadwalPelajaran.getAll(),
      absensi: db.absensi.getAll(),
      daftar_tugas: db.daftarTugas.getAll(),
      tugas_siswa: db.tugasSiswa.getAll(),
      asesmen: db.asesmen.getAll(),
      temuan_khusus: db.temuanKhusus.getAll(),
      buku_digital: db.bukuDigital.getAll(),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KELAS_KU_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (data.profil_sekolah) db.profilSekolah.update(data.profil_sekolah);
        if (Array.isArray(data.guru)) db.guru.save(data.guru);
        if (Array.isArray(data.siswa)) db.siswa.save(data.siswa);
        if (Array.isArray(data.orang_tua)) db.orangTua.save(data.orang_tua);
        if (Array.isArray(data.mata_pelajaran)) db.mataPelajaran.save(data.mata_pelajaran);
        if (Array.isArray(data.jadwal_pelajaran)) db.jadwalPelajaran.save(data.jadwal_pelajaran);
        if (Array.isArray(data.absensi)) db.absensi.save(data.absensi);
        if (Array.isArray(data.daftar_tugas)) db.daftarTugas.save(data.daftar_tugas);
        if (Array.isArray(data.tugas_siswa)) db.tugasSiswa.save(data.tugas_siswa);
        if (Array.isArray(data.asesmen)) db.asesmen.save(data.asesmen);
        if (Array.isArray(data.temuan_khusus)) db.temuanKhusus.save(data.temuan_khusus);
        if (Array.isArray(data.buku_digital)) db.bukuDigital.save(data.buku_digital);

        alert('Restore data berhasil dilakukan! Halaman akan dimuat ulang.');
        window.location.reload();
      } catch (err) {
        alert('Gagal membaca file backup JSON. Format tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
            <Settings className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-black">Pengaturan Aplikasi Operator (System Admin)</h2>
            <p className="text-xs text-blue-200 mt-1">
              Pusat kendali konfigurasi sekolah, struktur kelas, template data, keamanan akun, dan integrasi database.
            </p>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {saveMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. KELOLA PROFIL SEKOLAH & LOGO INSTANSI                                   */}
      {/* ========================================================================= */}
      <form onSubmit={handleSaveProfil} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">1. Kelola Profil Sekolah &amp; Logo Instansi</h3>
              <p className="text-[11px] text-slate-500">Identitas resmi lembaga sekolah, logo kop laporan/rapor, periode akademik aktif, akreditasi, dan wilayah.</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full">
            Umum #1
          </span>
        </div>

        {/* LOGO INSTANSI SEKOLAH (UPLOAD & URL INPUT) */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Image className="w-4 h-4 text-indigo-500" />
              Logo Resmi Instansi Sekolah
            </label>
            <span className="text-[10px] text-slate-400">Digunakan untuk Header Rapor, Kartu Siswa, dan Kop Laporan</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {profil.logoUrl ? (
              <div className="relative group shrink-0">
                <img
                  src={profil.logoUrl}
                  alt="Logo Sekolah"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-md bg-white dark:bg-slate-900"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow cursor-pointer transition-colors"
                  title="Hapus Logo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md border-2 border-indigo-400 shrink-0">
                {profil.namaSekolah ? profil.namaSekolah.substring(0, 2).toUpperCase() : 'SD'}
              </div>
            )}

            <div className="flex-1 w-full space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload Logo Baru</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSchoolLogoChange}
                    className="hidden"
                  />
                </label>
                {profil.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Hapus Logo
                  </button>
                )}
                <span className="text-[11px] text-slate-400">Format PNG/JPG/WebP, disarankan maks 2MB</span>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Atau tautkan URL gambar logo online:
                </label>
                <input
                  type="text"
                  value={profil.logoUrl || ''}
                  onChange={(e) => setProfil({ ...profil, logoUrl: e.target.value })}
                  placeholder="https://contoh.com/logo-sekolah.png"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* IDENTITAS SEKOLAH */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Sekolah / Lembaga
            </label>
            <input
              type="text"
              value={profil.namaSekolah || ''}
              onChange={(e) => setProfil({ ...profil, namaSekolah: e.target.value })}
              placeholder="Misal: SD NEGERI KITA"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              NPSN Sekolah
            </label>
            <input
              type="text"
              value={profil.npsn || ''}
              onChange={(e) => setProfil({ ...profil, npsn: e.target.value })}
              placeholder="Nomor Pokok Sekolah Nasional"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tahun Pelajaran Aktif
            </label>
            <input
              type="text"
              value={profil.tahunPelajaran || '2025/2026'}
              onChange={(e) => setProfil({ ...profil, tahunPelajaran: e.target.value })}
              placeholder="Contoh: 2025/2026"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Kepala Sekolah
            </label>
            <input
              type="text"
              value={profil.kepalaSekolah || ''}
              onChange={(e) => setProfil({ ...profil, kepalaSekolah: e.target.value })}
              placeholder="Nama Kepala Sekolah & Gelar"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              NIP Kepala Sekolah
            </label>
            <input
              type="text"
              value={profil.nipKepalaSekolah || ''}
              onChange={(e) => setProfil({ ...profil, nipKepalaSekolah: e.target.value })}
              placeholder="NIP Kepala Sekolah"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Status Akreditasi
            </label>
            <select
              value={profil.akreditasi || 'A'}
              onChange={(e) => setProfil({ ...profil, akreditasi: e.target.value as any })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="A">Terakreditasi A (Sangat Baik / Unggul)</option>
              <option value="B">Terakreditasi B (Baik)</option>
              <option value="C">Terakreditasi C (Cukup)</option>
              <option value="Belum Terakreditasi">Belum Terakreditasi</option>
            </select>
          </div>
        </div>

        {/* DETAIL ALAMAT WILAYAH SEKOLAH */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Detail Alamat Wilayah &amp; Kop Surat Laporan PDF</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Jalan / No. Bangunan</label>
              <input
                type="text"
                value={profil.jalan || ''}
                onChange={(e) => setProfil({ ...profil, jalan: e.target.value })}
                placeholder="Jl. Pendidikan No. 45"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">RT / RW</label>
              <input
                type="text"
                value={profil.rtRw || ''}
                onChange={(e) => setProfil({ ...profil, rtRw: e.target.value })}
                placeholder="RT 02 / RW 04"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Dusun / Lingkungan</label>
              <input
                type="text"
                value={profil.dusun || ''}
                onChange={(e) => setProfil({ ...profil, dusun: e.target.value })}
                placeholder="Dusun Krajan"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Desa / Kelurahan</label>
              <input
                type="text"
                value={profil.desa || ''}
                onChange={(e) => setProfil({ ...profil, desa: e.target.value })}
                placeholder="Desa Sukamaju"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Kecamatan</label>
              <input
                type="text"
                value={profil.kecamatan || ''}
                onChange={(e) => setProfil({ ...profil, kecamatan: e.target.value })}
                placeholder="Kec. Cibinong"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">Kabupaten / Kota (Kop PDF)</label>
              <input
                type="text"
                value={profil.kabupaten || ''}
                onChange={(e) => setProfil({ ...profil, kabupaten: e.target.value })}
                placeholder="Kabupaten Bogor"
                className="w-full bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 dark:text-indigo-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Provinsi &amp; Kode Pos</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={profil.provinsi || ''}
                  onChange={(e) => setProfil({ ...profil, provinsi: e.target.value })}
                  placeholder="Jawa Barat"
                  className="w-2/3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={profil.kodePos || ''}
                  onChange={(e) => setProfil({ ...profil, kodePos: e.target.value })}
                  placeholder="16911"
                  className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingProfil}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            {isSavingProfil ? 'Menyimpan...' : 'Simpan Profil & Logo Sekolah'}
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* PENGATURAN TEMA TAMPILAN (THEME CONTROL)                                  */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Pengaturan &amp; Kontrol Tema Tampilan</h3>
              <p className="text-[11px] text-slate-500">Pilih mode tampilan warna aplikasi (Terang, Gelap, atau Otomatis sesuai sistem) untuk kenyamanan penggunaan.</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-full">
            Tema Active: Mode {resolvedTheme === 'dark' ? 'Gelap' : 'Terang'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Light Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              theme === 'light'
                ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/50 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-500 text-white rounded-xl">
                <Sun className="w-5 h-5" />
              </div>
              {theme === 'light' && (
                <span className="text-[10px] font-extrabold bg-amber-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Aktif
                </span>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Mode Terang (Light Mode)</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Latar belakang putih bersih dengan kontras tinggi, ideal untuk lingkungan dengan pencahayaan terang.
              </p>
            </div>
          </button>

          {/* Dark Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              theme === 'dark'
                ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-400/50 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-indigo-600 text-white rounded-xl">
                <Moon className="w-5 h-5" />
              </div>
              {theme === 'dark' && (
                <span className="text-[10px] font-extrabold bg-indigo-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Aktif
                </span>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Mode Gelap (Dark Mode)</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tampilan bernuansa gelap lembut yang mengurangi silau dan kelelahan mata di malam hari.
              </p>
            </div>
          </button>

          {/* System Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              theme === 'system'
                ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/50 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-600 text-white rounded-xl">
                <Laptop className="w-5 h-5" />
              </div>
              {theme === 'system' && (
                <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Aktif
                </span>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Otomatis (Sistem)</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Otomatis menyesuaikan dengan preferensi mode terang/gelap sistem operasi pada komputer atau smartphone Anda.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MANAJEMEN KELAS SEKOLAH                                                */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">2. Manajemen Kelas Sekolah</h3>
              <p className="text-[11px] text-slate-500">Kelola daftar kelas resmi sekolah (Tambah Kelas Baru, Edit Nama Kelas, dan Hapus Kelas).</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full">
              Umum #2
            </span>
            <button
              type="button"
              onClick={() => {
                setNewClassNameInput('');
                setShowAddClassModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Kelas Baru
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {classList.map((cls) => {
            const studentCount = siswas.filter(s => s.kelas === cls).length;
            return (
              <div
                key={cls}
                className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 hover:border-emerald-300 dark:hover:border-slate-700 transition-all"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">{cls}</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">{studentCount} Siswa Terdaftar</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEditClassModal(cls)}
                    className="p-2 bg-white dark:bg-slate-900 rounded-xl text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                    title="Edit Nama Kelas"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClassConfirm(cls)}
                    className="p-2 bg-white dark:bg-slate-900 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                    title="Hapus Kelas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PUSAT UNDUHAN TEMPLATE EXCEL & IMPOR DATA                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">3. Pusat Unduhan Template Excel &amp; Impor Data Master</h3>
              <p className="text-[11px] text-slate-500">Unduh template format resmi Excel (.xlsx) serta fasilitas unggah/migrasi data guru, siswa, &amp; presensi.</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-full">
            Data &amp; Excel #3
          </span>
        </div>

        {/* Download Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Siswa */}
          <button
            type="button"
            onClick={handleDownloadTemplateSiswa}
            className="p-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer text-left"
          >
            <div>
              <span className="block font-bold">👨‍🎓 Template Data Siswa</span>
              <span className="text-[10px] font-normal text-slate-400">Termasuk Ortu &amp; Validasi Kelas</span>
            </div>
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </button>

          {/* 2. Absensi */}
          <button
            type="button"
            onClick={handleDownloadTemplateAbsensi}
            className="p-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer text-left"
          >
            <div>
              <span className="block font-bold">📋 Template Absensi Harian</span>
              <span className="text-[10px] font-normal text-slate-400">Dropdown Hadir, Sakit, Izin, Alfa</span>
            </div>
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </button>

          {/* 3. Guru */}
          <button
            type="button"
            onClick={handleDownloadTemplateGuru}
            className="p-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer text-left"
          >
            <div>
              <span className="block font-bold">👨‍🏫 Template Data Guru</span>
              <span className="text-[10px] font-normal text-slate-400">PNS/P3K/Honorer &amp; Wali Kelas</span>
            </div>
            <Download className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
          </button>

          {/* 4. Mata Pelajaran */}
          <button
            type="button"
            onClick={() => {
              exportToExcel([
                { kodeMapel: 'MAPEL-01', namaMapel: 'Bahasa Indonesia', kelompok: 'A', idGuru: 'GURU-01', kelas: 'Kelas 6' },
                { kodeMapel: 'MAPEL-02', namaMapel: 'Matematika', kelompok: 'A', idGuru: 'GURU-02', kelas: 'Kelas 6' }
              ], [
                { key: 'kodeMapel', label: 'Kode Mapel' },
                { key: 'namaMapel', label: 'Nama Mata Pelajaran' },
                { key: 'kelompok', label: 'Kelompok' },
                { key: 'idGuru', label: 'ID Guru' },
                { key: 'kelas', label: 'Target Kelas' }
              ], 'TEMPLATE_MATA_PELAJARAN');
            }}
            className="p-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer text-left"
          >
            <div>
              <span className="block font-bold">📘 Template Mata Pelajaran</span>
              <span className="text-[10px] font-normal text-slate-400">Kode &amp; Kelompok Mapel</span>
            </div>
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </button>

          {/* 5. Jadwal Pelajaran */}
          <button
            type="button"
            onClick={() => {
              exportToExcel([
                { hari: 'Senin', jamKe: 1, waktu: '07:00 - 07:35', namaMapel: 'Bahasa Indonesia', namaGuru: 'Budi Santoso, S.Pd', kelas: 'Kelas 6' },
                { hari: 'Senin', jamKe: 2, waktu: '07:35 - 08:10', namaMapel: 'Matematika', namaGuru: 'Siti Rahma, M.Pd', kelas: 'Kelas 6' }
              ], [
                { key: 'hari', label: 'Hari' },
                { key: 'jamKe', label: 'Jam Ke' },
                { key: 'waktu', label: 'Waktu' },
                { key: 'namaMapel', label: 'Mata Pelajaran' },
                { key: 'namaGuru', label: 'Guru Pengampu' },
                { key: 'kelas', label: 'Kelas' }
              ], 'TEMPLATE_JADWAL_PELAJARAN');
            }}
            className="p-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer text-left"
          >
            <div>
              <span className="block font-bold">📅 Template Jadwal Pelajaran</span>
              <span className="text-[10px] font-normal text-slate-400">Sesi Waktu &amp; Ruangan</span>
            </div>
            <Download className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          </button>

          {/* 6. Nilai Asesmen */}
          <button
            type="button"
            onClick={() => {
              exportToExcel([
                { nisn: '0123456789', namaSiswa: 'Ahmad Dahlan', kelas: 'Kelas 6', namaMapel: 'Bahasa Indonesia', tipe: 'harian', namaPenilaian: 'T1', nilai: 85 }
              ], [
                { key: 'nisn', label: 'NISN' },
                { key: 'namaSiswa', label: 'Nama Siswa' },
                { key: 'kelas', label: 'Kelas' },
                { key: 'namaMapel', label: 'Mata Pelajaran' },
                { key: 'tipe', label: 'Tipe' },
                { key: 'namaPenilaian', label: 'Nama Penilaian' },
                { key: 'nilai', label: 'Nilai' }
              ], 'TEMPLATE_NILAI_ASESMEN');
            }}
            className="p-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer text-left"
          >
            <div>
              <span className="block font-bold">📝 Template Nilai Asesmen</span>
              <span className="text-[10px] font-normal text-slate-400">Formatif &amp; Sumatif</span>
            </div>
            <Download className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          </button>
        </div>


      </div>

      {/* ========================================================================= */}
      {/* 4. UBAH USERNAME & PASSWORD OPERATOR                                      */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">4. Ubah Username &amp; Password Operator</h3>
              <p className="text-[11px] text-slate-500">Sesuaikan kredensial masuk akun Administrator / Operator utama Anda di sini.</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-full">
            Keamanan #4
          </span>
        </div>

        <form onSubmit={handleUpdateOperatorCredentials} className="space-y-4 max-w-2xl">
          {opSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {opSuccessMsg}
            </div>
          )}
          {opErrorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {opErrorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama Pengguna (Username) Operator Baru</label>
              <input
                type="text"
                value={opUsername}
                onChange={(e) => setOpUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="Masukkan nama pengguna baru..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Kata Sandi (Password) Operator Baru</label>
              <input
                type="password"
                value={opPassword}
                onChange={(e) => setOpPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="Masukkan kata sandi baru..."
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-2xl cursor-pointer shadow-sm transition-all"
            >
              Simpan Kredensial Operator
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 5. DATABASE & SINKRONISASI                                                */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">5. Database &amp; Sinkronisasi</h3>
              <p className="text-[11px] text-slate-500">Pusat integrasi multi-cloud (Supabase &amp; Firebase), realtime sinkronisasi, serta pencadangan data sekolah.</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-full">
            Infrastruktur #5
          </span>
        </div>

        {/* 1. Supabase Cloud Integration Module */}
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 space-y-4">
          <SupabaseSettingsTab />
        </div>

        {/* 2. Firebase Cloud Integration Module */}
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-4">
          <FirebaseSettingsTab />
        </div>

        {/* 3. Global Local Backup & Maintenance Section */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Cadangan &amp; Pemeliharaan Database Lokal:
            </span>
            <span className="text-[11px] text-slate-500">
              Format Standar .JSON
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBackupJSON}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Cadangkan Database Lokal (.JSON)
            </button>

            <label className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer transition-all shadow-sm border border-slate-300 dark:border-slate-700">
              <Upload className="w-4 h-4" />
              Pulihkan Database (.JSON)
              <input type="file" accept=".json" onChange={handleRestoreJSON} className="hidden" />
            </label>

            <button
              onClick={handleCleanAppCacheAndLogs}
              className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer transition-all shadow-sm border border-rose-200 dark:border-rose-800/50"
            >
              <Trash2 className="w-4 h-4" />
              Bersihkan Cache &amp; Log Chat App (Optimasi CPU)
            </button>
          </div>
        </div>

        {cacheClearMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cacheClearMsg}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. INTEGRASI WEBHOOK GOOGLE FORM                                         */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">6. Webhook Integrasi Google Form</h3>
              <p className="text-[11px] text-slate-500">Endpoint server untuk penyerapan nilai otomatis dari Google Apps Script.</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-full">
            Integrasi #6
          </span>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 rounded-2xl border border-sky-100 dark:border-sky-900/50 space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <div className="font-bold text-sky-800 dark:text-sky-300 text-xs flex items-center gap-1.5">
              <Server className="w-4 h-4" /> Apa itu Webhook Integrasi Google Form?
            </div>
            <p className="leading-relaxed">
              <strong>Webhook</strong> ini berfungsi sebagai jembatan otomatis (<em>real-time bridge</em>) antara <strong>Google Form / Google Sheet</strong> tugas kuis dan sistem aplikasi. Begitu siswa selesai mengerjakan kuis di Google Form dan menekan tombol <strong>Submit</strong>, Google Apps Script akan langsung menembakkan nilai ke server ini tanpa perlu input manual.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Endpoint Webhook Server Nilai Kuis (POST):
            </label>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-xs text-sky-600 dark:text-sky-400 font-bold select-all border border-slate-300 dark:border-slate-700 break-all">
              {window.location.origin}/api/webhook/google-form
            </div>
            <p className="text-[11px] text-slate-500">
              Pemicu <code>onFormSubmit</code> di Google Apps Script akan mengirimkan nilai kuis secara otomatis ke endpoint di atas.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              Alur Kerja Penyerapan Nilai Otomatis:
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
              <li>Guru membuat kuis di <strong>Google Form</strong> dan menghubungkannya ke <strong>Google Sheet</strong> respon.</li>
              <li>Pada Google Sheet tersebut, buka menu <strong>Ekstensi &gt; Apps Script</strong> dan pasang skrip penembak Webhook.</li>
              <li>Saat siswa submit kuis, skrip membaca <em>Email/NISN</em>, <em>ID Tugas</em>, dan <em>Skor Nilai</em>.</li>
              <li>Server memvalidasi data dan otomatis menyimpannya ke tabel <code>tugas_siswa</code> dan <code>penilaian</code> (Asesmen) di database cloud (Supabase/Firebase).</li>
            </ol>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. KEBIJAKAN PRIVASI & ISOLASI DATA WARGA SEKOLAH                         */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-m3-border dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">7. Kebijakan Privasi &amp; Isolasi Data Warga Sekolah</h3>
              <p className="text-[11px] text-slate-500">Aturan hak akses dan keamanan antar peran di dalam aplikasi.</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-full">
            Aturan Hak Akses #7
          </span>
        </div>

        <div className="p-4 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl space-y-2 text-xs text-rose-900 dark:text-rose-200">
          <div className="font-extrabold flex items-center gap-1.5 text-sm text-rose-700 dark:text-rose-300">
            <Lock className="w-4 h-4" /> Sistem "Kamar Privasi" Terisolasi Aktif
          </div>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            Aplikasi ini mengisolasi data antar kelas untuk menjaga kerahasiaan dan privasi:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 pl-1">
            <li><strong>Siswa &amp; Orang Tua:</strong> Hanya dapat mengakses tugas, presensi, dan nilai untuk kelas tempat siswa terdaftar.</li>
            <li><strong>Guru Wali Kelas:</strong> Mengelola tugas, absensi, dan penilaian khusus untuk kelas yang diampu.</li>
            <li><strong>Operator / Admin:</strong> Memegang hak akses penuh untuk kontrol seluruh kelas, identitas sekolah, serta pengaturan aplikasi.</li>
          </ul>
        </div>
      </div>

      {/* MODAL TAMBAH KELAS */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-600" />
                Tambah Kelas Baru
              </h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateClassConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama Kelas Baru</label>
                <input
                  type="text"
                  autoFocus
                  value={newClassNameInput}
                  onChange={(e) => setNewClassNameInput(e.target.value)}
                  placeholder="Misal: Kelas 7A atau Kelas I"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT KELAS */}
      {showEditClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                Edit Nama Kelas: {editingClassName}
              </h3>
              <button onClick={() => setShowEditClassModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedClassConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama Kelas Baru</label>
                <input
                  type="text"
                  autoFocus
                  value={editClassNameInput}
                  onChange={(e) => setEditClassNameInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditClassModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HASIL IMPOR DATA */}
      {showImportResultModal && importResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {importResult.title}
              </h3>
              <button onClick={() => setShowImportResultModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900">
                <span className="block text-lg font-black text-emerald-600 dark:text-emerald-400">{importResult.addedCount}</span>
                <span className="text-[10px] font-bold text-slate-500">Ditambahkan</span>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900">
                <span className="block text-lg font-black text-blue-600 dark:text-blue-400">{importResult.updatedCount}</span>
                <span className="text-[10px] font-bold text-slate-500">Diperbarui</span>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900">
                <span className="block text-lg font-black text-amber-600 dark:text-amber-400">{importResult.skippedCount}</span>
                <span className="text-[10px] font-bold text-slate-500">Dilewati</span>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-mono space-y-1">
              {importResult.details.map((dt, idx) => (
                <div key={idx} className="text-slate-600 dark:text-slate-300">{dt}</div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowImportResultModal(false)}
                className="px-5 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-900"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
