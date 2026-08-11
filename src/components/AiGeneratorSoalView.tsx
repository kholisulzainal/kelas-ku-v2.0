import React, { useState, useRef } from 'react';
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
  Trash2,
  RotateCcw,
  Paperclip
} from 'lucide-react';

interface UploadedDoc {
  name: string;
  size: number;
  type: string;
  textContent: string;
}

export function AiGeneratorSoalView() {
  const [mapel, setMapel] = useState('Matematika');
  const [kelas, setKelas] = useState('Kelas 4 / Fase B');
  const [topik, setTopik] = useState('Pecahan Senilai dan Operasi Penjumlahan Pecahan');
  const [jenisSoal, setJenisSoal] = useState<'pg' | 'essay' | 'campuran'>('campuran');
  const [jumlahSoalPreset, setJumlahSoalPreset] = useState('10');
  const [jumlahSoalCustom, setJumlahSoalCustom] = useState('10');
  const [tingkatHots, setTingkatHots] = useState('Sedang & HOTS');

  const [uploadedDoc, setUploadedDoc] = useState<UploadedDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const activeJumlahSoal = jumlahSoalPreset === 'custom' ? jumlahSoalCustom : jumlahSoalPreset;

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
      // Binary files (PDF, Word, Excel, etc.)
      reader.onload = (evt) => {
        const buffer = evt.target?.result as ArrayBuffer;
        let extractedText = '';
        if (buffer) {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const rawText = decoder.decode(buffer);
          // Extract clean printable characters
          extractedText = rawText.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
          if (extractedText.length > 3000) {
            extractedText = extractedText.substring(0, 3000) + '... (sebagian teks dokumen)';
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
      docPrompt = `\n\n[DOKUMEN/SOAL ACUAN ACUAN YANG DIUNGGAH GURU: "${uploadedDoc.name}"]\nContent/Referensi:\n${uploadedDoc.textContent || uploadedDoc.name}`;
    }

    const promptText = `Buatkan Paket Soal Ujian / Latihan Lengkap dengan Kunci Jawaban & Pembahasan untuk Guru:
Mata Pelajaran: ${mapel}
Tingkat / Fase: ${kelas}
Topik / Materi Spesifik: ${topik || 'Sesuai dokumen terlampir'}
Tipe Soal: ${jenisSoal === 'pg' ? 'Pilihan Ganda (A, B, C, D)' : jenisSoal === 'essay' ? 'Essay / Uraian' : 'Campuran (Pilihan Ganda + Uraian)'}
Jumlah Soal: ${activeJumlahSoal} soal
Tingkat Kesukaran: ${tingkatHots}${docPrompt}

Format Output (Markdown Rapi):
1. **Daftar Soal** (Siap dicetak/dibagikan ke siswa)
2. **Kunci Jawaban & Pembahasan Singkat**
3. **Rubrik Penilaian & Bobot Nilai**`;

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, history: [] })
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setGeneratedResult(data.reply);
      } else {
        setGeneratedResult(`⚠️ Gagal membuat soal: ${data.error || 'Terjadi masalah pada server AI.'}`);
      }
    } catch (err: any) {
      setGeneratedResult(`⚠️ Kesalahan jaringan: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearAll = () => {
    setGeneratedResult(null);
    setUploadedDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-extrabold border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Quiz &amp; Exam Generator</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            AI Generator Soal &amp; Bank Ujian
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100/80 max-w-2xl leading-relaxed">
            Buat soal latihan, Ulangan Harian, Sumatif Akhir Semester, dan soal HOTS Kurikulum Merdeka secara instan dari topik atau unggahan dokumen PDF/Word.
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 text-amber-400 border border-white/10">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Input Parameters Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Parameter Pembuatan Soal</span>
            </h3>

            {(generatedResult || uploadedDoc) && (
              <button
                onClick={handleClearAll}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                title="Riset Form &amp; Bersihkan Hasil"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Form</span>
              </button>
            )}
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mata Pelajaran
              </label>
              <input
                type="text"
                value={mapel}
                onChange={e => setMapel(e.target.value)}
                placeholder="misal: Matematika, IPAS, Bahasa Indonesia"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tingkat / Kelas
                </label>
                <select
                  value={kelas}
                  onChange={e => setKelas(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Kelas 1 / Fase A">Kelas 1 / Fase A</option>
                  <option value="Kelas 2 / Fase A">Kelas 2 / Fase A</option>
                  <option value="Kelas 3 / Fase B">Kelas 3 / Fase B</option>
                  <option value="Kelas 4 / Fase B">Kelas 4 / Fase B</option>
                  <option value="Kelas 5 / Fase C">Kelas 5 / Fase C</option>
                  <option value="Kelas 6 / Fase C">Kelas 6 / Fase C</option>
                  <option value="SMP / Fase D">SMP / Fase D</option>
                  <option value="SMA / Fase E-F">SMA / Fase E-F</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tingkat Kesulitan
                </label>
                <select
                  value={tingkatHots}
                  onChange={e => setTingkatHots(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Dasar / Mudah">Dasar / Mudah</option>
                  <option value="Sedang & HOTS">Sedang &amp; HOTS</option>
                  <option value="Tinggi / Analisis HOTS">Tinggi / Analisis HOTS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Topik / Materi Pembelajaran
              </label>
              <textarea
                value={topik}
                onChange={e => setTopik(e.target.value)}
                rows={2}
                placeholder="misal: Operasi Perkalian dan Pembagian Bilangan Cacah..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Upload File / Dokumen Soal (PDF, Word, Text, Excel) */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Upload Dokumen / File Soal Acuan</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">PDF, Word, TXT, Excel</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="doc_soal_file_input"
              />

              {uploadedDoc ? (
                <div className="bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-xs">
                        {uploadedDoc.name}
                      </p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                        {formatFileSize(uploadedDoc.size)} • Terlampir sebagai acuan
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveDoc}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer shrink-0"
                    title="Hapus Dokumen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 rounded-xl p-3 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer group"
                >
                  <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                    Klik atau Seret File di Sini
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Sistem akan mengekstrak materi dari PDF/Word/TXT
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bentuk Soal
                </label>
                <select
                  value={jenisSoal}
                  onChange={e => setJenisSoal(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="campuran">Campuran (PG + Essay)</option>
                  <option value="pg">Pilihan Ganda saja</option>
                  <option value="essay">Uraian / Essay saja</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jumlah Soal
                </label>
                <select
                  value={jumlahSoalPreset}
                  onChange={e => setJumlahSoalPreset(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="5">5 Soal</option>
                  <option value="10">10 Soal</option>
                  <option value="15">15 Soal</option>
                  <option value="20">20 Soal</option>
                  <option value="25">25 Soal</option>
                  <option value="30">30 Soal</option>
                  <option value="35">35 Soal</option>
                  <option value="40">40 Soal</option>
                  <option value="50">50 Soal</option>
                  <option value="custom">Input Kustom (Jumlah Bebas)</option>
                </select>
              </div>
            </div>

            {/* Custom Jumlah Soal Input */}
            {jumlahSoalPreset === 'custom' && (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jumlah Soal Kustom (1 - 100)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={jumlahSoalCustom}
                  onChange={e => setJumlahSoalCustom(e.target.value)}
                  placeholder="Masukkan jumlah soal yang diinginkan"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isLoading || (!topik.trim() && !uploadedDoc)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini AI Sedang Merumuskan Soal...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Generasi {activeJumlahSoal} Soal Ujian Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Viewer Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Hasil Generasi Soal</span>
            </h3>

            {generatedResult && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 hover:dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Clear Chat / Bersihkan Hasil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Chat</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Tersalin' : 'Salin Text'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center animate-bounce">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  AI sedang menyusun {activeJumlahSoal} daftar soal, opsi jawaban, dan rubrik penilaian...
                </p>
                <p className="text-xs text-slate-400">
                  Mohon tunggu beberapa detik.
                </p>
              </div>
            ) : generatedResult ? (
              <div className="whitespace-pre-wrap space-y-2">
                {generatedResult}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                <HelpCircle className="w-10 h-10 opacity-40 text-indigo-500" />
                <p className="font-semibold text-xs">
                  Isi parameter atau upload file acuan di sebelah kiri lalu klik <strong className="text-indigo-600 dark:text-indigo-400">Generasi Soal Ujian Sekarang</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

