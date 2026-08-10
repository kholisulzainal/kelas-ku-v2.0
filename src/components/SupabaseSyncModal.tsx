import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Save, 
  Check, 
  X, 
  Shield, 
  Info, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  resetSupabaseInstance, 
  getSupabaseClient, 
  syncAllToSupabase, 
  pullAllFromSupabase,
  MIGRATION_SQL,
  SyncResults 
} from '../services/supabase';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseSyncModal({ isOpen, onClose }: SupabaseSyncModalProps) {
  const [config, setConfig] = useState(getSupabaseConfig());
  const [urlInput, setUrlInput] = useState(config.url);
  const [keyInput, setKeyInput] = useState(config.anonKey);
  
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'success' | 'failed' | 'empty'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; results?: SyncResults; error?: string } | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState<{ success: boolean; error?: string } | null>(null);
  
  const [isCopied, setIsCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);

  // Test the current connection
  const testConnection = async () => {
    const currentConfig = getSupabaseConfig();
    if (!currentConfig.url || !currentConfig.anonKey) {
      setConnectionStatus('empty');
      return;
    }

    setConnectionStatus('checking');
    setConnectionError(null);

    try {
      const client = getSupabaseClient();
      if (!client) {
        setConnectionStatus('failed');
        setConnectionError('Gagal menginisialisasi client Supabase.');
        return;
      }

      // Try reading from a basic table to confirm connection
      const { data, error } = await client.from('profil_sekolah').select('id').limit(1);
      
      if (error) {
        // If the error is table not found, connection is fine but schema is missing
        if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Could not find the table')) {
          setConnectionStatus('success');
          setConnectionError('Koneksi berhasil ke Supabase, namun tabel belum dibuat. Harap salin dan jalankan Script SQL Migrasi di bawah ini pada SQL Editor Supabase!');
        } else if (error.code === '42501' || error.message.includes('row-level security policy')) {
          setConnectionStatus('success');
          setConnectionError('Koneksi berhasil, namun Row Level Security (RLS) aktif di Supabase. Jalankan Script SQL Migrasi di bawah di Supabase SQL Editor untuk memberikan izin akses!');
        } else {
          setConnectionStatus('failed');
          setConnectionError(error.message || 'Error saat mengakses database.');
        }
      } else {
        setConnectionStatus('success');
        setConnectionError(null);
      }
    } catch (err: any) {
      setConnectionStatus('failed');
      setConnectionError(err?.message || 'Gagal terhubung dengan server database.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      const currentConfig = getSupabaseConfig();
      setConfig(currentConfig);
      setUrlInput(currentConfig.url);
      setKeyInput(currentConfig.anonKey);
      testConnection();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig({
      url: urlInput.trim(),
      anonKey: keyInput.trim()
    });
    resetSupabaseInstance();
    setConfig(getSupabaseConfig());
    
    // Test connection with new config
    setTimeout(() => {
      testConnection();
    }, 100);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await syncAllToSupabase();
      setSyncStatus(res);
      // Retest connection to see updated results
      testConnection();
    } catch (err: any) {
      setSyncStatus({
        success: false,
        error: err?.message || 'Terjadi kesalahan saat sinkronisasi data.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullAll = async () => {
    setIsPulling(true);
    setPullStatus(null);
    try {
      const res = await pullAllFromSupabase();
      setPullStatus(res);
      if (res.success) {
        // Automatically reload the page after 2 seconds to refresh UI with new local database state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      setPullStatus({
        success: false,
        error: err?.message || 'Terjadi kesalahan saat mengunduh data.'
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isConfiguredFromEnv = 
    !localStorage.getItem('supabase_project_url') && 
    (((import.meta as any).env?.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL || (process.env.APP_URL && process.env.APP_URL.includes('supabase.co')));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight">
                Integrasi Database Supabase
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                Sinkronkan data pengelolaan kelas langsung ke cloud database Supabase Anda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Status Banner */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start gap-3.5 ${
            connectionStatus === 'success' 
              ? connectionError 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : connectionStatus === 'checking'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-800 dark:text-indigo-200'
              : connectionStatus === 'empty'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200'
          }`}>
            <div className="shrink-0 mt-0.5">
              {connectionStatus === 'success' ? (
                connectionError ? <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : connectionStatus === 'checking' ? (
                <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
              ) : connectionStatus === 'empty' ? (
                <HelpCircle className="w-5 h-5 text-slate-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Status Koneksi Supabase: {
                  connectionStatus === 'success' ? (connectionError ? 'Perlu Tindakan' : 'Terhubung') :
                  connectionStatus === 'checking' ? 'Memeriksa...' :
                  connectionStatus === 'empty' ? 'Belum Dikonfigurasi' : 'Koneksi Gagal'
                }
              </h4>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {connectionStatus === 'success' && !connectionError && 'Koneksi ke database Supabase aktif dan berfungsi penuh! Data yang Anda ubah akan otomatis disinkronkan ke cloud.'}
                {connectionStatus === 'success' && connectionError && connectionError}
                {connectionStatus === 'checking' && 'Sedang mengetes respon server Supabase dan mengecek schema tabel...'}
                {connectionStatus === 'empty' && 'Aplikasi belum terhubung dengan database Supabase. Hubungkan sekarang untuk menyimpan data secara aman di awan (cloud) sehingga data tidak hilang saat browser dibersihkan.'}
                {connectionStatus === 'failed' && (connectionError || 'Tidak dapat terhubung ke Supabase. Periksa kembali URL dan API Key Anda.')}
              </p>
              
              {connectionStatus !== 'empty' && (
                <div className="flex items-center gap-4 pt-1.5">
                  <button
                    onClick={testConnection}
                    disabled={connectionStatus === 'checking'}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Tes Ulang Koneksi
                  </button>
                  {isConfiguredFromEnv && (
                    <span className="text-[10px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                      Otomatis Terbaca dari .env
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              <Info className="w-4 h-4 text-m3-purple" /> Petunjuk Sinkronisasi Supabase
            </h4>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
              <div className="flex gap-2.5">
                <span className="flex items-center justify-center bg-m3-purple text-white text-[10px] font-bold w-5 h-5 rounded-full shrink-0">1</span>
                <p>Buat Project baru di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-m3-purple dark:text-indigo-400 font-bold underline hover:text-indigo-500">Supabase Console <ExternalLink className="inline w-3 h-3 mb-0.5" /></a>.</p>
              </div>
              <div className="flex gap-2.5">
                <span className="flex items-center justify-center bg-m3-purple text-white text-[10px] font-bold w-5 h-5 rounded-full shrink-0">2</span>
                <p>Buka menu <b>SQL Editor</b> di dashboard Supabase Anda, klik <b>"New query"</b>, lalu salin dan jalankan script SQL tabel yang kami sediakan di bagian bawah panel ini.</p>
              </div>
              <div className="flex gap-2.5">
                <span className="flex items-center justify-center bg-m3-purple text-white text-[10px] font-bold w-5 h-5 rounded-full shrink-0">3</span>
                <p>Masukkan <b>Project URL</b> dan <b>Anon API Key</b> di form di bawah ini (atau letakkan di file <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">.env</code> Anda), lalu klik <b>Simpan</b>.</p>
              </div>
              <div className="flex gap-2.5">
                <span className="flex items-center justify-center bg-m3-purple text-white text-[10px] font-bold w-5 h-5 rounded-full shrink-0">4</span>
                <p>Terakhir, klik tombol <b>"SINKRONISASI SEMUA DATA SEKARANG"</b> di bawah untuk mengunggah seluruh data yang saat ini tersimpan di memori lokal laptop/HP Anda ke Supabase!</p>
              </div>
            </div>
          </div>

          {/* Config Form */}
          <form onSubmit={handleSaveConfig} className="space-y-4 border-t border-slate-100 dark:border-slate-800/60 pt-5">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
              Form Konfigurasi Kredensial
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">SUPABASE_PROJECT_URL</label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-m3-purple/20 focus:bg-white outline-none text-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">SUPABASE_ANON_KEY</label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ik..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-m3-purple/20 focus:bg-white outline-none text-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] sm:text-xs rounded-xl cursor-pointer shadow-sm transition-colors"
              >
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Simpan Kredensial
              </button>
            </div>
          </form>

          {/* Sync Trigger Section */}
          <div className="space-y-6 border-t border-slate-100 dark:border-slate-800/60 pt-5">
            {/* Upload Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Unggah Semua Data Lokal ke Supabase
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Kirim seluruh data lokal saat ini (Siswa, Absensi, Nilai, Guru) ke database Supabase Anda.
                </p>
                {connectionStatus !== 'success' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold mt-1">
                    {connectionStatus === 'empty' 
                      ? '⚠️ Silakan simpan kredensial Supabase Anda di bawah agar tombol sinkron aktif.'
                      : '⚠️ Catatan: Status koneksi belum sepenuhnya berhasil. Anda masih dapat mencoba sinkronisasi.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={isSyncing || isPulling || connectionStatus === 'empty' || connectionStatus === 'checking'}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0 hover:scale-[1.02] active:scale-95 disabled:pointer-events-none"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    <span>Menyinkronkan...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Kirim ke Supabase</span>
                  </>
                )}
              </button>
            </div>

            {/* Download/Pull Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/40 pt-4">
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Unduh Semua Data dari Supabase
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Ambil semua data yang ada di Supabase dan timpa memori lokal aplikasi ini. Berguna jika Anda ingin memunculkan data dari Supabase ke aplikasi ini.
                </p>
                {connectionStatus !== 'success' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold mt-1">
                    {connectionStatus === 'empty' 
                      ? '⚠️ Silakan simpan kredensial Supabase Anda di bawah agar tombol unduh aktif.'
                      : '⚠️ Catatan: Status koneksi belum sepenuhnya berhasil.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePullAll}
                disabled={isSyncing || isPulling || connectionStatus === 'empty' || connectionStatus === 'checking'}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0 hover:scale-[1.02] active:scale-95 disabled:pointer-events-none"
              >
                {isPulling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    <span>Mengunduh...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Unduh dari Supabase</span>
                  </>
                )}
              </button>
            </div>

            {/* Pull Status Display */}
            {pullStatus && (
              <div className={`p-4 rounded-2xl border ${
                pullStatus.success 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  {pullStatus.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                  <h5 className="text-xs font-extrabold uppercase">
                    {pullStatus.success ? 'Data Berhasil Diunduh!' : 'Gagal Mengunduh Data'}
                  </h5>
                </div>
                <p className="text-xs mt-1 leading-normal">
                  {pullStatus.success 
                    ? 'Seluruh data berhasil disinkronkan ke dalam aplikasi. Aplikasi akan dimuat ulang otomatis dalam 2 detik...' 
                    : pullStatus.error}
                </p>
              </div>
            )}

              {/* Sync Results Display */}
              {syncStatus && (
                <div className={`p-4 rounded-2xl border ${
                  syncStatus.success 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {syncStatus.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    <h5 className="text-xs font-extrabold uppercase">
                      {syncStatus.success ? 'Sinkronisasi Selesai Sukses!' : 'Sinkronisasi Selesai dengan Hambatan'}
                    </h5>
                  </div>
                  
                  {syncStatus.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mb-2">{syncStatus.error}</p>
                  )}

                  {syncStatus.results && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        {Object.entries(syncStatus.results).map(([table, counts]) => {
                          const c = counts as { success: number; failed: number; total: number; skipped?: number; errors?: string[] };
                          return (
                            <div key={table} className="flex justify-between border-b border-slate-50 dark:border-slate-900 pb-1 pt-1">
                              <span className="text-slate-500 capitalize">{table.replace('_', ' ')}:</span>
                              <span className="font-mono font-bold flex items-center gap-1">
                                {c.success}/{c.total} 
                                {c.skipped && c.skipped > 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold" title={`${c.skipped} data dihemat (Delta Sync)`}>
                                    ({c.skipped}Δ)
                                  </span>
                                ) : null}
                                {c.failed > 0 && <span className="text-red-500 ml-1">({c.failed} gagal)</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Delta Sync Efficiency Summary */}
                      {(() => {
                        const resultsArray = Object.values(syncStatus.results || {}) as any[];
                        const totalItems = resultsArray.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);
                        const totalSkipped = resultsArray.reduce((acc: number, curr: any) => acc + (curr.skipped || 0), 0);
                        const efficiencyPercent = totalItems > 0 ? Math.round((totalSkipped / totalItems) * 100) : 0;
                        
                        if (totalItems === 0) return null;
                        
                        return (
                          <div className="text-[10px] bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                            <span>⚡ <strong>Delta Sync:</strong> Hanya mengirim data yang berubah saja.</span>
                            <span className="font-bold font-mono">
                              Hemat {efficiencyPercent}% Bandwidth ({totalSkipped}/{totalItems} data dilewati)
                            </span>
                          </div>
                        );
                      })()}

                      {/* Detailed Errors by Table */}
                      {Object.entries(syncStatus.results).some(([_, counts]) => (counts as any).errors?.length > 0) && (
                        <div className="text-[10px] bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 p-3 rounded-xl border border-red-100 dark:border-red-950/40 space-y-1 max-h-32 overflow-y-auto">
                          <p className="font-bold uppercase tracking-wider text-[9px]">Detail Hambatan API / Schema:</p>
                          {Object.entries(syncStatus.results).map(([table, counts]) => {
                            const c = counts as { errors?: string[] };
                            if (!c.errors || c.errors.length === 0) return null;
                            return (
                              <div key={table} className="leading-normal">
                                <span className="font-bold capitalize">{table.replace('_', ' ')}</span>: {c.errors.join(', ')}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* SQL Editor Code Panel */}
          <div className="border-t border-slate-100 dark:border-slate-800/60 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-500" /> SQL Script Inisialisasi Tabel
              </h4>
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="text-[10px] font-bold text-m3-purple hover:underline cursor-pointer"
              >
                {showSql ? 'Sembunyikan' : 'Tampilkan Script SQL'}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Gunakan script di bawah untuk membuat seluruh tabel yang diperlukan di database Supabase Anda. Copy-paste ke menu <b>SQL Editor</b> di Supabase, lalu jalankan.
            </p>

            {(showSql || connectionStatus === 'success' && connectionError) && (
              <div className="relative border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-950 text-slate-100 font-mono text-[10px] flex flex-col max-h-56">
                <div className="flex items-center justify-between bg-slate-900 px-4 py-2 border-b border-slate-800 text-slate-400 text-[9px] font-bold uppercase shrink-0">
                  <span>Supabase Migration.sql</span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Tersalin!' : 'Salin Script'}</span>
                  </button>
                </div>
                <pre className="p-4 overflow-auto flex-1 whitespace-pre leading-relaxed select-all">
                  {MIGRATION_SQL}
                </pre>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 sm:px-5 sm:py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] sm:text-xs rounded-xl transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
}
