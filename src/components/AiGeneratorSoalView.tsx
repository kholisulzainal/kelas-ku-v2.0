import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Download,
  Printer,
  HelpCircle,
  CheckCircle2,
  BookOpen,
  GraduationCap
} from 'lucide-react';

export function AiGeneratorSoalView() {
  const [mapel, setMapel] = useState('Matematika');
  const [kelas, setKelas] = useState('Kelas 4 / Fase B');
  const [topik, setTopik] = useState('Pecahan Senilai dan Operasi Penjumlahan Pecahan');
  const [jenisSoal, setJenisSoal] = useState<'pg' | 'essay' | 'campuran'>('campuran');
  const [jumlahSoal, setJumlahSoal] = useState('5');
  const [tingkatHots, setTingkatHots] = useState('Sedang & HOTS');

  const [isLoading, setIsLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async () => {
    if (!topik.trim()) return;
    setIsLoading(true);
    setGeneratedResult(null);

    const promptText = `Buatkan Paket Soal Ujian / Latihan Lengkap dengan Kunci Jawaban & Pembahasan untuk Guru:
Mata Pelajaran: ${mapel}
Tingkat / Fase: ${kelas}
Topik / Materi Spesifik: ${topik}
Tipe Soal: ${jenisSoal === 'pg' ? 'Pilihan Ganda (A, B, C, D)' : jenisSoal === 'essay' ? 'Essay / Uraian' : 'Campuran (Pilihan Ganda + Uraian)'}
Jumlah Soal: ${jumlahSoal} soal
Tingkat Kesukaran: ${tingkatHots}

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
            Buat soal latihan, Ulangan Harian, Sumatif Akhir Semester, dan soal HOTS Kurikulum Merdeka secara instan dilengkapi kunci jawaban &amp; rubrik.
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 text-amber-400 border border-white/10">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Input Parameters Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Parameter Pembuatan Soal</span>
          </h3>

          <div className="space-y-3 text-xs">
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
                rows={3}
                placeholder="misal: Operasi Perkalian dan Pembagian Bilangan Cacah..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
                  value={jumlahSoal}
                  onChange={e => setJumlahSoal(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="5">5 Soal</option>
                  <option value="10">10 Soal</option>
                  <option value="15">15 Soal</option>
                  <option value="20">20 Soal</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || !topik.trim()}
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
                  <span>Generasi Soal Ujian Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Viewer Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Hasil Generasi Soal</span>
            </h3>

            {generatedResult && (
              <div className="flex items-center gap-2">
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

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center animate-bounce">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  AI sedang menyusun daftar soal, opsi jawaban, dan rubrik penilaian...
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
                  Isi parameter di sebelah kiri lalu klik <strong className="text-indigo-600 dark:text-indigo-400">Generasi Soal Ujian Sekarang</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
