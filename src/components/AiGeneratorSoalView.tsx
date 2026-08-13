import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Printer,
  HelpCircle,
  CheckCircle2,
  BookOpen,
  UploadCloud,
  FileText,
  X,
  RotateCcw,
  Paperclip,
  Code,
  ExternalLink,
  FileCode,
  Sliders,
  CheckSquare,
  Zap,
  Info,
  Award,
  UserCheck,
  ListOrdered,
  Lock,
  Mail
} from 'lucide-react';
import { db } from '../services/db';
import { isMapelMatchingClassStrict } from '../utils/mapelUtils';

interface UploadedDoc {
  name: string;
  size: number;
  type: string;
  textContent: string;
}

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
  const clean = (className || '').trim();
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
  const matchAnyNum = clean.match(/(\d+)/);
  if (matchAnyNum) {
    return { num: parseInt(matchAnyNum[1], 10), suffix: clean };
  }
  return { num: 999, suffix: clean };
};

const extractGradeFromStr = (str: string): number | null => {
  if (!str || !str.trim()) return null;
  const clean = str.trim().toUpperCase();

  // Match explicit patterns like "KELAS 5", "KLS 6", "K5", "KL6", "CLASS 5"
  const matchK = clean.match(/(?:KELAS|KLS|CLASS|FASE\s+[A-F]\s+KELAS|K|KL)\s*([0-9]{1,2})\b/);
  if (matchK) return parseInt(matchK[1], 10);

  // Match codes like "MP-K5-01", "MP-5-MAT", "BIN-6", "KLS5"
  const matchCode = clean.match(/(?:^|[^0-9])([1-9]|1[0-2])(?:$|[^0-9])/);
  if (matchCode) {
    const n = parseInt(matchCode[1], 10);
    if (n >= 1 && n <= 12) return n;
  }

  const key = getSortKey(clean);
  if (key.num !== 999) return key.num;

  return null;
};

const sortClasses = (classes: string[]): string[] => {
  return Array.from(new Set(classes.filter(Boolean))).sort((a, b) => {
    const keyA = getSortKey(a);
    const keyB = getSortKey(b);
    if (keyA.num !== keyB.num) {
      return keyA.num - keyB.num;
    }
    return keyA.suffix.localeCompare(keyB.suffix, 'id', { numeric: true });
  });
};

export function AiGeneratorSoalView() {
  // Logged-in User & Guru Context
  const currentUser = db.getCurrentUser();
  const isOperator = currentUser.role === 'operator';
  const gurus = db.guru.getAll();
  const loggedInGuru = gurus.find(g => g.id === currentUser.id);

  // Check if current user is Wali Kelas with locked class
  const isRealWaliKelas = !isOperator && loggedInGuru?.isWaliKelas === true && loggedInGuru?.kelasWali && loggedInGuru?.kelasWali !== 'GURU MAPEL' && loggedInGuru?.kelasWali !== '';
  const lockedKelas = isRealWaliKelas ? loggedInGuru?.kelasWali : null;

  // Selected values
  const [kelas, setKelas] = useState<string>(lockedKelas || 'Kelas 4');
  const [isCustomKelas, setIsCustomKelas] = useState(false);
  const [customKelasText, setCustomKelasText] = useState('');

  const [mapel, setMapel] = useState('');
  const [isCustomMapel, setIsCustomMapel] = useState(false);
  const [customMapelText, setCustomMapelText] = useState('');

  // Available lists
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableMapels, setAvailableMapels] = useState<string[]>([]);

  // Topic / Material
  const [topik, setTopik] = useState('Pecahan Senilai, Penjumlahan & Pengurangan Pecahan');

  // Bentuk & Format Soal
  const [jenisSoal, setJenisSoal] = useState<'pg' | 'pg_bs' | 'pg_uraian' | 'uraian'>('pg');
  const [opsiPg, setOpsiPg] = useState<'4' | '5'>('4');
  const [jumlahSoalPreset, setJumlahSoalPreset] = useState('10');
  const [jumlahSoalCustom, setJumlahSoalCustom] = useState('10');
  const [tingkatHots, setTingkatHots] = useState('Sedang & HOTS');

  // Field Identitas Siswa (Checklist 5 items)
  const [includeNama, setIncludeNama] = useState(true);
  const [includeNisn, setIncludeNisn] = useState(true);
  const [includeKelas, setIncludeKelas] = useState(true);
  const [includeRombel, setIncludeRombel] = useState(true);
  const [includeAbsen, setIncludeAbsen] = useState(true);

  // Opsi Kumpulkan Email
  const [kumpulEmail, setKumpulEmail] = useState(false);

  // Pengaturan Poin / Bobot Nilai
  const [skemaPoin, setSkemaPoin] = useState<'otomatis' | 'kustom'>('otomatis');
  const [poinPg, setPoinPg] = useState('10');
  const [poinBs, setPoinBs] = useState('5');
  const [poinUraian, setPoinUraian] = useState('20');

  // File Upload
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generator & UI state
  const [isLoading, setIsLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [isCopiedScript, setIsCopiedScript] = useState(false);
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'text' | 'guide'>('script');

  const activeJumlahSoal = jumlahSoalPreset === 'custom' ? jumlahSoalCustom : jumlahSoalPreset;

  // 1. Load Classes from Database
  useEffect(() => {
    let classListFromSaved: string[] = [];
    try {
      const saved = localStorage.getItem('daftar_kelas');
      if (saved) classListFromSaved = JSON.parse(saved);
    } catch (e) {
      classListFromSaved = [];
    }
    const studentClasses = db.siswa.getAll().map(s => s.kelas).filter(Boolean);
    const defaultClasses = [
      'Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6',
      'Kelas 7', 'Kelas 8', 'Kelas 9', 'Kelas 10', 'Kelas 11', 'Kelas 12'
    ];
    const combinedClasses = sortClasses([...classListFromSaved, ...studentClasses, ...defaultClasses]);
    setAvailableClasses(combinedClasses);

    if (lockedKelas) {
      setKelas(lockedKelas);
    } else if (!kelas || !combinedClasses.includes(kelas)) {
      const defaultToSelect = combinedClasses.find(c => c === 'Kelas 4') || combinedClasses[0] || 'Kelas 1';
      setKelas(defaultToSelect);
    }
  }, [lockedKelas]);

  // 2. Filter Mapel strictly based on Selected/Locked Class
  useEffect(() => {
    const activeKelasName = isCustomKelas ? customKelasText : kelas;
    if (!activeKelasName) return;

    const activeGradeKey = getSortKey(activeKelasName);
    const activeGradeNum = activeGradeKey.num !== 999 ? activeGradeKey.num : null;

    // Fetch DB Mapels
    const allDbMapels = db.mataPelajaran.getAll();
    
    // Filter mapels assigned specifically to this class or matching grade strictly
    const matchingDbMapels = allDbMapels
      .filter(m => isMapelMatchingClassStrict(m, activeKelasName))
      .map(m => {
        if (m.kodeMapel && !m.namaMapel.toLowerCase().includes(m.kodeMapel.toLowerCase())) {
          return `${m.namaMapel} (${m.kodeMapel})`;
        }
        return m.namaMapel;
      });

    // Default subjects according to education level
    let gradeSpecificDefaults: string[] = [];
    if (activeGradeNum !== null && activeGradeNum <= 6) {
      // SD (Kelas 1-6)
      gradeSpecificDefaults = [
        'Matematika',
        'Bahasa Indonesia',
        'IPAS (IPA & IPS)',
        'Pendidikan Pancasila',
        'Bahasa Inggris',
        'Pendidikan Agama dan Budi Pekerti',
        'PJOK',
        'Seni dan Budaya'
      ];
    } else if (activeGradeNum !== null && activeGradeNum <= 9) {
      // SMP (Kelas 7-9)
      gradeSpecificDefaults = [
        'Matematika',
        'Bahasa Indonesia',
        'IPA',
        'IPS',
        'Bahasa Inggris',
        'Pendidikan Pancasila',
        'Informatika',
        'PJOK',
        'Seni dan Budaya',
        'Pendidikan Agama dan Budi Pekerti'
      ];
    } else {
      // SMA/SMK (Kelas 10-12)
      gradeSpecificDefaults = [
        'Matematika',
        'Bahasa Indonesia',
        'Bahasa Inggris',
        'Informatika',
        'Pendidikan Pancasila',
        'Fisika',
        'Kimia',
        'Biologi',
        'Ekonomi',
        'Sosiologi',
        'Geografi',
        'Sejarah',
        'PJOK',
        'Pendidikan Agama dan Budi Pekerti'
      ];
    }

    // Add teacher's primary subject if applicable
    if (loggedInGuru?.mataPelajaranUtama) {
      gradeSpecificDefaults.unshift(loggedInGuru.mataPelajaranUtama);
    }

    const filteredMapelList = Array.from(new Set([...matchingDbMapels, ...gradeSpecificDefaults])).filter(Boolean);
    setAvailableMapels(filteredMapelList);

    // Auto select first mapel if current mapel isn't in filtered list
    if (!mapel || !filteredMapelList.includes(mapel)) {
      setMapel(filteredMapelList[0] || 'Matematika');
    }
  }, [kelas, customKelasText, isCustomKelas, loggedInGuru?.mataPelajaranUtama]);

  const effectiveMapel = isCustomMapel ? customMapelText || 'Mata Pelajaran' : mapel;
  const effectiveKelas = isCustomKelas ? customKelasText || 'Kelas/Fase' : kelas;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isTextLike = file.type.includes('text') || 
      ['.txt', '.md', '.csv', '.json', '.html'].some(ext => file.name.toLowerCase().endsWith(ext));

    if (isTextLike) {
      reader.onload = (evt) => {
        const text = (evt.target?.result as string) || '';
        setUploadedDoc({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          textContent: text
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        const buffer = evt.target?.result as ArrayBuffer;
        let extractedText = '';
        if (buffer) {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const rawText = decoder.decode(buffer);
          extractedText = rawText.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
          if (extractedText.length > 4000) {
            extractedText = extractedText.substring(0, 4000) + '... (sebagian teks dokumen)';
          }
        }
        setUploadedDoc({
          name: file.name,
          size: file.size,
          type: file.type || file.name.split('.').pop() || 'document',
          textContent: extractedText || `Dokumen acuan: ${file.name}`
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleRemoveDoc = () => {
    setUploadedDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!topik.trim() && !uploadedDoc) return;
    setIsLoading(true);
    setGeneratedResult(null);

    let docPrompt = '';
    if (uploadedDoc) {
      docPrompt = `\n\n[DOKUMEN DUKUNGAN / RANGKUMAN MATERI ACUAN YANG DIUNGGAH GURU: "${uploadedDoc.name}"]\nTeks/Konten Acuan:\n${uploadedDoc.textContent || uploadedDoc.name}`;
    }

    // Map tipe soal label
    let tipeSoalLabel = 'Pilihan Ganda Saja';
    if (jenisSoal === 'pg_bs') {
      tipeSoalLabel = 'Kombinasi Pilihan Ganda & Benar-Salah (True/False)';
    } else if (jenisSoal === 'pg_uraian') {
      tipeSoalLabel = 'Kombinasi Pilihan Ganda & Uraian / Essay';
    } else if (jenisSoal === 'uraian') {
      tipeSoalLabel = 'Uraian / Essay Saja';
    }

    // Identitas Siswa Checklist
    const identitasList: string[] = [];
    if (includeNama) identitasList.push('Nama Lengkap Siswa (form.addTextItem().setTitle("Nama Lengkap Siswa").setRequired(true))');
    if (includeNisn) identitasList.push('ISIAN NISN / Nomor Induk Siswa Nasional (form.addTextItem().setTitle("NISN (Nomor Induk Siswa Nasional)").setRequired(true))');
    if (includeKelas) identitasList.push('Tingkat Kelas (form.addTextItem().setTitle("Kelas / Tingkat").setRequired(true))');
    if (includeRombel) identitasList.push('Rombel / Rombongan Belajar (form.addTextItem().setTitle("Rombel / Rombongan Belajar").setRequired(true))');
    if (includeAbsen) identitasList.push('Nomor Absen Siswa (form.addTextItem().setTitle("Nomor Absen").setRequired(true))');
    const identitasPrompt = identitasList.length > 0 
      ? `Sertakan field identitas siswa di awal Google Form:\n  ${identitasList.map((idText, idx) => `- ${idx + 1}. ${idText}`).join('\n  ')}`
      : `Tidak perlu membuat field identitas siswa di awal form.`;

    // Pengumpulan Email
    const emailPrompt = kumpulEmail
      ? `- PENGUMPULAN EMAIL: Ya (Sertakan instruksi \`form.setCollectEmail(true);\` pada kode GAS agar Google Form secara otomatis merekam alamat email siswa).`
      : `- PENGUMPULAN EMAIL: Tidak (Gunakan \`form.setCollectEmail(false);\` agar siswa dapat mengerjakan kuis tanpa harus mengumpulkan email).`;

    // Poin Nilai instruction
    let poinPrompt = '';
    if (skemaPoin === 'otomatis') {
      poinPrompt = `Setiap soal diberi poin yang seimbang sehingga total skor keseluruhan bernilai tepat 100 poin (Gunakan .setPoints(nilaiPoin)).`;
    } else {
      poinPrompt = `Gunakan skema poin kustom dari guru:\n  - Soal Pilihan Ganda: ${poinPg} Poin per soal\n  - Soal Benar/Salah: ${poinBs} Poin per soal\n  - Soal Uraian/Essay: ${poinUraian} Poin per soal\n(Terapkan .setPoints(...) sesuai nilai poin tersebut).`;
    }

    const promptText = `Anda adalah Pakar Kurikulum Merdeka & Developer Google Apps Script (GAS) Spesialis Google Form Kuis Ujian.

Tugas Anda: Buatkan SKRIP GOOGLE APPS SCRIPT (GAS) LENGKAP & VALID yang siap di-copy paste oleh Guru ke Google Apps Script Editor (script.google.com) untuk membuat Google Form Kuis Ujian secara OTOMATIS!

[INFORMASI SPESIFIKASI SOAL & KUIS]:
- Mata Pelajaran: ${effectiveMapel}
- Tingkat / Kelas: ${effectiveKelas}
- Topik/Materi: ${topik || 'Sesuai dokumen terlampir'}
- Bentuk / Tipe Soal: ${tipeSoalLabel}
- Jumlah Opsi Pilihan Ganda: ${opsiPg} Opsi (A, B, C, D${opsiPg === '5' ? ', E' : ''})
- Jumlah Total Soal: ${activeJumlahSoal} soal
- Tingkat Kesukaran: ${tingkatHots}

[PENGATURAN FIELD IDENTITAS SISWA]:
${identitasPrompt}

[PENGATURAN PENGUMPULAN EMAIL]:
${emailPrompt}

[PENGATURAN SKOR & POIN NILAI PER SOAL]:
${poinPrompt}${docPrompt}

[PETUNJUK KODE GOOGLE APPS SCRIPT (GAS)]:
1. Buat kode JavaScript valid dalam satu blok \`\`\`javascript ... \`\`\` dengan nama fungsi \`createGoogleForm()\`.
2. Gunakan API FormApp Google Apps Script secara presisi:
   - \`var form = FormApp.create("Kuis Ujian: " + "${effectiveMapel} - ${effectiveKelas}");\`
   - \`form.setDescription("Topik/Materi: " + "${topik.substring(0, 80)}" + "\\nPetunjuk: Jawablah pertanyaan di bawah ini dengan cermat dan jujur.");\`
   - \`form.setIsQuiz(true);\` (Mode Kuis Aktif)
   - ${kumpulEmail ? '`form.setCollectEmail(true);`' : '`form.setCollectEmail(false);`'}
   - Tambahkan field identitas sesuai permintaan checklist guru (Nama, NISN, Kelas/Absen) menggunakan \`.addTextItem().setTitle(...).setRequired(true)\`.
   - Tambahkan Section Header / Pemisah Bagian jika ada kombinasi tipe soal (misal: \`form.addPageBreakItem().setTitle("Bagian I: Pilihan Ganda")\`).
   - Untuk Pilihan Ganda, gunakan \`form.addMultipleChoiceItem()\`:
     - \`.setTitle("1. Teks Pertanyaan...")\`
     - \`.setChoices([ q.createChoice("A. Opsi 1"), q.createChoice("B. Opsi 2", true), ... ])\` (berikan flag true pada opsi yang menjadi Kunci Jawaban benar!)
     - \`.setPoints(${skemaPoin === 'kustom' ? poinPg : 'poinPilihanGanda'})\`
     - \`.setRequired(true)\`
   - Untuk Benar / Salah, gunakan \`form.addMultipleChoiceItem()\`:
     - \`.setTitle("Pertanyaan Benar/Salah...")\`
     - \`.setChoices([ q.createChoice("A. BENAR", isTrue), q.createChoice("B. SALAH", !isTrue) ])\`
     - \`.setPoints(${skemaPoin === 'kustom' ? poinBs : 'poinBs'})\`
   - Untuk Uraian, gunakan \`form.addParagraphTextItem()\`:
     - \`.setTitle("Pertanyaan Uraian...")\`
     - \`.setPoints(${skemaPoin === 'kustom' ? poinUraian : 'poinUraian'})\`
   - Di akhir fungsi, sertakan \`Logger.log("Form URL: " + form.getEditUrl());\`
3. Setelah blok kode \`\`\`javascript ... \`\`\`, berikan juga bagian "DOKUMEN NASKAH SOAL & KUNCI JAWABAN" secara rapi (Judul, Daftar Soal, Kunci Jawaban & Pembahasan Singkat) agar guru bisa membaca dan mencetaknya jika diperlukan.

Pastikan skrip JavaScript 100% syntactically correct, tanpa error, dan siap di-run langsung di script.google.com!`;

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, history: [] })
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setGeneratedResult(data.reply);
        setActiveTab('script');
      } else {
        setGeneratedResult(`⚠️ Gagal membuat skrip soal: ${data.error || 'Terjadi masalah pada server AI.'}`);
      }
    } catch (err: any) {
      setGeneratedResult(`⚠️ Kesalahan jaringan: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Extract clean Javascript code block from response
  const extractGasScript = (text: string | null): string => {
    if (!text) return '';
    const match = text.match(/```(?:javascript|js|gas)?([\s\S]*?)```/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return '';
  };

  // Extract text outside javascript code block
  const extractTextPart = (text: string | null): string => {
    if (!text) return '';
    const cleanText = text.replace(/```(?:javascript|js|gas)?([\s\S]*?)```/gi, '').trim();
    return cleanText || text;
  };

  const gasScriptCode = extractGasScript(generatedResult);
  const textContentPart = extractTextPart(generatedResult);

  const handleCopyScriptOnly = () => {
    const codeToCopy = gasScriptCode || generatedResult;
    if (!codeToCopy) return;
    navigator.clipboard.writeText(codeToCopy);
    setIsCopiedScript(true);
    setTimeout(() => setIsCopiedScript(false), 2000);
  };

  const handleCopyAll = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult);
    setIsCopiedAll(true);
    setTimeout(() => setIsCopiedAll(false), 2000);
  };

  const handlePrint = () => {
    if (!generatedResult) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Naskah Soal & Kunci Jawaban - ${effectiveMapel}</title>
            <style>
              body { font-family: sans-serif; padding: 24px; line-height: 1.6; color: #1e293b; }
              h1, h2, h3 { color: #0f172a; margin-top: 20px; }
              pre { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11px; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <h2>NASKAH SOAL &amp; KUNCI JAWABAN</h2>
            <p><strong>Mata Pelajaran:</strong> ${effectiveMapel} | <strong>Kelas:</strong> ${effectiveKelas}</p>
            <hr />
            <div>${textContentPart.replace(/\n/g, '<br />')}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleClearAll = () => {
    setTopik('');
    setUploadedDoc(null);
    setGeneratedResult(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-indigo-700/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-extrabold border border-amber-400/30 shadow-xs">
            <Zap className="w-3.5 h-3.5" />
            <span>AI Google Form Quiz &amp; Script Generator</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            AI Generator Soal &amp; Skrip Google Form
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100/80 max-w-2xl leading-relaxed">
            Buat soal kuis &amp; skrip otomatis yang <strong>langsung di-copy paste ke Google Form (Apps Script)</strong>. Terintegrasi khusus dengan mata pelajaran &amp; tingkat kelas di database sekolah.
          </p>
        </div>

        <div className="hidden sm:flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shrink-0 text-amber-300 shadow-inner">
          <FileCode className="w-7 h-7" />
        </div>
      </div>

      {/* Main Grid: Form Inputs & Result Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Generator Parameters */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            
            {/* Header Section */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Parameter Pembuatan Soal</span>
              </h3>

              <button
                onClick={handleClearAll}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                title="Reset Form & Bersihkan Hasil"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* 1. SELEKSI KELAS & MAPEL (TERHUBUNG & TERKUNCI SPESIFIK KELAS GURU) */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1. Tingkat Kelas &amp; Mapel</span>
                </span>
                {lockedKelas ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 rounded-full flex items-center gap-1 border border-amber-300">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Terkunci Wali Kelas</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full">
                    Database Sekolah
                  </span>
                )}
              </div>

              {/* Tingkat Kelas (Locked for Wali Kelas) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Tingkat Kelas</span>
                  {lockedKelas && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Di-lock khusus {lockedKelas}</span>
                    </span>
                  )}
                </label>

                {lockedKelas ? (
                  <div className="w-full bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2 text-xs font-black text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-2xs">
                    <span>{lockedKelas}</span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-lg">
                      🔒 Terkunci
                    </span>
                  </div>
                ) : !isCustomKelas ? (
                  <select
                    value={kelas}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setIsCustomKelas(true);
                      } else {
                        setKelas(e.target.value);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {availableClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">+ Tulis Kelas Lain...</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customKelasText}
                      onChange={e => setCustomKelasText(e.target.value)}
                      placeholder="Ketik tingkat kelas..."
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomKelas(false)}
                      className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>

              {/* Mata Pelajaran Dropdown (Filtered strictly by class) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Mata Pelajaran ({effectiveKelas})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Mapel terfilter {effectiveKelas}</span>
                </label>

                {!isCustomMapel ? (
                  <select
                    value={mapel}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setIsCustomMapel(true);
                      } else {
                        setMapel(e.target.value);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {availableMapels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="__custom__">+ Tulis Mapel Lain...</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customMapelText}
                      onChange={e => setCustomMapelText(e.target.value)}
                      placeholder="Ketik nama mata pelajaran..."
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomMapel(false)}
                      className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. TOPIK / MATERI & UPLOAD DOKUMEN */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Topik/Materi</span>
              </span>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Topik/Materi
                </label>
                <textarea
                  value={topik}
                  onChange={e => setTopik(e.target.value)}
                  rows={3}
                  placeholder="Paste rangkuman materi di sini, atau tuliskan kisi-kisi topik/materi soal yang ingin dibuat..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium leading-relaxed"
                />
              </div>

              {/* File Attachment Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Atau Upload Dokumen Materi (PDF/Word/TXT)</span>
                  </span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx"
                  className="hidden"
                />

                {uploadedDoc ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{uploadedDoc.name}</span>
                    </div>
                    <button
                      onClick={handleRemoveDoc}
                      className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer"
                      title="Hapus Dokumen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl flex items-center justify-center gap-2 transition-all group cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <span className="font-bold text-slate-600 dark:text-slate-300 text-xs">
                      Klik / Unggah Dokumen Rangkuman Materi
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. BENTUK & FORMAT SOAL */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                <span>3. Bentuk &amp; Format Soal</span>
              </span>

              {/* Tipe Soal Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bentuk Soal
                </label>
                <select
                  value={jenisSoal}
                  onChange={e => setJenisSoal(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="pg">Pilihan Ganda Saja</option>
                  <option value="pg_bs">Pilihan Ganda dan Benar / Salah</option>
                  <option value="pg_uraian">Pilihan Ganda dan Uraian</option>
                  <option value="uraian">Uraian / Essay Saja</option>
                </select>
              </div>

              {/* Option Count & Total Questions */}
              <div className="grid grid-cols-2 gap-2">
                {jenisSoal !== 'uraian' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Opsi PG
                    </label>
                    <select
                      value={opsiPg}
                      onChange={e => setOpsiPg(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                    >
                      <option value="4">4 Pilihan (A, B, C, D)</option>
                      <option value="5">5 Pilihan (A, B, C, D, E)</option>
                    </select>
                  </div>
                )}

                <div className={jenisSoal === 'uraian' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah Soal
                  </label>
                  <select
                    value={jumlahSoalPreset}
                    onChange={e => setJumlahSoalPreset(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="5">5 Soal</option>
                    <option value="10">10 Soal</option>
                    <option value="15">15 Soal</option>
                    <option value="20">20 Soal</option>
                    <option value="25">25 Soal</option>
                    <option value="30">30 Soal</option>
                    <option value="custom">Input Kustom</option>
                  </select>
                </div>
              </div>

              {jumlahSoalPreset === 'custom' && (
                <div>
                  <input
                    type="number"
                    value={jumlahSoalCustom}
                    onChange={e => setJumlahSoalCustom(e.target.value)}
                    placeholder="Masukkan jumlah soal..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              )}

              {/* Tingkat HOTS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tingkat Kesukaran / HOTS
                </label>
                <select
                  value={tingkatHots}
                  onChange={e => setTingkatHots(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="Mudah / Dasar">Mudah / Dasar</option>
                  <option value="Sedang & HOTS">Sedang &amp; HOTS (Standar Ujian)</option>
                  <option value="Tinggi / HOTS Murni">Tinggi / HOTS Murni (Olimpiade/Akademik)</option>
                </select>
              </div>
            </div>

            {/* 4. FIELD IDENTITAS SISWA (CHECKLIST 5 ITEM) */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>4. Field Identitas Siswa</span>
              </span>

              {/* Checklist Field Identitas Siswa */}
              <div className="space-y-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Pilih Field Identitas yang Disertakan di Form:
                </span>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeNama}
                    onChange={e => setIncludeNama(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Nama Lengkap Siswa</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeNisn}
                    onChange={e => setIncludeNisn(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>ISIAN NISN (Nomor Induk Siswa Nasional)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeKelas}
                    onChange={e => setIncludeKelas(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Tingkat Kelas</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeRombel}
                    onChange={e => setIncludeRombel(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Rombel (Rombongan Belajar)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAbsen}
                    onChange={e => setIncludeAbsen(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Nomor Absen Siswa</span>
                </label>
              </div>
            </div>

            {/* 5. PENGUMPULAN EMAIL SISWA */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                <span>5. Pengumpulan Email Siswa</span>
              </span>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={kumpulEmail}
                    onChange={e => setKumpulEmail(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      Kumpulkan Alamat Email Siswa Otomatis
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-normal block">
                      Jika dicentang, skrip GAS akan menambahkan <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 font-mono">form.setCollectEmail(true)</code> agar Google Form mencatat email pengerjaan siswa.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* 6. PENGATURAN POIN / BOBOT NILAI */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>6. Pengaturan Poin / Bobot Nilai</span>
              </span>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSkemaPoin('otomatis')}
                    className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
                      skemaPoin === 'otomatis'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-800 dark:text-amber-200 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-500'
                    }`}
                  >
                    Otomatis (Total 100)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSkemaPoin('kustom')}
                    className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
                      skemaPoin === 'kustom'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-800 dark:text-amber-200 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-500'
                    }`}
                  >
                    Atur Poin Kustom
                  </button>
                </div>

                {skemaPoin === 'kustom' && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Poin PG</label>
                      <input
                        type="number"
                        value={poinPg}
                        onChange={e => setPoinPg(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Poin B/S</label>
                      <input
                        type="number"
                        value={poinBs}
                        onChange={e => setPoinBs(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Poin Uraian</label>
                      <input
                        type="number"
                        value={poinUraian}
                        onChange={e => setPoinUraian(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-center font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || (!topik.trim() && !uploadedDoc)}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Merumuskan Skrip Google Form...</span>
                </>
              ) : (
                <>
                  <Code className="w-4.5 h-4.5 text-amber-300" />
                  <span>Generasi Skrip Google Form ({activeJumlahSoal} Soal)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Output Viewer */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[520px]">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Hasil Skrip Google Form &amp; Naskah Soal
              </h3>
            </div>

            {generatedResult && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleCopyScriptOnly}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Salin HANYA Kode Skrip Google Apps Script"
                >
                  {isCopiedScript ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedScript ? 'Skrip Tersalin!' : 'Salin Skrip Google Form'}</span>
                </button>

                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Salin Semua Teks Respon"
                >
                  {isCopiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Salin Teks</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Cetak Dokumen Naskah Soal"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>
              </div>
            )}
          </div>

          {/* Sub-tabs Navigation */}
          {generatedResult && (
            <div className="flex items-center gap-2 mb-3 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setActiveTab('script')}
                className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'script'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Skrip Google Form (GAS)</span>
              </button>

              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Naskah &amp; Kunci Jawaban</span>
              </button>

              <button
                onClick={() => setActiveTab('guide')}
                className={`py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'guide'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Panduan 5 Langkah</span>
              </button>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  AI sedang merumuskan {activeJumlahSoal} soal &amp; merancang skrip Google Form...
                </p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Skrip otomatis akan menyertakan field identitas siswa, pengaturan email, kunci jawaban, dan bobot poin nilai.
                </p>
              </div>
            ) : generatedResult ? (
              activeTab === 'script' ? (
                <div className="space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-3 text-xs flex items-start gap-2 text-amber-900 dark:text-amber-200">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Cara Eksekusi Skrip ke Google Form:</p>
                      <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                        Klik <strong>"Salin Skrip Google Form"</strong> di kanan atas, lalu buka <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900 dark:text-amber-200 inline-flex items-center gap-0.5">script.google.com <ExternalLink className="w-3 h-3" /></a> &gt; Tempel (Paste) &gt; Klik <strong>Jalankan (Play ▶️)</strong>.
                      </p>
                    </div>
                  </div>

                  {gasScriptCode ? (
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          onClick={handleCopyScriptOnly}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          {isCopiedScript ? <Check className="w-3 h-3 text-amber-300" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopiedScript ? 'Tersalin' : 'Salin Skrip'}</span>
                        </button>
                      </div>
                      <pre className="p-4 bg-slate-900 text-indigo-300 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                        <code>{gasScriptCode}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap font-mono text-xs bg-slate-900 text-slate-200 p-4 rounded-xl">
                      {generatedResult}
                    </div>
                  )}
                </div>
              ) : activeTab === 'text' ? (
                <div className="whitespace-pre-wrap space-y-2 leading-relaxed">
                  {textContentPart || generatedResult}
                </div>
              ) : (
                /* STEP-BY-STEP GUIDE */
                <div className="space-y-4 text-xs">
                  <div className="bg-indigo-50 dark:bg-indigo-950/60 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-1">
                    <h4 className="font-extrabold text-sm text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Panduan 5 Langkah Membuat Google Form Kuis</span>
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 text-xs">
                      Ubah skrip AI menjadi Google Form kuis utuh di Google Drive Anda tanpa input manual satu per satu:
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        1
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">Salin Kode Skrip</h5>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Klik tombol <strong className="text-indigo-600 dark:text-indigo-400">"Salin Skrip Google Form"</strong> di bagian atas.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        2
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">Buka Google Apps Script</h5>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Buka tab baru dan kunjungi <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline inline-flex items-center gap-0.5">script.google.com <ExternalLink className="w-3 h-3" /></a>, lalu klik <strong>"+ Proyek Baru"</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        3
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">Tempelkan Skrip (Paste)</h5>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Hapus seluruh teks bawaan di editor, lalu tekan <strong>Ctrl+V</strong> untuk menempelkan skrip.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        4
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">Jalankan Skrip (Run)</h5>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Klik tombol <strong className="text-emerald-600">Jalankan (ikon Play ▶️)</strong>. Jika diminta izin akses, klik <em>"Izinkan" (Authorize)</em>.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        5
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">Google Form Selesai Terbuat!</h5>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Cek Google Drive Anda. Google Form soal kuis baru telah otomatis terbuat lengkap dengan opsi jawaban, kunci jawaban, dan bobot nilai!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                <FileCode className="w-12 h-12 opacity-30 text-indigo-500" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                    Buat Skrip Google Form Otomatis
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Ketik materi / rangkuman di sebelah kiri atau unggah berkas acuan (PDF/Word), lalu klik <strong className="text-indigo-600 dark:text-indigo-400">Generasi Skrip Google Form</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
