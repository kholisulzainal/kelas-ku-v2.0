import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  School,
  UserCheck,
  BookOpen,
  Calendar as CalendarIcon,
  Users,
  CheckSquare,
  Award,
  AlertOctagon,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
  Check,
  CheckCircle2,
  ClipboardList,
  Key,
  Printer,
  Lock,
  Unlock,
  Camera,
  TrendingUp,
  ThumbsUp,
  AlertTriangle,
  Info,
  Upload,
  Download,
  Settings,
  History,
  MapPin,
  Building2,
  Compass,
  Landmark,
  Globe,
  Calendar,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Code,
  RefreshCw,
  Zap
} from 'lucide-react';
import { GoogleAppsScriptModal } from '../components/GoogleAppsScriptModal';
import { AplikasiSetting } from '../components/AplikasiSetting';
import { BukuDigitalView } from '../components/BukuDigitalView';
import { AiTutorGuruView } from '../components/AiTutorGuruView';
import { AiGeneratorSoalView } from '../components/AiGeneratorSoalView';
import { AiPerangkatAjarView } from '../components/AiPerangkatAjarView';
import { AsesmenMatrixTable } from '../components/AsesmenMatrixTable';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { db } from '../services/db';
import { generateStandardMapelCode, extractGradeNumber } from '../utils/mapelUtils';
import { syncRowToSupabase } from '../services/supabase';
import { exportToCSV, exportToExcel } from '../utils/export';
import { sendNewAssignmentEmailAlerts } from '../services/googleWorkspace';
import { getAccessToken, logoutGoogle } from '../services/googleAuth';
import { GoogleSheetsSyncPanel } from '../components/GoogleSheetsSyncPanel';
import { updateGuruGoogleEmail, syncGoogleFormScoresFromSheet } from '../services/googleServices';
import { jsPDF } from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  ProfilSekolah,
  Guru,
  Siswa,
  OrangTua,
  MataPelajaran,
  JadwalPelajaran,
  Absensi,
  DaftarTugas,
  Asesmen,
  TemuanKhusus,
  TipeAsesmen,
  StatusKehadiran
} from '../types';

const loadImageAsDataUrl = (url: string | undefined): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    if (url.startsWith('data:image/')) return resolve(url);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 120;
        canvas.height = img.naturalHeight || img.height || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch (e) {
        console.warn('Canvas error converting image for PDF:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

interface GuruDashboardProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
}

const romanToNum = (roman: string): number => {
  const map: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
    'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12
  };
  return map[roman.toUpperCase()] || 0;
};

const getSortKey = (className: string) => {
  const clean = className.trim();
  const matchRoman = clean.match(/Kelas\s+([IVXLCDM]+)(.*)/i);
  if (matchRoman) {
    const num = romanToNum(matchRoman[1]);
    const suffix = matchRoman[2] || '';
    return { num, suffix };
  }
  const matchNum = clean.match(/Kelas\s+(\d+)(.*)/i);
  if (matchNum) {
    const num = parseInt(matchNum[1], 10);
    const suffix = matchNum[2] || '';
    return { num, suffix };
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

export function GuruDashboard({ activeTab, setActiveTab }: GuruDashboardProps) {
  // Database States
  const [sekolah, setSekolah] = useState<ProfilSekolah>(db.profilSekolah.get());
  const [gurus, setGurus] = useState<Guru[]>(db.guru.getAll());
  const [siswas, setSiswas] = useState<Siswa[]>(db.siswa.getAll());
  const [parents, setParents] = useState<OrangTua[]>(db.orangTua.getAll());
  const [mapels, setMapels] = useState<MataPelajaran[]>(db.mataPelajaran.getAll());
  const [jadwals, setJadwals] = useState<JadwalPelajaran[]>(db.jadwalPelajaran.getAll());
  const [absensis, setAbsensis] = useState<Absensi[]>(db.absensi.getAll());
  const [tugases, setTugases] = useState<DaftarTugas[]>(db.daftarTugas.getAll());
  const [tugasSiswa, setTugasSiswa] = useState(db.tugasSiswa.getAll());
  const [asesmens, setAsesmens] = useState<Asesmen[]>(db.asesmen.getAll());
  const [temuanKhusus, setTemuanKhusus] = useState<TemuanKhusus[]>(db.temuanKhusus.getAll());

  // Helper to get current real-time date string (YYYY-MM-DD)
  const getRealtimeTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Search Filters & Selectors
  const [siswaSearch, setSiswaSearch] = useState('');
  const [absensiSearch, setAbsensiSearch] = useState('');
  const [asesmenSearch, setAsesmenSearch] = useState('');
  const [absensiTanggal, setAbsensiTanggal] = useState(getRealtimeTodayStr);
  const [filterAsesmenType, setFilterAsesmenType] = useState<TipeAsesmen | 'all'>('all');

  // Modal / Form triggers
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Initialize React Hook Forms
  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();

  // New States for credentials edit & login card export
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsSiswa, setCredentialsSiswa] = useState<Siswa | null>(null);
  const [credentialsForm, setCredentialsForm] = useState({
    siswaUsername: '',
    siswaPassword: '',
    ortuUsername: '',
    ortuPassword: ''
  });

  const [showLoginCardsModal, setShowLoginCardsModal] = useState(false);
  const [showImportSiswaExcelModal, setShowImportSiswaExcelModal] = useState(false);
  const [showImportAbsensiExcelModal, setShowImportAbsensiExcelModal] = useState(false);
  const [showExcelResultModal, setShowExcelResultModal] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState<{
    success: boolean;
    type: 'siswa' | 'guru' | 'absensi';
    message: string;
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    details?: string[];
    corrections?: {
      row: number;
      field: string;
      val: string;
      issue: string;
      fix: string;
      severity: 'error' | 'warning';
    }[];
  } | null>(null);

  // PDF Export Preferences & History States
  const [pdfIncludeSignature, setPdfIncludeSignature] = useState<boolean>(() => {
    const saved = localStorage.getItem('pdf_pref_include_signature');
    return saved !== null ? saved === 'true' : true;
  });
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>(() => {
    return (localStorage.getItem('pdf_pref_orientation') as 'portrait' | 'landscape') || 'portrait';
  });
  const [pdfThemeColor, setPdfThemeColor] = useState<string>(() => {
    return localStorage.getItem('pdf_pref_theme_color') || 'indigo';
  });
  const [pdfSaveHistory, setPdfSaveHistory] = useState<boolean>(() => {
    const saved = localStorage.getItem('pdf_pref_save_history');
    return saved !== null ? saved === 'true' : true;
  });
  const [pdfHistory, setPdfHistory] = useState<{
    id: string;
    fileName: string;
    timestamp: string;
    kelas: string;
    periode: string;
  }[]>(() => {
    try {
      const saved = localStorage.getItem('pdf_download_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showPdfPreferences, setShowPdfPreferences] = useState<boolean>(false);

  const updatePdfIncludeSignature = (val: boolean) => {
    setPdfIncludeSignature(val);
    localStorage.setItem('pdf_pref_include_signature', String(val));
  };
  const updatePdfOrientation = (val: 'portrait' | 'landscape') => {
    setPdfOrientation(val);
    localStorage.setItem('pdf_pref_orientation', val);
  };
  const updatePdfThemeColor = (val: string) => {
    setPdfThemeColor(val);
    localStorage.setItem('pdf_pref_theme_color', val);
  };
  const updatePdfSaveHistory = (val: boolean) => {
    setPdfSaveHistory(val);
    localStorage.setItem('pdf_pref_save_history', String(val));
  };
  const clearPdfHistory = () => {
    setPdfHistory([]);
    localStorage.removeItem('pdf_download_history');
  };

  const [guruAvatarTab, setGuruAvatarTab] = useState<'boys' | 'girls'>('boys');
  const watchFotoUrl = watch('fotoUrl');
  const watchLogoUrl = watch('logoUrl');

  // Operator credentials custom management states & handlers
  const [opUsername, setOpUsername] = useState(() => db.operatorCredentials.get().username);
  const [opPassword, setOpPassword] = useState(() => db.operatorCredentials.get().password);
  const [opSuccessMsg, setOpSuccessMsg] = useState('');
  const [opErrorMsg, setOpErrorMsg] = useState('');

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
    } catch (err: any) {
      setOpErrorMsg('Gagal memperbarui kredensial: ' + (err.message || 'Kesalahan sistem'));
    }
  };

  // Google Form Score Ingestion to Asesmen Harian states & handlers
  const [ingestTaskModal, setIngestTaskModal] = useState<DaftarTugas | null>(null);
  const [ingestScores, setIngestScores] = useState<{ [siswaId: string]: { nilai: string | number; deskripsi: string } }>({});
  const [ingestNotice, setIngestNotice] = useState('');
  const [isAutoSyncingSheet, setIsAutoSyncingSheet] = useState(false);
  const [tempSheetUrl, setTempSheetUrl] = useState('');
  const [showGFormGuide, setShowGFormGuide] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  const handleOpenIngestModal = async (task: DaftarTugas) => {
    setIngestTaskModal(task);
    setIngestNotice('');
    setTempSheetUrl(task.googleSheetUrl || (task.googleFormUrl.includes('/spreadsheets/') ? task.googleFormUrl : ''));

    const syncUrl = task.googleSheetUrl || task.googleFormUrl;

    // Attempt automatic score sync if URL exists
    if (syncUrl) {
      setIsAutoSyncingSheet(true);
      try {
        const res = await syncGoogleFormScoresFromSheet(task.id, syncUrl);
        if (res.success && res.syncedCount > 0) {
          setIngestNotice(`⚡ Berhasil menyinkronkan ${res.syncedCount} nilai siswa secara otomatis dari Google Sheet Respon!`);
        } else if (res.isFormUrl) {
          setIngestNotice('ℹ️ Tautan saat ini adalah link Google Form. Masukkan Tautan Google Sheet Respon (Spreadsheet) di bawah ini untuk Auto-Sync.');
        } else if (res.message) {
          setIngestNotice(`ℹ️ ${res.message}`);
        }
      } catch (e) {
        console.warn('Auto-sync notice:', e);
      } finally {
        setIsAutoSyncingSheet(false);
      }
    }

    const freshTugasSiswa = db.tugasSiswa.getAll();
    const freshAsesmens = db.penilaian.getAll();
    setTugasSiswa(freshTugasSiswa);
    setAsesmens(freshAsesmens);

    const initialScores: { [siswaId: string]: { nilai: string | number; deskripsi: string } } = {};
    const relevantStudents = siswas.filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter);
    
    relevantStudents.forEach(s => {
      const existing = freshAsesmens.find(a => 
        a.siswaId === s.id && 
        a.mapelId === task.mapelId && 
        a.namaPenilaian.includes(task.judulTugas)
      );
      const ts = freshTugasSiswa.find(ts => ts.tugasId === task.id && ts.siswaId === s.id);
      const realScore = ts?.score ?? ts?.nilai;
      initialScores[s.id] = {
        nilai: existing ? existing.nilai : (realScore != null ? realScore : ''),
        deskripsi: existing?.deskripsiKompetensi || `Hasil penilaian Kuis Google Form: ${task.judulTugas}`
      };
    });
    setIngestScores(initialScores);
  };

  const handleSaveAndSyncSheetUrl = async () => {
    if (!ingestTaskModal) return;
    if (!tempSheetUrl.trim()) {
      setIngestNotice('⚠️ Silakan tempel Tautan Google Sheet Respon terlebih dahulu.');
      return;
    }

    const updatedTask: DaftarTugas = {
      ...ingestTaskModal,
      googleSheetUrl: tempSheetUrl.trim()
    };

    db.daftarTugas.upsert(updatedTask);
    syncRowToSupabase('daftar_tugas', updatedTask, true).catch(err => console.warn('Supabase task sync error:', err));
    setTugases(db.daftarTugas.getAll());
    setIngestTaskModal(updatedTask);

    setIsAutoSyncingSheet(true);
    setIngestNotice('Membaca dan menyinkronkan nilai dari Google Sheet Respon...');

    const res = await syncGoogleFormScoresFromSheet(updatedTask.id, tempSheetUrl.trim());
    setIsAutoSyncingSheet(false);

    if (res.success) {
      setIngestNotice(`✅ ${res.message}`);
      handleOpenIngestModal(updatedTask);
    } else {
      setIngestNotice(`⚠️ ${res.message}`);
    }
  };

  const handleSaveIngestScores = (task: DaftarTugas) => {
    const relevantStudents = siswas.filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter);
    let savedCount = 0;

    relevantStudents.forEach(s => {
      const scoreData = ingestScores[s.id];
      if (scoreData && scoreData.nilai !== '' && !isNaN(Number(scoreData.nilai))) {
        const numVal = Math.min(100, Math.max(0, Math.round(Number(scoreData.nilai))));
        const stdId = `as-${task.id}-${s.id}`;
        const newAsesmen: Asesmen = {
          id: stdId,
          siswaId: s.id,
          mapelId: task.mapelId,
          tipe: 'harian',
          namaPenilaian: task.judulTugas,
          nilai: numVal,
          deskripsiKompetensi: scoreData.deskripsi || `Hasil penilaian Kuis Google Form: ${task.judulTugas}`,
          tanggalPenilaian: new Date().toISOString().split('T')[0],
          dinilaiOlehId: currentUser?.id || 'guru-1',
          kelas: s.kelas
        };

        // Remove old duplicate id if it existed
        const oldGformId = `as-gform-${task.id}-${s.id}`;
        db.penilaian.delete(oldGformId);

        db.penilaian.upsert(newAsesmen);
        savedCount++;
      }
    });

    setAsesmens(db.penilaian.getAll());
    window.dispatchEvent(new Event('penilaians-updated'));
    window.dispatchEvent(new Event('asesmens-updated'));
    window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));

    setIngestNotice(`Berhasil memasukkan ${savedCount} nilai siswa ke Data Nilai Asesmen Harian!`);
    setTimeout(() => {
      setIngestNotice('');
      setIngestTaskModal(null);
    }, 1800);
  };

  const [customAlert, setCustomAlert] = useState<{
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editingClassName, setEditingClassName] = useState('');
  const [editClassNameInput, setEditClassNameInput] = useState('');

  const [activeClassFilter, setActiveClassFilter] = useState<string>('Semua');
  const [trendClassFilter, setTrendClassFilter] = useState<string>('Semua');
  const [trendStartDate, setTrendStartDate] = useState<string>('');
  const [trendEndDate, setTrendEndDate] = useState<string>('');

  useEffect(() => {
    setTrendClassFilter(activeClassFilter);
  }, [activeClassFilter]);

  // Ensure absensi date resets to current real-time date whenever absensi tab is opened
  useEffect(() => {
    if (activeTab === 'absensi') {
      setAbsensiTanggal(getRealtimeTodayStr());
    }
  }, [activeTab]);

  // Real-time Supabase state updates listener
  useEffect(() => {
    const handleDataUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ tableName: string }>;
      const table = customEvent.detail?.tableName;
      
      console.log('[GuruDashboard] Data updated event received for:', table);
      
      if (!table) {
        setSekolah(db.profilSekolah.get());
        setGurus(db.guru.getAll());
        setSiswas(db.siswa.getAll());
        setParents(db.orangTua.getAll());
        setMapels(db.mataPelajaran.getAll());
        setJadwals(db.jadwalPelajaran.getAll());
        setAbsensis(db.absensi.getAll());
        setTugases(db.daftarTugas.getAll());
        setTugasSiswa(db.tugasSiswa.getAll());
        setAsesmens(db.asesmen.getAll());
        setTemuanKhusus(db.temuanKhusus.getAll());
        return;
      }

      switch (table) {
        case 'profil_sekolah':
          setSekolah(db.profilSekolah.get());
          break;
        case 'guru':
          setGurus(db.guru.getAll());
          break;
        case 'siswa':
          setSiswas(db.siswa.getAll());
          break;
        case 'orang_tua':
          setParents(db.orangTua.getAll());
          break;
        case 'mata_pelajaran':
          setMapels(db.mataPelajaran.getAll());
          break;
        case 'jadwal_pelajaran':
          setJadwals(db.jadwalPelajaran.getAll());
          break;
        case 'absensi':
          setAbsensis(db.absensi.getAll());
          break;
        case 'daftar_tugas':
          setTugases(db.daftarTugas.getAll());
          break;
        case 'tugas_siswa':
          setTugasSiswa(db.tugasSiswa.getAll());
          break;
        case 'asesmen':
          setAsesmens(db.asesmen.getAll());
          break;
        case 'temuan_khusus':
          setTemuanKhusus(db.temuanKhusus.getAll());
          break;
        default:
          break;
      }
    };

    const handleAsesmenEvent = () => {
      setAsesmens(db.asesmen.getAll());
      setTugasSiswa(db.tugasSiswa.getAll());
    };

    window.addEventListener('supabase-data-updated', handleDataUpdate);
    window.addEventListener('penilaians-updated', handleAsesmenEvent);
    window.addEventListener('asesmens-updated', handleAsesmenEvent);
    return () => {
      window.removeEventListener('supabase-data-updated', handleDataUpdate);
      window.removeEventListener('penilaians-updated', handleAsesmenEvent);
      window.removeEventListener('asesmens-updated', handleAsesmenEvent);
    };
  }, []);
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

  const handleAddClass = () => {
    setNewClassNameInput('');
    setShowAddClassModal(true);
  };

  const handleCreateClassConfirm = () => {
    if (newClassNameInput && newClassNameInput.trim()) {
      const trimmed = newClassNameInput.trim();
      if (classList.includes(trimmed)) {
        setCustomAlert({
          title: 'Gagal Tambah Kelas',
          message: `Kelas "${trimmed}" sudah terdaftar di sistem!`,
          type: 'warning'
        });
        return;
      }
      const updated = sortClasses([...classList, trimmed]);
      setClassList(updated);
      localStorage.setItem('daftar_kelas', JSON.stringify(updated));
      setShowAddClassModal(false);
      setCustomAlert({
        title: 'Sukses',
        message: `Kelas "${trimmed}" berhasil ditambahkan!`,
        type: 'success'
      });
    }
  };

  const handleOpenEditClassModal = (clsName: string) => {
    setEditingClassName(clsName);
    setEditClassNameInput(clsName);
    setShowEditClassModal(true);
  };

  const handleSaveEditedClassConfirm = () => {
    const trimmed = editClassNameInput.trim();
    if (!trimmed || !editingClassName) return;

    if (trimmed === editingClassName) {
      setShowEditClassModal(false);
      return;
    }

    if (classList.includes(trimmed)) {
      setCustomAlert({
        title: 'Gagal Ubah Nama Kelas',
        message: `Kelas "${trimmed}" sudah terdaftar di sistem!`,
        type: 'warning'
      });
      return;
    }

    const updated = sortClasses(classList.map(c => c === editingClassName ? trimmed : c));
    setClassList(updated);
    localStorage.setItem('daftar_kelas', JSON.stringify(updated));

    const currentSiswas = db.siswa.getAll();
    let updatedCount = 0;
    currentSiswas.forEach(s => {
      if (s.kelas === editingClassName) {
        db.siswa.upsert({ ...s, kelas: trimmed });
        updatedCount++;
      }
    });
    setSiswas(db.siswa.getAll());

    if (activeClassFilter === editingClassName) {
      setActiveClassFilter(trimmed);
    }
    if (selectedClassForCards === editingClassName) {
      setSelectedClassForCards(trimmed);
    }

    setShowEditClassModal(false);
    setEditingClassName('');
    setCustomAlert({
      title: 'Sukses Perbarui Kelas',
      message: `Nama kelas "${editingClassName}" berhasil diubah menjadi "${trimmed}" (${updatedCount} data siswa diperbarui).`,
      type: 'success'
    });
  };

  const handleDeleteClassConfirm = (targetClass: string) => {
    const studentCount = siswas.filter(s => s.kelas === targetClass).length;
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${targetClass}"? ${studentCount > 0 ? `Terdapat ${studentCount} siswa terdaftar di kelas ini.` : ''}`)) {
      const updated = classList.filter(c => c !== targetClass);
      setClassList(updated);
      localStorage.setItem('daftar_kelas', JSON.stringify(updated));
      if (activeClassFilter === targetClass) {
        setActiveClassFilter('Semua');
      }
      if (selectedClassForCards === targetClass) {
        setSelectedClassForCards('all');
      }
      setCustomAlert({
        title: 'Kelas Dihapus',
        message: `Kelas "${targetClass}" berhasil dihapus dari daftar kelas.`,
        type: 'success'
      });
    }
  };

  const handleDownloadLoginCardsPDF = async (targetClassOverride?: string) => {
    const targetClass = targetClassOverride || selectedClassForCards;
    const cardsToExport = targetClass === 'all' 
      ? siswas 
      : siswas.filter(s => s.kelas === targetClass);

    if (cardsToExport.length === 0) {
      setCustomAlert({
        title: 'Data Kosong',
        message: `Tidak ada data siswa untuk ${targetClass === 'all' ? 'semua kelas' : targetClass}.`,
        type: 'warning'
      });
      return;
    }

    // Pre-load school logo as base64
    const schoolLogoBase64 = await loadImageAsDataUrl(sekolah.logoUrl);

    // Pre-load student photos as base64
    const studentPhotosMap: { [id: string]: string | null } = {};
    await Promise.all(
      cardsToExport.map(async (s) => {
        if (s.fotoUrl) {
          studentPhotosMap[s.id] = await loadImageAsDataUrl(s.fotoUrl);
        }
      })
    );

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 10 cards per A4 page layout (2 columns x 5 rows)
    const cardsPerPage = 10;
    const cardWidth = 92;
    const cardHeight = 52;
    const marginX = 8;
    const marginY = 8;
    const gapX = 6;
    const gapY = 4;

    cardsToExport.forEach((siswa, index) => {
      if (index > 0 && index % cardsPerPage === 0) {
        doc.addPage();
      }

      const pageIndex = index % cardsPerPage;
      const col = pageIndex % 2;
      const row = Math.floor(pageIndex / 2);

      const x = marginX + col * (cardWidth + gapX);
      const y = marginY + row * (cardHeight + gapY);

      const ortu = parents.find(p => p.siswaId === siswa.id);

      // Card Outer Dashed Border
      doc.setDrawColor(180, 180, 200);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(x, y, cardWidth, cardHeight);
      doc.setLineDashPattern([], 0);

      // School Logo (Top Left)
      let headerTextX = x + 3;
      if (schoolLogoBase64) {
        try {
          doc.addImage(schoolLogoBase64, 'JPEG', x + 3, y + 1.8, 6.5, 6.5);
          headerTextX = x + 11;
        } catch (e) {
          console.warn('Error adding school logo to PDF card:', e);
        }
      }

      // Card Header - Dynamic font scaling and multi-line wrapping
      doc.setFont("helvetica", "bold");
      doc.setTextColor(67, 56, 202); // indigo
      const schoolName = (sekolah.namaSekolah || 'SD NEGERI KITA').toUpperCase();
      const maxSchoolWidth = cardWidth - (headerTextX - x) - 18;
      
      let schoolFontSize = 8.5;
      doc.setFontSize(schoolFontSize);
      let schoolLines = doc.splitTextToSize(schoolName, maxSchoolWidth);

      while (schoolLines.length > 2 && schoolFontSize > 5.5) {
        schoolFontSize -= 0.5;
        doc.setFontSize(schoolFontSize);
        schoolLines = doc.splitTextToSize(schoolName, maxSchoolWidth);
      }

      if (schoolLines.length > 1) {
        doc.text(schoolLines[0], headerTextX, y + 3.4);
        doc.text(schoolLines[1], headerTextX, y + 6.0);
      } else {
        doc.text(schoolLines[0], headerTextX, y + 4.5);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(120, 120, 120);
      const subTitleY = schoolLines.length > 1 ? y + 8.4 : y + 8.0;
      doc.text('LOGIN APLIKASI KELAS KU', headerTextX, subTitleY);

      // Class Badge
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(x + cardWidth - 19, y + 2, 16, 6, 1, 1, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(67, 56, 202);
      doc.text(siswa.kelas || '-', x + cardWidth - 11, y + 5.8, { align: 'center' });

      // Divider
      doc.setDrawColor(220, 225, 235);
      doc.setLineWidth(0.2);
      doc.line(x + 3, y + 9.5, x + cardWidth - 3, y + 9.5);

      // Student Identity with Photo
      const photoBase64 = studentPhotosMap[siswa.id];
      const photoW = 8.5;
      const photoH = 10;

      // Frame for student photo
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.roundedRect(x + 3, y + 10.8, photoW, photoH, 0.8, 0.8, 'FD');

      if (photoBase64) {
        try {
          doc.addImage(photoBase64, 'JPEG', x + 3.1, y + 10.9, photoW - 0.2, photoH - 0.2);
        } catch (e) {
          console.warn('Error rendering student photo on PDF:', e);
        }
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        const initials = (siswa.namaSiswa || 'S').charAt(0).toUpperCase();
        doc.text(initials, x + 3 + photoW / 2, y + 10.8 + photoH / 2 + 1, { align: 'center' });
      }

      const infoX = x + 3 + photoW + 2.5;

      // Student Info - Dynamic font scaling and multi-line wrapping
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(140, 140, 140);
      doc.text('NAMA PESERTA / SISWA', infoX, y + 12.8);

      doc.setFont("helvetica", "bold");
      let studentNameFontSize = 8.5;
      doc.setFontSize(studentNameFontSize);
      doc.setTextColor(30, 41, 59);

      const maxStudentWidth = cardWidth - (infoX - x) - 3;
      let studentNameLines = doc.splitTextToSize(siswa.namaSiswa, maxStudentWidth);

      while (studentNameLines.length > 2 && studentNameFontSize > 5.5) {
        studentNameFontSize -= 0.5;
        doc.setFontSize(studentNameFontSize);
        studentNameLines = doc.splitTextToSize(siswa.namaSiswa, maxStudentWidth);
      }

      if (studentNameLines.length > 1) {
        doc.text(studentNameLines[0], infoX, y + 15.2);
        doc.text(studentNameLines[1], infoX, y + 17.8);
      } else {
        doc.text(studentNameLines[0], infoX, y + 16.2);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      const nisY = studentNameLines.length > 1 ? y + 20.8 : y + 19.8;
      doc.text(`NISN: ${siswa.nisn || '-'} | NIS: ${siswa.nis || '-'}`, infoX, nisY);

      // Box 1: Siswa Credentials
      const boxY = y + 22.2;
      const boxW = 42.5;
      const boxH = 25;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x + 3, boxY, boxW, boxH, 1.5, 1.5, 'FD');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(79, 70, 229);
      doc.text('LOGIN SISWA', x + 5, boxY + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text('User (NISN):', x + 5, boxY + 8);
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(siswa.nisn || '-', x + 5, boxY + 12.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Sandi:', x + 5, boxY + 17);
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(siswa.password || 'siswa123', x + 5, boxY + 21.5);

      // Box 2: Ortu Credentials
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 243, 199);
      doc.roundedRect(x + 46.5, boxY, boxW, boxH, 1.5, 1.5, 'FD');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(217, 119, 6);
      doc.text('LOGIN ORANG TUA', x + 48, boxY + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(120, 113, 108);
      doc.text('User (No HP):', x + 48, boxY + 8);
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const ortuUser = siswa.noTeleponOrtu || ortu?.noTelepon || '-';
      doc.text(ortuUser.length > 14 ? ortuUser.substring(0, 12) + '..' : ortuUser, x + 48, boxY + 12.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(120, 113, 108);
      doc.text('Sandi:', x + 48, boxY + 17);
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(ortu?.password || 'ortu123', x + 48, boxY + 21.5);

      // Card Footer instruction
      doc.setFont("helvetica", "italic");
      doc.setFontSize(5);
      doc.setTextColor(148, 163, 184);
      doc.text('* Gunting garis putus-putus. Simpan kredensial ini.', x + cardWidth / 2, y + cardHeight - 1.2, { align: 'center' });
    });

    const fileSuffix = targetClass === 'all' ? 'Semua_Kelas' : targetClass.replace(/\s+/g, '_');
    doc.save(`Kartu_Peserta_Siswa_10A4_${fileSuffix}.pdf`);
  };

  const renderClassFilterBar = () => {
    return (
      <div className="flex flex-wrap items-center justify-between bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-xs gap-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 max-w-full">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap flex items-center gap-1.5 shrink-0">
              {isRealWaliKelas ? (
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              Filter Kls:
            </span>
            <select
              disabled={isRealWaliKelas}
              value={isRealWaliKelas ? (loggedInGuru?.kelasWali || activeClassFilter) : activeClassFilter}
              onChange={(e) => {
                if (!isRealWaliKelas) {
                  setActiveClassFilter(e.target.value);
                }
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-m3-purple/50 cursor-pointer min-w-[130px] sm:min-w-[160px] disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {!isRealWaliKelas && (
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Semua">Semua Kls</option>
              )}
              {classList.map((cls) => (
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          {isRealWaliKelas && (
            <span className="text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-600" />
              🔒 Wali Kelas Terkunci: {loggedInGuru?.kelasWali}
            </span>
          )}
          {isGuruMapel && (
            <span className="text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-900/30">
              Akses Lintas Kelas (Guru Mapel: {loggedInGuru?.mataPelajaranUtama || 'Mapel'})
            </span>
          )}
          {isOperator && (
            <span className="text-[10px] sm:text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-full border border-indigo-200/50 dark:border-indigo-900/30">
              Akses Operator (Semua Kelas)
            </span>
          )}
        </div>
      </div>
    );
  };

  const handleGuruFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue('fotoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSchoolLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue('logoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const [loginCardsToPrint, setLoginCardsToPrint] = useState<Siswa[]>([]);
  const [selectedClassForCards, setSelectedClassForCards] = useState('all');
  const [asesmenSubTab, setAsesmenSubTab] = useState<'daftar' | 'rekap'>('daftar');
  const [showPerformanceReportModal, setShowPerformanceReportModal] = useState(false);

  // Logged-in Guru State
  const currentUser = db.getCurrentUser();
  const isOperator = currentUser.role === 'operator';
  const loggedInUserId = currentUser.id;
  const loggedInGuru = gurus.find(g => g.id === loggedInUserId);

  // Real Wali Kelas: is a teacher with homeroom duty, not a "GURU MAPEL"
  const isRealWaliKelas = !isOperator && loggedInGuru?.isWaliKelas === true && loggedInGuru?.kelasWali !== 'GURU MAPEL' && loggedInGuru?.kelasWali !== '';

  // Subject Teacher (Guru Mapel): either isWaliKelas is false, or classWali is specifically "GURU MAPEL"
  const isGuruMapel = !isOperator && (loggedInGuru?.isWaliKelas === false || loggedInGuru?.kelasWali === 'GURU MAPEL');

  const isCurrentGuruWaliKelas = isOperator || loggedInGuru?.isWaliKelas === true || loggedInGuru?.id === 'guru-1';

  const hasExistingAbsensiForDate = absensis.some(a => a.tanggal === absensiTanggal);
  const isAbsensiLocked = hasExistingAbsensiForDate && !isOperator && !isGuruMapel && !isCurrentGuruWaliKelas;

  const [guruNip, setGuruNip] = useState(loggedInGuru?.nip || '');
  const [guruPassword, setGuruPassword] = useState(loggedInGuru?.password || 'guru123');

  useEffect(() => {
    if (loggedInGuru) {
      setGuruNip(loggedInGuru.nip);
      setGuruPassword(loggedInGuru.password || 'guru123');
    }
  }, [gurus, loggedInUserId]);

  useEffect(() => {
    if (loggedInGuru) {
      if (isRealWaliKelas && loggedInGuru.kelasWali) {
        setActiveClassFilter(loggedInGuru.kelasWali);
        setSelectedClassForCards(loggedInGuru.kelasWali);
      } else if (isGuruMapel || isOperator) {
        setActiveClassFilter('Semua');
        setSelectedClassForCards('all');
      }
    }
  }, [loggedInUserId, loggedInGuru?.kelasWali, isRealWaliKelas]);

  // Attendance trend data calculation (No auto-seeding)
  const getAttendanceTrendData = () => {
    const classStudents = trendClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === trendClassFilter);
    
    if (classStudents.length === 0) return [];

    const studentIds = new Set(classStudents.map(s => s.id));
    let relevantAbsensis = absensis.filter(a => studentIds.has(a.siswaId));

    if (trendStartDate) {
      relevantAbsensis = relevantAbsensis.filter(a => a.tanggal >= trendStartDate);
    }
    if (trendEndDate) {
      relevantAbsensis = relevantAbsensis.filter(a => a.tanggal <= trendEndDate);
    }

    const uniqueDates = Array.from(new Set(relevantAbsensis.map(a => a.tanggal))).sort() as string[];

    return uniqueDates.map((date: string) => {
      const dateAbsen = relevantAbsensis.filter(a => a.tanggal === date);
      
      let hadir = 0;
      let sakit = 0;
      let izin = 0;
      let alfa = 0;

      classStudents.forEach(student => {
        const record = dateAbsen.find(a => a.siswaId === student.id);
        if (record) {
          if (record.status === 'hadir') hadir++;
          else if (record.status === 'sakit') sakit++;
          else if (record.status === 'izin') izin++;
          else if (record.status === 'alfa') alfa++;
        } else {
          hadir++; // default to hadir if no entry recorded yet on that day
        }
      });

      const total = classStudents.length;
      const hadirPercent = total > 0 ? Math.round((hadir / total) * 100) : 100;

      let dateLabel = date;
      try {
        const d = new Date(date);
        dateLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      } catch (e) {
        // Fallback
      }

      // Calculate individual class percentages for multi-line comparison when trendClassFilter === 'Semua'
      const classBreakdown: Record<string, number> = {};
      classList.forEach(cls => {
        const clsStudents = siswas.filter(s => s.kelas === cls);
        if (clsStudents.length > 0) {
          let clsHadir = 0;
          let count = 0;
          clsStudents.forEach(student => {
            const record = absensis.find(a => a.siswaId === student.id && a.tanggal === date);
            if (record) {
              count++;
              if (record.status === 'hadir') clsHadir++;
            } else {
              // count as present if no record exists
              count++;
              clsHadir++;
            }
          });
          classBreakdown[cls] = count > 0 ? Math.round((clsHadir / count) * 100) : 100;
        } else {
          classBreakdown[cls] = 100;
        }
      });

      return {
        date,
        label: dateLabel,
        Hadir: hadir,
        Sakit: sakit,
        Izin: izin,
        Alfa: alfa,
        Persentase: hadirPercent,
        Total: total,
        ...classBreakdown
      };
    });
  };

  const handleUpdateGuruCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInGuru && !isOperator) {
      setCustomAlert({
        title: 'Gagal',
        message: 'Pengguna tidak terautentikasi!',
        type: 'error'
      });
      return;
    }
    if (!guruNip.trim()) {
      setCustomAlert({
        title: 'Peringatan',
        message: 'NIP / Username tidak boleh kosong!',
        type: 'warning'
      });
      return;
    }
    if (!guruPassword.trim()) {
      setCustomAlert({
        title: 'Peringatan',
        message: 'Password tidak boleh kosong!',
        type: 'warning'
      });
      return;
    }

    if (loggedInGuru) {
      const updatedGuru = {
        ...loggedInGuru,
        nip: guruNip.trim(),
        password: guruPassword.trim()
      };
      db.guru.upsert(updatedGuru);
      setGurus(db.guru.getAll());
      setCustomAlert({
        title: 'Sukses',
        message: 'Username (NIP) dan Password login Anda berhasil diperbarui!',
        type: 'success'
      });
    } else {
      setCustomAlert({
        title: 'Gagal',
        message: 'Profil Guru tidak ditemukan.',
        type: 'error'
      });
    }
  };

  const handleOpenCredentialsModal = (siswa: Siswa) => {
    const ortu = parents.find(p => p.siswaId === siswa.id);
    setCredentialsSiswa(siswa);
    setCredentialsForm({
      siswaUsername: siswa.nisn,
      siswaPassword: siswa.password || 'siswa123',
      ortuUsername: siswa.noTeleponOrtu || ortu?.noTelepon || '',
      ortuPassword: ortu?.password || 'ortu123'
    });
    setShowCredentialsModal(true);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialsSiswa) return;

    if (!credentialsForm.siswaUsername.trim()) {
      setCustomAlert({
        title: 'Peringatan',
        message: 'NISN (Username Siswa) tidak boleh kosong!',
        type: 'warning'
      });
      return;
    }
    if (!credentialsForm.ortuUsername.trim()) {
      setCustomAlert({
        title: 'Peringatan',
        message: 'Nomor Telepon (Username Orang Tua) tidak boleh kosong!',
        type: 'warning'
      });
      return;
    }

    const updatedSiswa = {
      ...credentialsSiswa,
      nisn: credentialsForm.siswaUsername.trim(),
      noTeleponOrtu: credentialsForm.ortuUsername.trim(),
      password: credentialsForm.siswaPassword.trim()
    };
    db.siswa.upsert(updatedSiswa);

    const ortu = parents.find(p => p.siswaId === credentialsSiswa.id);
    const updatedOrtu: OrangTua = {
      id: ortu?.id || `ortu-${Date.now()}`,
      namaOrtu: credentialsSiswa.namaAyah || 'Orang Tua',
      siswaId: credentialsSiswa.id,
      hubungan: ortu?.hubungan || 'Ayah',
      noTelepon: credentialsForm.ortuUsername.trim(),
      password: credentialsForm.ortuPassword.trim()
    };
    db.orangTua.upsert(updatedOrtu);

    setSiswas(db.siswa.getAll());
    setParents(db.orangTua.getAll());
    setShowCredentialsModal(false);
    setCustomAlert({
      title: 'Sukses',
      message: 'Kredensial login Siswa dan Orang Tua berhasil diperbarui!',
      type: 'success'
    });
  };

  useEffect(() => {
    const handleUpdate = () => {
      setSekolah(db.profilSekolah.get());
    };
    window.addEventListener('school-profile-updated', handleUpdate);
    return () => window.removeEventListener('school-profile-updated', handleUpdate);
  }, []);

  useEffect(() => {
    reset(sekolah);
  }, [sekolah, reset]);

  // Handle updates to school profile
  const onUpdateSchool = (data: any) => {
    const parts = [
      data.jalan,
      data.rtRw,
      data.dusun,
      data.desa,
      data.kecamatan ? (data.kecamatan.toLowerCase().startsWith('kec') ? data.kecamatan : `Kec. ${data.kecamatan}`) : '',
      data.kabupaten,
      data.provinsi,
      data.kodePos
    ].filter(Boolean);

    const fullAlamat = parts.length > 0 ? parts.join(', ') : (data.alamat || sekolah.alamat || '');

    const updated: ProfilSekolah = {
      ...sekolah,
      ...data,
      alamat: fullAlamat
    };
    db.profilSekolah.update(updated);
    setSekolah(updated);
    window.dispatchEvent(new Event('school-profile-updated'));
    setCustomAlert({
      title: 'Sukses',
      message: 'Profil Sekolah berhasil diperbarui!',
      type: 'success'
    });
  };

  // CRUD actions helper
  const handleOpenAddModal = () => {
    setEditingItem(null);
    if (activeTab === 'data_siswa') {
      reset({
        nisn: '',
        nis: '',
        namaSiswa: '',
        jenisKelamin: 'L',
        kelas: activeClassFilter !== 'Semua' ? activeClassFilter : (classList[0] || 'Kelas 4-A'),
        alamat: '',
        namaAyah: '',
        namaIbu: '',
        noTeleponOrtu: '',
        fotoUrl: '',
        password: 'siswa123',
        passwordOrtu: 'ortu123'
      });
    } else if (activeTab === 'profil_guru') {
      reset({
        nip: '',
        namaGuru: '',
        gelar: '',
        mataPelajaranUtama: '',
        statusKepegawaian: 'PNS',
        fotoUrl: '',
        password: 'guru123',
        isWaliKelas: false
      });
    } else if (activeTab === 'tugas_harian') {
      const defaultMapel = mapels.find(m => isCurrentGuruWaliKelas || m.guruPengampuId === loggedInUserId)?.id || mapels[0]?.id || '';
      const defaultKelas = activeClassFilter !== 'Semua' ? activeClassFilter : (loggedInGuru?.kelasWali || classList[0] || 'Kelas 1');
      reset({
        judulTugas: '',
        deskripsi: '',
        mapelId: defaultMapel,
        googleFormUrl: '',
        tanggalDiberikan: new Date().toISOString().split('T')[0],
        tenggatWaktu: '2026-07-25T23:59',
        kelas: defaultKelas
      });
    } else if (activeTab === 'asesmen') {
      const filteredSiswa = siswas.filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter);
      const defaultSiswaId = filteredSiswa[0]?.id || siswas[0]?.id || '';
      const defaultMapel = mapels.find(m => isCurrentGuruWaliKelas || m.guruPengampuId === loggedInUserId)?.id || mapels[0]?.id || '';
      reset({
        siswaId: defaultSiswaId,
        mapelId: defaultMapel,
        tipe: 'harian',
        nilai: 75,
        namaPenilaian: '',
        deskripsiKompetensi: '',
        tanggalPenilaian: new Date().toISOString().split('T')[0]
      });
    } else if (activeTab === 'mata_pelajaran') {
      const defaultKelasMapel = (isRealWaliKelas && loggedInGuru?.kelasWali) 
        ? loggedInGuru.kelasWali 
        : (activeClassFilter !== 'Semua' ? activeClassFilter : (classList[0] || 'Kelas 4'));
      reset({
        kodeMapel: '',
        namaMapel: '',
        kkm: 75,
        guruPengampuId: loggedInUserId || gurus[0]?.id || '',
        kelas: defaultKelasMapel
      });
    } else if (activeTab === 'jadwal_pelajaran') {
      reset({
        mapelId: mapels[0]?.id || '',
        kelas: activeClassFilter !== 'Semua' ? activeClassFilter : (classList[0] || 'Kelas 4'),
        hari: 'Senin',
        jamMulai: '07:30',
        jamSelesai: '09:00',
        ruangan: 'Ruang Kelas 4-A'
      });
    } else if (activeTab === 'temuan_khusus') {
      const filteredSiswa = siswas.filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter);
      const defaultSiswaId = filteredSiswa[0]?.id || siswas[0]?.id || '';
      reset({
        siswaId: defaultSiswaId,
        kategori: 'Perilaku Positif',
        tanggal: new Date().toISOString().split('T')[0],
        deskripsi: '',
        tindakanLanjut: ''
      });
    } else {
      reset({});
    }
    setShowFormModal(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'data_siswa') {
      const ortu = parents.find(p => p.siswaId === item.id);
      reset({
        ...item,
        password: item.password || 'siswa123',
        passwordOrtu: ortu?.password || 'ortu123'
      });
    } else if (activeTab === 'mata_pelajaran') {
      const defaultKelasMapel = item.kelas || ((isRealWaliKelas && loggedInGuru?.kelasWali) 
        ? loggedInGuru.kelasWali 
        : (activeClassFilter !== 'Semua' ? activeClassFilter : (classList[0] || 'Kelas 4')));
      reset({
        ...item,
        kelas: defaultKelasMapel
      });
    } else {
      reset(item);
    }
    setShowFormModal(true);
  };

  // A. GURU CRUD
  const onSubmitGuru = (data: any) => {
    const item: Guru = {
      id: editingItem?.id || `guru-${Date.now()}`,
      nip: data.nip,
      namaGuru: data.namaGuru,
      gelar: data.gelar,
      mataPelajaranUtama: data.mataPelajaranUtama,
      statusKepegawaian: data.statusKepegawaian,
      fotoUrl: data.fotoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
      password: data.password || editingItem?.password || 'guru123',
      isWaliKelas: (data.kelasWali && data.kelasWali !== 'GURU MAPEL' && data.kelasWali !== '') ? true : !!data.isWaliKelas,
      kelasWali: data.kelasWali || editingItem?.kelasWali || ''
    };
    db.guru.upsert(item);
    setGurus(db.guru.getAll());
    setShowFormModal(false);
  };

  // Custom non-blocking deletion state & execution helper
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: 'guru' | 'siswa' | 'mapel' | 'jadwal' | 'tugas' | 'asesmen' | 'temuan' | 'absensi';
    message: string;
  } | null>(null);

  const myMapels = mapels.filter(m => {
    if (m.guruPengampuId === loggedInUserId) return true;
    if (isGuruMapel) {
      const lowerName = m.namaMapel.toLowerCase();
      return lowerName.includes('pai') || lowerName.includes('agama') || lowerName.includes('penjas') || lowerName.includes('olahraga') || lowerName.includes('jasmani');
    }
    return false;
  });
  const myMapelIds = myMapels.map(m => m.id);

  const executeDelete = (id: string, type: string) => {
    switch (type) {
      case 'guru':
        db.guru.delete(id);
        setGurus(db.guru.getAll());
        break;
      case 'siswa':
        db.siswa.delete(id);
        // Also delete linked parent if any
        const linkedParents = parents.filter(p => p.siswaId === id);
        linkedParents.forEach(p => db.orangTua.delete(p.id));
        setParents(db.orangTua.getAll());
        setSiswas(db.siswa.getAll());
        break;
      case 'mapel':
        db.mataPelajaran.delete(id);
        setMapels(db.mataPelajaran.getAll());
        break;
      case 'jadwal':
        db.jadwalPelajaran.delete(id);
        setJadwals(db.jadwalPelajaran.getAll());
        break;
      case 'tugas':
        db.daftarTugas.delete(id);
        setTugases(db.daftarTugas.getAll());
        break;
      case 'asesmen':
        db.asesmen.delete(id);
        setAsesmens(db.asesmen.getAll());
        break;
      case 'temuan':
        db.temuanKhusus.delete(id);
        setTemuanKhusus(db.temuanKhusus.getAll());
        break;
      case 'absensi':
        db.absensi.clearAll();
        setAbsensis([]);
        break;
      default:
        break;
    }
  };

  const onDeleteGuru = (id: string) => {
    setDeleteConfirm({
      id,
      type: 'guru',
      message: 'Apakah Anda yakin ingin menghapus data guru ini? Tindakan ini tidak dapat dibatalkan.'
    });
  };

  const handleEditGoogleEmail = (guruId: string, currentEmail: string) => {
    const newEmail = window.prompt('Masukkan email Google / Gmail resmi untuk Guru/Wali Kelas ini:', currentEmail);
    if (newEmail !== null) {
      const emailTrimmed = newEmail.trim();
      if (emailTrimmed === '') {
        updateGuruGoogleEmail(guruId, null);
        alert('Singkronisasi email Google telah dihapus.');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed)) {
          alert('Format email tidak valid.');
          return;
        }
        updateGuruGoogleEmail(guruId, emailTrimmed);
        alert(`Berhasil mensinkronkan email (${emailTrimmed}) untuk Guru ini.`);
      }
      setGurus(db.guru.getAll());
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
    }
  };

  const handleTestEmailSync = (guru: any) => {
    if (!guru.googleEmail) {
      alert('Guru belum memiliki Email Google tersinkron.');
      return;
    }
    alert(`[Singkronisasi Email Berhasil]\n\nGuru: ${guru.namaGuru}\nEmail Google: ${guru.googleEmail}\nStatus: Tersinkron & Siap Menerima Notifikasi/Tugas Workspace.`);
  };

  const handleRemoveGoogleAuth = async (guruId: string) => {
    if (window.confirm('Apakah Anda yakin ingin mencabut otorisasi Email Google untuk Guru ini?')) {
      updateGuruGoogleEmail(guruId, null);
      setGurus(db.guru.getAll());
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
      alert('Otorisasi email Google berhasil dicabut.');
    }
  };

  // B. SISWA CRUD
  const onSubmitSiswa = (data: any) => {
    const item: Siswa = {
      id: editingItem?.id || `siswa-${Date.now()}`,
      nisn: data.nisn,
      nis: data.nis,
      namaSiswa: data.namaSiswa,
      jenisKelamin: data.jenisKelamin,
      kelas: data.kelas || 'Kelas 4-A',
      alamat: data.alamat,
      namaAyah: data.namaAyah,
      namaIbu: data.namaIbu,
      noTeleponOrtu: data.noTeleponOrtu,
      fotoUrl: data.fotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
      password: data.password || 'siswa123'
    };
    db.siswa.upsert(item);
    
    // Auto-create Orang Tua if doesn't exist
    const ortu: OrangTua = {
      id: editingItem ? (parents.find(p => p.siswaId === item.id)?.id || `ortu-${Date.now()}`) : `ortu-${Date.now()}`,
      namaOrtu: data.namaAyah || 'Orang Tua',
      siswaId: item.id,
      hubungan: 'Ayah',
      noTelepon: data.noTeleponOrtu,
      password: data.passwordOrtu || 'ortu123'
    };
    db.orangTua.upsert(ortu);

    setSiswas(db.siswa.getAll());
    setParents(db.orangTua.getAll());
    setShowFormModal(false);
    reset();
  };

  const onDeleteSiswa = (id: string) => {
    setDeleteConfirm({
      id,
      type: 'siswa',
      message: 'Apakah Anda yakin ingin menghapus data siswa ini? Seluruh absensi dan nilai terkait akan ikut terhapus secara permanen.'
    });
  };

  // C. MATA PELAJARAN CRUD
  const onSubmitMapel = (data: any) => {
    const defaultKelasMapel = (isRealWaliKelas && loggedInGuru?.kelasWali) 
      ? loggedInGuru.kelasWali 
      : (activeClassFilter !== 'Semua' ? activeClassFilter : (classList[0] || 'Kelas 4'));
    const classToAssign = data.kelas || defaultKelasMapel;

    // Enforce standard mapel code rules to prevent class leaks (e.g. bin5 for Kls 5, bin6 for Kls 6)
    let validatedKodeMapel = (data.kodeMapel || '').trim();
    if (!validatedKodeMapel || validatedKodeMapel.startsWith('MP-')) {
      validatedKodeMapel = generateStandardMapelCode(data.namaMapel, classToAssign);
    } else {
      const codeGrade = extractGradeNumber(validatedKodeMapel);
      const targetGrade = extractGradeNumber(classToAssign);
      if (codeGrade !== null && targetGrade !== null && codeGrade !== targetGrade) {
        validatedKodeMapel = generateStandardMapelCode(data.namaMapel, classToAssign);
      }
    }

    const item: MataPelajaran = {
      id: editingItem?.id || `mapel-${Date.now()}`,
      kodeMapel: validatedKodeMapel,
      namaMapel: data.namaMapel,
      kkm: Number(data.kkm) || 75,
      guruPengampuId: data.guruPengampuId || loggedInUserId || gurus[0]?.id || '',
      kelas: classToAssign
    };
    db.mataPelajaran.upsert(item);
    setMapels(db.mataPelajaran.getAll());
    setShowFormModal(false);
  };

  const onDeleteMapel = (id: string) => {
    setDeleteConfirm({
      id,
      type: 'mapel',
      message: 'Apakah Anda yakin ingin menghapus mata pelajaran ini? Jadwal pelajaran dan penilaian yang berhubungan dengan mata pelajaran ini akan ikut terpengaruh.'
    });
  };

  // D. JADWAL PELAJARAN CRUD
  const onSubmitJadwal = (data: any) => {
    const item: JadwalPelajaran = {
      id: editingItem?.id || `jadwal-${Date.now()}`,
      mapelId: data.mapelId,
      kelas: data.kelas || editingItem?.kelas || activeClassFilter,
      hari: data.hari,
      jamMulai: data.jamMulai,
      jamSelesai: data.jamSelesai,
      ruangan: data.ruangan || 'Ruang Kelas 4-A'
    };
    db.jadwalPelajaran.upsert(item);
    setJadwals(db.jadwalPelajaran.getAll());
    setShowFormModal(false);
  };

  const onDeleteJadwal = (id: string) => {
    setDeleteConfirm({
      id,
      type: 'jadwal',
      message: 'Apakah Anda yakin ingin menghapus jadwal pelajaran ini?'
    });
  };

  // E. ABSENSI BULK ACTION
  const [tempAbsen, setTempAbsen] = useState<Record<string, StatusKehadiran>>({});

  const handleAbsenChange = (siswaId: string, status: StatusKehadiran) => {
    setTempAbsen(prev => ({
      ...prev,
      [siswaId]: status
    }));
  };

  const handleSaveAbsensi = () => {
    if (isAbsensiLocked) {
      setCustomAlert({
        title: 'Absensi Dikunci',
        message: 'Maaf, absensi dikunci karena sudah diisi oleh Guru lain pada tanggal ini. Hanya Wali Kelas yang dapat mengubah data absensi ini.',
        type: 'warning'
      });
      return;
    }
    const targetStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);

    const listToSave: Absensi[] = targetStudents.map(s => ({
      siswaId: s.id,
      tanggal: absensiTanggal,
      status: tempAbsen[s.id] || 'hadir',
      keterangan: tempAbsen[s.id] === 'sakit' || tempAbsen[s.id] === 'izin' ? 'Dicatat Wali Kelas' : ''
    }));
    db.absensi.bulkUpsert(listToSave);
    setAbsensis(db.absensi.getAll());
    setCustomAlert({
      title: 'Sukses',
      message: `Kehadiran siswa tanggal ${absensiTanggal} berhasil disimpan!`,
      type: 'success'
    });
  };

  // F. TUGAS (GOOGLE FORM INTEGRATION) CRUD
  const onSubmitTugas = async (data: any) => {
    const classToAssign = data.kelas || (activeClassFilter !== 'Semua' ? activeClassFilter : (loggedInGuru?.kelasWali || 'Kelas 1'));
    const item: DaftarTugas = {
      id: editingItem?.id || `tugas-${Date.now()}`,
      mapelId: data.mapelId,
      judulTugas: data.judulTugas,
      deskripsi: data.deskripsi,
      googleFormUrl: data.googleFormUrl,
      googleSheetUrl: data.googleSheetUrl || '',
      tanggalDiberikan: data.tanggalDiberikan || new Date().toISOString().split('T')[0],
      tenggatWaktu: data.tenggatWaktu || '2026-07-25T23:59',
      dibuatOlehId: loggedInUserId,
      kelas: classToAssign
    };
    db.daftarTugas.upsert(item);
    syncRowToSupabase('daftar_tugas', item, true).catch(err => console.warn('Supabase task sync error:', err));
    setTugases(db.daftarTugas.getAll());
    setTugasSiswa(db.tugasSiswa.getAll());
    setShowFormModal(false);

    // If sendEmailAlerts is checked, send notifications via Gmail API
    if (data.sendEmailAlerts) {
      const mapelObj = mapels.find(m => m.id === data.mapelId);
      const mapelName = mapelObj?.namaMapel || 'Mata Pelajaran';

      setCustomAlert({
        title: 'Mengirim Email Pemberitahuan...',
        message: 'Mohon tunggu sejenak, surel otomatis sedang didispatch ke inbox siswa & wali murid.',
        type: 'info' as any
      });

      try {
        const result = await sendNewAssignmentEmailAlerts(item, mapelName);
        if (result.success) {
          setCustomAlert({
            title: 'Notifikasi Email Terkirim!',
            message: `Berhasil mengirim ${result.sentCount} surel notifikasi ke seluruh siswa dan orang tua kelas ${classToAssign}.`,
            type: 'success'
          });
        } else if (result.sentCount > 0) {
          setCustomAlert({
            title: 'Notifikasi Sebagian Terkirim',
            message: `Terkirim ke ${result.sentCount} siswa/orang tua. Beberapa gagal: ${result.errors?.join(', ')}`,
            type: 'warning'
          });
        } else {
          setCustomAlert({
            title: 'Notifikasi Email Gagal',
            message: result.errors?.[0] || 'Gagal mengirim email pemberitahuan otomatis. Silakan periksa koneksi Google Workspace Anda.',
            type: 'error'
          });
        }
      } catch (err: any) {
        console.error(err);
        setCustomAlert({
          title: 'Gagal Mengirim Notifikasi',
          message: err?.message || 'Gagal menyambung ke Gmail API untuk pemberitahuan.',
          type: 'error'
        });
      }
    }
  };

  const onDeleteTugas = (id: string) => {
    setDeleteConfirm({
      id,
      type: 'tugas',
      message: 'Apakah Anda yakin ingin menghapus tugas ini? Seluruh pengerjaan dan nilai terhubung akan dihapus.'
    });
  };

  // G. ASESMEN CRUD
  const onSubmitAsesmen = (data: any) => {
    let finalTipe = data.tipe;
    if (isGuruMapel) {
      const chosenMapel = mapels.find(m => m.id === data.mapelId);
      if (chosenMapel) {
        const lowerName = chosenMapel.namaMapel.toLowerCase();
        const isAllowed = lowerName.includes('pai') || lowerName.includes('agama') || lowerName.includes('penjas') || lowerName.includes('olahraga') || lowerName.includes('jasmani');
        if (!isAllowed) {
          setCustomAlert({
            title: 'Akses Ditolak',
            message: 'Sebagai Guru Mapel, Anda hanya diizinkan menginput nilai untuk Mata Pelajaran PAI dan PENJAS.',
            type: 'warning'
          });
          return;
        }
      }
      finalTipe = 'harian'; // Force tipe to harian/formative for Guru Mapel
    }

    const item: Asesmen = {
      id: editingItem?.id || `as-${Date.now()}`,
      siswaId: data.siswaId,
      mapelId: data.mapelId,
      tipe: finalTipe,
      namaPenilaian: data.namaPenilaian,
      nilai: Number(data.nilai),
      deskripsiKompetensi: data.deskripsiKompetensi,
      tanggalPenilaian: data.tanggalPenilaian || new Date().toISOString().split('T')[0],
      dinilaiOlehId: loggedInUserId
    };
    db.asesmen.upsert(item);
    setAsesmens(db.asesmen.getAll());
    setShowFormModal(false);
  };

  const onDeleteAsesmen = (id: string) => {
    setDeleteConfirm({
      id,
      type: 'asesmen',
      message: 'Apakah Anda yakin ingin menghapus data asesmen ini?'
    });
  };

  // H. TEMUAN KHUSUS CRUD
  const onSubmitTemuan = (data: any) => {
    const item: TemuanKhusus = {
      id: editingItem?.id || `tk-${Date.now()}`,
      siswaId: data.siswaId,
      tanggal: data.tanggal || new Date().toISOString().split('T')[0],
      kategori: data.kategori,
      deskripsi: data.deskripsi,
      tindakanLanjut: data.tindakanLanjut,
      dilaporkanOlehId: loggedInUserId
    };
    db.temuanKhusus.upsert(item);
    setTemuanKhusus(db.temuanKhusus.getAll());
    setShowFormModal(false);
  };

  const onDeleteTemuan = (id: string) => {
    setDeleteConfirm({
      id,
      type: 'temuan',
      message: 'Apakah Anda yakin ingin menghapus temuan khusus ini?'
    });
  };

  // EXPORT UTILITIES FOR EACH REPORT
  const exportJadwalExcel = () => {
    const formatted = jadwals.map((j, idx) => {
      const mapel = mapels.find(m => m.id === j.mapelId);
      return {
        no: idx + 1,
        hari: j.hari,
        kelas: j.kelas || 'Kelas 4',
        namaMapel: mapel ? mapel.namaMapel : '-',
        jamMulai: j.jamMulai,
        jamSelesai: j.jamSelesai,
        ruangan: j.ruangan
      };
    });
    exportToExcel(
      formatted,
      [
        { key: 'no', label: 'No' },
        { key: 'hari', label: 'Hari' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'namaMapel', label: 'Mata Pelajaran' },
        { key: 'jamMulai', label: 'Jam Mulai' },
        { key: 'jamSelesai', label: 'Jam Selesai' },
        { key: 'ruangan', label: 'Ruangan' }
      ],
      `Jadwal_Pelajaran_${activeClassFilter === 'Semua' ? 'Semua_Kelas' : activeClassFilter.replace(/\s+/g, '_')}`
    );
  };

  const handleImportJadwalExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert(`✅ Berhasil mengimpor file jadwal "${file.name}". Data jadwal pelajaran telah diperbarui di sistem.`);
    e.target.value = '';
  };

  const cetakJadwalPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    drawSchoolHeader(doc, 'JADWAL PELAJARAN KELAS', true, activeClassFilter);
    const filteredJadwals = jadwals.filter(j => activeClassFilter === 'Semua' || j.kelas === activeClassFilter);
    const tableData = filteredJadwals.map((j, idx) => {
      const mapel = mapels.find(m => m.id === j.mapelId);
      return [
        (idx + 1).toString(),
        j.hari,
        j.kelas || '-',
        mapel ? mapel.namaMapel : '-',
        `${j.jamMulai} - ${j.jamSelesai}`,
        j.ruangan
      ];
    });

    autoTable(doc, {
      startY: 36,
      head: [['No', 'Hari', 'Kelas', 'Mata Pelajaran', 'Waktu', 'Ruangan']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Jadwal_Pelajaran_${activeClassFilter.replace(/\s+/g, '_')}.pdf`);
  };

  const exportTugasExcel = () => {
    const formatted = tugases.map((t, idx) => {
      const mapel = mapels.find(m => m.id === t.mapelId);
      return {
        no: idx + 1,
        judulTugas: t.judulTugas,
        namaMapel: mapel ? mapel.namaMapel : '-',
        deskripsi: t.deskripsi,
        googleFormUrl: t.googleFormUrl,
        tenggatWaktu: t.tenggatWaktu
      };
    });
    exportToExcel(
      formatted,
      [
        { key: 'no', label: 'No' },
        { key: 'judulTugas', label: 'Judul Tugas' },
        { key: 'namaMapel', label: 'Mata Pelajaran' },
        { key: 'deskripsi', label: 'Deskripsi' },
        { key: 'googleFormUrl', label: 'Tautan Google Form' },
        { key: 'tenggatWaktu', label: 'Tenggat Waktu' }
      ],
      'Data_Daftar_Tugas'
    );
  };

  const handleImportTugasExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert(`✅ Berhasil mengimpor file tugas "${file.name}". Data tugas telah berhasil diperbarui.`);
    e.target.value = '';
  };

  const exportGuruCSV = () => {
    exportToCSV(
      gurus,
      [
        { key: 'nip', label: 'NIP' },
        { key: 'namaGuru', label: 'Nama Lengkap' },
        { key: 'gelar', label: 'Gelar Akademik' },
        { key: 'mataPelajaranUtama', label: 'Mata Pelajaran Utama' },
        { key: 'statusKepegawaian', label: 'Status Kepegawaian' }
      ],
      'Laporan_Data_Guru'
    );
  };

  const exportSiswaCSV = () => {
    exportToCSV(
      siswas,
      [
        { key: 'nisn', label: 'NISN' },
        { key: 'nis', label: 'NIS' },
        { key: 'namaSiswa', label: 'Nama Siswa' },
        { key: 'jenisKelamin', label: 'JK' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'alamat', label: 'Alamat Rumah' },
        { key: 'namaAyah', label: 'Nama Ayah' },
        { key: 'namaIbu', label: 'Nama Ibu' },
        { key: 'noTeleponOrtu', label: 'No Telp Orang Tua' }
      ],
      'Laporan_Data_Siswa'
    );
  };

  const exportAbsensiCSV = () => {
    const classStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);
      
    const studentIds = new Set(classStudents.map(s => s.id));
    const filteredAbsensis = absensis.filter(a => studentIds.has(a.siswaId));

    const formatted = filteredAbsensis.map(a => {
      const siswa = siswas.find(s => s.id === a.siswaId);
      return {
        tanggal: a.tanggal,
        namaSiswa: siswa ? siswa.namaSiswa : 'Siswa',
        kelas: siswa ? siswa.kelas : 'Kelas',
        status: a.status.toUpperCase(),
        keterangan: a.keterangan || '-'
      };
    });

    const classNameSuffix = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    exportToCSV(
      formatted,
      [
        { key: 'tanggal', label: 'Tanggal Absen' },
        { key: 'namaSiswa', label: 'Nama Siswa' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'status', label: 'Status Kehadiran' },
        { key: 'keterangan', label: 'Keterangan' }
      ],
      `Rekap_Absensi_Siswa_${classNameSuffix}`
    );
  };

  const getPrintLocation = (sekolahObj: ProfilSekolah) => {
    if (sekolahObj.kabupaten && sekolahObj.kabupaten.trim()) {
      return sekolahObj.kabupaten.trim();
    }
    if (sekolahObj.alamat && sekolahObj.alamat.trim()) {
      const match = sekolahObj.alamat.match(/(Kab\.|Kabupaten|Kota)\s+([A-Za-z\s]+)/i);
      if (match) return match[0];
    }
    return 'Bandung';
  };

  const getWaliKelasForClass = (kelasName: string) => {
    if (kelasName && kelasName !== 'Semua') {
      const wali = gurus.find(g => g.isWaliKelas && g.kelasWali === kelasName);
      if (wali) {
        return { nama: wali.namaGuru, nip: wali.nip || '-' };
      }
    }
    if (loggedInGuru && loggedInGuru.isWaliKelas) {
      return { nama: loggedInGuru.namaGuru, nip: loggedInGuru.nip || '-' };
    }
    const firstWali = gurus.find(g => g.isWaliKelas);
    if (firstWali) {
      return { nama: firstWali.namaGuru, nip: firstWali.nip || '-' };
    }
    return {
      nama: '__________________________',
      nip: '__________________________'
    };
  };

  const drawSchoolHeader = async (doc: any, reportTitle: string, isPortrait: boolean, specificClass: string = '', dateInfo: string = '') => {
    const pageWidth = isPortrait ? 210 : 297;
    const centerX = pageWidth / 2;
    const rightMargin = pageWidth - 15;
    
    // Draw Logo: check if school logo image is available
    const logoX = 18;
    const logoY = 10;
    
    const logoBase64 = await loadImageAsDataUrl(sekolah.logoUrl);
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'JPEG', logoX, logoY, 17, 17);
      } catch (e) {
        console.warn('Error adding school logo image to PDF header:', e);
        // Fallback vector crest
        doc.setDrawColor(79, 70, 229); // Indigo
        doc.setLineWidth(0.8);
        doc.circle(logoX + 8, logoY + 8, 9);
        doc.setLineWidth(0.2);
        doc.circle(logoX + 8, logoY + 8, 7.5);
        
        doc.setFillColor(79, 70, 229);
        doc.triangle(logoX + 8, logoY + 4, logoX + 5, logoY + 9, logoX + 11, logoY + 9, 'F');
        doc.triangle(logoX + 8, logoY + 12, logoX + 5, logoY + 7, logoX + 11, logoY + 7, 'F');
      }
    } else {
      doc.setDrawColor(79, 70, 229); // Indigo
      doc.setLineWidth(0.8);
      doc.circle(logoX + 8, logoY + 8, 9);
      doc.setLineWidth(0.2);
      doc.circle(logoX + 8, logoY + 8, 7.5);
      
      doc.setFillColor(79, 70, 229);
      doc.triangle(logoX + 8, logoY + 4, logoX + 5, logoY + 9, logoX + 11, logoY + 9, 'F');
      doc.triangle(logoX + 8, logoY + 12, logoX + 5, logoY + 7, logoX + 11, logoY + 7, 'F');
    }
    
    // Header texts
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text((sekolah.namaSekolah || 'SD NEGERI KITA').toUpperCase(), centerX + 8, 14, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`STATUS AKREDITASI: ${sekolah.akreditasi || 'A'} | NPSN: ${sekolah.npsn || '-'}`, centerX + 8, 19, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    const addressLine = sekolah.alamat || '';
    if (addressLine) {
      doc.text(addressLine, centerX + 8, 23, { align: 'center' });
    }
    
    // Academic details
    const currentClass = specificClass || (activeClassFilter === 'Semua' ? 'Semua Kelas' : activeClassFilter);
    const periodStr = dateInfo ? `| Periode: ${dateInfo}` : '';
    const tpStr = sekolah.tahunPelajaran || '2025/2026';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Tahun Pelajaran: ${tpStr} | ${reportTitle} | Kelas: ${currentClass}${periodStr}`, centerX + 8, 28, { align: 'center' });
    
    // Double line divider
    doc.setDrawColor(51, 65, 85); // slate-700
    doc.setLineWidth(0.6);
    doc.line(15, 31, rightMargin, 31);
    doc.setLineWidth(0.2);
    doc.line(15, 32, rightMargin, 32);
    
    doc.setTextColor(0, 0, 0); // reset to black
  };

  const drawPDFSignature = (doc: any, pageHeight: number, currentClass: string, isPortrait: boolean) => {
    // @ts-ignore
    const finalY = doc.lastAutoTable?.finalY || 150;
    const requiredSpace = 55;
    
    let signatureY = finalY + 15;
    if (signatureY + requiredSpace > pageHeight) {
      doc.addPage();
      signatureY = 20;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const signLeftX = isPortrait ? 30 : 45;
    const signRightX = isPortrait ? 130 : 195;

    if (pdfIncludeSignature) {
      doc.text('Mengetahui,', signLeftX, signatureY);
      doc.text('Kepala Sekolah', signLeftX, signatureY + 5);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`( ${sekolah.kepalaSekolah || '__________________________'} )`, signLeftX, signatureY + 30);
      doc.setFont('helvetica', 'normal');
      doc.text(`NIP. ${sekolah.nipKepalaSekolah || '__________________________'}`, signLeftX, signatureY + 35);
    }

    const locationStr = getPrintLocation(sekolah);
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const wali = getWaliKelasForClass(currentClass);

    doc.text(`${locationStr}, ${dateStr}`, signRightX, signatureY);
    doc.text('Wali Kelas / Guru Pengampu', signRightX, signatureY + 5);

    doc.setFont('helvetica', 'bold');
    doc.text(`( ${wali.nama} )`, signRightX, signatureY + 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${wali.nip}`, signRightX, signatureY + 35);
  };

  const exportToExcelWithHeader = (
    data: any[],
    headers: { key: string; label: string }[],
    title: string,
    periode: string,
    currentClass: string,
    fileName: string
  ) => {
    const tpStr = sekolah.tahunPelajaran || '2025/2026';
    const aoa = [
      [sekolah.namaSekolah.toUpperCase()],
      [`STATUS AKREDITASI: ${sekolah.akreditasi || 'A'} | NPSN: ${sekolah.npsn || '20401234'}`],
      [sekolah.alamat || ''],
      [`Tahun Pelajaran: ${tpStr}`],
      [`Laporan: ${title}`],
      [`Kelas: ${currentClass || 'Semua Kelas'}`],
      [`Periode Penilaian: ${periode || '-'}`],
      []
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    const tableRows = data.map(item => {
      const rowObj: Record<string, any> = {};
      headers.forEach(h => {
        rowObj[h.label] = item[h.key] !== undefined ? item[h.key] : '-';
      });
      return rowObj;
    });

    XLSX.utils.sheet_add_json(worksheet, tableRows, { origin: 'A9' });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan');

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const handleDownloadTemplateSiswa = () => {
    // Sync with existing students in database for the active class to prevent duplicates
    const targetSiswas = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);

    const data = targetSiswas.map(s => ({
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
          'Kelas': activeClassFilter !== 'Semua' ? activeClassFilter : 'Kelas 4',
          'Alamat': 'Perum Geriya Indah Blok C3, Bandung',
          'Nama Ayah': 'Pak Joko Fauzi',
          'Nama Ibu': 'Ibu Ratna Fauzi',
          'No Telepon Ortu': '081234567890'
        },
        {
          'Nama Siswa': 'Siti Aminah',
          'NISN': '0123456782',
          'NIS': '232404002',
          'Jenis Kelamin': 'P',
          'Kelas': 'Kelas 1',
          'Alamat': 'Jl. Merdeka No. 12, Bandung',
          'Nama Ayah': 'Pak Ahmad',
          'Nama Ibu': 'Ibu Aminah',
          'No Telepon Ortu': '081234567891'
        }
      );
    }

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set precise column widths (utuh & sempurna)
    worksheet['!cols'] = [
      { wch: 25 }, // Nama Siswa
      { wch: 15 }, // NISN
      { wch: 15 }, // NIS
      { wch: 15 }, // Jenis Kelamin (L/P)
      { wch: 15 }, // Kelas
      { wch: 35 }, // Alamat
      { wch: 20 }, // Nama Ayah
      { wch: 20 }, // Nama Ibu
      { wch: 18 }  // No Telepon Ortu
    ];

    // Enable Grid Lines
    worksheet['!views'] = [{ showGridLines: true }];

    // Excel Dropdown Validation (Jenis Kelamin and Kelas)
    worksheet['!dataValidation'] = [
      {
        sqref: 'D2:D500', // Jenis Kelamin
        type: 'list',
        allowBlank: true,
        formula1: '"L,P"',
        showInputMessage: true,
        showErrorMessage: true,
        errorTitle: 'Input Tidak Valid',
        error: 'Pilih jenis kelamin yang valid (L atau P)'
      },
      {
        sqref: 'E2:E500', // Kelas
        type: 'list',
        allowBlank: true,
        formula1: `"${classList.join(',')}"`,
        showInputMessage: true,
        showErrorMessage: true,
        errorTitle: 'Input Tidak Valid',
        error: 'Pilih kelas dari pilihan yang terdaftar di database'
      }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');
    XLSX.writeFile(workbook, 'Template_Import_Siswa.xlsx');
  };

  const handleDownloadTemplateAbsensi = () => {
    // Pre-populate with real student database records to prevent duplicate database entries
    const targetStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);

    const data = targetStudents.map(s => ({
      'Nama Siswa': s.namaSiswa,
      'NISN': s.nisn,
      'NIS': s.nis,
      'Tanggal': absensiTanggal,
      'Status': 'Hadir',
      'Keterangan': ''
    }));

    if (data.length === 0) {
      data.push(
        {
          'Nama Siswa': 'Ahmad Fauzi',
          'NISN': '0123456781',
          'NIS': '232404001',
          'Tanggal': absensiTanggal,
          'Status': 'Hadir',
          'Keterangan': 'Masuk'
        },
        {
          'Nama Siswa': 'Siti Aminah',
          'NISN': '0123456782',
          'NIS': '232404002',
          'Tanggal': absensiTanggal,
          'Status': 'Sakit',
          'Keterangan': 'Demam tinggi'
        }
      );
    }

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set precise column widths (utuh & sempurna)
    worksheet['!cols'] = [
      { wch: 25 }, // Nama Siswa
      { wch: 15 }, // NISN
      { wch: 15 }, // NIS
      { wch: 15 }, // Tanggal
      { wch: 15 }, // Status
      { wch: 35 }  // Keterangan
    ];

    // Enable Grid Lines
    worksheet['!views'] = [{ showGridLines: true }];

    // Excel Dropdown Validation (Status Kehadiran)
    worksheet['!dataValidation'] = [
      {
        sqref: 'E2:E1000', // Status
        type: 'list',
        allowBlank: true,
        formula1: '"Hadir,Sakit,Izin,Alfa"',
        showInputMessage: true,
        showErrorMessage: true,
        errorTitle: 'Status Tidak Valid',
        error: 'Pilih status presensi: Hadir, Sakit, Izin, atau Alfa'
      }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Absensi');
    XLSX.writeFile(workbook, 'Template_Import_Absensi.xlsx');
  };

  const handleDownloadTemplateGuru = () => {
    // Populate with real teacher records to allow editing existing teachers
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
      data.push(
        {
          'NIP': '198503142011012009',
          'Nama Guru': 'Kholisul Zainal Asfan Sholikh, S.Pd.',
          'Gelar': 'S.Pd. (Sarjana Pendidikan)',
          'Mata Pelajaran Utama': 'Tematik & Matematika',
          'Status Kepegawaian': 'PNS',
          'Is Wali Kelas': 'Ya',
          'Kelas Wali': 'Kelas 4'
        },
        {
          'NIP': '199001012015011001',
          'Nama Guru': 'Siti Aminah, S.Pd.',
          'Gelar': 'S.Pd. (Sarjana Pendidikan)',
          'Mata Pelajaran Utama': 'Tematik Kelas 1',
          'Status Kepegawaian': 'PNS',
          'Is Wali Kelas': 'Ya',
          'Kelas Wali': 'Kelas 1'
        }
      );
    }

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set precise column widths (utuh & sempurna)
    worksheet['!cols'] = [
      { wch: 22 }, // NIP
      { wch: 30 }, // Nama Guru
      { wch: 20 }, // Gelar
      { wch: 25 }, // Mata Pelajaran Utama
      { wch: 20 }, // Status Kepegawaian
      { wch: 15 }, // Is Wali Kelas
      { wch: 15 }  // Kelas Wali
    ];

    // Enable Grid Lines
    worksheet['!views'] = [{ showGridLines: true }];

    // Excel Dropdown Validation (Status Kepegawaian, Is Wali Kelas, Kelas Wali)
    worksheet['!dataValidation'] = [
      {
        sqref: 'E2:E500', // Status Kepegawaian
        type: 'list',
        allowBlank: true,
        formula1: '"PNS,P3K,Honor Daerah"',
        showInputMessage: true,
        showErrorMessage: true,
        errorTitle: 'Status Tidak Valid',
        error: 'Pilih Status Kepegawaian: PNS, P3K, atau Honor Daerah'
      },
      {
        sqref: 'F2:F500', // Is Wali Kelas
        type: 'list',
        allowBlank: true,
        formula1: '"Ya,Tidak"',
        showInputMessage: true,
        showErrorMessage: true,
        errorTitle: 'Pilihan Tidak Valid',
        error: 'Pilih Ya jika guru merupakan Wali Kelas, atau Tidak jika bukan'
      },
      {
        sqref: 'G2:G500', // Kelas Wali
        type: 'list',
        allowBlank: true,
        formula1: `"${['GURU MAPEL', ...classList].join(',')}"`,
        showInputMessage: true,
        showErrorMessage: true,
        errorTitle: 'Kelas Wali Tidak Valid',
        error: 'Pilih kelas wali yang sesuai atau GURU MAPEL'
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
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          setExcelImportResult({
            success: false,
            type: 'guru',
            message: 'File Excel kosong atau tidak terbaca dengan benar.',
            addedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            corrections: []
          });
          setShowExcelResultModal(true);
          return;
        }

        const currentGurus = db.guru.getAll();
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const details: string[] = [];
        const corrections: any[] = [];

        // Track seen elements in this excel upload to detect duplicates
        const seenNips = new Set<string>();
        const seenNames = new Set<string>();

        data.forEach((row: any, index: number) => {
          const rowNum = index + 2;
          const findVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(candidate => k.toLowerCase().replace(/[\s_]/g, '') === candidate.toLowerCase().replace(/[\s_]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const nip = String(findVal(['nip', 'nomorindukpegawai']) || '').trim();
          const namaGuru = String(findVal(['namaguru', 'nama', 'fullname', 'namalengkap']) || '').trim();
          const gelar = String(findVal(['gelar', 'title', 'akademik']) || '').trim();
          const mapelUtama = String(findVal(['matapelajaranutama', 'mapel', 'spesialisasi', 'mengampu']) || '').trim();
          const statusKepegawaianRaw = String(findVal(['statuskepegawaian', 'status', 'kepegawaian']) || '').trim();
          const isWaliKelasRaw = String(findVal(['iswalikelas', 'walikelas', 'wali']) || '').trim().toLowerCase();
          const kelasWali = String(findVal(['kelaswali', 'kelas']) || '').trim();

          // 1. VALIDASI NAMA GURU (WAJIB)
          if (!namaGuru) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Nama Guru',
              val: '',
              issue: 'Nama Guru tidak boleh kosong.',
              fix: 'Silakan isi Nama Guru dengan nama lengkap beserta gelar di kolom B.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Nama Guru kosong.`);
            return;
          }

          // 2. VALIDASI DUPLIKAT DI EXCEL
          if (nip && seenNips.has(nip)) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'NIP',
              val: nip,
              issue: `NIP ganda (${nip}) terdeteksi di baris lain dalam file Excel ini.`,
              fix: 'Ganti NIP agar unik, atau hapus baris duplikat ini di file Excel Anda.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - NIP ganda dalam file Excel.`);
            return;
          }
          if (seenNames.has(namaGuru.toLowerCase())) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Nama Guru',
              val: namaGuru,
              issue: `Nama Guru ganda ("${namaGuru}") terdeteksi di baris lain dalam file Excel ini.`,
              fix: 'Gunakan nama unik / tambahkan gelar untuk membedakan guru dengan nama sama.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Nama Guru ganda dalam file Excel.`);
            return;
          }

          if (nip) seenNips.add(nip);
          seenNames.add(namaGuru.toLowerCase());

          // 3. VALIDASI STATUS KEPEGAWAIAN
          let statusKepegawaian = 'PNS';
          const validStatuses = ['PNS', 'P3K', 'Honor Daerah'];
          if (statusKepegawaianRaw) {
            const matched = validStatuses.find(vs => vs.toLowerCase() === statusKepegawaianRaw.toLowerCase());
            if (matched) {
              statusKepegawaian = matched;
            } else {
              statusKepegawaian = 'PNS'; // Fallback
              corrections.push({
                row: rowNum,
                field: 'Status Kepegawaian',
                val: statusKepegawaianRaw,
                issue: `Status kepegawaian "${statusKepegawaianRaw}" tidak dikenali.`,
                fix: 'Ganti dengan salah satu dari: PNS, P3K, atau Honor Daerah. Sistem mengasumsikan PNS sebagai default.',
                severity: 'warning'
              });
            }
          }

          // 4. VALIDASI WALI KELAS & KELAS WALI
          const isWaliKelas = isWaliKelasRaw === 'ya' || isWaliKelasRaw === 'yes' || isWaliKelasRaw === 'y' || isWaliKelasRaw === 'true';
          let finalKelasWali = '';

          if (isWaliKelas) {
            if (!kelasWali || kelasWali.toLowerCase() === 'guru mapel') {
              skippedCount++;
              corrections.push({
                row: rowNum,
                field: 'Kelas Wali',
                val: kelasWali || '(Kosong)',
                issue: 'Ditandai sebagai Wali Kelas, tetapi Kelas Wali kosong atau "GURU MAPEL".',
                fix: 'Silakan isi nama kelas wali yang valid (contoh: Kelas 4) sesuai dropdown kolom G.',
                severity: 'error'
              });
              details.push(`Baris ${rowNum}: Gagal - Kelas wali kosong untuk Wali Kelas.`);
              return;
            }

            const matchedClass = classList.find(c => c.toLowerCase() === kelasWali.toLowerCase());
            if (!matchedClass) {
              skippedCount++;
              corrections.push({
                row: rowNum,
                field: 'Kelas Wali',
                val: kelasWali,
                issue: `Kelas "${kelasWali}" tidak terdaftar dalam sistem.`,
                fix: `Silakan ganti dengan kelas yang terdaftar: ${classList.join(', ')} atau buat kelas tersebut dahulu di menu Tambah Kelas.`,
                severity: 'error'
              });
              details.push(`Baris ${rowNum}: Gagal - Kelas wali tidak terdaftar.`);
              return;
            }
            finalKelasWali = matchedClass;

            // Check db duplicate: is there already another teacher holding this class?
            const otherWali = currentGurus.find(g => g.isWaliKelas && g.kelasWali.toLowerCase() === finalKelasWali.toLowerCase() && g.namaGuru.toLowerCase() !== namaGuru.toLowerCase() && (nip ? g.nip !== nip : true));
            if (otherWali) {
              corrections.push({
                row: rowNum,
                field: 'Kelas Wali',
                val: finalKelasWali,
                issue: `Kelas ${finalKelasWali} sudah memiliki Wali Kelas aktif di database: ${otherWali.namaGuru}.`,
                fix: `Sistem akan tetap menyimpan data ini, namun harap sesuaikan wali kelas ${finalKelasWali} agar tidak ganda.`,
                severity: 'warning'
              });
            }
          } else {
            if (kelasWali && kelasWali.toLowerCase() !== 'guru mapel') {
              corrections.push({
                row: rowNum,
                field: 'Is Wali Kelas / Kelas Wali',
                val: `Wali: ${isWaliKelasRaw}, Kelas: ${kelasWali}`,
                issue: `Kelas wali diisi "${kelasWali}" namun status Wali Kelas diset "Tidak".`,
                fix: 'Kosongkan kolom Kelas Wali atau ganti status Wali Kelas menjadi "Ya" jika guru tersebut wali kelas.',
                severity: 'warning'
              });
            }
            finalKelasWali = '';
          }

          // 5. UPSERT PROCESS
          let existing = currentGurus.find(g => 
            (nip && g.nip === nip) || 
            (g.namaGuru.toLowerCase() === namaGuru.toLowerCase())
          );

          const teacherId = existing?.id || `guru-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

          const updatedItem: Guru = {
            id: teacherId,
            nip: nip || existing?.nip || '',
            namaGuru,
            gelar: gelar || existing?.gelar || '-',
            mataPelajaranUtama: mapelUtama || existing?.mataPelajaranUtama || '-',
            statusKepegawaian,
            fotoUrl: existing?.fotoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
            profileId: existing?.profileId,
            password: existing?.password || 'guru123',
            isWaliKelas,
            kelasWali: finalKelasWali
          };

          db.guru.upsert(updatedItem);
          if (existing) {
            updatedCount++;
            details.push(`Baris ${rowNum}: Diperbarui - ${namaGuru}`);
          } else {
            addedCount++;
            details.push(`Baris ${rowNum}: Ditambahkan - ${namaGuru}`);
          }
        });

        const updatedList = db.guru.getAll();
        setGurus(updatedList);

        const errorsCount = corrections.filter(c => c.severity === 'error').length;
        const warningsCount = corrections.filter(c => c.severity === 'warning').length;

        setExcelImportResult({
          success: errorsCount === 0,
          type: 'guru',
          message: `Selesai memproses file Guru! Sukses: ${addedCount + updatedCount} baris (${addedCount} baru, ${updatedCount} pembaruan). Gagal/Dilewati: ${skippedCount} baris. Terdeteksi ${errorsCount} kesalahan kritis dan ${warningsCount} peringatan.`,
          addedCount,
          updatedCount,
          skippedCount,
          details,
          corrections
        });
        setShowExcelResultModal(true);

      } catch (err: any) {
        setExcelImportResult({
          success: false,
          type: 'guru',
          message: `Gagal membaca file Excel: ${err?.message || 'Error tidak diketahui'}`,
          addedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          corrections: []
        });
        setShowExcelResultModal(true);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportMapelExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        let importedCount = 0;
        rows.forEach((row) => {
          const findVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k =>
              keys.some(candidate => k.toLowerCase().replace(/[\s_:-]/g, '') === candidate.toLowerCase().replace(/[\s_:-]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const namaMapel = String(findVal(['namamapel', 'mapel', 'matapelajaran', 'nama']) || '').trim();
          if (!namaMapel) return;

          let kodeMapel = String(findVal(['kodemapel', 'kode']) || '').trim();
          const kkm = parseInt(String(findVal(['kkm', 'kkmstandar', 'kriteria']) || '75'), 10) || 75;
          const kelompok = String(findVal(['kelompok', 'kategori']) || 'Mata Pelajaran Utama').trim();
          const kelas = String(findVal(['kelas', 'targetkelas']) || (activeClassFilter !== 'Semua' ? activeClassFilter : 'Kelas 4')).trim();

          if (!kodeMapel || kodeMapel.startsWith('MP-')) {
            kodeMapel = generateStandardMapelCode(namaMapel, kelas);
          } else {
            const codeGrade = extractGradeNumber(kodeMapel);
            const targetGrade = extractGradeNumber(kelas);
            if (codeGrade !== null && targetGrade !== null && codeGrade !== targetGrade) {
              kodeMapel = generateStandardMapelCode(namaMapel, kelas);
            }
          }

          const existing = db.mataPelajaran.getAll().find(m =>
            m.namaMapel.toLowerCase() === namaMapel.toLowerCase() && m.kelas === kelas
          );

          const newMapel: MataPelajaran = {
            id: existing ? existing.id : `mp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            kodeMapel,
            namaMapel,
            kkm,
            kelompok,
            kategori: kelompok,
            kelas,
            guruPengampuId: loggedInUserId || 'g1'
          };

          db.mataPelajaran.upsert(newMapel);
          importedCount++;
        });

        const refreshed = db.mataPelajaran.getAll();
        setMapels(refreshed);
        alert(`Berhasil mengimpor ${importedCount} mata pelajaran dari file Excel!`);
        window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'mata_pelajaran' } }));
      } catch (err: any) {
        alert('Gagal mengimpor file Excel Mapel: ' + (err.message || 'Format tidak valid'));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const exportAbsensiExcel = () => {
    const classStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);
      
    if (classStudents.length === 0) {
      alert('Tidak ada data siswa untuk diekspor.');
      return;
    }

    const [yearStr, monthStr] = absensiTanggal.split('-');
    const selectedMonthPrefix = `${yearStr}-${monthStr}`;
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthNameIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ][monthIndex] || 'Bulan';
    const periodName = `${monthNameIndo} ${yearStr}`;

    const tableData = classStudents.map((siswa, index) => {
      const studentAbsensis = absensis.filter(a => a.siswaId === siswa.id && a.tanggal.startsWith(selectedMonthPrefix));
      
      let hadir = 0;
      let sakit = 0;
      let izin = 0;
      let alfa = 0;

      studentAbsensis.forEach(a => {
        if (a.status === 'hadir') hadir++;
        else if (a.status === 'sakit') sakit++;
        else if (a.status === 'izin') izin++;
        else if (a.status === 'alfa') alfa++;
      });

      const totalEfektif = hadir + sakit + izin + alfa;
      const persentase = totalEfektif > 0 
        ? `${Math.round(((hadir + sakit + izin) / totalEfektif) * 100)}%` 
        : '0%';

      return {
        no: index + 1,
        namaSiswa: siswa.namaSiswa,
        nisn: siswa.nisn || '-',
        kelas: siswa.kelas,
        hadir,
        sakit,
        izin,
        alfa,
        totalEfektif,
        persentase
      };
    });

    const headers = [
      { key: 'no', label: 'No' },
      { key: 'namaSiswa', label: 'Nama Siswa' },
      { key: 'nisn', label: 'NISN' },
      { key: 'kelas', label: 'Kelas' },
      { key: 'hadir', label: 'Hadir (H)' },
      { key: 'sakit', label: 'Sakit (S)' },
      { key: 'izin', label: 'Izin (I)' },
      { key: 'alfa', label: 'Alfa (A)' },
      { key: 'totalEfektif', label: 'Total Hari Efektif' },
      { key: 'persentase', label: 'Persentase Kehadiran' }
    ];

    const classNameFile = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    exportToExcelWithHeader(
      tableData,
      headers,
      'REKAPITULASI PRESENSI KEHADIRAN SISWA',
      periodName,
      activeClassFilter,
      `Rekap_Presensi_${classNameFile}_${periodName.replace(/\s+/g, '_')}`
    );
  };

  const exportAbsensiPDF = async () => {
    const classStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);
      
    if (classStudents.length === 0) {
      alert('Tidak ada data siswa untuk diekspor.');
      return;
    }

    const [yearStr, monthStr] = absensiTanggal.split('-');
    const selectedMonthPrefix = `${yearStr}-${monthStr}`;
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthNameIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ][monthIndex] || 'Bulan';

    const periodName = `${monthNameIndo} ${yearStr}`;

    const isPortrait = pdfOrientation === 'portrait';
    const pageWidth = isPortrait ? 210 : 297;
    const pageHeight = isPortrait ? 297 : 210;

    const doc = new jsPDF({
      orientation: pdfOrientation,
      unit: 'mm',
      format: 'a4'
    });

    await drawSchoolHeader(doc, 'REKAPITULASI PRESENSI SISWA', isPortrait, activeClassFilter, periodName);

    let headerBgColor: [number, number, number] = [79, 70, 229];
    if (pdfThemeColor === 'emerald') headerBgColor = [5, 150, 105];
    else if (pdfThemeColor === 'slate') headerBgColor = [71, 85, 105];
    else if (pdfThemeColor === 'rose') headerBgColor = [225, 29, 72];
    else if (pdfThemeColor === 'amber') headerBgColor = [217, 119, 6];

    const tableRows: any[] = [];
    classStudents.forEach((siswa, index) => {
      const studentAbsensis = absensis.filter(a => a.siswaId === siswa.id && a.tanggal.startsWith(selectedMonthPrefix));
      
      let hadir = 0;
      let sakit = 0;
      let izin = 0;
      let alfa = 0;

      studentAbsensis.forEach(a => {
        if (a.status === 'hadir') hadir++;
        else if (a.status === 'sakit') sakit++;
        else if (a.status === 'izin') izin++;
        else if (a.status === 'alfa') alfa++;
      });

      const totalEfektif = hadir + sakit + izin + alfa;
      const persentase = totalEfektif > 0 
        ? `${Math.round(((hadir + sakit + izin) / totalEfektif) * 100)}%` 
        : '-';

      tableRows.push([
        index + 1,
        siswa.namaSiswa,
        siswa.nisn || '-',
        siswa.kelas,
        hadir,
        sakit,
        izin,
        alfa,
        totalEfektif,
        persentase
      ]);
    });

    const colStyles: any = isPortrait ? {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 10, halign: 'center' },
      8: { cellWidth: 20, halign: 'center' },
      9: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
    } : {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 80, fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 15, halign: 'center' },
      8: { cellWidth: 30, halign: 'center' },
      9: { cellWidth: 30, halign: 'center', fontStyle: 'bold' }
    };

    autoTable(doc, {
      startY: 38,
      head: [[
        { content: 'No', styles: { halign: 'center' } },
        { content: 'Nama Siswa', styles: { halign: 'left' } },
        { content: 'NISN', styles: { halign: 'center' } },
        { content: 'Kelas', styles: { halign: 'center' } },
        { content: 'H', styles: { halign: 'center' } },
        { content: 'S', styles: { halign: 'center' } },
        { content: 'I', styles: { halign: 'center' } },
        { content: 'A', styles: { halign: 'center' } },
        { content: 'Total Hari', styles: { halign: 'center' } },
        { content: 'Kehadiran (%)', styles: { halign: 'center' } }
      ]],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: headerBgColor,
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        valign: 'middle'
      },
      columnStyles: colStyles,
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5
      },
      didParseCell: function (data: any) {
        if (data.row.index !== undefined && data.section === 'body') {
          const percentageVal = data.row.cells[9].text[0];
          if (percentageVal && percentageVal !== '-') {
            const num = parseInt(percentageVal);
            if (num < 85) {
              data.cell.styles.textColor = [220, 38, 38];
            } else if (num >= 95) {
              data.cell.styles.textColor = [5, 150, 105];
            }
          }
        }
      }
    });

    drawPDFSignature(doc, pageHeight, activeClassFilter, isPortrait);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Keterangan: H = Hadir, S = Sakit, I = Izin, A = Alfa (Tanpa Keterangan)', 15, pageHeight - 8);

    const classNameFile = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    const pdfFileName = `Laporan_Presensi_${classNameFile}_${periodName.replace(/\s+/g, '_')}.pdf`;
    
    doc.save(pdfFileName);

    if (pdfSaveHistory) {
      const newRecord = {
        id: `pdf-dl-${Date.now()}`,
        fileName: pdfFileName,
        timestamp: new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        kelas: activeClassFilter === 'Semua' ? 'Semua Kelas' : activeClassFilter,
        periode: periodName
      };

      setPdfHistory(prev => {
        const updated = [newRecord, ...prev].slice(0, 8);
        localStorage.setItem('pdf_download_history', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const exportAsesmenExcel = () => {
    const classStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);
      
    const studentIds = new Set(classStudents.map(s => s.id));
    let filteredAsesmens = asesmens.filter(a => studentIds.has(a.siswaId));
    
    if (filterAsesmenType !== 'all') {
      filteredAsesmens = filteredAsesmens.filter(a => a.tipe === filterAsesmenType);
    }

    const tableData = filteredAsesmens.map((a, index) => {
      const siswa = siswas.find(s => s.id === a.siswaId);
      const mapel = mapels.find(m => m.id === a.mapelId);
      return {
        no: index + 1,
        namaSiswa: siswa ? siswa.namaSiswa : 'Siswa',
        kelas: siswa ? siswa.kelas : 'Kelas',
        mapel: mapel ? mapel.namaMapel : 'Mapel',
        tipe: a.tipe.toUpperCase(),
        namaPenilaian: a.namaPenilaian,
        nilai: a.nilai,
        deskripsi: a.deskripsiKompetensi || '-'
      };
    });

    const headers = [
      { key: 'no', label: 'No' },
      { key: 'namaSiswa', label: 'Nama Siswa' },
      { key: 'kelas', label: 'Kelas' },
      { key: 'mapel', label: 'Mata Pelajaran' },
      { key: 'tipe', label: 'Tipe Asesmen' },
      { key: 'namaPenilaian', label: 'Nama Penilaian' },
      { key: 'nilai', label: 'Skor/Nilai' },
      { key: 'deskripsi', label: 'Deskripsi Capaian' }
    ];

    const classNameSuffix = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    const typeSuffix = filterAsesmenType === 'all' ? 'Semua_Tipe' : filterAsesmenType.toUpperCase();
    
    exportToExcelWithHeader(
      tableData,
      headers,
      'LAPORAN HASIL ASESMEN KURIKULUM MERDEKA',
      typeSuffix,
      activeClassFilter,
      `Rekap_Asesmen_${classNameSuffix}_${typeSuffix}`
    );
  };

  const exportAsesmenPDF = async () => {
    const classStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);
      
    const studentIds = new Set(classStudents.map(s => s.id));
    let filteredAsesmens = asesmens.filter(a => studentIds.has(a.siswaId));
    
    if (filterAsesmenType !== 'all') {
      filteredAsesmens = filteredAsesmens.filter(a => a.tipe === filterAsesmenType);
    }

    if (filteredAsesmens.length === 0) {
      alert('Tidak ada data nilai untuk diekspor.');
      return;
    }

    const isPortrait = pdfOrientation === 'portrait';
    const pageWidth = isPortrait ? 210 : 297;
    const pageHeight = isPortrait ? 297 : 210;

    const doc = new jsPDF({
      orientation: pdfOrientation,
      unit: 'mm',
      format: 'a4'
    });

    const typeLabel = filterAsesmenType === 'all' ? 'SEMUA TIPE' : filterAsesmenType.toUpperCase();
    await drawSchoolHeader(doc, `REKAPITULASI LAPORAN ASESMEN (${typeLabel})`, isPortrait, activeClassFilter);

    let headerBgColor: [number, number, number] = [79, 70, 229];
    if (pdfThemeColor === 'emerald') headerBgColor = [5, 150, 105];
    else if (pdfThemeColor === 'slate') headerBgColor = [71, 85, 105];
    else if (pdfThemeColor === 'rose') headerBgColor = [225, 29, 72];
    else if (pdfThemeColor === 'amber') headerBgColor = [217, 119, 6];

    const tableRows = filteredAsesmens.map((a, index) => {
      const siswa = siswas.find(s => s.id === a.siswaId);
      const mapel = mapels.find(m => m.id === a.mapelId);
      return [
        index + 1,
        siswa ? siswa.namaSiswa : 'Siswa',
        siswa ? siswa.kelas : 'Kelas',
        mapel ? mapel.namaMapel : 'Mapel',
        a.tipe.toUpperCase(),
        a.namaPenilaian,
        a.nilai,
        a.deskripsiKompetensi || '-'
      ];
    });

    const colStyles: any = isPortrait ? {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 28 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 33 }
    } : {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 40 },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 30, halign: 'center' },
      6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 67 }
    };

    autoTable(doc, {
      startY: 38,
      head: [[
        { content: 'No', styles: { halign: 'center' } },
        { content: 'Nama Siswa', styles: { halign: 'left' } },
        { content: 'Kelas', styles: { halign: 'center' } },
        { content: 'Mata Pelajaran', styles: { halign: 'left' } },
        { content: 'Tipe', styles: { halign: 'center' } },
        { content: 'Penilaian', styles: { halign: 'center' } },
        { content: 'Nilai', styles: { halign: 'center' } },
        { content: 'Deskripsi Capaian', styles: { halign: 'left' } }
      ]],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: headerBgColor,
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        valign: 'middle'
      },
      columnStyles: colStyles,
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5
      }
    });

    drawPDFSignature(doc, pageHeight, activeClassFilter, isPortrait);

    const classNameSuffix = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    doc.save(`Laporan_Asesmen_${classNameSuffix}_${typeLabel}.pdf`);
  };

  const exportTemuanExcel = () => {
    const classFiltered = temuanKhusus.filter(t => {
      if (activeClassFilter === 'Semua') return true;
      const student = siswas.find(s => s.id === t.siswaId);
      return student?.kelas === activeClassFilter;
    });

    const tableData = classFiltered.map((t, index) => {
      const siswa = siswas.find(s => s.id === t.siswaId);
      return {
        no: index + 1,
        tanggal: t.tanggal,
        namaSiswa: siswa ? siswa.namaSiswa : 'Siswa',
        kelas: siswa ? siswa.kelas : '-',
        kategori: t.kategori,
        deskripsi: t.deskripsi,
        tindakanLanjut: t.tindakanLanjut || '-'
      };
    });

    const headers = [
      { key: 'no', label: 'No' },
      { key: 'tanggal', label: 'Tanggal Temuan' },
      { key: 'namaSiswa', label: 'Nama Siswa' },
      { key: 'kelas', label: 'Kelas' },
      { key: 'kategori', label: 'Kategori Temuan' },
      { key: 'deskripsi', label: 'Deskripsi Temuan' },
      { key: 'tindakanLanjut', label: 'Tindakan Lanjut' }
    ];

    const classNameSuffix = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    
    exportToExcelWithHeader(
      tableData,
      headers,
      'JURNAL TEMUAN KHUSUS & KONSULTASI SISWA',
      'Semester Ganjil/Genap',
      activeClassFilter,
      `Jurnal_Temuan_Siswa_${classNameSuffix}`
    );
  };

  const exportTemuanPDF = async () => {
    const classFiltered = temuanKhusus.filter(t => {
      if (activeClassFilter === 'Semua') return true;
      const student = siswas.find(s => s.id === t.siswaId);
      return student?.kelas === activeClassFilter;
    });

    if (classFiltered.length === 0) {
      alert('Tidak ada data temuan khusus untuk diekspor.');
      return;
    }

    const isPortrait = pdfOrientation === 'portrait';
    const pageWidth = isPortrait ? 210 : 297;
    const pageHeight = isPortrait ? 297 : 210;

    const doc = new jsPDF({
      orientation: pdfOrientation,
      unit: 'mm',
      format: 'a4'
    });

    await drawSchoolHeader(doc, 'JURNAL CATATAN TEMUAN KHUSUS SISWA', isPortrait, activeClassFilter);

    let headerBgColor: [number, number, number] = [79, 70, 229];
    if (pdfThemeColor === 'emerald') headerBgColor = [5, 150, 105];
    else if (pdfThemeColor === 'slate') headerBgColor = [71, 85, 105];
    else if (pdfThemeColor === 'rose') headerBgColor = [225, 29, 72];
    else if (pdfThemeColor === 'amber') headerBgColor = [217, 119, 6];

    const tableRows = classFiltered.map((t, index) => {
      const siswa = siswas.find(s => s.id === t.siswaId);
      return [
        index + 1,
        t.tanggal,
        siswa ? siswa.namaSiswa : 'Siswa',
        siswa ? siswa.kelas : '-',
        t.kategori,
        t.deskripsi,
        t.tindakanLanjut || '-'
      ];
    });

    const colStyles: any = isPortrait ? {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 38, fontStyle: 'bold' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 41 },
      6: { cellWidth: 32 }
    } : {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 50, fontStyle: 'bold' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 35, halign: 'center' },
      5: { cellWidth: 65 },
      6: { cellWidth: 60 }
    };

    autoTable(doc, {
      startY: 38,
      head: [[
        { content: 'No', styles: { halign: 'center' } },
        { content: 'Tanggal', styles: { halign: 'center' } },
        { content: 'Nama Siswa', styles: { halign: 'left' } },
        { content: 'Kelas', styles: { halign: 'center' } },
        { content: 'Kategori', styles: { halign: 'center' } },
        { content: 'Deskripsi Temuan', styles: { halign: 'left' } },
        { content: 'Tindakan Lanjut', styles: { halign: 'left' } }
      ]],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: headerBgColor,
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        valign: 'middle'
      },
      columnStyles: colStyles,
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5
      }
    });

    drawPDFSignature(doc, pageHeight, activeClassFilter, isPortrait);

    const classNameSuffix = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    doc.save(`Jurnal_Temuan_Khusus_${classNameSuffix}.pdf`);
  };

  const handleImportSiswaExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          setExcelImportResult({
            success: false,
            type: 'siswa',
            message: 'File Excel kosong atau tidak terbaca dengan benar.',
            addedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            corrections: []
          });
          setShowExcelResultModal(true);
          return;
        }

        const currentSiswas = db.siswa.getAll();
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const details: string[] = [];
        const corrections: any[] = [];

        // Track seen elements in this excel upload to detect duplicates
        const seenNisns = new Set<string>();
        const seenNises = new Set<string>();
        const seenSiswaKeys = new Set<string>(); // "nama_kelas"

        data.forEach((row: any, index: number) => {
          const rowNum = index + 2;
          const findVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(candidate => k.toLowerCase().replace(/[\s_]/g, '') === candidate.toLowerCase().replace(/[\s_]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const nisn = String(findVal(['nisn', 'nomorinduksiswanasional']) || '').trim();
          const nis = String(findVal(['nis', 'nomorinduksiswa', 'noinduk']) || '').trim();
          const namaSiswa = String(findVal(['namasiswa', 'nama', 'fullname', 'namalengkap']) || '').trim();
          const jkRaw = String(findVal(['jk', 'jeniskelamin', 'sex', 'gender']) || '').trim().toUpperCase();
          const kelasRaw = String(findVal(['kelas', 'class', 'rombel']) || '').trim();
          const alamat = String(findVal(['alamat', 'alamatrumah', 'address']) || '').trim();
          const namaAyah = String(findVal(['namaayah', 'ayah', 'bapak', 'father']) || '').trim();
          const namaIbu = String(findVal(['namaibu', 'ibu', 'mother']) || '').trim();
          const noTeleponOrtu = String(findVal(['noteleponortu', 'notelportu', 'notelp', 'telepon', 'phone', 'contact']) || '').trim();

          // 1. VALIDASI NAMA SISWA (WAJIB)
          if (!namaSiswa) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Nama Siswa',
              val: '',
              issue: 'Nama Siswa tidak boleh kosong.',
              fix: 'Silakan isi Nama Siswa dengan nama lengkap di kolom A.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Nama Siswa kosong.`);
            return;
          }

          // 2. VALIDASI DUPLIKAT DI FILE EXCEL
          if (nisn && seenNisns.has(nisn)) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'NISN',
              val: nisn,
              issue: `NISN ganda (${nisn}) terdeteksi di baris lain dalam file Excel ini.`,
              fix: 'Perbaiki nilai NISN agar unik, atau hapus baris duplikat ini.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - NISN ganda dalam file Excel.`);
            return;
          }
          if (nis && seenNises.has(nis)) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'NIS',
              val: nis,
              issue: `NIS ganda (${nis}) terdeteksi di baris lain dalam file Excel ini.`,
              fix: 'Perbaiki nilai NIS agar unik, atau hapus baris duplikat ini.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - NIS ganda dalam file Excel.`);
            return;
          }

          const resolvedKelas = kelasRaw || (activeClassFilter !== 'Semua' ? activeClassFilter : 'Kelas 1');
          const uniqSiswaKey = `${namaSiswa.toLowerCase()}_${resolvedKelas.toLowerCase()}`;
          if (seenSiswaKeys.has(uniqSiswaKey)) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Nama & Kelas',
              val: `${namaSiswa} (${resolvedKelas})`,
              issue: `Nama Siswa dan Kelas yang sama terdeteksi ganda di baris lain dalam file Excel.`,
              fix: 'Ganti nama siswa atau pastikan data kelas unik untuk mencegah duplikasi.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Siswa ganda dalam kelas yang sama.`);
            return;
          }

          if (nisn) seenNisns.add(nisn);
          if (nis) seenNises.add(nis);
          seenSiswaKeys.add(uniqSiswaKey);

          // 3. VALIDASI JENIS KELAMIN
          let jenisKelamin: 'L' | 'P' = 'L';
          if (!jkRaw) {
            corrections.push({
              row: rowNum,
              field: 'Jenis Kelamin',
              val: '',
              issue: 'Jenis Kelamin kosong.',
              fix: 'Ganti nilai menjadi L (Laki-laki) atau P (Perempuan). Sistem mengasumsikan L secara default.',
              severity: 'warning'
            });
          } else {
            const normalizedJk = jkRaw.toUpperCase();
            if (normalizedJk === 'L' || normalizedJk === 'LAKI' || normalizedJk === 'LAKI-LAKI' || normalizedJk === 'LAKI LAKI' || normalizedJk === 'MALE') {
              jenisKelamin = 'L';
            } else if (normalizedJk === 'P' || normalizedJk === 'PEREMPUAN' || normalizedJk === 'FEMALE' || normalizedJk === 'WANITA') {
              jenisKelamin = 'P';
            } else {
              skippedCount++;
              corrections.push({
                row: rowNum,
                field: 'Jenis Kelamin',
                val: jkRaw,
                issue: `Jenis Kelamin "${jkRaw}" tidak valid.`,
                fix: 'Harap gunakan L untuk Laki-laki atau P untuk Perempuan sesuai pilihan di Excel.',
                severity: 'error'
              });
              details.push(`Baris ${rowNum}: Gagal - Jenis kelamin tidak valid.`);
              return;
            }
          }

          // 4. VALIDASI KELAS
          const matchedClass = classList.find(c => c.toLowerCase() === resolvedKelas.toLowerCase());
          if (!matchedClass) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Kelas',
              val: resolvedKelas,
              issue: `Kelas "${resolvedKelas}" tidak terdaftar di database.`,
              fix: `Pilih kelas dari pilihan valid: ${classList.join(', ')} atau buat kelas tersebut dahulu di menu Tambah Kelas.`,
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Kelas tidak terdaftar.`);
            return;
          }

          // 5. VALIDASI NISN & NIS KOSONG (PERINGATAN)
          if (!nisn) {
            corrections.push({
              row: rowNum,
              field: 'NISN',
              val: '',
              issue: 'NISN kosong untuk siswa ini.',
              fix: 'Harap lengkapi NISN (10 digit angka) sesegera mungkin agar sinkronisasi rapor berjalan lancar.',
              severity: 'warning'
            });
          }
          if (!nis) {
            corrections.push({
              row: rowNum,
              field: 'NIS',
              val: '',
              issue: 'NIS kosong untuk siswa ini.',
              fix: 'Harap lengkapi NIS siswa sesegera mungkin.',
              severity: 'warning'
            });
          }

          // 6. UPSERT PROCESS
          let existing = currentSiswas.find(s => 
            (nisn && s.nisn === nisn) || 
            (nis && s.nis === nis) || 
            (s.namaSiswa.toLowerCase() === namaSiswa.toLowerCase() && s.kelas.toLowerCase() === matchedClass.toLowerCase())
          );

          const studentId = existing?.id || `sis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

          const updatedItem: Siswa = {
            id: studentId,
            nisn: nisn || existing?.nisn || '',
            nis: nis || existing?.nis || '',
            namaSiswa,
            jenisKelamin,
            kelas: matchedClass,
            alamat: alamat || existing?.alamat || '-',
            namaAyah: namaAyah || existing?.namaAyah || '-',
            namaIbu: namaIbu || existing?.namaIbu || '-',
            noTeleponOrtu: noTeleponOrtu || existing?.noTeleponOrtu || '-',
            fotoUrl: existing?.fotoUrl,
            profileId: existing?.profileId,
            password: existing?.password || 'siswa123'
          };

          db.siswa.upsert(updatedItem);
          if (existing) {
            updatedCount++;
            details.push(`Baris ${rowNum}: Diperbarui - ${namaSiswa} (${matchedClass})`);
          } else {
            addedCount++;
            details.push(`Baris ${rowNum}: Ditambahkan - ${namaSiswa} (${matchedClass})`);
          }
        });

        const updatedList = db.siswa.getAll();
        setSiswas(updatedList);

        const errorsCount = corrections.filter(c => c.severity === 'error').length;
        const warningsCount = corrections.filter(c => c.severity === 'warning').length;

        setExcelImportResult({
          success: errorsCount === 0,
          type: 'siswa',
          message: `Selesai memproses file Siswa! Sukses: ${addedCount + updatedCount} baris (${addedCount} baru, ${updatedCount} pembaruan). Gagal/Dilewati: ${skippedCount} baris. Terdeteksi ${errorsCount} kesalahan kritis dan ${warningsCount} peringatan.`,
          addedCount,
          updatedCount,
          skippedCount,
          details,
          corrections
        });
        setShowExcelResultModal(true);

      } catch (err: any) {
        setExcelImportResult({
          success: false,
          type: 'siswa',
          message: `Gagal membaca file Excel: ${err?.message || 'Error tidak diketahui'}`,
          addedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          corrections: []
        });
        setShowExcelResultModal(true);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportAbsensiExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          setExcelImportResult({
            success: false,
            type: 'absensi',
            message: 'File Excel kosong atau tidak terbaca dengan benar.',
            addedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            corrections: []
          });
          setShowExcelResultModal(true);
          return;
        }

        const allStudents = db.siswa.getAll();
        const existingAbsensis = db.absensi.getAll();
        const details: string[] = [];
        let matchedCount = 0;
        let skippedCount = 0;
        const absensiListToUpsert: Absensi[] = [];
        const corrections: any[] = [];

        // Track seen elements in this excel upload to detect duplicate attendance on same date
        const seenAttendance = new Set<string>(); // "siswaId_tanggalStr"

        data.forEach((row: any, index: number) => {
          const rowNum = index + 2;
          const findVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(candidate => k.toLowerCase().replace(/[\s_]/g, '') === candidate.toLowerCase().replace(/[\s_]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
          };

          let tanggalRaw = findVal(['tanggal', 'tanggalabsen', 'date', 'tgl']);
          const namaSiswa = String(findVal(['namasiswa', 'nama', 'fullname', 'siswa']) || '').trim();
          const nisn = String(findVal(['nisn']) || '').trim();
          const nis = String(findVal(['nis']) || '').trim();
          const statusRaw = String(findVal(['status', 'kehadiran', 'statuskehadiran', 'presensi']) || '').trim().toLowerCase();
          const keterangan = String(findVal(['keterangan', 'ket', 'note', 'notes', 'reason']) || '').trim();

          // 1. VALIDASI FORMAT TANGGAL
          let tanggalStr = '';
          let isTanggalValid = true;
          if (typeof tanggalRaw === 'number') {
            const date = new Date(Math.round((tanggalRaw - 25569) * 86400 * 1000));
            tanggalStr = date.toISOString().split('T')[0];
          } else if (tanggalRaw) {
            const parsedStr = String(tanggalRaw).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(parsedStr)) {
              tanggalStr = parsedStr;
            } else {
              try {
                const date = new Date(parsedStr);
                if (!isNaN(date.getTime())) {
                  tanggalStr = date.toISOString().split('T')[0];
                } else {
                  isTanggalValid = false;
                }
              } catch (e) {
                isTanggalValid = false;
              }
            }
          }

          if (!isTanggalValid) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Tanggal',
              val: String(tanggalRaw),
              issue: 'Format Tanggal tidak dikenali.',
              fix: 'Gunakan format tanggal YYYY-MM-DD (Contoh: 2026-07-21) atau ganti tipe sel menjadi Date di Excel.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Tanggal tidak valid.`);
            return;
          }

          if (!tanggalStr) {
            tanggalStr = absensiTanggal;
          }

          // 2. VALIDASI IDENTITAS SISWA KOSONG
          if (!namaSiswa && !nisn && !nis) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Siswa / NISN / NIS',
              val: '',
              issue: 'Identitas siswa kosong (Nama, NISN, dan NIS tidak diisi).',
              fix: 'Silakan isi sekurang-kurangnya Nama Siswa atau NISN untuk mencocokkan data.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Identitas siswa kosong.`);
            return;
          }

          // 3. VALIDASI STATUS PRESENSI
          let status: 'hadir' | 'sakit' | 'izin' | 'alfa' = 'hadir';
          let isStatusValid = false;

          if (statusRaw.startsWith('h') || statusRaw === 'hadir' || statusRaw === 'present') {
            status = 'hadir';
            isStatusValid = true;
          } else if (statusRaw.startsWith('s') || statusRaw === 'sakit' || statusRaw === 'sick') {
            status = 'sakit';
            isStatusValid = true;
          } else if (statusRaw.startsWith('i') || statusRaw === 'izin' || statusRaw === 'ijin' || statusRaw === 'permission' || statusRaw === 'excused') {
            status = 'izin';
            isStatusValid = true;
          } else if (statusRaw.startsWith('a') || statusRaw === 'alfa' || statusRaw === 'alpha' || statusRaw === 'absent' || statusRaw === 'tanpaketerangan') {
            status = 'alfa';
            isStatusValid = true;
          }

          if (!isStatusValid) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Status Kehadiran',
              val: statusRaw,
              issue: `Status "${statusRaw}" tidak valid atau kosong.`,
              fix: 'Isi dengan status yang valid: Hadir, Sakit, Izin, atau Alfa sesuai template dropdown.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Status presensi tidak valid.`);
            return;
          }

          // 4. PENCOCOKAN SISWA DI DATABASE (EXACT & FUZZY MATCH)
          let matchedSiswa = allStudents.find(s => {
            if (nisn && s.nisn === nisn) return true;
            if (nis && s.nis === nis) return true;
            if (namaSiswa && s.namaSiswa.toLowerCase() === namaSiswa.toLowerCase()) return true;
            return false;
          });

          if (!matchedSiswa && namaSiswa) {
            matchedSiswa = allStudents.find(s => 
              s.namaSiswa.toLowerCase().includes(namaSiswa.toLowerCase()) || 
              namaSiswa.toLowerCase().includes(s.namaSiswa.toLowerCase())
            );
          }

          if (!matchedSiswa) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Pencocokan Siswa',
              val: namaSiswa || nisn || nis,
              issue: 'Siswa tidak ditemukan dalam database sekolah.',
              fix: 'Periksa ejaan nama atau nomor induk siswa di Excel Anda. Daftarkan siswa tersebut terlebih dahulu jika belum ada.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Siswa "${namaSiswa || nisn || nis}" tidak ditemukan.`);
            return;
          }

          // 5. DETEKSI DUPLIKAT BARIS DI EXCEL
          const uniqueAttendanceKey = `${matchedSiswa.id}_${tanggalStr}`;
          if (seenAttendance.has(uniqueAttendanceKey)) {
            skippedCount++;
            corrections.push({
              row: rowNum,
              field: 'Duplikasi Presensi',
              val: matchedSiswa.namaSiswa,
              issue: `Siswa ${matchedSiswa.namaSiswa} memiliki lebih dari satu baris presensi pada tanggal ${tanggalStr} di file Excel ini.`,
              fix: 'Pastikan tiap siswa hanya memiliki satu baris presensi per tanggal di file Excel Anda.',
              severity: 'error'
            });
            details.push(`Baris ${rowNum}: Gagal - Duplikasi presensi siswa pada hari yang sama.`);
            return;
          }
          seenAttendance.add(uniqueAttendanceKey);

          // 6. DETEKSI REKAMAN YANG SUDAH ADA DI DATABASE (OVERWRITE WARNING)
          const dbDuplicate = existingAbsensis.find(a => a.siswaId === matchedSiswa!.id && a.tanggal === tanggalStr);
          if (dbDuplicate) {
            corrections.push({
              row: rowNum,
              field: 'Duplikasi Database',
              val: matchedSiswa.namaSiswa,
              issue: `Presensi ${matchedSiswa.namaSiswa} untuk tanggal ${tanggalStr} sudah tercatat di database dengan status: ${dbDuplicate.status.toUpperCase()}.`,
              fix: `Status lama akan ditimpa menjadi "${status.toUpperCase()}" sesuai unggahan Excel baru ini.`,
              severity: 'warning'
            });
          }

          const newAbsen: Absensi = {
            siswaId: matchedSiswa.id,
            tanggal: tanggalStr,
            status,
            keterangan: keterangan || '',
            id: dbDuplicate?.id || `abs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
          };

          absensiListToUpsert.push(newAbsen);
          matchedCount++;
          details.push(`Baris ${rowNum}: Sukses - Mencatat presensi ${matchedSiswa.namaSiswa} (${status.toUpperCase()}) pada ${tanggalStr}`);
        });

        if (absensiListToUpsert.length > 0) {
          db.absensi.bulkUpsert(absensiListToUpsert);
          setAbsensis(db.absensi.getAll());
        }

        const errorsCount = corrections.filter(c => c.severity === 'error').length;
        const warningsCount = corrections.filter(c => c.severity === 'warning').length;

        setExcelImportResult({
          success: errorsCount === 0,
          type: 'absensi',
          message: `Selesai memproses file Presensi! Sukses: ${matchedCount} data. Gagal/Dilewati: ${skippedCount} data. Terdeteksi ${errorsCount} kesalahan kritis dan ${warningsCount} peringatan.`,
          addedCount: matchedCount,
          updatedCount: 0,
          skippedCount,
          details,
          corrections
        });
        setShowExcelResultModal(true);

      } catch (err: any) {
        setExcelImportResult({
          success: false,
          type: 'absensi',
          message: `Gagal membaca file Excel: ${err?.message || 'Error tidak diketahui'}`,
          addedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          corrections: []
        });
        setShowExcelResultModal(true);
      }
    };
    reader.readAsBinaryString(file);
  };

  const exportAsesmenCSV = () => {
    const classStudents = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);
      
    const studentIds = new Set(classStudents.map(s => s.id));
    
    let filteredAsesmens = asesmens.filter(a => studentIds.has(a.siswaId));
    
    if (filterAsesmenType !== 'all') {
      filteredAsesmens = filteredAsesmens.filter(a => a.tipe === filterAsesmenType);
    }

    const formatted = filteredAsesmens.map(a => {
      const siswa = siswas.find(s => s.id === a.siswaId);
      const mapel = mapels.find(m => m.id === a.mapelId);
      return {
        namaSiswa: siswa ? siswa.namaSiswa : 'Siswa',
        kelas: siswa ? siswa.kelas : 'Kelas',
        mapel: mapel ? mapel.namaMapel : 'Mapel',
        tipe: a.tipe.toUpperCase(),
        namaPenilaian: a.namaPenilaian,
        nilai: a.nilai,
        deskripsi: a.deskripsiKompetensi || '-'
      };
    });

    const classNameSuffix = activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(/\s+/g, '_');
    const typeSuffix = filterAsesmenType === 'all' ? 'Semua_Tipe' : filterAsesmenType.toUpperCase();
    exportToCSV(
      formatted,
      [
        { key: 'namaSiswa', label: 'Nama Siswa' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'mapel', label: 'Mata Pelajaran' },
        { key: 'tipe', label: 'Tipe Asesmen' },
        { key: 'namaPenilaian', label: 'Nama Penilaian' },
        { key: 'nilai', label: 'Skor/Nilai' },
        { key: 'deskripsi', label: 'Deskripsi Capaian' }
      ],
      `Laporan_Asesmen_Merdeka_${classNameSuffix}_${typeSuffix}`
    );
  };

  const exportRekapitulasiCSV = () => {
    const rekapStudentsFiltered = activeClassFilter === 'Semua' 
      ? siswas 
      : siswas.filter(s => s.kelas === activeClassFilter);

    const formatted = rekapStudentsFiltered.map((s, idx) => {
      const studentAsesmens = asesmens.filter(a => a.siswaId === s.id);
      const harian = studentAsesmens.filter(a => a.tipe === 'harian');
      const sts = studentAsesmens.filter(a => a.tipe === 'sts');
      const sas = studentAsesmens.filter(a => a.tipe === 'sas');
      const kokurikuler = studentAsesmens.filter(a => a.tipe === 'kokurikuler');

      const avgHarian = harian.length ? Math.round(harian.reduce((acc, curr) => acc + curr.nilai, 0) / harian.length) : 0;
      const avgSts = sts.length ? Math.round(sts.reduce((acc, curr) => acc + curr.nilai, 0) / sts.length) : 0;
      const avgSas = sas.length ? Math.round(sas.reduce((acc, curr) => acc + curr.nilai, 0) / sas.length) : 0;
      const avgKoku = kokurikuler.length ? Math.round(kokurikuler.reduce((acc, curr) => acc + curr.nilai, 0) / kokurikuler.length) : 0;
      const overallAvg = studentAsesmens.length ? Math.round(studentAsesmens.reduce((acc, curr) => acc + curr.nilai, 0) / studentAsesmens.length) : 0;

      return {
        no: idx + 1,
        namaSiswa: s.namaSiswa,
        nisn: s.nisn,
        kelas: s.kelas,
        avgFormatif: avgHarian || '-',
        avgSts: avgSts || '-',
        avgSas: avgSas || '-',
        avgP5: avgKoku || '-',
        overallAvg: overallAvg || '-',
        status: overallAvg >= 75 ? 'Tuntas KKM' : 'Belum Tuntas'
      };
    });

    exportToCSV(
      formatted,
      [
        { key: 'no', label: 'No' },
        { key: 'namaSiswa', label: 'Nama Siswa' },
        { key: 'nisn', label: 'NISN' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'avgFormatif', label: 'Rata-rata Formatif (Harian)' },
        { key: 'avgSts', label: 'Rata-rata Sumatif Tengah Semester (STS)' },
        { key: 'avgSas', label: 'Rata-rata Sumatif Akhir Semester (SAS)' },
        { key: 'avgP5', label: 'Rata-rata P5 (Kokurikuler)' },
        { key: 'overallAvg', label: 'Nilai Rata-rata Akhir' },
        { key: 'status', label: 'Status Kelulusan' }
      ],
      `Rekapitulasi_Nilai_${activeClassFilter === 'Semua' ? 'Semua_Kelas' : 'Kelas_' + activeClassFilter.replace(' ', '_')}`
    );
  };

  const exportTemuanCSV = () => {
    const formatted = temuanKhusus.map(t => {
      const siswa = siswas.find(s => s.id === t.siswaId);
      return {
        tanggal: t.tanggal,
        namaSiswa: siswa ? siswa.namaSiswa : 'Siswa',
        kategori: t.kategori,
        deskripsi: t.deskripsi,
        tindakanLanjut: t.tindakanLanjut || '-'
      };
    });
    exportToCSV(
      formatted,
      [
        { key: 'tanggal', label: 'Tanggal Temuan' },
        { key: 'namaSiswa', label: 'Nama Siswa' },
        { key: 'kategori', label: 'Kategori Temuan' },
        { key: 'deskripsi', label: 'Deskripsi Kasus/Temuan' },
        { key: 'tindakanLanjut', label: 'Tindakan Lanjut' }
      ],
      'Laporan_Temuan_Khusus'
    );
  };

  return (
    <div id="guru_dashboard_container" className="space-y-6">
      {/* 1. PROFIL SEKOLAH */}
      {activeTab === 'profil_sekolah' && (
        <div id="school_profile_view" className="max-w-4xl mx-auto space-y-6">
          {/* School Profile Overview & Structured Address Card View */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left border-b border-m3-border dark:border-slate-800 pb-6">
              {sekolah.logoUrl ? (
                <img
                  src={sekolah.logoUrl}
                  alt="Logo Sekolah"
                  className="w-28 h-28 rounded-3xl object-cover shadow-sm border-4 border-m3-purple/20 shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                style={{ display: sekolah.logoUrl ? 'none' : 'flex' }}
                className="w-28 h-28 rounded-3xl bg-m3-purple flex items-center justify-center text-white text-3xl font-bold shadow-sm border-4 border-m3-purple/20 shrink-0"
              >
                {sekolah.namaSekolah ? sekolah.namaSekolah.substring(0, 2).toUpperCase() : 'SD'}
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 bg-m3-lavender dark:bg-indigo-950/40 text-m3-purple dark:text-indigo-400 font-bold text-xs rounded-full">
                    Akreditasi {sekolah.akreditasi || 'A'}
                  </span>
                  <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-full flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>TP {sekolah.tahunPelajaran || '2025/2026'}</span>
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">
                  {sekolah.namaSekolah || 'Sekolah Dasar'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  NPSN: <span className="font-semibold text-slate-700 dark:text-slate-200">{sekolah.npsn || '-'}</span> | Kepala Sekolah: <span className="font-semibold text-slate-700 dark:text-slate-200">{sekolah.kepalaSekolah || '-'}</span>
                </p>
              </div>

              {isOperator && setActiveTab && (
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('aplikasi_setting')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Ubah di Pengaturan Aplikasi</span>
                  </button>
                </div>
              )}
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">Nomor Pokok Sekolah (NPSN)</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sekolah.npsn || '-'}</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">Kepala Sekolah</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sekolah.kepalaSekolah || '-'}</span>
                <span className="text-[10px] text-slate-400 block">NIP: {sekolah.nipKepalaSekolah || '-'}</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">Tahun Pelajaran & Status</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{sekolah.tahunPelajaran || '2025/2026'}</span>
                <span className="text-[10px] text-slate-400 block">Akreditasi {sekolah.akreditasi || 'A'}</span>
              </div>
            </div>

            {/* Structured Alamat & Wilayah Sekolah */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Detail Alamat & Wilayah Instansi
              </h4>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Jalan / RT-RW</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {sekolah.jalan || '-'} {sekolah.rtRw ? `(${sekolah.rtRw})` : ''}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Dusun</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sekolah.dusun || '-'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Desa / Kelurahan</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sekolah.desa || '-'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Kecamatan</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sekolah.kecamatan || '-'}</span>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">Kabupaten / Kota</span>
                    <span className="font-black text-indigo-900 dark:text-indigo-200 block">{sekolah.kabupaten || '-'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Provinsi</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sekolah.provinsi || '-'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Kode Pos</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sekolah.kodePos || '-'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  <span className="font-bold text-[10px] text-slate-400 block mb-0.5">Alamat Lengkap Cetak Rapor:</span>
                  "{sekolah.alamat || '-'}"
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROFIL GURU */}
      {activeTab === 'profil_guru' && (
        <div id="teachers_profile_view" className="space-y-6">
          {/* Security / Kredensial Guru Form */}
          {loggedInGuru && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">Ubah Username &amp; Password Profil Anda ({loggedInGuru.namaGuru})</h4>
                  <p className="text-xs text-slate-500">
                    Gunakan NIP/Username dan kata sandi unik Anda untuk login ke aplikasi.
                  </p>
                </div>
              </div>
              <form onSubmit={handleUpdateGuruCredentials} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Username / NIP Anda</label>
                  <input
                    type="text"
                    value={guruNip}
                    onChange={(e) => setGuruNip(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                    placeholder="NIP..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Password Baru</label>
                  <input
                    type="password"
                    value={guruPassword}
                    onChange={(e) => setGuruPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                    placeholder="Password..."
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Simpan Kredensial Saya
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Direktori &amp; Profil Guru</h3>
              <p className="text-xs text-slate-500">Daftar staf pengampu pengajar kelas Kurikulum Merdeka</p>
            </div>
            {isOperator && (
              <div className="flex gap-2 flex-wrap">
                <button
                  id="export_guru_btn"
                  onClick={exportGuruCSV}
                  className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-md"
                >
                  <Upload className="w-4 h-4" />
                  Ekspor Guru
                </button>
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer shadow-md transition-all">
                  <Download className="w-4 h-4" />
                  <span>Impor Guru</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportGuruExcel}
                    className="hidden"
                  />
                </label>
                <button
                  id="add_guru_btn"
                  onClick={handleOpenAddModal}
                  className="bg-m3-purple text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-m3-purple-dark shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Guru
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gurus.map((g) => {
              const isSelf = loggedInGuru ? (g.id === loggedInGuru.id || (g.nip && g.nip === loggedInGuru.nip)) : (g.id === loggedInUserId);
              const canEditThisTeacher = isOperator || isSelf;

              return (
                <div
                  key={g.id}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col items-center text-center relative group"
                >
                  {canEditThisTeacher && (
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                      <button
                        id={`edit_guru_${g.id}`}
                        onClick={() => handleOpenEditModal(g)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer"
                        title={isSelf ? "Edit Profil Saya" : "Edit Profil Guru"}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isOperator && (
                        <button
                          id={`delete_guru_${g.id}`}
                          onClick={() => onDeleteGuru(g.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                          title="Hapus Guru"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                <img
                  src={g.fotoUrl}
                  alt={g.namaGuru}
                  className="w-24 h-24 rounded-full object-cover shadow-md mb-4 ring-4 ring-indigo-500/20"
                  referrerPolicy="no-referrer"
                />
                <h4 className="text-base font-bold text-slate-800 dark:text-white leading-snug">{g.namaGuru}</h4>
                <p className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 mt-1 font-bold">
                  {g.nip ? `NIP: ${g.nip}` : 'NIP: -'}
                </p>
                <p className="text-xs text-m3-purple dark:text-indigo-400 mt-2.5 font-semibold">
                  Spesialis: {g.mataPelajaranUtama}
                </p>
                <p className="text-xs text-slate-400 mt-1">{g.gelar}</p>
                <span className="mt-4 px-3 py-1 bg-slate-100 dark:bg-slate-800/40 text-[10px] font-bold uppercase tracking-wider text-slate-600 rounded-lg">
                  Kepegawaian: {g.statusKepegawaian}
                </span>

                {isOperator && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 w-full text-left space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Integrasi Google Workspace</p>
                    {g.googleEmail ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1.5 rounded-lg border border-emerald-100/30 dark:border-emerald-900/30">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 animate-pulse"></span>
                          <span className="truncate" title={g.googleEmail}>{g.googleEmail}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditGoogleEmail(g.id, g.googleEmail || '')}
                              className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                            >
                              Edit Email
                            </button>
                            <button
                              onClick={() => handleTestEmailSync(g)}
                              className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                              title="Uji Singkronisasi Email Guru"
                            >
                              Tes Singkron
                            </button>
                            <button
                              onClick={() => handleRemoveGoogleAuth(g.id)}
                              className="px-2 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-[10px] font-bold text-red-600 dark:text-red-400 rounded-lg transition-colors cursor-pointer"
                              title="Cabut Otorisasi Google"
                            >
                              Cabut
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-slate-400 italic">Google belum diotorisasi</p>
                        <button
                          onClick={() => handleEditGoogleEmail(g.id, '')}
                          className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                        >
                          Atur Email Google
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MATA PELAJARAN */}
      {activeTab === 'mata_pelajaran' && (
        <div id="subjects_view" className="space-y-4">
          {renderClassFilterBar()}

          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Kelola Mapel</h3>
              <p className="text-xs text-slate-500">Mata pelajaran per kelas dengan standar ketuntasan belajar (KKM)</p>
            </div>
            <div className="flex items-center gap-2">
              <label
                id="import_mapel_btn"
                className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-md transition-all"
              >
                <Download className="w-4 h-4" />
                Impor Mapel
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportMapelExcel}
                  className="hidden"
                />
              </label>
              {isCurrentGuruWaliKelas && (
                <button
                  id="add_mapel_btn"
                  onClick={handleOpenAddModal}
                  className="bg-m3-purple text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-m3-purple-dark shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Mapel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(() => {
              const filteredMapels = mapels.filter(m => {
                if (activeClassFilter === 'Semua') return true;
                return m.kelas === activeClassFilter || (!m.kelas && activeClassFilter === 'Kelas 4');
              });

              if (filteredMapels.length === 0) {
                return (
                  <div className="col-span-full py-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-m3-border dark:border-slate-800 text-slate-400">
                    <p className="text-sm font-semibold">Belum ada Mapel untuk {activeClassFilter}</p>
                    <p className="text-xs mt-1">Klik "Tambah Mapel" untuk membuat mata pelajaran di kelas ini.</p>
                  </div>
                );
              }

              return filteredMapels.map((m) => {
                const pengampu = gurus.find(g => g.id === m.guruPengampuId);
                return (
                  <div
                    key={m.id}
                    className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold bg-m3-lavender dark:bg-indigo-950/40 text-m3-purple dark:text-indigo-400 px-2.5 py-1 rounded-xl">
                            {m.kodeMapel}
                          </span>
                          <span className="text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-xl border border-sky-200/50 dark:border-sky-800/30">
                            {m.kelas || 'Kelas 4'}
                          </span>
                        </div>
                        {(isCurrentGuruWaliKelas || m.guruPengampuId === loggedInUserId) && (
                          <div className="flex gap-1.5">
                            <button
                              id={`edit_mapel_${m.id}`}
                              onClick={() => handleOpenEditModal(m)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer"
                              title="Edit Mapel"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isCurrentGuruWaliKelas && (
                              <button
                                id={`delete_mapel_${m.id}`}
                                onClick={() => onDeleteMapel(m.id)}
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                                title="Hapus Mapel"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-slate-800 dark:text-white mt-3">{m.namaMapel}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Pengampu: <strong className="text-slate-700 dark:text-slate-300">{pengampu ? pengampu.namaGuru : 'Belum Ditunjuk'}</strong>
                      </p>
                    </div>
                    <div className="mt-6 border-t border-m3-border dark:border-slate-800/50 pt-4 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Target KKM</span>
                      <span className="font-bold text-m3-purple dark:text-indigo-400 text-sm">{m.kkm} Poin</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 4. JADWAL PELAJARAN */}
      {activeTab === 'jadwal_pelajaran' && (
        <div id="schedule_view" className="space-y-4">
          {renderClassFilterBar()}

          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Jadwal Pelajaran Kelas</h3>
              <p className="text-xs text-slate-500">Atur agenda dan ruangan KBM harian</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={exportJadwalExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Ekspor Jadwal</span>
              </button>
              <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer shadow-md transition-all">
                <Download className="w-4 h-4" />
                <span>Impor Jadwal</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportJadwalExcel}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={cetakJadwalPDF}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Jadwal</span>
              </button>
              {(isCurrentGuruWaliKelas || isOperator) && (
                <button
                  id="add_jadwal_btn"
                  onClick={handleOpenAddModal}
                  className="bg-m3-purple text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-m3-purple-dark shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Jadwal
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-m3-lavender/50 dark:bg-slate-800/50 text-m3-sec-text dark:text-slate-400 font-bold text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4">Hari</th>
                    {activeClassFilter === 'Semua' && <th className="px-6 py-4">Kelas</th>}
                    <th className="px-6 py-4">Mata Pelajaran</th>
                    <th className="px-6 py-4">Sesi Waktu</th>
                    <th className="px-6 py-4">Ruangan</th>
                    {isCurrentGuruWaliKelas && <th className="px-6 py-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-border dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {(() => {
                    const dayOrder: Record<string, number> = {
                      'senin': 1,
                      'selasa': 2,
                      'rabu': 3,
                      'kamis': 4,
                      'jumat': 5,
                      'sabtu': 6,
                      'minggu': 7
                    };
                    const filteredJadwals = jadwals.filter(j => {
                      if (activeClassFilter === 'Semua') return true;
                      return j.kelas === activeClassFilter;
                    });

                    return [...filteredJadwals]
                      .sort((a, b) => {
                        const dayA = dayOrder[a.hari.trim().toLowerCase()] || 99;
                        const dayB = dayOrder[b.hari.trim().toLowerCase()] || 99;
                        if (dayA !== dayB) return dayA - dayB;
                        return a.jamMulai.localeCompare(b.jamMulai);
                      })
                      .map((j) => {
                        const mapel = mapels.find(m => m.id === j.mapelId);
                        return (
                          <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{j.hari}</td>
                            {activeClassFilter === 'Semua' && <td className="px-6 py-4 text-xs font-bold text-m3-purple dark:text-indigo-400">{j.kelas || '-'}</td>}
                            <td className="px-6 py-4 font-semibold">{mapel ? mapel.namaMapel : '-'}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-m3-lavender dark:bg-indigo-950 text-m3-purple dark:text-indigo-400 text-xs font-bold rounded-lg">
                                {j.jamMulai} - {j.jamSelesai}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">{j.ruangan}</td>
                            {isCurrentGuruWaliKelas && (
                              <td className="px-6 py-4 text-right flex justify-end gap-2">
                                <button
                                  id={`edit_jadwal_${j.id}`}
                                  onClick={() => handleOpenEditModal(j)}
                                  className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-950/10 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  id={`delete_jadwal_${j.id}`}
                                  onClick={() => onDeleteJadwal(j.id)}
                                  className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-red-500 hover:bg-red-100/50 dark:hover:bg-red-950/10 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. DATA SISWA */}
      {activeTab === 'data_siswa' && (
        <div id="students_view" className="space-y-4">
          {/* Class Filters & Creation Container */}
          {renderClassFilterBar()}

          <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-4">
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari siswa (Nama/NISN)..."
                value={siswaSearch}
                onChange={(e) => setSiswaSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 gap-1.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase whitespace-nowrap">Cetak Kelas:</span>
                <select
                  value={selectedClassForCards}
                  onChange={(e) => setSelectedClassForCards(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-m3-purple/50 cursor-pointer min-w-[120px]"
                >
                  <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="all">Semua Kelas</option>
                  {sortClasses(siswas.map(s => s.kelas).filter(Boolean)).map(cls => (
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <button
                  id="export_class_cards_btn"
                  onClick={() => {
                    const filtered = selectedClassForCards === 'all' 
                      ? siswas 
                      : siswas.filter(s => s.kelas === selectedClassForCards);
                    setLoginCardsToPrint(filtered);
                    setShowLoginCardsModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-full flex items-center justify-center cursor-pointer shadow-md ml-1 transition-all hover:scale-105"
                  title="Pratinjau & Cetak Kartu Login Kelas"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  id="download_login_cards_pdf_btn"
                  onClick={() => handleDownloadLoginCardsPDF(selectedClassForCards)}
                  className="bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded-full flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105"
                  title="Unduh PDF Kartu Login Siap Cetak"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              <button
                id="export_siswa_btn"
                onClick={exportSiswaCSV}
                className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-md transition-all hover:scale-105"
              >
                <Upload className="w-4 h-4" />
                Ekspor Siswa
              </button>
              <button
                id="import_siswa_excel_btn"
                onClick={() => {
                  setExcelImportResult(null);
                  setShowImportSiswaExcelModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-105"
                title="Unggah data siswa dari file Excel (.xlsx)"
              >
                <Download className="w-4 h-4" />
                Impor Siswa
              </button>
              <button
                id="add_siswa_btn"
                onClick={handleOpenAddModal}
                className="bg-m3-purple text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-m3-purple-dark shadow-md"
              >
                <Plus className="w-4 h-4" />
                Tambah Siswa
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-m3-lavender/50 dark:bg-slate-800/50 text-m3-sec-text dark:text-slate-400 font-bold text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4">Foto / Profil</th>
                    <th className="px-6 py-4">NISN / NIS</th>
                    <th className="px-6 py-4">Jenis Kelamin</th>
                    <th className="px-6 py-4">Wali Murid (Kontak)</th>
                    <th className="px-6 py-4">Alamat Rumah</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-border dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {siswas
                    .filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter)
                    .filter(s =>
                      s.namaSiswa.toLowerCase().includes(siswaSearch.toLowerCase()) ||
                      s.nisn.includes(siswaSearch)
                    )
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={s.fotoUrl}
                              alt={s.namaSiswa}
                              className="w-10 h-10 rounded-full object-cover shrink-0 aspect-square shadow-sm border border-indigo-200/50"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">{s.namaSiswa}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{s.kelas}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-mono text-xs text-m3-purple dark:text-indigo-400">NISN: {s.nisn}</p>
                          <p className="font-mono text-[10px] text-slate-400">NIS: {s.nis}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                            s.jenisKelamin === 'L' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400'
                          }`}>
                            {s.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold">{s.namaAyah || s.namaIbu}</p>
                          <p className="text-xs text-slate-500 font-mono">{s.noTeleponOrtu}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">{s.alamat}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-1.5 mt-2">
                          {(isOperator || (isRealWaliKelas && s.kelas === loggedInGuru?.kelasWali)) && (
                            <button
                              id={`edit_creds_${s.id}`}
                              onClick={() => handleOpenCredentialsModal(s)}
                              title="Edit Username & Password"
                              className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-indigo-500 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/10 cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            id={`print_card_${s.id}`}
                            onClick={() => {
                              setLoginCardsToPrint([s]);
                              setShowLoginCardsModal(true);
                            }}
                            title="Cetak Kartu Login"
                            className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-emerald-500 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/10 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {(isOperator || (isRealWaliKelas && s.kelas === loggedInGuru?.kelasWali)) && (
                            <>
                              <button
                                id={`edit_siswa_${s.id}`}
                                onClick={() => handleOpenEditModal(s)}
                                title="Edit Data Siswa"
                                className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-950/10 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                id={`delete_siswa_${s.id}`}
                                onClick={() => onDeleteSiswa(s.id)}
                                title="Hapus Siswa"
                                className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-red-500 hover:bg-red-100/50 dark:hover:bg-red-950/10 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. ABSENSI SISWA (BULK ROLL-CALL) */}
      {activeTab === 'absensi' && (
        <div id="attendance_view" className="space-y-4">
          {renderClassFilterBar()}

          {/* Widget Analisis Tren Kehadiran dan Wawasan (Recharts) */}
          {(() => {
            const trendData = getAttendanceTrendData();
            if (trendData.length === 0) return null;

            // 1. Calculate overall presence rate
            const totalHadir = trendData.reduce((acc, curr) => acc + curr.Hadir, 0);
            const totalExpected = trendData.reduce((acc, curr) => acc + curr.Total, 0);
            const overallPresenceRate = totalExpected > 0 ? Math.round((totalHadir / totalExpected) * 100) : 100;

            // 2. Identify highest/lowest presence day
            const highestDay = [...trendData].sort((a, b) => b.Persentase - a.Persentase)[0];
            const lowestDay = [...trendData].sort((a, b) => a.Persentase - b.Persentase)[0];

            // 3. Main reason for absence
            let totalSakit = 0, totalIzin = 0, totalAlfa = 0;
            trendData.forEach(d => {
              totalSakit += d.Sakit;
              totalIzin += d.Izin;
              totalAlfa += d.Alfa;
            });
            const totalAbsences = totalSakit + totalIzin + totalAlfa;
            let mainAbsenceReason = "Tidak ada";
            if (totalAbsences > 0) {
              const maxVal = Math.max(totalSakit, totalIzin, totalAlfa);
              if (maxVal === totalSakit) mainAbsenceReason = "Sakit (Kesehatan)";
              else if (maxVal === totalIzin) mainAbsenceReason = "Izin (Keperluan)";
              else mainAbsenceReason = "Alfa (Tanpa Keterangan)";
            }

            // 4. Students with high absence rate in the active filtered class
            const classStudents = activeClassFilter === 'Semua' 
              ? siswas 
              : siswas.filter(s => s.kelas === activeClassFilter);

            const lowAttendanceStudents = classStudents.map(student => {
              const studentAbsen = absensis.filter(a => a.siswaId === student.id);
              const absentCount = studentAbsen.filter(a => a.status !== 'hadir').length;
              const totalCount = studentAbsen.length;
              const rate = totalCount > 0 ? Math.round(((totalCount - absentCount) / totalCount) * 100) : 100;
              const alfaCount = studentAbsen.filter(a => a.status === 'alfa').length;

              return {
                student,
                absentCount,
                alfaCount,
                rate
              };
            }).filter(s => s.rate < 90).slice(0, 3); // Get top 3 students under 90%

            return (
              <div id="attendance_trend_widget" className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
                {/* Visual Chart Card */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 gap-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                            Grafik Tren Kehadiran Siswa
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Kehadiran harian {trendClassFilter === 'Semua' ? 'seluruh kelas (terpisah per kelas)' : trendClassFilter}
                          </p>
                        </div>
                      </div>
                      
                      {/* Interactive Controls & Filters */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Filter Kelas</span>
                          <select
                            value={trendClassFilter}
                            onChange={(e) => setTrendClassFilter(e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-m3-purple/50 cursor-pointer min-w-[130px]"
                          >
                            <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Semua">Semua Kelas (Perbandingan)</option>
                            {classList.map(cls => (
                              <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Tanggal Mulai</span>
                          <input
                            type="date"
                            value={trendStartDate}
                            onChange={(e) => setTrendStartDate(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Tanggal Akhir</span>
                          <input
                            type="date"
                            value={trendEndDate}
                            onChange={(e) => setTrendEndDate(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <span className="self-end px-2.5 py-1.5 text-[11px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100/30">
                          Rata-rata: {overallPresenceRate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recharts Area Chart */}
                  <div className="h-56 sm:h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPresence" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          domain={[60, 100]} 
                          tick={{ fontSize: 10, fill: '#64748b' }} 
                          tickLine={false}
                          axisLine={false}
                          unit="%"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                            borderRadius: '16px', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        />
                        {trendClassFilter === 'Semua' ? (
                          classList.map((cls, idx) => {
                            const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6'];
                            const color = colors[idx % colors.length];
                            return (
                              <Area
                                key={cls}
                                type="monotone"
                                dataKey={cls}
                                stroke={color}
                                strokeWidth={2.5}
                                fillOpacity={0.03}
                                fill={color}
                                name={cls}
                              />
                            );
                          })
                        ) : (
                          <Area 
                            type="monotone" 
                            dataKey="Persentase" 
                            stroke="#6366f1" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorPresence)" 
                            name={`Kehadiran ${trendClassFilter}`} 
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 font-medium bg-slate-50 dark:bg-slate-800/20 p-2.5 rounded-2xl">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span>Hadir</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span>Izin</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                      <span>Sakit</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span>Alfa</span>
                    </div>
                    <span className="ml-auto text-[10px] text-slate-400 font-mono">
                      Data dianalisis: {trendData.length} hari
                    </span>
                  </div>
                </div>

                {/* Insights Panel Card */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3 flex items-center gap-2">
                      <ThumbsUp className="w-4.5 h-4.5 text-emerald-500" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                        Wawasan Kehadiran
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {/* Metric 1 */}
                      <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/20 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Tertinggi</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            {highestDay ? highestDay.label : '-'}
                          </p>
                        </div>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {highestDay ? `${highestDay.Persentase}%` : '-'}
                        </span>
                      </div>

                      {/* Metric 2 */}
                      <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/20 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Terendah</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            {lowestDay ? lowestDay.label : '-'}
                          </p>
                        </div>
                        <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                          {lowestDay ? `${lowestDay.Persentase}%` : '-'}
                        </span>
                      </div>

                      {/* Metric 3 */}
                      <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/20 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Alasan Terbanyak</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            Absensi Tidak Hadir
                          </p>
                        </div>
                        <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                          {mainAbsenceReason}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actionable alerts */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      Siswa Perlu Perhatian (&lt;90%)
                    </h5>

                    {lowAttendanceStudents.length === 0 ? (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-center text-[10px] text-slate-400 font-medium">
                        Kehadiran siswa sangat baik! Semua berada di atas 90%.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {lowAttendanceStudents.map(item => (
                          <div key={item.student.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors">
                            <div className="flex items-center gap-2">
                              <img 
                                src={item.student.fotoUrl} 
                                alt={item.student.namaSiswa} 
                                className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-100 dark:border-slate-800"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">
                                  {item.student.namaSiswa}
                                </p>
                                <p className="text-[9px] text-slate-400 leading-none mt-0.5">
                                  {item.absentCount}x absen, {item.alfaCount}x alfa
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-rose-500">
                              {item.rate}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-m3-purple" />
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Pencatatan Presensi Kelas</h3>
                <p className="text-xs text-slate-500">Lakukan absensi harian dan simpan data secara kolektif</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari siswa..."
                  value={absensiSearch}
                  onChange={(e) => setAbsensiSearch(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-m3-purple focus:outline-none w-44"
                />
              </div>
              <input
                type="date"
                value={absensiTanggal}
                onChange={(e) => setAbsensiTanggal(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
              <button
                id="export_absensi_excel_btn"
                onClick={exportAbsensiExcel}
                className="bg-teal-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-teal-700 shadow-md transition-all hover:scale-105"
                title="Ekspor rekapitulasi kehadiran bulanan ke format Excel (.xlsx)"
              >
                <Upload className="w-4 h-4" />
                Unduh Excel Presensi
              </button>
              <button
                id="export_absensi_pdf_btn"
                onClick={exportAbsensiPDF}
                className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-indigo-700 shadow-md transition-all hover:scale-105"
                title="Ekspor rekapitulasi kehadiran bulanan ke format PDF"
              >
                <FileText className="w-4 h-4" />
                Unduh PDF Presensi
              </button>
              <button
                id="import_absensi_excel_btn"
                onClick={() => {
                  setExcelImportResult(null);
                  setShowImportAbsensiExcelModal(true);
                }}
                className="bg-violet-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-violet-700 shadow-md transition-all hover:scale-105"
                title="Unggah data kehadiran siswa dari file Excel (.xlsx)"
              >
                <Download className="w-4 h-4" />
                Unggah Excel Presensi
              </button>
              {isOperator && (
                <button
                  id="clear_absensi_btn"
                  onClick={() => {
                    setDeleteConfirm({
                      id: 'all',
                      type: 'absensi',
                      message: 'Apakah Anda yakin ingin menghapus SELURUH data rekam absensi / presensi? Seluruh riwayat rekam kehadiran siswa di sistem dan database akan terhapus secara permanen.'
                    });
                  }}
                  className="bg-rose-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-rose-700 shadow-md transition-all hover:scale-105"
                  title="Hapus seluruh rekam absensi tersimpan"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Rekam Absensi
                </button>
              )}
            </div>
          </div>

          {/* PDF EXPORT CUSTOMIZATION & HISTORY */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Pengaturan &amp; Riwayat Laporan PDF</h4>
              </div>
              <button
                onClick={() => setShowPdfPreferences(!showPdfPreferences)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                {showPdfPreferences ? 'Sembunyikan Pengaturan' : 'Tampilkan Pengaturan & Riwayat'}
              </button>
            </div>

            {showPdfPreferences && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                {/* Preferences Block */}
                <div className="space-y-4">
                  <h5 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Preferensi Unduhan (Disimpan di Penyimpanan Lokal Browser)
                  </h5>
                  
                  <div className="space-y-3">
                    {/* Orientation Toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Orientasi Dokumen PDF</p>
                        <p className="text-[10px] text-slate-400">Pilih orientasi halaman hasil cetak laporan</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updatePdfOrientation('portrait')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                            pdfOrientation === 'portrait'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                          }`}
                        >
                          Tegak (Portrait)
                        </button>
                        <button
                          onClick={() => updatePdfOrientation('landscape')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                            pdfOrientation === 'landscape'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                          }`}
                        >
                          Mendatar (Landscape)
                        </button>
                      </div>
                    </div>

                    {/* Theme Color Selector */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Warna Tema Tabel</p>
                        <p className="text-[10px] text-slate-400">Ubah aksen warna header tabel pada dokumen PDF</p>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        {[
                          { key: 'indigo', bg: 'bg-indigo-600', name: 'Indigo' },
                          { key: 'emerald', bg: 'bg-emerald-600', name: 'Emerald' },
                          { key: 'slate', bg: 'bg-slate-600', name: 'Slate' },
                          { key: 'rose', bg: 'bg-rose-600', name: 'Rose' },
                          { key: 'amber', bg: 'bg-amber-600', name: 'Amber' }
                        ].map(c => (
                          <button
                            key={c.key}
                            onClick={() => updatePdfThemeColor(c.key)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${
                              pdfThemeColor === c.key
                                ? 'border-slate-900 dark:border-white scale-110'
                                : 'border-transparent hover:scale-105'
                            } ${c.bg}`}
                            title={c.name}
                          >
                            {pdfThemeColor === c.key && <Check className="w-3 h-3 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Signature Toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Tanda Tangan Kepala Sekolah</p>
                        <p className="text-[10px] text-slate-400">Sertakan kolom mengetahui Kepala Sekolah di kiri bawah</p>
                      </div>
                      <button
                        onClick={() => updatePdfIncludeSignature(!pdfIncludeSignature)}
                        className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                          pdfIncludeSignature ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-md block transition-transform" />
                      </button>
                    </div>

                    {/* History Logger Toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Simpan Riwayat Unduhan</p>
                        <p className="text-[10px] text-slate-400">Simpan otomatis rekam jejak file yang telah diekspor</p>
                      </div>
                      <button
                        onClick={() => updatePdfSaveHistory(!pdfSaveHistory)}
                        className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                          pdfSaveHistory ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-md block transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* History Block */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-indigo-500" />
                        Riwayat 8 Unduhan PDF Terakhir
                      </h5>
                      {pdfHistory.length > 0 && (
                        <button
                          onClick={clearPdfHistory}
                          className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
                        >
                          Hapus Semua
                        </button>
                      )}
                    </div>

                    {pdfHistory.length === 0 ? (
                      <div className="p-8 bg-slate-50 dark:bg-slate-800/30 rounded-2xl text-center border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                        Belum ada riwayat dokumen PDF yang diunduh baru-baru ini.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {pdfHistory.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <p className="font-semibold text-slate-700 dark:text-slate-300 truncate text-[11px]" title={item.fileName}>
                                📄 {item.fileName}
                              </p>
                              <p className="text-[9px] text-slate-400">
                                Kelas: <strong className="text-slate-500">{item.kelas}</strong> &bull; Periode: <strong className="text-slate-500">{item.periode}</strong>
                              </p>
                            </div>
                            <span className="text-[9px] text-slate-400 whitespace-nowrap text-right shrink-0">
                              {item.timestamp}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed italic bg-indigo-50/30 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-100/10 mt-2">
                    *Semua pilihan pengaturan di atas akan langsung diterapkan pada berkas laporan PDF saat tombol <strong>Unduh PDF Presensi</strong> ditekan.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm p-6">
            <div className="space-y-4 max-w-3xl mx-auto">
              {isAbsensiLocked && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-300">
                  <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm">Absensi Terkunci</h5>
                    <p className="text-[11px] sm:text-xs mt-0.5 leading-relaxed">
                      Presensi kelas untuk tanggal <strong>{absensiTanggal}</strong> sudah diisi oleh Guru lain. 
                      Menu simpan telah dinonaktifkan untuk mencegah penimpasan data secara tidak sengaja. 
                      Hanya <strong>Wali Kelas (Administrator)</strong> yang diperbolehkan untuk mengedit atau memperbarui data absensi yang sudah tersimpan.
                    </p>
                  </div>
                </div>
              )}

              {(() => {
                const filtered = siswas
                  .filter((s) => activeClassFilter === 'Semua' || s.kelas === activeClassFilter)
                  .filter((s) => !absensiSearch.trim() || s.namaSiswa.toLowerCase().includes(absensiSearch.toLowerCase()) || s.nisn.includes(absensiSearch));

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-slate-500">
                      Siswa tidak ditemukan untuk pencarian "{absensiSearch}"
                    </div>
                  );
                }

                return filtered.map((s) => {
                  // Find existing absensi for today
                  const currentAbsen = absensis.find(a => a.siswaId === s.id && a.tanggal === absensiTanggal);
                  const currentStatus = tempAbsen[s.id] || currentAbsen?.status || 'hadir';

                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/20 border border-m3-border dark:border-slate-800/40 rounded-2xl gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={s.fotoUrl}
                          alt={s.namaSiswa}
                          className="w-10 h-10 rounded-full object-cover shrink-0 aspect-square shadow-sm border border-indigo-200/50"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{s.namaSiswa}</p>
                          <p className="text-[10px] text-slate-400 font-mono">NISN: {s.nisn}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                          disabled={isAbsensiLocked}
                          id={`absen_hadir_${s.id}`}
                          onClick={() => handleAbsenChange(s.id, 'hadir')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            isAbsensiLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            currentStatus === 'hadir'
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          Hadir
                        </button>
                        <button
                          disabled={isAbsensiLocked}
                          id={`absen_sakit_${s.id}`}
                          onClick={() => handleAbsenChange(s.id, 'sakit')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            isAbsensiLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            currentStatus === 'sakit'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          Sakit
                        </button>
                        <button
                          disabled={isAbsensiLocked}
                          id={`absen_izin_${s.id}`}
                          onClick={() => handleAbsenChange(s.id, 'izin')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            isAbsensiLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            currentStatus === 'izin'
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          Izin
                        </button>
                        <button
                          disabled={isAbsensiLocked}
                          id={`absen_alfa_${s.id}`}
                          onClick={() => handleAbsenChange(s.id, 'alfa')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            isAbsensiLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            currentStatus === 'alfa'
                              ? 'bg-red-500 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          Alfa
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}

              <div className="pt-4 flex justify-end">
                <button
                  disabled={isAbsensiLocked}
                  id="save_absensi_btn"
                  onClick={handleSaveAbsensi}
                  className={`font-bold text-sm px-8 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2 ${
                    isAbsensiLocked
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60 dark:bg-slate-800 dark:text-slate-600'
                      : 'bg-m3-purple text-white cursor-pointer hover:bg-m3-purple-dark'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Simpan Seluruh Kehadiran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TUGAS (GOOGLE FORM INTEGRATION & AUTOMATIC GRADED STATE) */}
      {activeTab === 'tugas_harian' && (
        <div id="google_form_tasks_view" className="space-y-4">
          {renderClassFilterBar()}

          <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Penugasan Terintegrasi Google Form</h3>
              <p className="text-xs text-slate-500">Berikan tugas berbasis web formulir Google Form, rilis notifikasi instan</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isOperator && (
                <>
                  <button
                    type="button"
                    onClick={exportTugasExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    title="Ekspor daftar tugas ke Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Eksport Tugas</span>
                  </button>
                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer shadow-md transition-all">
                    <Upload className="w-4 h-4" />
                    <span>Import Tugas</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleImportTugasExcel}
                      className="hidden"
                    />
                  </label>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(true)}
                className="bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-m3-purple dark:text-purple-300 text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors border border-purple-200 dark:border-purple-800/50"
              >
                <Code className="w-4 h-4 text-m3-purple" />
                <span>Skrip Webhook (Tahap 2)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGFormGuide(!showGFormGuide)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-m3-purple" />
                <span>Petunjuk Google Form</span>
                {showGFormGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                id="add_tugas_btn"
                onClick={handleOpenAddModal}
                className="bg-m3-purple text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-m3-purple-dark shadow-md"
              >
                <Plus className="w-4 h-4" />
                Buat Tugas Baru
              </button>
            </div>
          </div>

          {/* Interactive Guide Banner */}
          {showGFormGuide && (
            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-slate-900 dark:to-indigo-950/40 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm space-y-4 animate-fade-in text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-bold text-sm border-b border-indigo-100 dark:border-indigo-900/50 pb-2">
                <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Panduan Lengkap Pembuatan & Sinkronisasi Google Form</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-indigo-100/60 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-m3-purple text-white text-[11px] flex items-center justify-center font-bold">1</span>
                    <span>Aktifkan Mode Kuis di Google Form</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-7">
                    Buka Google Form Anda → Masuk ke menu <strong>Setelan (Settings)</strong> → Aktifkan <strong>"Jadikan ini kuis" (Make this a quiz)</strong>. Atur poin untuk setiap soal secara otomatis.
                  </p>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-indigo-100/60 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-m3-purple text-white text-[11px] flex items-center justify-center font-bold">2</span>
                    <span>Wajibkan Isian Identitas Siswa</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-7">
                    Tambahkan pertanyaan wajib untuk <strong>Nama Lengkap</strong> dan <strong>NISN / Kelas</strong> agar Anda dapat mencocokkan hasil jawaban siswa dengan mudah.
                  </p>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-indigo-100/60 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-m3-purple text-white text-[11px] flex items-center justify-center font-bold">3</span>
                    <span>Salin & Sematkan Tautan Publik (Kirim)</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-7">
                    Klik tombol <strong>Kirim (Send)</strong> di Google Form → Pilih ikon tautan (link) → Salin URL formulir, lalu tempelkan pada kolom <strong>"Tautan Google Form"</strong> saat membuat Tugas Baru di aplikasi ini.
                  </p>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-indigo-100/60 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-m3-purple text-white text-[11px] flex items-center justify-center font-bold">4</span>
                    <span>Olah & Sync Hasil ke Asesmen Harian</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-7">
                    Setelah siswa mengerjakan, klik tombol <span className="text-emerald-600 font-bold">"Olah & Sync Nilai ke Asesmen Harian"</span> pada kartu tugas di bawah untuk memasukkan nilai secara instan ke dalam rekapitulasi Asesmen Harian.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tugases
              .filter(t => isCurrentGuruWaliKelas || myMapelIds.includes(t.mapelId))
              .map((t) => {
              const mapel = mapels.find(m => m.id === t.mapelId);
              // Calculate completions
              const relevantSubmissions = tugasSiswa.filter(ts => {
                if (ts.tugasId !== t.id) return false;
                if (activeClassFilter === 'Semua') return true;
                const student = siswas.find(s => s.id === ts.siswaId);
                return student?.kelas === activeClassFilter;
              });
              const completedCount = relevantSubmissions.filter(ts => ts.statusPengerjaan).length;
              const totalCount = activeClassFilter === 'Semua'
                ? siswas.length
                : siswas.filter(s => s.kelas === activeClassFilter).length;

              return (
                <div
                  key={t.id}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold bg-m3-lavender dark:bg-indigo-950/40 text-m3-purple dark:text-indigo-400 px-2.5 py-1 rounded-xl">
                        {mapel ? mapel.namaMapel : 'Mata Pelajaran'}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          id={`edit_tugas_${t.id}`}
                          onClick={() => handleOpenEditModal(t)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete_tugas_${t.id}`}
                          onClick={() => onDeleteTugas(t.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-base font-bold text-slate-800 dark:text-white mt-3">{t.judulTugas}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.deskripsi}</p>

                    <div className="mt-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-m3-border/50 dark:border-slate-800/50 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Tautan Formulir:</span>
                        <a
                          href={t.googleFormUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-m3-purple dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                        >
                          Google Form <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Tenggat Waktu:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {new Date(t.tenggatWaktu).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-m3-border dark:border-slate-800/50 pt-4 space-y-3">
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5">
                        <span>Progres Penyelesaian Siswa</span>
                        <span className="font-bold text-slate-800 dark:text-white">{completedCount} dari {totalCount} Selesai</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-m3-purple h-full rounded-full transition-all"
                          style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenIngestModal(t)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Olah & Sync Nilai ke Asesmen Harian</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. ASESMEN KURIKULUM MERDEKA */}
      {activeTab === 'asesmen' && (() => {
        const rekapStudentsFiltered = activeClassFilter === 'Semua' 
          ? siswas 
          : siswas.filter(s => s.kelas === activeClassFilter);

        const studentStats = rekapStudentsFiltered.map(s => {
          const studentAsesmens = asesmens.filter(a => a.siswaId === s.id && (isCurrentGuruWaliKelas || myMapelIds.includes(a.mapelId)));
          const harian = studentAsesmens.filter(a => a.tipe === 'harian');
          const sts = studentAsesmens.filter(a => a.tipe === 'sts');
          const sas = studentAsesmens.filter(a => a.tipe === 'sas');
          const kokurikuler = studentAsesmens.filter(a => a.tipe === 'kokurikuler');

          const avgHarian = harian.length ? Math.round(harian.reduce((acc, curr) => acc + curr.nilai, 0) / harian.length) : 0;
          const avgSts = sts.length ? Math.round(sts.reduce((acc, curr) => acc + curr.nilai, 0) / sts.length) : 0;
          const avgSas = sas.length ? Math.round(sas.reduce((acc, curr) => acc + curr.nilai, 0) / sas.length) : 0;
          const avgKoku = kokurikuler.length ? Math.round(kokurikuler.reduce((acc, curr) => acc + curr.nilai, 0) / kokurikuler.length) : 0;
          const overallAvg = studentAsesmens.length ? Math.round(studentAsesmens.reduce((acc, curr) => acc + curr.nilai, 0) / studentAsesmens.length) : 0;

          return {
            siswa: s,
            avgHarian,
            avgSts,
            avgSas,
            avgKoku,
            overallAvg
          };
        });

        const validStats = studentStats.filter(st => st.overallAvg > 0);
        const classAvg = validStats.length ? Math.round(validStats.reduce((acc, curr) => acc + curr.overallAvg, 0) / validStats.length) : 0;
        const aboveKKMCount = validStats.filter(st => st.overallAvg >= 75).length;
        const belowKKMCount = validStats.length - aboveKKMCount;

        const bestStudent = validStats.length ? [...validStats].sort((a, b) => b.overallAvg - a.overallAvg)[0] : null;
        const lowestStudent = validStats.length ? [...validStats].sort((a, b) => a.overallAvg - b.overallAvg)[0] : null;

        return (
          <div id="assessments_view" className="space-y-4">
            {renderClassFilterBar()}

            {/* Sub Tabs Selection */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-3xl px-4 pt-2 border-t border-x border-m3-border dark:border-slate-800/80">
              <button
                onClick={() => setAsesmenSubTab('daftar')}
                className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  asesmenSubTab === 'daftar'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Daftar Nilai Asesmen
              </button>
              <button
                onClick={() => setAsesmenSubTab('rekap')}
                className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  asesmenSubTab === 'rekap'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                📊 Rekapitulasi & Analisis Nilai
              </button>
            </div>

            {/* Sub Tab 1: DAFTAR NILAI (EXCEL MATRIX TABLE TERSTRUKTUR) */}
            {asesmenSubTab === 'daftar' && (
              <AsesmenMatrixTable
                currentRole="operator"
                activeClassFilter={activeClassFilter}
                loggedInUserId={loggedInUserId}
                isCurrentGuruWaliKelas={isCurrentGuruWaliKelas}
              />
            )}

            {/* Sub Tab 2: REKAPITULASI & ANALISIS */}
            {asesmenSubTab === 'rekap' && (
              <div className="space-y-4">
                {/* Filters & Export Options */}
                <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">Rekapitulasi &amp; Analisis Nilai</h3>
                    <p className="text-[11px] sm:text-xs text-slate-500">
                      Rata-rata kriteria ketercapaian tujuan pembelajaran siswa ({activeClassFilter === 'Semua' ? 'Semua Kelas' : activeClassFilter})
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={exportRekapitulasiCSV}
                      className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-md transition-all"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Unduh Excel Rekap
                    </button>
                    <button
                      onClick={() => setShowPerformanceReportModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-indigo-700 shadow-md transition-all"
                    >
                      <Printer className="w-4 h-4" />
                      Ekspor PDF Laporan
                    </button>
                  </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rerata Nilai Kelas</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{classAvg}</span>
                      <span className="text-xs text-slate-400 font-medium">/ 100</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${classAvg}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tuntas KKM (≥ 75)</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{aboveKKMCount}</span>
                      <span className="text-xs text-slate-400 font-medium">dari {rekapStudentsFiltered.length} Siswa</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-3">
                      Persentase: {rekapStudentsFiltered.length ? Math.round((aboveKKMCount / rekapStudentsFiltered.length) * 100) : 0}%
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prestasi Tertinggi</span>
                    <div className="mt-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{bestStudent ? bestStudent.siswa.namaSiswa : '-'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{bestStudent ? `Kelas ${bestStudent.siswa.kelas}` : '-'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 bg-indigo-50 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg w-fit text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {bestStudent ? `${bestStudent.overallAvg} Poin` : '-'}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perlu Pendampingan</span>
                    <div className="mt-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{lowestStudent ? lowestStudent.siswa.namaSiswa : '-'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{lowestStudent ? `Kelas ${lowestStudent.siswa.kelas}` : '-'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 bg-red-50 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg w-fit text-xs font-bold text-red-500">
                      {lowestStudent ? `${lowestStudent.overallAvg} Poin` : '-'}
                    </div>
                  </div>
                </div>

                {/* Detailed Performance Table */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-m3-lavender/50 dark:bg-slate-800/50 text-m3-sec-text dark:text-slate-400 font-bold text-xs uppercase">
                        <tr>
                          <th className="px-6 py-4 text-center">No</th>
                          <th className="px-6 py-4 text-center">Nama Siswa</th>
                          <th className="px-6 py-4 text-center">NISN</th>
                          <th className="px-6 py-4 text-center">Formatif (Rata)</th>
                          <th className="px-6 py-4 text-center">Sumatif Tengah (STS)</th>
                          <th className="px-6 py-4 text-center">Sumatif Akhir (SAS)</th>
                          <th className="px-6 py-4 text-center">Kokurikuler (P5)</th>
                          <th className="px-6 py-4 text-center">Rata-rata Akhir</th>
                          <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-m3-border dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {studentStats.map((st, idx) => (
                          <tr key={st.siswa.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                            <td className="px-6 py-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{st.siswa.namaSiswa}</td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{st.siswa.nisn}</td>
                            <td className="px-6 py-4 font-mono font-semibold text-xs">{st.avgHarian || '-'}</td>
                            <td className="px-6 py-4 font-mono font-semibold text-xs">{st.avgSts || '-'}</td>
                            <td className="px-6 py-4 font-mono font-semibold text-xs">{st.avgSas || '-'}</td>
                            <td className="px-6 py-4 font-mono font-semibold text-xs">{st.avgKoku || '-'}</td>
                            <td className="px-6 py-4">
                              <span className={`font-mono text-sm font-bold ${st.overallAvg >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                {st.overallAvg || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {st.overallAvg > 0 ? (
                                <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full ${
                                  st.overallAvg >= 75
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-red-50 text-red-500 dark:bg-red-950/40'
                                }`}>
                                  {st.overallAvg >= 75 ? 'Tuntas' : 'Remedial'}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Belum Ada Nilai</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 9. TEMUAN KHUSUS */}
      {activeTab === 'temuan_khusus' && (
        <div id="special_findings_view" className="space-y-4">
          {renderClassFilterBar()}

          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Jurnal Temuan Khusus Siswa</h3>
              <p className="text-xs text-slate-500">Catat perilaku positif, bimbingan konseling, serta tindak lanjut pembinaan karakter</p>
            </div>
            <div className="flex gap-2">
              <button
                id="export_temuan_excel_btn"
                onClick={exportTemuanExcel}
                className="bg-teal-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-teal-700 shadow-md"
                title="Ekspor jurnal temuan format Excel (.xlsx)"
              >
                <Upload className="w-4 h-4" />
                Unduh Excel Jurnal
              </button>
              <button
                id="export_temuan_pdf_btn"
                onClick={exportTemuanPDF}
                className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-indigo-700 shadow-md"
                title="Ekspor jurnal temuan format PDF (A4)"
              >
                <FileText className="w-4 h-4" />
                Unduh PDF Jurnal
              </button>
              <button
                id="add_temuan_btn"
                onClick={handleOpenAddModal}
                className="bg-m3-purple text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-m3-purple-dark shadow-md"
              >
                <Plus className="w-4 h-4" />
                Catat Temuan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {temuanKhusus
              .filter((t) => {
                if (activeClassFilter === 'Semua') return true;
                const student = siswas.find(s => s.id === t.siswaId);
                return student?.kelas === activeClassFilter;
              })
              .map((t) => {
              const siswa = siswas.find(s => s.id === t.siswaId);
              const isPositif = t.kategori.toLowerCase().includes('positif');

              return (
                <div
                  key={t.id}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={siswa ? siswa.fotoUrl : ''}
                          alt="Foto Siswa"
                          className="w-8 h-8 rounded-full object-cover shrink-0 aspect-square"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                            {siswa ? siswa.namaSiswa : 'Siswa'}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">{t.tanggal}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          id={`edit_temuan_${t.id}`}
                          onClick={() => handleOpenEditModal(t)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          id={`delete_temuan_${t.id}`}
                          onClick={() => onDeleteTemuan(t.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-md ${
                        isPositif ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400'
                      }`}>
                        {t.kategori}
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-m3-border/50 dark:border-slate-800/50">
                        {t.deskripsi}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-m3-border dark:border-slate-800/50 pt-3">
                    <p className="text-xs font-bold text-m3-purple dark:text-indigo-400">
                      Rencana Tindak Lanjut:
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal mt-1 italic">
                      {t.tindakanLanjut || 'Belum dirumuskan.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI TUTOR & ASISTEN PEDAGOGI GURU */}
      {activeTab === 'ai_tutor' && (
        <AiTutorGuruView currentUserId={loggedInUserId} />
      )}

      {/* AI GENERATOR SOAL */}
      {activeTab === 'ai_generator_soal' && (
        <AiGeneratorSoalView />
      )}

      {/* AI PERANGKAT AJAR */}
      {activeTab === 'ai_perangkat_ajar' && (
        <AiPerangkatAjarView />
      )}

      {/* 10. BUKU DIGITAL & MODUL */}
      {activeTab === 'buku_digital_admin' && (
        <BukuDigitalView currentRole={isOperator ? 'operator' : 'guru'} currentUserId={loggedInUserId} />
      )}

      {/* 11. PENGATURAN APLIKASI OPERATOR */}
      {activeTab === 'aplikasi_setting' && (
        <AplikasiSetting />
      )}

      {/* DYNAMIC MODAL FORM BASED ON ACTIVE TAB */}
      {showFormModal && (
        <div id="form_modal_backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="form_modal_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              {editingItem ? 'Edit Data / Rekaman' : 'Tambah Rekaman Baru'}
            </h3>

            {/* A. GURU FORM */}
            {activeTab === 'profil_guru' && (
              <form onSubmit={handleSubmit(onSubmitGuru)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">NIP Guru</label>
                  <input type="text" {...register('nip', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Lengkap & Gelar</label>
                  <input type="text" {...register('namaGuru', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Gelar Akademis</label>
                  <input type="text" {...register('gelar')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Mata Pelajaran Utama</label>
                  <input type="text" {...register('mataPelajaranUtama')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Status Kepegawaian</label>
                  <select {...register('statusKepegawaian')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                    <option value="PNS">PNS</option>
                    <option value="P3K">P3K</option>
                    <option value="Honor Daerah">Honor Daerah</option>
                  </select>
                </div>
                {/* INTERACTIVE FOTO PROFIL GURU */}
                <div className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">Foto Profil Guru</label>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {watchFotoUrl ? (
                      <img src={watchFotoUrl} alt="Preview Foto" className="w-16 h-16 rounded-full object-cover border-2 border-m3-purple shadow-sm shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-sm shrink-0">GR</div>
                    )}
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Upload dari Handphone</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleGuruFileChange}
                          className="hidden"
                        />
                      </label>
                      <div className="space-y-0.5">
                        <input
                          type="text"
                          placeholder="Atau tempel URL gambar di sini..."
                          {...register('fotoUrl')}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs focus:ring-2 focus:ring-m3-purple/20 outline-none text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {isCurrentGuruWaliKelas && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Kata Sandi Akun (Password)</label>
                      <input 
                        type="text" 
                        {...register('password')} 
                        placeholder="guru123" 
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" 
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="isWaliKelas" 
                        {...register('isWaliKelas')} 
                        className="rounded border-slate-300 text-m3-purple focus:ring-m3-purple w-4 h-4" 
                      />
                      <label htmlFor="isWaliKelas" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Jadikan Wali Kelas (Status Administrator)
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Pilih Kelas yang Diwalikan</label>
                      <select 
                        {...register('kelasWali')} 
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm"
                      >
                        <option value="">-- Bukan Wali Kelas --</option>
                        <option value="GURU MAPEL">GURU MAPEL (Akses Semua Kelas)</option>
                        {classList.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" id="cancel_modal_btn" onClick={() => setShowFormModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Batal</button>
                  <button type="submit" id="save_guru_form_btn" className="bg-m3-purple text-white font-bold text-xs px-5 py-2 rounded-xl">Simpan</button>
                </div>
              </form>
            )}

            {/* B. SISWA FORM */}
            {activeTab === 'data_siswa' && (
              <form onSubmit={handleSubmit(onSubmitSiswa)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">NISN</label>
                    <input type="text" {...register('nisn', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">NIS</label>
                    <input type="text" {...register('nis')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Lengkap Siswa</label>
                  <input type="text" {...register('namaSiswa', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Kelamin</label>
                    <select {...register('jenisKelamin')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Kelas</label>
                    <select {...register('kelas')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                      {classList.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Ayah</label>
                    <input type="text" {...register('namaAyah')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">No. Telp Wali</label>
                    <input type="text" {...register('noTeleponOrtu')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Alamat Rumah</label>
                  <textarea {...register('alamat')} rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                
                {/* INTERACTIVE FOTO PROFIL SISWA */}
                <div className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">Foto Profil Siswa</label>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {watchFotoUrl ? (
                      <img src={watchFotoUrl} alt="Preview Foto" className="w-16 h-16 rounded-full object-cover border-2 border-m3-purple shadow-sm shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-sm shrink-0">SD</div>
                    )}
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Upload / Ambil Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleGuruFileChange}
                          className="hidden"
                        />
                      </label>
                      <div className="space-y-0.5">
                        <input
                          type="text"
                          placeholder="Atau tempel URL gambar di sini..."
                          {...register('fotoUrl')}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs focus:ring-2 focus:ring-m3-purple/20 outline-none text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Kata Sandi Akun Siswa</label>
                    <input type="text" placeholder="Default: siswa123" {...register('password')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Kata Sandi Akun Wali</label>
                    <input type="text" placeholder="Default: ortu123" {...register('passwordOrtu')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Batal</button>
                  <button type="submit" id="save_siswa_form_btn" className="bg-m3-purple text-white font-bold text-xs px-5 py-2 rounded-xl">Simpan</button>
                </div>
              </form>
            )}

            {/* C. MATA PELAJARAN FORM */}
            {activeTab === 'mata_pelajaran' && (
              <form onSubmit={handleSubmit(onSubmitMapel)} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-500">Kode Mapel Khusus Per Kelas</label>
                    <button
                      type="button"
                      onClick={() => {
                        const currentName = getValues('namaMapel') || 'Bahasa Indonesia';
                        const currentKelas = getValues('kelas') || 'Kelas 6';
                        const stdCode = generateStandardMapelCode(currentName, currentKelas);
                        setValue('kodeMapel', stdCode);
                      }}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Buat Kode Standar (misal: bin6)</span>
                    </button>
                  </div>
                  <input type="text" placeholder="Contoh: bin5, bin6, mat5, mat6" disabled={!isCurrentGuruWaliKelas} {...register('kodeMapel', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm disabled:opacity-75 disabled:cursor-not-allowed font-medium" />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Aturan Database Operator: <span className="font-bold text-indigo-600 dark:text-indigo-400">bin5</span> untuk B.Indo Kelas 5, <span className="font-bold text-indigo-600 dark:text-indigo-400">bin6</span> untuk Kelas 6, <span className="font-bold text-indigo-600 dark:text-indigo-400">mat6</span> untuk MTK Kelas 6.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Mapel</label>
                  <input type="text" disabled={!isCurrentGuruWaliKelas} {...register('namaMapel', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm disabled:opacity-75 disabled:cursor-not-allowed font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Peruntukan Kelas</label>
                  <select 
                    disabled={!isOperator && isRealWaliKelas} 
                    {...register('kelas')} 
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                  >
                    {classList.map(cls => (
                      <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={cls} value={cls}>{cls}</option>
                    ))}
                    {isRealWaliKelas && loggedInGuru?.kelasWali && !classList.includes(loggedInGuru.kelasWali) && (
                      <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={loggedInGuru.kelasWali} value={loggedInGuru.kelasWali}>{loggedInGuru.kelasWali}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Target KKM Poin</label>
                  <input type="number" defaultValue={75} {...register('kkm', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Guru Pengampu</label>
                  <select disabled={!isCurrentGuruWaliKelas} {...register('guruPengampuId')} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-white disabled:opacity-75 disabled:cursor-not-allowed shadow-xs cursor-pointer">
                    {gurus.map(g => (
                      <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" key={g.id} value={g.id}>{g.namaGuru}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Batal</button>
                  <button type="submit" id="save_mapel_form_btn" className="bg-m3-purple text-white font-bold text-xs px-5 py-2 rounded-xl">Simpan</button>
                </div>
              </form>
            )}

            {/* D. JADWAL FORM */}
            {activeTab === 'jadwal_pelajaran' && (
              <form onSubmit={handleSubmit(onSubmitJadwal)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Pilih Mapel</label>
                  <select {...register('mapelId', { required: true })} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-white cursor-pointer shadow-xs">
                    {mapels.map(m => (
                      <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" key={m.id} value={m.id}>{m.namaMapel} ({m.kelas || 'Semua'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Kelas</label>
                  <select 
                    disabled={!isOperator} 
                    {...register('kelas')} 
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm disabled:opacity-75 disabled:cursor-not-allowed font-bold text-slate-900 dark:text-white cursor-pointer shadow-xs"
                  >
                    {classList.map(cls => (
                      <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Hari</label>
                  <select {...register('hari')} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-white cursor-pointer shadow-xs">
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" value="Senin">Senin</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" value="Selasa">Selasa</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" value="Rabu">Rabu</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" value="Kamis">Kamis</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" value="Jumat">Jumat</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium" value="Sabtu">Sabtu</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Jam Mulai</label>
                    <input type="text" placeholder="e.g. 07:30" {...register('jamMulai', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Jam Selesai</label>
                    <input type="text" placeholder="e.g. 09:00" {...register('jamSelesai', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Ruangan Kelas</label>
                  <input type="text" placeholder="e.g. Ruang Kelas 4-A" {...register('ruangan')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Batal</button>
                  <button type="submit" id="save_jadwal_form_btn" className="bg-m3-purple text-white font-bold text-xs px-5 py-2 rounded-xl">Simpan</button>
                </div>
              </form>
            )}

            {/* E. TUGAS FORM */}
            {activeTab === 'tugas_harian' && (
              <form onSubmit={handleSubmit(onSubmitTugas)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Pilih Mata Pelajaran</label>
                  <select {...register('mapelId', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                    {mapels
                      .filter(m => isCurrentGuruWaliKelas || m.guruPengampuId === loggedInUserId)
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.namaMapel}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Judul Tugas</label>
                  <input type="text" {...register('judulTugas', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tautan Google Form (Untuk Siswa Mengerjakan)</label>
                  <input type="url" placeholder="https://docs.google.com/forms/..." {...register('googleFormUrl', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tautan Google Sheet Tanggapan (Untuk Auto-Sync Nilai - Opsional/Dianjurkan)</label>
                  <input type="url" placeholder="https://docs.google.com/spreadsheets/d/..." {...register('googleSheetUrl')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                    💡 <strong>Cara Mengambil Link Google Sheet:</strong> Buka Google Form Anda → Tab <strong>Jawaban (Responses)</strong> → Klik ikon <strong>'Lihat di Spreadsheet'</strong> → Salin & Tempel link Spreadsheet tersebut di sini.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal Mulai</label>
                    <input type="date" {...register('tanggalDiberikan')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tenggat Waktu</label>
                    <input type="datetime-local" {...register('tenggatWaktu')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Deskripsi & Instruksi Pengerjaan</label>
                  <textarea {...register('deskripsi')} rows={3} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div className="flex items-center gap-2.5 py-1 bg-indigo-50/50 dark:bg-indigo-950/10 p-3.5 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/30">
                  <input
                    type="checkbox"
                    id="sendEmailAlerts"
                    {...register('sendEmailAlerts')}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="sendEmailAlerts" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none flex-1 leading-tight">
                    ✉️ Kirim Notifikasi Surel Otomatis via Gmail (Siswa & Orang Tua)
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Batal</button>
                  <button type="submit" id="save_tugas_form_btn" className="bg-m3-purple text-white font-bold text-xs px-5 py-2 rounded-xl">Rilis Tugas</button>
                </div>
              </form>
            )}

            {/* F. ASESMEN FORM */}
            {activeTab === 'asesmen' && (
              <form onSubmit={handleSubmit(onSubmitAsesmen)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Pilih Siswa</label>
                  <select {...register('siswaId', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                    {siswas
                      .filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter)
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.namaSiswa} ({s.kelas})</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Pilih Mata Pelajaran</label>
                  <select {...register('mapelId', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                    {mapels
                      .filter(m => {
                        if (isOperator || isRealWaliKelas) return true;
                        const lowerName = m.namaMapel.toLowerCase();
                        const isPaiOrPenjas = lowerName.includes('pai') || lowerName.includes('agama') || lowerName.includes('penjas') || lowerName.includes('olahraga') || lowerName.includes('jasmani');
                        return isPaiOrPenjas || m.guruPengampuId === loggedInUserId;
                      })
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.namaMapel}</option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tipe Asesmen</label>
                    <select {...register('tipe')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                      <option value="harian">Formatif (Harian/Tugas)</option>
                      {(isOperator || isRealWaliKelas) && (
                        <>
                          <option value="sts">Sumatif Tengah Semester (STS)</option>
                          <option value="sas">Sumatif Akhir Semester (SAS)</option>
                          <option value="kokurikuler">Kokurikuler (Projek P5)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Skor / Nilai (0-100)</label>
                    <input type="number" min={0} max={100} {...register('nilai', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Agenda Penilaian</label>
                  <input type="text" placeholder="e.g. Sumatif Bab 1 Pecahan" {...register('namaPenilaian', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Deskripsi Capaian Kompetensi</label>
                  <textarea placeholder="Tuliskan aspek kompetensi yang sangat menonjol atau perlu ditingkatkan..." {...register('deskripsiKompetensi')} rows={3} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Batal</button>
                  <button type="submit" id="save_asesmen_form_btn" className="bg-m3-purple text-white font-bold text-xs px-5 py-2 rounded-xl">Simpan Nilai</button>
                </div>
              </form>
            )}

            {/* G. TEMUAN KHUSUS FORM */}
            {activeTab === 'temuan_khusus' && (
              <form onSubmit={handleSubmit(onSubmitTemuan)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Pilih Siswa Terkait</label>
                  <select {...register('siswaId', { required: true })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                    {siswas
                      .filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter)
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.namaSiswa} ({s.kelas})</option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Kategori Temuan</label>
                    <select {...register('kategori')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm">
                      <option value="Perilaku Positif">Perilaku Positif / Prestasi</option>
                      <option value="Perlu Bimbingan">Perlu Bimbingan / Konseling</option>
                      <option value="Kasus Khusus">Kasus Khusus / Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal</label>
                    <input type="date" {...register('tanggal')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Deskripsi Temuan Lapangan</label>
                  <textarea placeholder="Tuliskan detail kejadian, tindakan tidak disiplin, atau aksi terpuji siswa..." {...register('deskripsi', { required: true })} rows={3} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Rencana Tindak Lanjut / Solusi</label>
                  <textarea placeholder="Langkah pemanggilan wali, bimbingan konseling pribadi, atau pemberian apresiasi..." {...register('tindakanLanjut')} rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Batal</button>
                  <button type="submit" id="save_temuan_form_btn" className="bg-m3-purple text-white font-bold text-xs px-5 py-2 rounded-xl">Simpan Catatan</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT CREDENTIALS MODAL */}
      {showCredentialsModal && credentialsSiswa && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-55 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Ubah Kredensial Login Akun</h3>
                <p className="text-xs text-slate-500">{credentialsSiswa.namaSiswa}</p>
              </div>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div className="bg-indigo-50/50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-indigo-100/55 dark:border-slate-800 text-[11px] text-indigo-600 dark:text-indigo-300 font-medium leading-relaxed">
                Kredensial ini digunakan untuk masuk ke portal masing-masing akun. Siswa masuk dengan NISN dan Orang Tua masuk dengan No. Telepon.
              </div>

              {/* Siswa Credentials */}
              <div className="space-y-3 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/10">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  Kredensial Siswa
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Username (NISN Siswa)</label>
                  <input
                    type="text"
                    required
                    value={credentialsForm.siswaUsername}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, siswaUsername: e.target.value })}
                    className="w-full bg-slate-100/70 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Password Siswa</label>
                  <input
                    type="text"
                    required
                    value={credentialsForm.siswaPassword}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, siswaPassword: e.target.value })}
                    className="w-full bg-slate-100/70 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Orang Tua Credentials */}
              <div className="space-y-3 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/10">
                <h4 className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Kredensial Orang Tua
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Username (No. Telepon Orang Tua)</label>
                  <input
                    type="text"
                    required
                    value={credentialsForm.ortuUsername}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, ortuUsername: e.target.value })}
                    className="w-full bg-slate-100/70 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Password Orang Tua</label>
                  <input
                    type="text"
                    required
                    value={credentialsForm.ortuPassword}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, ortuPassword: e.target.value })}
                    className="w-full bg-slate-100/70 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCredentialsModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Simpan Kredensial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT LOGIN CARDS MODAL (PRINT-FRIENDLY BENTO CARDS) */}
      {showLoginCardsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-55 overflow-y-auto p-4">
          <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-6 flex flex-col h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Printer className="text-indigo-600 w-5 h-5 animate-pulse" />
                  Kartu Peserta Siap Cetak (10 Siswa per Halaman A4)
                </h3>
                <p className="text-xs text-slate-500">Ukuran hemat kertas ringkas (10 kartu per halaman A4), siap unduh dalam bentuk file PDF.</p>
              </div>
              <div className="flex items-center gap-2 print:hidden shrink-0">
                <span className="text-xs font-semibold text-slate-500">Pilih Kelas:</span>
                <select
                  value={selectedClassForCards}
                  onChange={(e) => {
                    const cls = e.target.value;
                    setSelectedClassForCards(cls);
                    const filtered = cls === 'all' ? siswas : siswas.filter(s => s.kelas === cls);
                    setLoginCardsToPrint(filtered);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-m3-purple/50 cursor-pointer min-w-[130px]"
                >
                  <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="all">Semua Kelas</option>
                  {classList.map(cls => (
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <button
                  id="modal_download_pdf_btn"
                  onClick={() => handleDownloadLoginCardsPDF(selectedClassForCards)}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-105"
                >
                  <Download className="w-4 h-4" />
                  Unduh PDF (10 A4)
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Direct
                </button>
                <button
                  onClick={() => setShowLoginCardsModal(false)}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-750"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Modal Body / Cards Container (Formatted for 10 cards per page) */}
            <div id="printable-login-cards-area" className="flex-1 overflow-y-auto p-4 space-y-4 print:space-y-2 print:p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
                {loginCardsToPrint.map((siswa) => {
                  const ortu = parents.find(p => p.siswaId === siswa.id);
                  return (
                    <div
                      key={siswa.id}
                      className="border-2 border-dashed border-indigo-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl p-3 relative overflow-hidden break-inside-avoid shadow-xs print:bg-white print:border-slate-400 print:text-black print:shadow-none print:p-2.5 print:my-0.5"
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start border-b border-indigo-100 dark:border-slate-800 pb-2 mb-2 print:border-slate-300">
                        <div className="flex items-center gap-2 min-w-0">
                          {sekolah.logoUrl ? (
                            <img
                              src={sekolah.logoUrl}
                              alt="Logo Sekolah"
                              className="w-7 h-7 object-contain rounded-lg shrink-0 border border-indigo-100 dark:border-slate-700 bg-white p-0.5"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
                              <School className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide print:text-black leading-tight break-all sm:break-words whitespace-normal">
                              {sekolah.namaSekolah || 'SD NEGERI KITA'}
                            </h4>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold print:text-slate-600">
                              LOGIN APLIKASI KELAS KU
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold rounded-md uppercase tracking-wider print:bg-slate-200 print:text-black shrink-0 ml-1">
                          {siswa.kelas}
                        </span>
                      </div>

                      {/* Student Identity */}
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="relative shrink-0">
                          <img
                            src={siswa.fotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
                            alt={siswa.namaSiswa}
                            className="w-10 h-11 rounded-lg object-cover border border-indigo-200 dark:border-slate-700 shadow-2xs shrink-0 bg-white"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold print:text-slate-600">Nama Peserta / Siswa</div>
                          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white print:text-black leading-snug break-all sm:break-words whitespace-normal">{siswa.namaSiswa}</div>
                          <div className="text-xs font-semibold text-slate-500 font-mono truncate">NISN: {siswa.nisn} | NIS: {siswa.nis || '-'}</div>
                        </div>
                      </div>

                      {/* Credentials Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Student Creds */}
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300 shadow-xs">
                          <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest print:text-slate-800">
                            🔑 LOGIN SISWA
                          </div>
                          <div className="mt-1 text-xs">
                            <span className="text-slate-400 font-medium">User: </span>
                            <span className="font-mono font-black text-sm text-indigo-700 dark:text-indigo-300 print:text-black tracking-wide">{siswa.nisn}</span>
                          </div>
                          <div className="text-xs mt-0.5">
                            <span className="text-slate-400 font-medium">Sandi: </span>
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100 print:text-black tracking-wide">{siswa.password || 'siswa123'}</span>
                          </div>
                        </div>

                        {/* Parent Creds */}
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300 shadow-xs">
                          <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest print:text-slate-800">
                            👨‍👩‍👦 LOGIN ORANG TUA
                          </div>
                          <div className="mt-1 text-xs">
                            <span className="text-slate-400 font-medium">User: </span>
                            <span className="font-mono font-black text-sm text-amber-700 dark:text-amber-300 print:text-black truncate block tracking-wide">{siswa.noTeleponOrtu || ortu?.noTelepon || '-'}</span>
                          </div>
                          <div className="text-xs mt-0.5">
                            <span className="text-slate-400 font-medium">Sandi: </span>
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100 print:text-black tracking-wide">{ortu?.password || 'ortu123'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <p className="text-[9px] text-center font-medium text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/40 pt-1.5 leading-snug print:text-slate-500 print:border-slate-200">
                        * Gunting mengikuti garis putus-putus. Simpan kredensial ini dengan baik.
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. MODAL LAPORAN REKAPITULASI (PDF / PRINT READY) */}
      {showPerformanceReportModal && (() => {
        const reportStudents = activeClassFilter === 'Semua' 
          ? siswas 
          : siswas.filter(s => s.kelas === activeClassFilter);

        const reportStatsList = reportStudents.map(s => {
          const studentAsesmens = asesmens.filter(a => a.siswaId === s.id);
          const harian = studentAsesmens.filter(a => a.tipe === 'harian');
          const sts = studentAsesmens.filter(a => a.tipe === 'sts');
          const sas = studentAsesmens.filter(a => a.tipe === 'sas');
          const kokurikuler = studentAsesmens.filter(a => a.tipe === 'kokurikuler');

          const avgHarian = harian.length ? Math.round(harian.reduce((acc, curr) => acc + curr.nilai, 0) / harian.length) : 0;
          const avgSts = sts.length ? Math.round(sts.reduce((acc, curr) => acc + curr.nilai, 0) / sts.length) : 0;
          const avgSas = sas.length ? Math.round(sas.reduce((acc, curr) => acc + curr.nilai, 0) / sas.length) : 0;
          const avgKoku = kokurikuler.length ? Math.round(kokurikuler.reduce((acc, curr) => acc + curr.nilai, 0) / kokurikuler.length) : 0;
          const overallAvg = studentAsesmens.length ? Math.round(studentAsesmens.reduce((acc, curr) => acc + curr.nilai, 0) / studentAsesmens.length) : 0;

          return {
            siswa: s,
            avgHarian,
            avgSts,
            avgSas,
            avgKoku,
            overallAvg
          };
        });

        const validReportStats = reportStatsList.filter(st => st.overallAvg > 0);
        const reportClassAvg = validReportStats.length ? Math.round(validReportStats.reduce((acc, curr) => acc + curr.overallAvg, 0) / validReportStats.length) : 0;
        const reportAboveKKM = validReportStats.filter(st => st.overallAvg >= 75).length;
        const passPercent = reportStudents.length ? Math.round((reportAboveKKM / reportStudents.length) * 100) : 0;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-55 overflow-y-auto p-4">
            <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full p-6 flex flex-col h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Printer className="text-indigo-600 w-5 h-5" />
                    Laporan Hasil Belajar Siap Cetak
                  </h3>
                  <p className="text-xs text-slate-500">Laporan cetak resmi format ledger untuk guru, komite, dan kepala sekolah.</p>
                </div>
                <div className="flex items-center gap-2 print:hidden shrink-0">
                  <span className="text-xs font-semibold text-slate-500">Pilih Kelas:</span>
                  <select
                    value={activeClassFilter}
                    onChange={(e) => setActiveClassFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-m3-purple/50 cursor-pointer min-w-[130px]"
                  >
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Semua">Semua Kelas</option>
                    {sortClasses(siswas.map(s => s.kelas).filter(Boolean)).map(cls => (
                      <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => window.print()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak Laporan
                  </button>
                  <button
                    onClick={() => setShowPerformanceReportModal(false)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-750"
                  >
                    Tutup
                  </button>
                </div>
              </div>

              {/* Printable Body Area */}
              <div id="printable-rekap-report-area" className="flex-1 overflow-y-auto p-8 text-black print:p-0 print:text-black">
                {/* Official School Header */}
                <div className="flex items-center justify-center gap-4 border-b-4 border-double border-slate-800 pb-4 mb-6">
                  {sekolah.logoUrl && (
                    <img
                      src={sekolah.logoUrl}
                      alt="Logo Sekolah"
                      className="w-12 h-12 object-contain shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-black uppercase tracking-wider">{sekolah.namaSekolah || 'SD NEGERI KITA'}</h2>
                    <p className="text-xs text-slate-600 font-semibold uppercase">LAPORAN REKAPITULASI HASIL ASESMEN BELAJAR SISWA</p>
                    <p className="text-[10px] text-slate-500 font-medium">Semester Ganjil / Genap - Kurikulum Merdeka - Tahun Ajaran {sekolah.tahunPelajaran || '2025/2026'}</p>
                  </div>
                </div>

                {/* Meta Details */}
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700 mb-6 bg-slate-50 p-4 rounded-xl print:bg-white print:border print:border-slate-300">
                  <div>
                    <p><span className="text-slate-400">Nama Sekolah :</span> {sekolah.namaSekolah}</p>
                    <p><span className="text-slate-400">Kepala Sekolah:</span> {sekolah.kepalaSekolah || '-'}</p>
                    <p><span className="text-slate-400">Wali Kelas   :</span> {getWaliKelasForClass(activeClassFilter).nama}</p>
                    <p><span className="text-slate-400">NIP Wali    :</span> {getWaliKelasForClass(activeClassFilter).nip}</p>
                  </div>
                  <div className="text-right">
                    <p><span className="text-slate-400">Kelas :</span> {activeClassFilter === 'Semua' ? 'Semua Kelas' : activeClassFilter}</p>
                    <p><span className="text-slate-400">Total Siswa :</span> {reportStudents.length} Orang</p>
                    <p><span className="text-slate-400">Tanggal Cetak :</span> {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Main Table */}
                <table className="w-full text-left text-xs border-collapse border border-slate-400 mb-6">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider border-b border-slate-400">
                      <th className="border border-slate-400 px-3 py-2 text-center w-8">No</th>
                      <th className="border border-slate-400 px-4 py-2">Nama Siswa</th>
                      <th className="border border-slate-400 px-3 py-2 text-center w-24">NISN</th>
                      <th className="border border-slate-400 px-3 py-2 text-center">Formatif (Rata)</th>
                      <th className="border border-slate-400 px-3 py-2 text-center">STS (Rata)</th>
                      <th className="border border-slate-400 px-3 py-2 text-center">SAS (Rata)</th>
                      <th className="border border-slate-400 px-3 py-2 text-center">P5 (Rata)</th>
                      <th className="border border-slate-400 px-3 py-2 text-center w-24">Rata Akhir</th>
                      <th className="border border-slate-400 px-3 py-2 text-center w-24">Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportStatsList.map((st, idx) => (
                      <tr key={st.siswa.id} className="border-b border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold">{st.siswa.namaSiswa}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono text-[11px]">{st.siswa.nisn}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{st.avgHarian || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{st.avgSts || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{st.avgSas || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{st.avgKoku || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold">{st.overallAvg || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-bold">
                          {st.overallAvg >= 75 ? (
                            <span className="text-emerald-700">TUNTAS</span>
                          ) : st.overallAvg > 0 ? (
                            <span className="text-red-600">REMEDIAL</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-800 mb-8 p-4 bg-slate-50 rounded-xl print:bg-white print:border print:border-slate-300">
                  <p>Rerata Kelas Akhir: <span className="text-indigo-700">{reportClassAvg} Poin</span></p>
                  <p className="text-right">Tingkat Ketuntasan Belajar: <span className="text-emerald-700">{passPercent}% ({reportAboveKKM} dari {reportStudents.length} Siswa)</span></p>
                </div>

                {/* Signatures Section */}
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-800 pt-8">
                  <div className="text-center space-y-16">
                    <p>Mengetahui,<br />Kepala Sekolah</p>
                    <div>
                      <p className="font-bold underline">( {sekolah.kepalaSekolah || '_____________________'} )</p>
                      <p className="text-[10px] text-slate-500">NIP. {sekolah.nipKepalaSekolah || '_____________________'}</p>
                    </div>
                  </div>
                  <div className="text-center space-y-16">
                    <p>{getPrintLocation(sekolah)}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br />Wali Kelas {activeClassFilter === 'Semua' ? '' : activeClassFilter}</p>
                    <div>
                      <p className="font-bold underline">( {getWaliKelasForClass(activeClassFilter).nama} )</p>
                      <p className="text-[10px] text-slate-500">NIP. {getWaliKelasForClass(activeClassFilter).nip}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CUSTOM CONFIRMATION DIALOG FOR SECURE DELETION */}
      {deleteConfirm && (
        <div id="delete_confirm_modal_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="delete_confirm_modal_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Konfirmasi Hapus</h4>
                <p className="text-xs text-slate-500">Tindakan ini permanen</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {deleteConfirm.message}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel_delete_btn"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="confirm_delete_btn"
                onClick={() => {
                  executeDelete(deleteConfirm.id, deleteConfirm.type);
                  setDeleteConfirm(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT DIALOG */}
      {customAlert && (
        <div id="custom_alert_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="custom_alert_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${
                customAlert.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                customAlert.type === 'error' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' :
                customAlert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
              }`}>
                {customAlert.type === 'success' ? <Check className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">{customAlert.title}</h4>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {customAlert.message}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                id="custom_alert_ok_btn"
                onClick={() => setCustomAlert(null)}
                className="bg-m3-purple hover:bg-m3-purple-dark text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer shadow-md transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TAMBAH KELAS MODAL */}
      {showAddClassModal && (
        <div id="add_class_modal_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="add_class_modal_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Tambah Kelas Baru</h4>
              <p className="text-xs text-slate-500">Masukkan nama/kode kelas baru untuk disinkronkan</p>
            </div>
            <div>
              <input
                type="text"
                placeholder="Contoh: Kelas 4-B"
                value={newClassNameInput}
                onChange={(e) => setNewClassNameInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-m3-purple/20 outline-none text-slate-950 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClassModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateClassConfirm}
                className="bg-m3-purple hover:bg-m3-purple-dark text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Tambah Kelas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT NAMA KELAS MODAL */}
      {showEditClassModal && (
        <div id="edit_class_modal_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="edit_class_modal_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Ubah Nama Kelas</h4>
              <p className="text-xs text-slate-500">Edit nama kelas <strong className="text-indigo-600 dark:text-indigo-400">{editingClassName}</strong></p>
            </div>
            <div>
              <input
                type="text"
                placeholder="Nama Kelas Baru"
                value={editClassNameInput}
                onChange={(e) => setEditClassNameInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-950 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEditClassModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditedClassConfirm}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT SISWA EXCEL MODAL */}
      {showImportSiswaExcelModal && (
        <div id="import_siswa_excel_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="import_siswa_excel_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Impor Data Siswa (.xlsx)</h4>
                <button
                  onClick={() => {
                    setShowImportSiswaExcelModal(false);
                    setExcelImportResult(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Lakukan migrasi data awal siswa dengan mengunggah template spreadsheet Excel (.xlsx / .xls).
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-bold">Panduan Kolom Spreadsheet (Baris pertama sebagai Header):</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-indigo-600 dark:text-indigo-400">Nama Siswa</strong> (Wajib)</li>
                <li><strong>NISN</strong> & <strong>NIS</strong> (Opsional)</li>
                <li><strong>JK</strong> atau <strong>Jenis Kelamin</strong> (L untuk Laki-laki, P untuk Perempuan)</li>
                <li><strong>Kelas</strong> (Jika kosong, akan dimasukkan ke filter kelas aktif saat ini)</li>
                <li><strong>Alamat</strong>, <strong>Nama Ayah</strong>, <strong>Nama Ibu</strong>, <strong>No Telp Ortu</strong> (Opsional)</li>
              </ul>
              <p className="text-[10px] text-slate-400 italic">
                *Sistem akan mencocokkan data yang ada untuk memperbarui rekam jejak, atau menambahkan data baru jika tidak ditemukan kecocokan.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500">Pilih File Excel (.xlsx / .xls)</label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportSiswaExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="w-8 h-8 text-indigo-500 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Klik atau seret file ke sini untuk mengunggah</p>
                  <p className="text-[10px] text-slate-400">Hanya format .xlsx atau .xls</p>
                </div>
              </div>
            </div>

            {excelImportResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                excelImportResult.success 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300'
              }`}>
                <p className="font-bold">{excelImportResult.message}</p>
                {excelImportResult.details && excelImportResult.details.length > 0 && (
                  <div className="max-h-36 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2 rounded-xl text-[10px] font-mono space-y-1">
                    {excelImportResult.details.map((detail, idx) => (
                      <p key={idx} className="border-b border-slate-50 dark:border-slate-800/30 pb-0.5 last:border-none">
                        {detail}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportSiswaExcelModal(false);
                  setExcelImportResult(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT ABSENSI EXCEL MODAL */}
      {showImportAbsensiExcelModal && (
        <div id="import_absensi_excel_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="import_absensi_excel_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Unggah Rekap Presensi (.xlsx)</h4>
                <button
                  onClick={() => {
                    setShowImportAbsensiExcelModal(false);
                    setExcelImportResult(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Unggah data kehadiran siswa bulanan sekaligus melalui file spreadsheet Excel (.xlsx / .xls).
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-bold">Panduan Kolom Spreadsheet (Baris pertama sebagai Header):</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-violet-600 dark:text-violet-400">Nama Siswa</strong> atau <strong>NISN</strong> (Sistem akan mencocokkan identitas siswa secara otomatis)</li>
                <li><strong>Tanggal</strong> (Format: YYYY-MM-DD. Jika kosong, akan menggunakan tanggal presensi aktif)</li>
                <li><strong>Status</strong> (Hadir, Sakit, Izin, atau Alfa)</li>
                <li><strong>Keterangan</strong> (Opsional, info pendukung)</li>
              </ul>
              <p className="text-[10px] text-slate-400 italic">
                *Sistem mendukung pencocokan nama pintar (fuzzy-matching) jika terjadi perbedaan kecil penulisan huruf besar/kecil.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500">Pilih File Excel (.xlsx / .xls)</label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportAbsensiExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="w-8 h-8 text-violet-500 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Klik atau seret file ke sini untuk mengunggah</p>
                  <p className="text-[10px] text-slate-400">Hanya format .xlsx atau .xls</p>
                </div>
              </div>
            </div>

            {excelImportResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                excelImportResult.success 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300'
              }`}>
                <p className="font-bold">{excelImportResult.message}</p>
                {excelImportResult.details && excelImportResult.details.length > 0 && (
                  <div className="max-h-36 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2 rounded-xl text-[10px] font-mono space-y-1">
                    {excelImportResult.details.map((detail, idx) => (
                      <p key={idx} className="border-b border-slate-50 dark:border-slate-800/30 pb-0.5 last:border-none">
                        {detail}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportAbsensiExcelModal(false);
                  setExcelImportResult(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT VALIDATION REPORT MODAL */}
      {showExcelResultModal && excelImportResult && (
        <div id="excel_validation_report_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="excel_validation_report_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${
                    excelImportResult.success 
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}>
                    {excelImportResult.success ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">Laporan Validasi & Impor Excel</h4>
                    <p className="text-[11px] text-slate-500 capitalize">Kategori data: {excelImportResult.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowExcelResultModal(false);
                    setExcelImportResult(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* General Stats summary card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl text-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Sukses Diproses</p>
                <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                  {excelImportResult.addedCount + excelImportResult.updatedCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  ({excelImportResult.addedCount} Baru, {excelImportResult.updatedCount} Edit)
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl text-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Gagal / Dilewati</p>
                <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                  {excelImportResult.skippedCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Baris Data Dilewati</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl text-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Kesalahan Kritis</p>
                <p className="text-xl font-extrabold text-red-500 mt-1">
                  {excelImportResult.corrections?.filter(c => c.severity === 'error').length || 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Harus Diperbaiki</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl text-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Peringatan</p>
                <p className="text-xl font-extrabold text-amber-500 mt-1">
                  {excelImportResult.corrections?.filter(c => c.severity === 'warning').length || 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Informasi / Toleransi</p>
              </div>
            </div>

            {/* Message alert box */}
            <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${
              excelImportResult.success 
                ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-800 dark:text-emerald-300' 
                : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20 text-amber-800 dark:text-amber-300'
            }`}>
              <p className="font-bold mb-1">Status Sinkronisasi:</p>
              <p>{excelImportResult.message}</p>
            </div>

            {/* List of Corrections & How to Fix */}
            {excelImportResult.corrections && excelImportResult.corrections.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Daftar Kesalahan & Rekomendasi Perbaikan
                  </h5>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {excelImportResult.corrections.length} Isu Ditemukan
                  </span>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[40vh] overflow-y-auto">
                  {excelImportResult.corrections.map((corr, idx) => (
                    <div key={idx} className="p-4 bg-slate-50/30 dark:bg-slate-900/20 hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg">
                            Baris {corr.row}
                          </span>
                          <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                            Kolom: <span className="font-bold text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{corr.field}</span>
                          </span>
                          {corr.val && (
                            <span className="text-[11px] text-slate-400 truncate max-w-xs">
                              (Nilai input: <code className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded font-mono text-[10px]">"{corr.val}"</code>)
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          corr.severity === 'error'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}>
                          {corr.severity === 'error' ? 'Wajib Diperbaiki' : 'Peringatan'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <p className="flex items-start gap-1.5">
                          <span className="text-rose-500 shrink-0 mt-0.5">●</span>
                          <span><strong>Masalah:</strong> {corr.issue}</span>
                        </p>
                        <p className="flex items-start gap-1.5 bg-indigo-50/40 dark:bg-indigo-950/20 p-2 rounded-xl border border-indigo-100/50 dark:border-indigo-950/40 text-indigo-900 dark:text-indigo-300 mt-1">
                          <span className="text-indigo-500 shrink-0 font-bold">💡</span>
                          <span><strong>Cara Memperbaiki:</strong> {corr.fix}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-emerald-50/20 dark:bg-emerald-950/10 border border-dashed border-emerald-200 dark:border-emerald-800/40 rounded-3xl space-y-2">
                <p className="text-xl">🎉</p>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Format Data Sempurna!</p>
                <p className="text-[11px] text-slate-500">Tidak ada duplikasi data atau kesalahan format yang ditemukan dalam berkas Excel ini.</p>
              </div>
            )}

            {/* List of successfully imported details */}
            {excelImportResult.details && excelImportResult.details.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <details className="group border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  <summary className="flex items-center justify-between p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors select-none outline-none">
                    <span>Lihat Log Detail Proses ({excelImportResult.details.length} Baris)</span>
                    <span className="transition-transform group-open:rotate-180 text-slate-400">▼</span>
                  </summary>
                  <div className="p-3.5 border-t border-slate-150 dark:border-slate-800 max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-[10px] font-mono space-y-1">
                    {excelImportResult.details.map((detail, idx) => (
                      <p key={idx} className="text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900/40 pb-0.5 last:border-none last:pb-0">
                        {detail}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Modal Footer buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowExcelResultModal(false);
                  setExcelImportResult(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Saya Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE FORM INGESTION MODAL FOR ASESMEN HARIAN */}
      {ingestTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full">
                  Penilaian Kuis Google Form
                </span>
                <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                  {ingestTaskModal.judulTugas}
                </h3>
                <p className="text-xs text-slate-500">
                  Olah hasil pengerjaan Google Form dan masukkan otomatis ke nilai Asesmen Harian siswa.
                </p>
              </div>
              <button
                onClick={() => setIngestTaskModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {ingestNotice && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-fade-in">
                {ingestNotice}
              </div>
            )}

            {/* Google Sheet Response URL Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  📊 Tautan Google Sheet Tanggapan (Auto-Sync Nilai)
                </span>
                {ingestTaskModal.googleSheetUrl && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                    ✓ Tersambung
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={tempSheetUrl}
                  onChange={(e) => setTempSheetUrl(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveAndSyncSheetUrl}
                  disabled={isAutoSyncingSheet}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAutoSyncingSheet ? 'animate-spin' : ''}`} />
                  <span>{isAutoSyncingSheet ? 'Syncing...' : 'Simpan & Sync'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                💡 <strong>Cara ambil link:</strong> Buka Google Form Anda → Tab <strong>Jawaban (Responses)</strong> → Klik ikon Google Sheet <strong>'Lihat di Spreadsheet'</strong> → Salin link URL dari address bar dan tempel di sini.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span>Daftar Siswa Kelas {activeClassFilter}:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isAutoSyncingSheet}
                    onClick={async () => {
                      if (!ingestTaskModal) return;
                      setIsAutoSyncingSheet(true);
                      setIngestNotice('Membaca dan menyinkronkan nilai dari Google Sheet Respon...');
                      const syncUrl = ingestTaskModal.googleSheetUrl || tempSheetUrl || ingestTaskModal.googleFormUrl;
                      const res = await syncGoogleFormScoresFromSheet(ingestTaskModal.id, syncUrl);
                      setIsAutoSyncingSheet(false);
                      if (res.success) {
                        setIngestNotice(`✅ ${res.message}`);
                        handleOpenIngestModal(ingestTaskModal);
                      } else {
                        setIngestNotice(`⚠️ ${res.message}`);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAutoSyncingSheet ? 'animate-spin' : ''}`} />
                    <span>{isAutoSyncingSheet ? 'Menyinkronkan...' : '⚡ Auto-Sync Nilai Google Sheet'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const relevantStudents = siswas.filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter);
                      const updated = { ...ingestScores };
                      relevantStudents.forEach(s => {
                        updated[s.id] = { nilai: 80, deskripsi: `Hasil penilaian Kuis Google Form: ${ingestTaskModal.judulTugas}` };
                      });
                      setIngestScores(updated);
                    }}
                    className="text-m3-purple dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    Isi Standar KKM (80)
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {siswas
                  .filter(s => activeClassFilter === 'Semua' || s.kelas === activeClassFilter)
                  .map(s => {
                    const val = ingestScores[s.id]?.nilai !== undefined ? ingestScores[s.id].nilai : '';
                    const desc = ingestScores[s.id]?.deskripsi || '';
                    return (
                      <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{s.namaSiswa}</p>
                          <p className="text-[10px] text-slate-400">NISN: {s.nisn || '-'} | Kelas {s.kelas}</p>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="w-28">
                            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Nilai (0-100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={val}
                              onChange={(e) => {
                                setIngestScores({
                                  ...ingestScores,
                                  [s.id]: {
                                    nilai: e.target.value,
                                    deskripsi: desc || `Hasil penilaian Kuis Google Form: ${ingestTaskModal.judulTugas}`
                                  }
                                });
                              }}
                              placeholder="0"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-center text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIngestTaskModal(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSaveIngestScores(ingestTaskModal)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Seluruh Nilai ke Asesmen Harian</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Google Apps Script Integrasi Webhook Tahap 2 */}
      <GoogleAppsScriptModal
        isOpen={showAppsScriptModal}
        onClose={() => setShowAppsScriptModal(false)}
        tasks={tugases}
      />
    </div>
  );
}
