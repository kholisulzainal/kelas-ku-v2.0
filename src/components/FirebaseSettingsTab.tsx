import React, { useState, useEffect } from 'react';
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  DownloadCloud,
  Settings,
  Database,
  Radio,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Info,
  RefreshCw,
  Loader2,
  Unplug
} from 'lucide-react';
import {
  pushAllToFirebase,
  pullAllFromFirebase,
  isFirebaseConfigured,
  getStoredFirebaseConfig,
  startFirebaseRealtimeSync,
  stopFirebaseRealtimeSync,
  testFirebaseConnection,
  isFirebaseRealtimeEnabled,
  setFirebaseRealtimeEnabled
} from '../services/firebase';
import {
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
  FirebaseCustomConfig
} from '../services/firebaseClient';

export function FirebaseSettingsTab() {
  const [activeSection, setActiveSection] = useState<'sync' | 'config' | 'guide'>('sync');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; message: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncDetails, setSyncDetails] = useState<Record<string, number> | null>(null);
  const [realtimeActive, setRealtimeActive] = useState<boolean>(() => isFirebaseRealtimeEnabled() && isFirebaseConfigured());

  // Form input state
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [appId, setAppId] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [copiedRules, setCopiedRules] = useState(false);

  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    const handleStatusChange = (e: any) => {
      const isEnabled = e?.detail?.enabled ?? isFirebaseRealtimeEnabled();
      setRealtimeActive(isEnabled && isFirebaseConfigured());
    };
    window.addEventListener('firebase-realtime-status-changed', handleStatusChange);
    return () => window.removeEventListener('firebase-realtime-status-changed', handleStatusChange);
  }, []);

  useEffect(() => {
    const custom = getStoredFirebaseConfig();
    if (custom && custom.projectId) {
      setApiKey(custom.apiKey || '');
      setProjectId(custom.projectId || '');
      setAppId(custom.appId || '');
      setAuthDomain(custom.authDomain || '');
      setStorageBucket(custom.storageBucket || '');
      setMessagingSenderId(custom.messagingSenderId || '');
    } else {
      setApiKey('');
      setProjectId('');
      setAppId('');
      setAuthDomain('');
      setStorageBucket('');
      setMessagingSenderId('');
    }
  }, []);

  const handlePushAll = async () => {
    setIsPushing(true);
    setSyncStatus('Sedang mengunggah seluruh data ke Cloud Firestore...');
    setSyncDetails(null);

    try {
      const res = await pushAllToFirebase();
      if (res.success) {
        setSyncStatus('✅ Berhasil mengunggah semua data lokal ke Cloud Firestore!');
        setSyncDetails(res.details);
      } else {
        setSyncStatus(`❌ Gagal mengunggah: ${res.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setSyncStatus(`❌ Error: ${err?.message || 'Gagal koneksi ke Firestore'}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullAll = async () => {
    setIsPulling(true);
    setSyncStatus('⏳ Sedang mengunduh seluruh data dari Cloud Firestore...');
    setSyncDetails(null);

    try {
      const res = await pullAllFromFirebase();
      if (res.success) {
        const totalItems = Object.values(res.details || {}).reduce((acc, curr) => acc + curr, 0);
        setSyncStatus(`✅ Berhasil mengunduh dan memperbarui database lokal! (Total ${totalItems} data tersinkronisasi)`);
        setSyncDetails(res.details);
      } else {
        setSyncStatus(`❌ Gagal mengunduh: ${res.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setSyncStatus(`❌ Error: ${err?.message || 'Gagal koneksi ke Firestore'}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSyncStatus('⏳ Sedang menguji koneksi ke Firestore...');
    try {
      const res = await testFirebaseConnection();
      setTestResult(res);
      if (res.success) {
        setSyncStatus(`✅ ${res.message}`);
      } else {
        setSyncStatus(`❌ ${res.message}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Gagal menguji koneksi' });
      setSyncStatus(`❌ ${err?.message || 'Gagal menguji koneksi'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleRealtime = () => {
    const nextState = !realtimeActive;
    setRealtimeActive(nextState);
    setFirebaseRealtimeEnabled(nextState);

    if (!nextState) {
      stopFirebaseRealtimeSync();
      setSyncStatus('ℹ️ Real-time listener Firebase dinonaktifkan.');
    } else {
      startFirebaseRealtimeSync(() => {
        setSyncStatus('⚡ Perubahan data diterima dari Cloud Firestore (Real-time).');
      });
      setSyncStatus('⚡ Real-time sync Firebase aktif! Setiap pembaruan langsung disinkronkan.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanProjectId = projectId.trim();
    if (!cleanProjectId) {
      alert('Project ID Firebase wajib diisi!');
      return;
    }

    setIsTesting(true);
    setSavedMsg('⏳ Menyimpan konfigurasi dan menguji sambungan Firestore...');
    setTestResult(null);

    const config: FirebaseCustomConfig = {
      apiKey: apiKey.trim(),
      projectId: cleanProjectId,
      appId: appId.trim(),
      authDomain: authDomain.trim() || `${cleanProjectId}.firebaseapp.com`,
      storageBucket: storageBucket.trim() || `${cleanProjectId}.appspot.com`,
      messagingSenderId: messagingSenderId.trim()
    };

    try {
      await saveCustomFirebaseConfig(config);
      const res = await testFirebaseConnection();
      setTestResult(res);
      if (res.success) {
        setSavedMsg(`✅ Berhasil Tersambung ke Firestore (${res.latencyMs} ms)`);
      } else {
        setSavedMsg(`⚠️ Disimpan, namun uji koneksi gagal: ${res.message}`);
      }
    } catch (err: any) {
      setSavedMsg(`❌ Gagal: ${err?.message || 'Terjadi kesalahan saat menguji koneksi'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('Putuskan koneksi (Disconnect) dari Firebase? Aplikasi akan beralih ke penyimpanan lokal (offline).')) {
      if (realtimeActive) {
        stopFirebaseRealtimeSync();
        setRealtimeActive(false);
      }
      await clearCustomFirebaseConfig();
      setApiKey('');
      setProjectId('');
      setAppId('');
      setAuthDomain('');
      setStorageBucket('');
      setMessagingSenderId('');
      setSavedMsg('ℹ️ Berhasil memutuskan koneksi Firebase.');
      setTestResult(null);
      setSyncDetails(null);
      setSyncStatus('ℹ️ Firebase terputus (Mode Lokal Offline).');
      setTimeout(() => {
        setSavedMsg('');
        setSyncStatus(null);
      }, 3500);
    }
  };

  const handleCopyRules = () => {
    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;
    navigator.clipboard.writeText(rules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Sub Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 dark:border-amber-900/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
            <Flame className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Cloud Firebase Firestore</h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Database Real-time Google Cloud untuk sinkronisasi multi-perangkat</p>
          </div>
        </div>

        <div className="flex gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-amber-200/80 dark:border-amber-800/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('sync')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'sync'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-amber-600'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Sinkronisasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('config')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'config'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-amber-600'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Konfigurasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('guide')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'guide'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-amber-600'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Panduan</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: SYNC & STATUS */}
      {activeSection === 'sync' && (
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-2xl border bg-white/80 dark:bg-slate-900/80 border-amber-200/60 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                <span>Database Proyek:</span>
                <strong className="text-xs text-slate-900 dark:text-white font-mono px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md">
                  {projectId || 'Belum Diatur'}
                </strong>
                {testResult?.latencyMs && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                    {testResult.latencyMs} ms
                  </span>
                )}
              </div>
              {testResult && (
                <div className={`text-xs font-bold flex items-center gap-1.5 ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                id="btn_test_firebase_connection"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Mengecek...' : 'Uji Koneksi'}</span>
              </button>

              {isConfigured ? (
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
              ) : (
                <span className="px-3 py-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[11px] font-extrabold rounded-xl flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Belum Diatur
                </span>
              )}
            </div>
          </div>

          {syncStatus && (
            <div className="p-3.5 bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-900 text-amber-950 dark:text-amber-200 text-xs rounded-2xl font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Sync Actions: Push & Pull */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              id="btn_push_all_firebase_tab"
              onClick={handlePushAll}
              disabled={isPushing || isPulling || !isConfigured}
              className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs flex flex-col items-start gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 text-left"
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <UploadCloud className={`w-5 h-5 ${isPushing ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <div className="font-extrabold text-sm">Unggah Semua Data ke Firebase (Push All)</div>
                <div className="text-[11px] text-amber-100 font-normal mt-0.5 leading-relaxed">
                  Kirim seluruh data lokal (Siswa, Guru, Nilai, Tugas, Absensi) langsung ke koleksi Cloud Firestore.
                </div>
              </div>
            </button>

            <button
              type="button"
              id="btn_pull_all_firebase_tab"
              onClick={handlePullAll}
              disabled={isPushing || isPulling || !isConfigured}
              className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex flex-col items-start gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 border border-slate-700 text-left"
            >
              <div className="p-2 bg-white/10 rounded-xl">
                <DownloadCloud className={`w-5 h-5 ${isPulling ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <div className="font-extrabold text-sm">Unduh Semua Data dari Firebase (Pull All)</div>
                <div className="text-[11px] text-slate-300 font-normal mt-0.5 leading-relaxed">
                  Tarik seluruh dokumen dari Cloud Firestore dan perbarui database lokal pada browser ini.
                </div>
              </div>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl border border-amber-200/60 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${realtimeActive ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                <Radio className={`w-4 h-4 ${realtimeActive ? 'animate-pulse text-emerald-600' : ''}`} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Live Real-time Sync (Firebase)</div>
                <div className="text-[11px] text-slate-500">Menerima pembaruan data secara langsung saat ada perubahan di cloud.</div>
              </div>
            </div>
            <button
              type="button"
              disabled={!isConfigured}
              onClick={handleToggleRealtime}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                realtimeActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
              }`}
            >
              {realtimeActive ? 'Nonaktifkan Realtime' : 'Aktifkan Realtime'}
            </button>
          </div>

          {/* Sync details report table */}
          {syncDetails && (
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Rincian Data Tersinkronisasi:</span>
                <span className="text-[11px] text-amber-600 font-mono">
                  Total {Object.values(syncDetails).reduce((a: number, b: number) => a + b, 0)} Baris
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                {Object.entries(syncDetails).map(([col, count]) => (
                  <div key={col} className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="capitalize text-slate-600 dark:text-slate-400 text-[11px] truncate">{col.replace(/_/g, ' ')}</span>
                    <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: CONFIGURATION */}
      {activeSection === 'config' && (
        <form onSubmit={handleSaveConfig} className="space-y-4 pt-1">
          <div className="p-4 rounded-2xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Tips Konfigurasi Mandiri:</strong> Cukup masukkan <strong>Project ID</strong> dan <strong>Web API Key</strong> dari Firebase Console Anda. Data disimpan secara aman di peramban (browser) Anda.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Firebase Project ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="misal: kelasku-cloud-app"
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">Ditemukan di Project Settings &gt; General di Firebase Console</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Web API Key (Opsional / Direkomendasikan)
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="misal: AIzaSy..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">Web API Key dari Project Settings Firebase</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                App ID (Opsional)
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="misal: 1:1234567890:web:abcdef..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Auth Domain (Opsional)
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="misal: project-id.firebaseapp.com"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {savedMsg && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300">
              {savedMsg}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={isTesting}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Simpan &amp; Hubungkan Firebase</span>
            </button>

            {isConfigured && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Unplug className="w-4 h-4" />
                <span>Disconnect (Putuskan Koneksi)</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* SECTION 3: GUIDE & SECURITY RULES */}
      {activeSection === 'guide' && (
        <div className="space-y-4 pt-1">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">1</span>
              Langkah Membuat Firestore Database di Firebase Console
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600 dark:text-slate-300 pl-2 leading-relaxed">
              <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-amber-600 underline font-bold">Firebase Console</a> lalu buat Proyek Baru atau pilih proyek Anda.</li>
              <li>Di menu kiri, pilih menu <strong>Build &gt; Firestore Database</strong>.</li>
              <li>Klik tombol <strong>Create Database</strong>, pilih lokasi server (misal: <em>asia-southeast2 (Jakarta)</em>), lalu klik Next.</li>
              <li>Pilih mode <strong>Start in test mode</strong> atau production mode, lalu klik <strong>Create</strong>.</li>
            </ol>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">2</span>
                Pengaturan Security Rules (Izin Akses Baca/Tulis)
              </h4>
              <button
                type="button"
                onClick={handleCopyRules}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1 cursor-pointer"
              >
                {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRules ? 'Tersalin!' : 'Salin Rules'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Buka tab <strong>Rules</strong> di Firestore Database Firebase Console, ganti aturan dengan kode berikut, lalu klik <strong>Publish</strong>:
            </p>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
