import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Save,
  Check,
  Radio,
  ExternalLink,
  Shield,
  UploadCloud,
  DownloadCloud,
  Unplug,
  Zap,
  Info,
  Sliders,
  Sparkles
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
import { startRealtimeSync } from '../services/realtimeSync';

export function SupabaseSettingsTab() {
  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'sql'>('sync');
  const [config, setConfig] = useState(getSupabaseConfig());
  const [urlInput, setUrlInput] = useState(config.url);
  const [keyInput, setKeyInput] = useState(config.anonKey);

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'success' | 'failed' | 'empty'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; results?: SyncResults; error?: string } | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState<{ success: boolean; details?: Record<string, number>; error?: string } | null>(null);

  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeCleaner, setRealtimeCleaner] = useState<(() => void) | null>(null);
  const [realtimeStatusMsg, setRealtimeStatusMsg] = useState<string | null>(null);

  const [isCopied, setIsCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const isConfigured = Boolean(config.url && config.anonKey);

  // Test the current connection
  const testConnection = async () => {
    const currentConfig = getSupabaseConfig();
    if (!currentConfig.url || !currentConfig.anonKey) {
      setConnectionStatus('empty');
      setLatencyMs(null);
      return;
    }

    setConnectionStatus('checking');
    setConnectionError(null);
    const startT = performance.now();

    try {
      const client = getSupabaseClient();
      if (!client) {
        setConnectionStatus('failed');
        setConnectionError('Gagal menginisialisasi client Supabase.');
        return;
      }

      // Try reading from a basic table to confirm connection
      const { data, error } = await client.from('profil_sekolah').select('id').limit(1);
      const elapsed = Math.round(performance.now() - startT);
      setLatencyMs(elapsed);

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('Could not find the table')) {
          setConnectionStatus('success');
          setConnectionError('Koneksi berhasil ke Supabase, namun tabel belum dibuat. Harap salin dan jalankan Script SQL Migrasi di tab SQL Script!');
        } else if (error.code === '42501' || error.message.includes('row-level security policy')) {
          setConnectionStatus('success');
          setConnectionError('Koneksi berhasil, namun Row Level Security (RLS) membatasi akses. Jalankan Script SQL Migrasi pada SQL Editor Supabase!');
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
    const currentConfig = getSupabaseConfig();
    setConfig(currentConfig);
    setUrlInput(currentConfig.url);
    setKeyInput(currentConfig.anonKey);
    testConnection();

    return () => {
      if (realtimeCleaner) {
        realtimeCleaner();
      }
    };
  }, []);

  const handleConnectOrSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = urlInput.trim();
    const cleanKey = keyInput.trim();

    if (!cleanUrl || !cleanKey) {
      alert('URL Proyek Supabase dan Anon Key wajib diisi!');
      return;
    }

    saveSupabaseConfig({
      url: cleanUrl,
      anonKey: cleanKey
    });
    resetSupabaseInstance();
    const updated = getSupabaseConfig();
    setConfig(updated);

    setSavedMsg('✅ Kredensial Supabase tersimpan. Menguji sambungan...');
    setTimeout(() => {
      testConnection();
      setTimeout(() => setSavedMsg(null), 3500);
    }, 150);
  };

  const handleDisconnect = () => {
    if (window.confirm('Putuskan koneksi (Disconnect) dari Supabase? Aplikasi akan beralih ke penyimpanan lokal (offline).')) {
      if (realtimeCleaner) {
        realtimeCleaner();
        setRealtimeCleaner(null);
      }
      setRealtimeActive(false);

      saveSupabaseConfig({ url: '', anonKey: '' });
      resetSupabaseInstance();
      setUrlInput('');
      setKeyInput('');
      const updated = getSupabaseConfig();
      setConfig(updated);
      setConnectionStatus('empty');
      setConnectionError(null);
      setLatencyMs(null);
      setSyncStatus(null);
      setPullStatus(null);
      setRealtimeStatusMsg('ℹ️ Supabase terputus (Mode Lokal Offline).');
      setSavedMsg('ℹ️ Berhasil memutuskan koneksi Supabase.');
      setTimeout(() => {
        setSavedMsg(null);
        setRealtimeStatusMsg(null);
      }, 3500);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await syncAllToSupabase();
      setSyncStatus(res);
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
        setTimeout(() => {
          window.location.reload();
        }, 1800);
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

  const handleToggleRealtime = () => {
    if (realtimeActive) {
      if (realtimeCleaner) {
        realtimeCleaner();
        setRealtimeCleaner(null);
      }
      setRealtimeActive(false);
      setRealtimeStatusMsg('ℹ️ Real-time listener Supabase dinonaktifkan.');
    } else {
      const unsub = startRealtimeSync();
      if (unsub) {
        setRealtimeCleaner(() => unsub);
        setRealtimeActive(true);
        setRealtimeStatusMsg('⚡ Live Real-time Sync Supabase aktif! Perubahan data di cloud langsung disinkronkan ke lokal.');
      } else {
        setRealtimeStatusMsg('⚠️ Pastikan koneksi Supabase telah terhubung sebelum mengaktifkan Realtime.');
      }
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Sub Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/80 dark:border-emerald-900/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">PostgreSQL Supabase Cloud</h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Database Relasional SQL &amp; Real-time Multi-Perangkat</p>
          </div>
        </div>

        <div className="flex gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sinkronisasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Kredensial URL</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>SQL Script</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SINKRONISASI */}
      {activeTab === 'sync' && (
        <div className="space-y-4 pt-1">
          {/* Connection Status Card */}
          <div className="p-3.5 rounded-2xl border bg-white/80 dark:bg-slate-900/80 border-emerald-200/60 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                <span>Endpoint Supabase:</span>
                <strong className="text-xs text-slate-900 dark:text-white font-mono px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md truncate max-w-xs">
                  {config.url || 'Belum Dikonfigurasi'}
                </strong>
                {latencyMs !== null && connectionStatus === 'success' && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                    {latencyMs} ms
                  </span>
                )}
              </div>
              {connectionError && (
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{connectionError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                id="btn_test_supabase_connection"
                onClick={testConnection}
                disabled={connectionStatus === 'checking'}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
                <span>{connectionStatus === 'checking' ? 'Mengecek...' : 'Uji Koneksi'}</span>
              </button>

              {isConfigured && connectionStatus === 'success' ? (
                <>
                  <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-extrabold rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Terkoneksi
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-extrabold rounded-xl flex items-center gap-1 border border-rose-200 dark:border-rose-900 cursor-pointer transition-all"
                  >
                    <Unplug className="w-3.5 h-3.5" /> Disconnect
                  </button>
                </>
              ) : isConfigured && connectionStatus === 'failed' ? (
                <>
                  <span className="px-3 py-1.5 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 text-[11px] font-extrabold rounded-xl flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Gagal Sambung
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Unplug className="w-3.5 h-3.5" /> Putuskan
                  </button>
                </>
              ) : (
                <span className="px-3 py-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[11px] font-extrabold rounded-xl flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Belum Diatur
                </span>
              )}
            </div>
          </div>

          {realtimeStatusMsg && (
            <div className="p-3 bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-900 text-emerald-950 dark:text-emerald-200 text-xs rounded-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{realtimeStatusMsg}</span>
            </div>
          )}

          {/* Action Buttons: Push & Pull */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              id="btn_push_all_supabase_tab"
              onClick={handleSyncAll}
              disabled={isSyncing || isPulling || !isConfigured}
              className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex flex-col items-start gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 text-left"
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <UploadCloud className={`w-5 h-5 ${isSyncing ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <div className="font-extrabold text-sm">Kirim &amp; Sinkronkan ke Supabase (Push All)</div>
                <div className="text-[11px] text-emerald-100 font-normal mt-0.5 leading-relaxed">
                  Kirim seluruh tabel lokal (Siswa, Guru, Nilai, Tugas, Absensi) dengan efisiensi Delta Sync.
                </div>
              </div>
            </button>

            <button
              type="button"
              id="btn_pull_all_supabase_tab"
              onClick={handlePullAll}
              disabled={isSyncing || isPulling || !isConfigured}
              className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex flex-col items-start gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 border border-slate-700 text-left"
            >
              <div className="p-2 bg-white/10 rounded-xl">
                <DownloadCloud className={`w-5 h-5 ${isPulling ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <div className="font-extrabold text-sm">Unduh Semua Data dari Supabase (Pull All)</div>
                <div className="text-[11px] text-slate-300 font-normal mt-0.5 leading-relaxed">
                  Tarik seluruh data dari tabel PostgreSQL Supabase dan perbarui database lokal pada aplikasi.
                </div>
              </div>
            </button>
          </div>

          {/* Live Real-time Sync Toggle */}
          <div className="p-3.5 rounded-2xl border border-emerald-200/60 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${realtimeActive ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                <Radio className={`w-4 h-4 ${realtimeActive ? 'animate-pulse text-emerald-600' : ''}`} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Live Real-time Sync (Supabase)</div>
                <div className="text-[11px] text-slate-500">Menerima pembaruan data Postgres secara otomatis saat ada perubahan di cloud.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleRealtime}
              disabled={!isConfigured}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                realtimeActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200'
              }`}
            >
              {realtimeActive ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>

          {/* Pull Status Result */}
          {pullStatus && (
            <div className={`p-4 rounded-2xl border ${
              pullStatus.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-2">
                {pullStatus.success ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                <h5 className="text-xs font-extrabold uppercase">
                  {pullStatus.success ? 'Data Berhasil Diunduh dari Supabase!' : 'Gagal Mengunduh Data'}
                </h5>
              </div>
              <p className="text-xs mt-1 leading-normal">
                {pullStatus.success
                  ? 'Seluruh data berhasil disinkronkan ke memori lokal. Halaman akan dimuat ulang...'
                  : pullStatus.error}
              </p>
            </div>
          )}

          {/* Sync / Push Status Result */}
          {syncStatus && (
            <div className={`p-4 rounded-2xl border ${
              syncStatus.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {syncStatus.success ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                <h5 className="text-xs font-extrabold uppercase">
                  {syncStatus.success ? 'Sinkronisasi Supabase Selesai Sukses!' : 'Sinkronisasi Selesai dengan Catatan'}
                </h5>
              </div>
              
              {syncStatus.error && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">{syncStatus.error}</p>
              )}

              {syncStatus.results && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {Object.entries(syncStatus.results).map(([table, counts]) => {
                      const c = counts as { success: number; failed: number; total: number; skipped?: number };
                      return (
                        <div key={table} className="flex justify-between border-b border-slate-50 dark:border-slate-900 pb-1 pt-1">
                          <span className="text-slate-500 capitalize">{table.replace('_', ' ')}:</span>
                          <span className="font-mono font-bold flex items-center gap-1">
                            {c.success}/{c.total} 
                            {c.skipped && c.skipped > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold" title="Data tidak berubah (Delta Sync)">
                                ({c.skipped}Δ)
                              </span>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KONFIGURASI KREDENSIAL (URL & ANON KEY) */}
      {activeTab === 'config' && (
        <form onSubmit={handleConnectOrSave} className="space-y-3.5 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200/60 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Masukkan kredensial dari <strong>Supabase Dashboard</strong> (Project Settings &gt; API &gt; Project URL &amp; anon / public key):
          </p>

          {savedMsg && (
            <div className="p-3 border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                SUPABASE_PROJECT_URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                SUPABASE_ANON_KEY (Public Key) <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
            {isConfigured ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer flex items-center gap-1"
              >
                <Unplug className="w-3.5 h-3.5" /> Putuskan Koneksi
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Belum terkoneksi</span>
            )}

            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan &amp; Hubungkan</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: SQL SCRIPT & GUIDE */}
      {activeTab === 'sql' && (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200/60 dark:border-slate-700">
          <div className="space-y-2">
            <div className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600" />
              Langkah Inisialisasi Tabel di Supabase:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
              <li>Buka <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-3 h-3" /></a> lalu pilih project Anda.</li>
              <li>Buka menu <strong>SQL Editor</strong> di sidebar sebelah kiri.</li>
              <li>Klik tombol <strong>"New query"</strong>.</li>
              <li>Salin script SQL di bawah ini lalu tempel (Paste) di editor Supabase dan klik <strong>RUN</strong>.</li>
            </ol>
          </div>

          <div className="p-3 bg-slate-950 text-slate-200 rounded-xl space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 font-sans text-xs pb-1 border-b border-slate-800">
              <span>SQL Migration Script (Skema Tabel &amp; RLS Policy):</span>
              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer font-bold"
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Tersalin!' : 'Salin SQL Script'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto text-[10px] text-emerald-300 leading-relaxed max-h-64 p-2 bg-slate-900 rounded-lg">
              {MIGRATION_SQL}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
