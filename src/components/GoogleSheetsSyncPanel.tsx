import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Database, 
  HelpCircle, 
  ExternalLink, 
  Info,
  Link,
  Check,
  UserCheck,
  ServerCrash
} from 'lucide-react';
import { getAccessToken, googleSignIn } from '../services/googleAuth';
import { googleSheetsClient, syncClassDataFromGoogleSheet, SheetSyncResult, linkGoogleEmailToActiveGuru } from '../services/googleServices';
import { db } from '../services/db';

interface GoogleSheetsSyncPanelProps {
  onSyncSuccess?: () => void;
  activeClass?: string;
}

export function GoogleSheetsSyncPanel({ onSyncSuccess, activeClass }: GoogleSheetsSyncPanelProps) {
  const [inputUrlOrId, setInputUrlOrId] = useState('');
  const [range, setRange] = useState('Sheet1!A1:J100');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Preview state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SheetSyncResult | null>(null);

  // Local state for the connected Google Email of Wali Kelas
  const [connectedEmail, setConnectedEmail] = useState<string | null>(() => {
    const currentUser = db.getCurrentUser();
    const gurus = db.guru.getAll();
    const activeGuru = currentUser.role === 'guru' ? gurus.find(g => g.id === currentUser.id) : null;
    return activeGuru?.googleEmail || null;
  });

  // Listen to realtime changes from Supabase / Local database updates to keep email in sync
  useEffect(() => {
    const handleGuruUpdate = () => {
      const currentUser = db.getCurrentUser();
      const gurus = db.guru.getAll();
      const activeGuru = currentUser.role === 'guru' ? gurus.find(g => g.id === currentUser.id) : null;
      setConnectedEmail(activeGuru?.googleEmail || null);
    };
    window.addEventListener('supabase-data-updated', handleGuruUpdate);
    return () => {
      window.removeEventListener('supabase-data-updated', handleGuruUpdate);
    };
  }, []);

  // Load active token on mount
  useEffect(() => {
    checkGoogleConnection();
  }, []);

  const checkGoogleConnection = async () => {
    try {
      const token = await getAccessToken();
      setGoogleToken(token);
      
      // Look up logged-in school administrator or active user
      const currentUser = db.getCurrentUser();
      setGoogleUser(currentUser);
    } catch (e) {
      console.error('Koneksi Google belum aktif:', e);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleToken(result.accessToken);
        setGoogleUser(db.getCurrentUser());
        
        if (result.user?.email) {
          linkGoogleEmailToActiveGuru(result.user.email);
          setConnectedEmail(result.user.email);
        }
      }
    } catch (err: any) {
      alert('Gagal menghubungkan Google Workspace: ' + (err.message || err));
    } finally {
      setIsConnecting(false);
    }
  };

  // Helper to extract spreadsheet ID from URL or raw input
  const getSpreadsheetId = () => {
    if (!inputUrlOrId) return '';
    const match = inputUrlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : inputUrlOrId.trim();
  };

  // Fetch sheet data for preview
  const handleFetchPreview = async () => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      setPreviewError('Mohon masukkan tautan URL Google Spreadsheet atau ID dokumen yang valid.');
      return;
    }

    if (!googleToken) {
      setPreviewError('Silakan sambungkan ke akun Google Workspace terlebih dahulu.');
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewRows([]);
    setDetectedHeaders([]);
    setSyncResult(null);

    try {
      const rawRows = await googleSheetsClient.getValues(googleToken, spreadsheetId, range);
      if (!rawRows || rawRows.length === 0) {
        throw new Error('Google Sheet kosong atau tidak dapat diakses.');
      }

      if (rawRows.length < 2) {
        throw new Error('Dibutuhkan minimal baris judul (header) dan satu baris data.');
      }

      setDetectedHeaders(rawRows[0].map(h => (h ? h.toString().trim() : '')));
      setPreviewRows(rawRows.slice(1, 6)); // display top 5 rows
    } catch (err: any) {
      console.error(err);
      setPreviewError(err?.message || 'Gagal mengambil data dari Google Sheets. Pastikan dokumen dapat dibaca oleh akun Anda.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Trigger full sync
  const handleTriggerSync = async () => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      alert('Mohon lengkapi spreadsheet ID atau tautan dokumen.');
      return;
    }

    if (!googleToken) {
      alert('Koneksi Google Workspace belum aktif.');
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await syncClassDataFromGoogleSheet(googleToken, spreadsheetId, range);
      setSyncResult(res);
      if (res.success && onSyncSuccess) {
        onSyncSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setSyncResult({
        success: false,
        totalRows: 0,
        syncedCount: 0,
        failedCount: 1,
        errors: [err?.message || 'Gangguan tidak dikenal pada proses sinkronisasi.']
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div id="google_sheets_sync_panel" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden">
      
      {/* Visual Progress Bar (Akan berdenyut saat ada proses aktif) */}
      {(isSyncing || isPreviewLoading) && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500 animate-pulse rounded-r-full" style={{ width: isSyncing ? '75%' : '40%', transition: 'width 2s ease-in-out' }}></div>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Google Sheets Class Synchronizer
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                Integrasi Otomatis Data Kelas, Siswa, dan Wali Murid ke Platform Kurikulum Merdeka & Supabase DB
              </p>
            </div>
          </div>
        </div>

        {/* Integration Connection Indicator */}
        <div>
          {connectedEmail ? (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-3.5 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
              <Check className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>Terhubung (Email Wali Kelas): {connectedEmail}</span>
            </div>
          ) : googleToken ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-3.5 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>Terhubung: {googleUser?.name || 'Google Cloud Auth'}</span>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="flex items-center gap-1.5 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-3.5 py-1.5 rounded-full border border-indigo-100 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
              <span>Otorisasi Google Workspace</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Setup Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Link className="w-3.5 h-3.5 text-indigo-500" /> Tautan URL atau ID Google Spreadsheet
              </label>
              <input
                type="text"
                placeholder="Palingan paste URL spreadsheet disini..."
                value={inputUrlOrId}
                onChange={(e) => setInputUrlOrId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <span className="text-[10px] text-slate-400 block leading-normal">
                Saran: Buat Google Sheet baru, atau tempel tautan yang berisi data siswa dengan format nama kolom teratur.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                  Range Lembar Kerja
                </label>
                <input
                  type="text"
                  placeholder="Sheet1!A1:J100"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleFetchPreview}
                  disabled={isPreviewLoading || !inputUrlOrId || !googleToken}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {isPreviewLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Pratinjau Data</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Sync Trigger button */}
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing || !inputUrlOrId || !googleToken}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 font-extrabold text-xs rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98] cursor-pointer"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>MULAI SINKRONISASI KE SUPABASE</span>
          </button>

          {/* Instructions Box */}
          <div className="bg-indigo-50/40 dark:bg-slate-900/40 p-4 rounded-2xl border border-indigo-100/30 dark:border-slate-800/80 space-y-2">
            <h5 className="text-[11px] font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Panduan Kolom Spreadsheet:
            </h5>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Nama-nama kolom pada baris pertama (header) akan dicocokkan secara pintar:
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 font-medium font-mono bg-white dark:bg-slate-950/30 p-2 rounded-xl">
              <div>• NISN (ID unik)</div>
              <div>• Nama Siswa</div>
              <div>• Jenis Kelamin (L/P)</div>
              <div>• Kelas</div>
              <div>• Alamat</div>
              <div>• Wali Murid / Ayah / Ibu</div>
            </div>
          </div>
        </div>

        {/* Right Column: Previews & Logs */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active Synchronization Loader & Info Panel */}
          {isSyncing && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30 p-6 rounded-3xl text-center space-y-4 animate-pulse">
              <div className="flex justify-center">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-12 h-12 rounded-full border-4 border-emerald-500/20 animate-ping"></div>
                  <div className="bg-emerald-600 text-white p-3.5 rounded-full shadow-md">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">
                  Sinkronisasi Google Sheet Aktif...
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Menghubungkan ke API Google Workspace untuk menarik baris data siswa, mengonversi struktur, dan menyinkronkannya langsung ke database utama Supabase.
                </p>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-infinite-loading"></div>
              </div>
            </div>
          )}

          {/* Dynamic error display */}
          {previewError && (
            <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-2xl border border-red-100 dark:border-red-950/30 flex gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal Mengakses Spreadsheet</p>
                <p className="mt-1 leading-relaxed">{previewError}</p>
              </div>
            </div>
          )}

          {/* Connected Google Account state message */}
          {!googleToken && !isSyncing && (
            <div className="bg-slate-50 dark:bg-slate-800/40 p-12 text-center rounded-3xl border border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center space-y-3">
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-full text-slate-400">
                <Info className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Otorisasi Google Diperlukan
                </h4>
                <p className="text-xs text-slate-500 leading-normal">
                  Sambungkan akun Google Anda untuk membaca isi Spreadsheet Google Sheets secara langsung melalui API Workspace yang aman.
                </p>
              </div>
              <button
                onClick={handleConnectGoogle}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Hubungkan Sekarang
              </button>
            </div>
          )}

          {/* Sync Success Results Box */}
          {syncResult && !isSyncing && (
            <div className={`p-4 rounded-2xl border flex gap-3 text-xs ${
              syncResult.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400' 
                : 'bg-amber-50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-400'
            }`}>
              {syncResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <h4 className="font-bold text-sm">
                  {syncResult.success ? 'Sinkronisasi Selesai Sukses!' : 'Sinkronisasi Selesai dengan Hambatan'}
                </h4>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-y border-current/10">
                  <div>
                    <span className="opacity-80 block text-[10px]">Total Baris</span>
                    <span className="font-extrabold text-base">{syncResult.totalRows}</span>
                  </div>
                  <div>
                    <span className="opacity-80 block text-[10px]">Tersinkron</span>
                    <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">{syncResult.syncedCount}</span>
                  </div>
                  <div>
                    <span className="opacity-80 block text-[10px]">Gagal</span>
                    <span className="font-extrabold text-base text-rose-500">{syncResult.failedCount}</span>
                  </div>
                </div>
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <p className="font-bold text-[10px] uppercase tracking-wider">Catatan Masalah:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[10px] opacity-90 max-h-[120px] overflow-y-auto">
                      {syncResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row Preview Table */}
          {googleToken && !previewError && !syncResult && !isSyncing && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1">
                  <Database className="w-4 h-4 text-emerald-500" /> Pratinjau Lembar Kerja (Maksimal 5 Baris Teratas)
                </h4>
                {previewRows.length > 0 && (
                  <span className="text-[10px] bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 font-bold px-2 py-0.5 rounded">
                    Terdeteksi {detectedHeaders.length} Kolom
                  </span>
                )}
              </div>

              {previewRows.length > 0 ? (
                <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          {detectedHeaders.map((header, idx) => (
                            <th key={idx} className="px-4 py-2.5 whitespace-nowrap">{header || `Kolom ${idx + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {previewRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            {detectedHeaders.map((_, colIdx) => (
                              <td key={colIdx} className="px-4 py-2 whitespace-nowrap font-medium">
                                {row[colIdx]?.toString() || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/40 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800 p-8 rounded-2xl text-center text-xs text-slate-400 italic">
                  Belum ada data pratinjau yang dimuat. Tempel tautan spreadsheet aktif di kolom kiri lalu klik tombol "Pratinjau Data".
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
