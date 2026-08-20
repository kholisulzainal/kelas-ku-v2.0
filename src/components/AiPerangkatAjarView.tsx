import React, { useState } from 'react';
import { callAiTutor } from '../services/geminiClient';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Printer,
  FileText,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Layers
} from 'lucide-react';

export function AiPerangkatAjarView() {
  const [mapel, setMapel] = useState('IPAS (Ilmu Pengetahuan Alam dan Sosial)');
  const [kelas, setKelas] = useState('Kelas 4 / Fase B');
  const [topik, setTopik] = useState('Wujud Zat dan Perubahannya (Padat, Cair, Gas)');
  const [modelBelajar, setModelBelajar] = useState('Problem-Based Learning (PBL)');
  const [alokasiWaktu, setAlokasiWaktu] = useState('2 x 35 Menit (1 Pertemuan)');

  const [isLoading, setIsLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async () => {
    if (!topik.trim()) return;
    setIsLoading(true);
    setGeneratedResult(null);

    const promptText = `Buatkan Modul Ajar / Perangkat Ajar Kurikulum Merdeka Lengkap & Siap Pakai:
Mata Pelajaran: ${mapel}
Fase / Kelas: ${kelas}
Topik / Elemen: ${topik}
Model Pembelajaran: ${modelBelajar}
Alokasi Waktu: ${alokasiWaktu}

Sertakan struktur baku Kurikulum Merdeka dalam format Markdown rapi:
1. **INFORMASI UMUM**: Identitas Modul, Profil Pelajar Pancasila (P3), Sarana & Prasarana.
2. **KOMPONEN INTI**:
   - Tujuan Pembelajaran (TP)
   - Pemahaman Bermakna & Pertanyaan Pemantik
   - Kegiatan Pembelajaran (Pendahuluan, Inti sesuai Sintaks ${modelBelajar}, Penutup)
3. **LAMPIRAN**:
   - Asesmen Formatif / Sumatif
   - Lembar Kerja Peserta Didik (LKPD) Singkat
   - Pengayaan & Remedial`;

    try {
      const data = await callAiTutor({ prompt: promptText, history: [] });
      if (data.success && data.reply) {
        setGeneratedResult(data.reply);
      } else {
        setGeneratedResult(`⚠️ Gagal menyusun perangkat ajar: ${data.error || 'Terjadi masalah pada server AI. Pastikan Gemini API Key telah dikonfigurasi.'}`);
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
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-400/20 text-emerald-300 rounded-full text-xs font-extrabold border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Modul Ajar &amp; RPP Kurikulum Merdeka</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            AI Generator Perangkat Ajar &amp; Modul
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
            Susun Modul Ajar lengkap dengan Tujuan Pembelajaran, Pertanyaan Pemantik, Langkah Sintaks Pembelajaran, Asesmen &amp; LKPD secara otomatis.
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 text-emerald-300 border border-white/10">
          <FileText className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form Input */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Spesifikasi Modul Ajar</span>
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
                placeholder="misal: IPAS, Bahasa Indonesia, Pendidikan Pancasila"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas / Fase
                </label>
                <select
                  value={kelas}
                  onChange={e => setKelas(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Kelas 1 / Fase A">Kelas 1 / Fase A</option>
                  <option value="Kelas 2 / Fase A">Kelas 2 / Fase A</option>
                  <option value="Kelas 3 / Fase B">Kelas 3 / Fase B</option>
                  <option value="Kelas 4 / Fase B">Kelas 4 / Fase B</option>
                  <option value="Kelas 5 / Fase C">Kelas 5 / Fase C</option>
                  <option value="Kelas 6 / Fase C">Kelas 6 / Fase C</option>
                  <option value="SMP / Fase D">SMP / Fase D</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alokasi Waktu
                </label>
                <input
                  type="text"
                  value={alokasiWaktu}
                  onChange={e => setAlokasiWaktu(e.target.value)}
                  placeholder="2 x 35 Menit"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Model Pembelajaran
              </label>
              <select
                value={modelBelajar}
                onChange={e => setModelBelajar(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Problem-Based Learning (PBL)">Problem-Based Learning (PBL)</option>
                <option value="Project-Based Learning (PjBL)">Project-Based Learning (PjBL)</option>
                <option value="Inquiry / Discovery Learning">Inquiry / Discovery Learning</option>
                <option value="Cooperative Learning">Cooperative Learning</option>
                <option value="Diferensiasi Proses & Produk">Diferensiasi Proses &amp; Produk</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Materi / Topik Utama
              </label>
              <textarea
                value={topik}
                onChange={e => setTopik(e.target.value)}
                rows={3}
                placeholder="misal: Mengenal Pancasila sebagai Pandangan Hidup..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || !topik.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini AI Sedang Menyusun Modul Ajar...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Susun Modul Ajar Sekarang</span>
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
              <span>Dokumen Modul Ajar</span>
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
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  AI sedang merumuskan Langkah Kegiatan, LKPD, dan Asesmen Kurikulum Merdeka...
                </p>
                <p className="text-xs text-slate-400">
                  Mohon tunggu beberapa saat.
                </p>
              </div>
            ) : generatedResult ? (
              <div className="whitespace-pre-wrap space-y-2">
                {generatedResult}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                <HelpCircle className="w-10 h-10 opacity-40 text-emerald-500" />
                <p className="font-semibold text-xs">
                  Isi informasi di sebelah kiri lalu klik <strong className="text-emerald-600 dark:text-emerald-400">Susun Modul Ajar Sekarang</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
