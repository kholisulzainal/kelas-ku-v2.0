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

export function FirebaseSettingsTab() {
  const [activeSection, setActiveSection] = useState<'sync' | 'config' | 'guide'>('sync');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; message: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncDetails, setSyncDetails] = useState<Record<string, number> | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);

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
    if (realtimeActive) {
      stopFirebaseRealtimeSync();
      setRealtimeActive(false);
      setSyncStatus('ℹ️ Real-time listener Firebase dinonaktifkan.');
    } else {
      startFirebaseRealtimeSync(() => {
        setSyncStatus('⚡ Perubahan data diterima dari Cloud Firestore (Real-time).');
      });
      setRealtimeActive(true);
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

  const handleResetConfig = async () => {
    if (window.confirm('Hapus konfigurasi kustom Firebase dan kembali ke pengaturan bawaan?')) {
      await clearCustomFirebaseConfig();
      setApiKey('');
      setProjectId('');
      setAppId('');
      setAuthDomain('');
      setStorageBucket('');
      setMessagingSenderId('');
      setSavedMsg('ℹ️ Konfigurasi kustom dihapus.');
      setTestResult(null);
      setTimeout(() => setSavedMsg(''), 3000);
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
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>Database Proyek:</span>
                <strong className="text-xs text-slate-900 dark:text-white font-mono px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md">
                  {projectId || 'kelasku-cloud'}
                </strong>
              </div>
              {testResult && (
                <div className={`text-xs font-bold flex items-center gap-1.5 ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
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
                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-extrabold rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terkoneksi
                </span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              id="btn_push_all_firebase_tab"
              onClick={handlePushAll}
              disabled={isPushing || isPulling}
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
              disabled={isPushing || isPulling}
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
                <div className="text-xs font-bold text-slate-900 dark:text-white">Live Real-time Sync</div>
                <div className="text-[11px] text-slate-500">Menerima pembaruan data secara langsung saat ada perubahan di cloud.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleRealtime}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                realtimeActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200'
              }`}
            >
              {realtimeActive ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>

          {syncDetails && (
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Rincian Dokumen Terkoneksi:</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {Object.entries(syncDetails).map(([col, count]) => (
                  <div key={col} className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400 capitalize">{col.replace(/_/g, ' ')}:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: CONFIGURATION */}
      {activeSection === 'config' && (
        <form onSubmit={handleSaveConfig} className="space-y-3.5 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200/60 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Masukkan konfigurasi Web App dari <strong>Firebase Console</strong> (Project Settings &gt; General &gt; Your apps):
          </p>

          {savedMsg && (
            <div className={`p-3 border text-xs rounded-xl font-bold flex items-center gap-2 ${
              savedMsg.includes('✅') 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : savedMsg.includes('⏳')
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}>
              {savedMsg.includes('⏳') ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
              ) : savedMsg.includes('✅') ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{savedMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handleResetConfig}
              className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
            >
              Reset ke Bawaan
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
        </form>
      )}

      {/* SECTION 3: SETUP GUIDE */}
      {activeSection === 'guide' && (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200/60 dark:border-slate-700">
          <div className="space-y-2">
            <div className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Langkah Pembuatan di Firebase Console:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
              <li>Buka <strong>https://console.firebase.google.com</strong> lalu buat proyek baru.</li>
              <li>Masuk ke <strong>Build &gt; Firestore Database</strong> &gt; klik <strong>Create Database</strong>.</li>
              <li>Pilih lokasi server <strong>asia-southeast2 (Jakarta)</strong> atau <strong>asia-southeast1 (Singapura)</strong>.</li>
              <li>Pilih <strong>Start in test mode</strong> lalu klik <strong>Enable</strong>.</li>
              <li>Salin <strong>Project ID</strong> dan <strong>Web API Key</strong> ke formulir Konfigurasi di samping.</li>
            </ol>
          </div>

          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 font-sans text-xs">
              <span>Aturan Keamanan Firestore (Rules):</span>
              <button
                type="button"
                onClick={handleCopyRules}
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                {copiedRules ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedRules ? 'Disalin!' : 'Salin Rules'}
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
  );
}
