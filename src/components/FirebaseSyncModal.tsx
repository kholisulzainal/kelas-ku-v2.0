import React, { useState, useEffect } from 'react';
import {
  X,
  Flame,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  Settings,
  Database,
  Radio,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Info,
  Loader2
} from 'lucide-react';
import {
  pushAllToFirebase,
  pullAllFromFirebase,
  isFirebaseConfigured,
  getStoredFirebaseConfig,
  startFirebaseRealtimeSync,
  stopFirebaseRealtimeSync,
  testFirebaseConnection
} from '../services/firebase';
import {
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
  FirebaseCustomConfig
} from '../services/firebaseClient';

interface FirebaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FirebaseSyncModal({ isOpen, onClose }: FirebaseSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'tutorial'>('sync');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; message: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncDetails, setSyncDetails] = useState<Record<string, number> | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);

  // Custom Firebase Form state
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [appId, setAppId] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [configSavedMsg, setConfigSavedMsg] = useState('');
  const [copiedRule, setCopiedRule] = useState(false);

  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    if (isOpen) {
      const custom = getStoredFirebaseConfig();
      if (custom) {
        setApiKey(custom.apiKey || '');
        setProjectId(custom.projectId || '');
        setAppId(custom.appId || '');
        setAuthDomain(custom.authDomain || '');
        setStorageBucket(custom.storageBucket || '');
        setMessagingSenderId(custom.messagingSenderId || '');
      } else {
        setProjectId(import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kelasku-cloud');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      setSyncStatus(`❌ ${err?.message || 'Gagal koneksi'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleRealtime = () => {
    if (realtimeActive) {
      stopFirebaseRealtimeSync();
      setRealtimeActive(false);
      setSyncStatus('ℹ️ Real-time listener Firebase dinonaktifkan.');
    } else {
      startFirebaseRealtimeSync(() => {
        setSyncStatus('⚡ Perubahan data diterima dari Cloud Firestore (Real-time).');
      });
      setRealtimeActive(true);
      setSyncStatus('⚡ Real-time sync Firebase aktif! Setiap perubahan akan langsung disinkronkan.');
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
    setConfigSavedMsg('⏳ Menyimpan konfigurasi dan menguji sambungan Firestore...');
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
        setConfigSavedMsg(`✅ Berhasil Tersambung ke Firestore (${res.latencyMs} ms)`);
      } else {
        setConfigSavedMsg(`⚠️ Disimpan, namun uji koneksi gagal: ${res.message}`);
      }
    } catch (err: any) {
      setConfigSavedMsg(`❌ Gagal: ${err?.message || 'Terjadi kesalahan saat menguji koneksi'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetConfig = async () => {
    if (window.confirm('Hapus konfigurasi kustom Firebase dan kembali ke pengaturan bawaan?')) {
      await clearCustomFirebaseConfig();
      setApiKey('');
      setProjectId('');
      setAppId('');
      setAuthDomain('');
      setStorageBucket('');
      setMessagingSenderId('');
      setConfigSavedMsg('ℹ️ Konfigurasi kustom dihapus.');
      setTestResult(null);
      setTimeout(() => setConfigSavedMsg(''), 3000);
    }
  };

  const handleCopySecurityRules = () => {
    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;
    navigator.clipboard.writeText(rules);
    setCopiedRule(true);
    setTimeout(() => setCopiedRule(false), 2500);
  };

  return (
    <div id="firebase_modal_backdrop" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="firebase_modal_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
              <Flame className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Sinkronisasi Cloud Firebase</h3>
              <p className="text-xs text-amber-100 font-medium">Google Cloud Firestore NoSQL Database</p>
            </div>
          </div>
          <button
            id="btn_close_firebase_modal"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 pt-3 gap-2">
          <button
            id="tab_firebase_sync"
            onClick={() => setActiveTab('sync')}
            className={`pb-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'sync'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Database className="w-4 h-4" />
            Sinkronisasi &amp; Status
          </button>
          <button
            id="tab_firebase_config"
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            Konfigurasi Proyek Firebase
          </button>
          <button
            id="tab_firebase_tutorial"
            onClick={() => setActiveTab('tutorial')}
            className={`pb-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'tutorial'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Info className="w-4 h-4" />
            Panduan Buat di Firebase Console
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: SYNC & STATUS */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              
              {/* Connection Status Card */}
              <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Status Koneksi Cloud Firestore:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn_test_firebase_conn_modal"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-amber-500 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Mengecek...' : 'Uji Koneksi'}</span>
                    </button>
                    {isConfigured ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Terkoneksi &amp; Aktif
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Belum Dikonfigurasi
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Target Project ID: <strong className="text-slate-700 dark:text-slate-200">{projectId || 'Bawaan Platform'}</strong>
                </p>
                {testResult && (
                  <div className={`text-xs font-bold flex items-center gap-1.5 pt-1 ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Status Message */}
              {syncStatus && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs rounded-2xl font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{syncStatus}</span>
                </div>
              )}

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Push All Button */}
                <button
                  id="btn_push_all_firebase"
                  onClick={handlePushAll}
                  disabled={isPushing || isPulling}
                  className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs flex flex-col items-start gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 text-left"
                >
                  <div className="p-2 bg-white/20 rounded-xl">
                    <UploadCloud className={`w-5 h-5 ${isPushing ? 'animate-bounce' : ''}`} />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm">Unggah Semua Data ke Firebase</div>
                    <div className="text-[11px] text-amber-100 font-normal mt-0.5">
                      Kirim seluruh data lokal (Siswa, Guru, Nilai, Tugas) ke Cloud Firestore.
                    </div>
                  </div>
                </button>

                {/* Pull All Button */}
                <button
                  id="btn_pull_all_firebase"
                  onClick={handlePullAll}
                  disabled={isPushing || isPulling}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex flex-col items-start gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 border border-slate-700 text-left"
                >
                  <div className="p-2 bg-white/10 rounded-xl">
                    <DownloadCloud className={`w-5 h-5 ${isPulling ? 'animate-bounce' : ''}`} />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm">Unduh Semua Data dari Firebase</div>
                    <div className="text-[11px] text-slate-300 font-normal mt-0.5">
                      Tarik data cloud Firestore dan simpan ke database lokal perangkat.
                    </div>
                  </div>
                </button>
              </div>

              {/* Real-time sync switch */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${realtimeActive ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                    <Radio className={`w-5 h-5 ${realtimeActive ? 'animate-pulse text-emerald-600' : ''}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Live Real-time Sync (Firestore Snapshot)</div>
                    <div className="text-[11px] text-slate-500">Menerima pembaruan data secara langsung saat ada perubahan di cloud.</div>
                  </div>
                </div>
                <button
                  id="btn_toggle_realtime_firebase"
                  onClick={handleToggleRealtime}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    realtimeActive
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {realtimeActive ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              {/* Sync Details Summary */}
              {syncDetails && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Rincian Dokumen Disinkronkan:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    {Object.entries(syncDetails).map(([col, count]) => (
                      <div key={col} className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400 capitalize">{col.replace(/_/g, ' ')}:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL CONFIGURATION */}
          {activeTab === 'config' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Jika Anda ingin menghubungkan database ke <strong>Proyek Firebase Console Pribadi</strong>, masukkan data konfigurasi Web App di bawah ini:
              </p>

              {configSavedMsg && (
                <div className={`p-3 border text-xs rounded-2xl font-bold flex items-center gap-2 ${
                  configSavedMsg.includes('✅') 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : configSavedMsg.includes('⏳')
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}>
                  {configSavedMsg.includes('⏳') ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                  ) : configSavedMsg.includes('✅') ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{configSavedMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Project ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="contoh: kelasku-sekolah"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    API Key (Web SDK)
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSyD-xxxxxxxxxxxx"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    App ID
                  </label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1:123456789:web:abcdef"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Auth Domain
                  </label>
                  <input
                    type="text"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    placeholder="kelasku-sekolah.firebaseapp.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                >
                  Reset ke Pengaturan Bawaan
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menguji Koneksi...</span>
                      </>
                    ) : (
                      <span>Simpan Konfigurasi</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: TUTORIAL / PANDUAN */}
          {activeTab === 'tutorial' && (
            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                <div className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Langkah Pembuatan di Firebase Console:
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <li>Buka <strong>https://console.firebase.google.com</strong> lalu klik <strong>Add project</strong>.</li>
                  <li>Di bilah kiri, klik <strong>Build</strong> &gt; <strong>Firestore Database</strong> &gt; klik <strong>Create Database</strong>.</li>
                  <li>Pilih lokasi server <strong>asia-southeast2 (Jakarta)</strong> atau <strong>asia-southeast1 (Singapura)</strong>.</li>
                  <li>Pilih <strong>Start in test mode</strong> lalu klik <strong>Enable</strong>.</li>
                  <li>Masuk ke <strong>Project Settings (Ikon Gerigi)</strong> &gt; scroll ke <strong>Your apps</strong> &gt; buat Web App (`&lt;/&gt;`) untuk mengambil <em>apiKey</em>, <em>projectId</em>, dan <em>appId</em>.</li>
                </ol>
              </div>

              {/* Security Rules Snippet */}
              <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-400 font-sans text-xs">
                  <span>Aturan Keamanan Firestore (Rules):</span>
                  <button
                    onClick={handleCopySecurityRules}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    {copiedRule ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedRule ? 'Disalin!' : 'Salin Rules'}
                  </button>
                </div>
                <pre className="overflow-x-auto text-[10px] text-amber-300 leading-relaxed">
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

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
