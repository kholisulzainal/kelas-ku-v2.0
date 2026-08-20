import React, { useState, useEffect } from 'react';
import { Bot, Key, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, ShieldCheck, Sparkles, Trash2, Eye, EyeOff } from 'lucide-react';
import { getStoredGeminiApiKey, setStoredGeminiApiKey, testGeminiApiKey } from '../services/geminiClient';

export function GeminiSettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const key = getStoredGeminiApiKey();
    setApiKey(key);
  }, []);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStoredGeminiApiKey(apiKey);
    setSaveMessage('Konfigurasi Gemini API Key berhasil disimpan di peramban (browser) Anda.');
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handleClear = () => {
    setApiKey('');
    setStoredGeminiApiKey('');
    setTestResult(null);
    setSaveMessage('API Key lokal berhasil dihapus. Aplikasi akan menggunakan environment variable server jika tersedia.');
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiApiKey(apiKey);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Gagal menguji API Key' });
    } finally {
      setIsTesting(false);
    }
  };

  const hasLocalKey = Boolean(apiKey.trim());

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100 dark:border-indigo-900/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Google Gemini AI Configuration
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                hasLocalKey 
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
              }`}>
                {hasLocalKey ? 'Custom Key Aktif' : 'Default Server'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Pengaturan API Key untuk Guru AI (AI Tutor Pedagogi, AI Generator Soal &amp; Modul Ajar).
            </p>
          </div>
        </div>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800"
        >
          <span>Dapatkan API Key Gratis di Google AI Studio</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Form Input */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-600" />
              GEMINI_API_KEY (Google AI Studio Key)
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Opsional jika sudah dipasang di Environment Variables Vercel
            </span>
          </label>

          <div className="relative flex items-center">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Contoh: AIzaSy..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-20 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                title={showKey ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            💡 API Key ini disimpan secara aman di peramban lokal perangkat Anda dan otomatis dikirimkan ke endpoint Guru AI.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Simpan API Key
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition-all border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi AI'}
          </button>

          {hasLocalKey && (
            <button
              type="button"
              onClick={handleClear}
              className="text-rose-600 hover:text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Key Lokal
            </button>
          )}
        </div>
      </form>

      {/* Test Result Message */}
      {testResult && (
        <div
          className={`p-3 rounded-2xl text-xs font-medium flex items-start gap-2 border ${
            testResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{testResult.message}</span>
        </div>
      )}

      {/* Save Success Message */}
      {saveMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Deployment & Environment Variable Guide */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Panduan Deployment Vercel (Production):
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          Agar Guru AI dapat digunakan langsung oleh semua guru tanpa perlu memasukkan API Key di setiap perangkat:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400 pl-1 leading-relaxed">
          <li>Buka dashboard Vercel Anda di <strong>vercel.com</strong> &gt; Pilih proyek <strong>Kelas Ku</strong>.</li>
          <li>Klik menu <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
          <li>Tambahkan Key: <code>GEMINI_API_KEY</code> dengan Value dari Google AI Studio.</li>
          <li>Klik <strong>Save</strong> lalu lakukan <strong>Redeploy</strong> proyek Anda.</li>
        </ol>
      </div>
    </div>
  );
}
