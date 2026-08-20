import React, { useState, useEffect } from 'react';
import {
  PenTool,
  QrCode,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Eye,
  ShieldCheck,
  UserCheck,
  School,
  FileCheck,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { db } from '../services/db';
import { ProfilSekolah, Guru } from '../types';
import {
  generateQrCodeDataUrl,
  getKepalaSekolahQrPayload,
  getGuruQrPayload,
  formatNamaDenganGelar
} from '../utils/signatureUtils';

export function SignatureSettingsTab() {
  const [profil, setProfil] = useState<ProfilSekolah>(() => db.profilSekolah.get());
  const [gurus, setGurus] = useState<Guru[]>(() => db.guru.getAll());
  
  // Active sub-tab in signature settings: 'kepsek' | 'guru' | 'preview'
  const [activeTab, setActiveTab] = useState<'kepsek' | 'guru' | 'preview'>('kepsek');

  // Selected teacher for editing personal signature
  const [selectedGuruId, setSelectedGuruId] = useState<string>('');

  // Live QR Previews
  const [ksQrPreview, setKsQrPreview] = useState<string>('');
  const [guruDefaultQrPreview, setGuruDefaultQrPreview] = useState<string>('');
  const [selectedGuruQrPreview, setSelectedGuruQrPreview] = useState<string>('');

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Load and refresh QR codes whenever profile or teachers change
  useEffect(() => {
    let isMounted = true;

    async function loadPreviews() {
      const ksPayload = getKepalaSekolahQrPayload(profil);
      const ksQr = await generateQrCodeDataUrl(ksPayload);
      if (isMounted) setKsQrPreview(ksQr);

      const defaultGuruObj = gurus[0] || { namaGuru: 'Nama Guru', gelar: 'S.Pd.', nip: '19850101 201001 1 001' };
      const gPayload = getGuruQrPayload(defaultGuruObj, profil);
      const gQr = await generateQrCodeDataUrl(gPayload);
      if (isMounted) setGuruDefaultQrPreview(gQr);

      if (selectedGuruId) {
        const targetG = gurus.find(g => g.id === selectedGuruId);
        if (targetG) {
          const tPayload = getGuruQrPayload(targetG, profil);
          const tQr = await generateQrCodeDataUrl(tPayload);
          if (isMounted) setSelectedGuruQrPreview(tQr);
        }
      }
    }

    loadPreviews();
    return () => {
      isMounted = false;
    };
  }, [profil, gurus, selectedGuruId]);

  const handleUpdateProfilField = (field: keyof ProfilSekolah, value: any) => {
    const updated = { ...profil, [field]: value };
    setProfil(updated);
    db.profilSekolah.update(updated);
    showSuccessToast('Pengaturan tanda tangan berhasil disimpan.');
  };

  const showSuccessToast = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => {
      setSaveSuccessMsg('');
    }, 4000);
  };

  // Convert uploaded image file to Base64
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'kepsek' | 'guru_specific',
    guruId?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file tanda tangan terlalu besar (Maksimal 2 MB). Silakan gunakan gambar yang lebih ringkas.');
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      setIsProcessingFile(false);

      if (target === 'kepsek') {
        const updated = {
          ...profil,
          ttdKepalaSekolahOpsi: 'manual_image' as const,
          ttdKepalaSekolahGambar: base64Data
        };
        setProfil(updated);
        db.profilSekolah.update(updated);
        showSuccessToast('File tanda tangan Kepala Sekolah berhasil diunggah!');
      } else if (target === 'guru_specific' && guruId) {
        const updatedGurus = gurus.map(g => {
          if (g.id === guruId) {
            return {
              ...g,
              ttdOpsi: 'manual_image' as const,
              ttdGambar: base64Data
            };
          }
          return g;
        });
        setGurus(updatedGurus);
        db.guru.save(updatedGurus);
        showSuccessToast('File tanda tangan personal guru berhasil disimpan!');
      }
    };
    reader.onerror = () => {
      setIsProcessingFile(false);
      alert('Gagal membaca berkas gambar. Silakan coba lagi.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (target: 'kepsek' | 'guru_specific', guruId?: string) => {
    if (target === 'kepsek') {
      const updated = {
        ...profil,
        ttdKepalaSekolahOpsi: 'qr_code' as const,
        ttdKepalaSekolahGambar: ''
      };
      setProfil(updated);
      db.profilSekolah.update(updated);
      showSuccessToast('Gambar tanda tangan Kepala Sekolah dihapus. Beralih ke QR Code otomatis.');
    } else if (target === 'guru_specific' && guruId) {
      const updatedGurus = gurus.map(g => {
        if (g.id === guruId) {
          return {
            ...g,
            ttdOpsi: 'qr_code' as const,
            ttdGambar: ''
          };
        }
        return g;
      });
      setGurus(updatedGurus);
      db.guru.save(updatedGurus);
      showSuccessToast('Gambar tanda tangan guru dihapus. Otomatis beralih ke QR Code resmi.');
    }
  };

  const activeSpecificGuru = gurus.find(g => g.id === selectedGuruId);

  return (
    <div className="space-y-6">
      {/* Header Notification Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-blue-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-500/20 text-blue-300 rounded-2xl border border-blue-400/30">
            <PenTool className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black flex items-center gap-2">
              Pengaturan Tanda Tangan Digital Dokumen PDF
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-full">
                Terintegrasi Semua Ekspor
              </span>
            </h3>
            <p className="text-xs text-blue-200 mt-0.5">
              Tanda tangan resmi ini otomatis tersemat pada Berkas Presensi, Nilai Asesmen, Jurnal Temuan, Rapor, dan Dokumen Pembelajaran.
            </p>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('kepsek')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'kepsek'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <School className="w-4 h-4" />
          1. TTD Kepala Sekolah
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guru')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'guru'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          2. TTD Guru &amp; Wali Kelas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          3. Simulasi Pratinjau Cetak PDF
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. TAB: TTD KEPALA SEKOLAH                                                */}
      {/* ========================================================================= */}
      {activeTab === 'kepsek' && (
        <div className="space-y-5">
          {/* Identity info card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Identitas Penandatangan Utama</span>
              <h4 className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                {profil.kepalaSekolah || '(Nama Kepala Sekolah Belum Diisi)'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                NIP: {profil.nipKepalaSekolah || '-'} | Instansi: {profil.namaSekolah || 'Sekolah'}
              </p>
            </div>
            <span className="text-[10px] font-extrabold px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full">
              Pemberi Pengesahan Resmi
            </span>
          </div>

          {/* Option Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opsi A: Generate QR Code Otomatis */}
            <div
              onClick={() => handleUpdateProfilField('ttdKepalaSekolahOpsi', 'qr_code')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                profil.ttdKepalaSekolahOpsi === 'qr_code' || !profil.ttdKepalaSekolahOpsi
                  ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-500 text-white rounded-xl shadow-sm">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      Opsi 1: Generate QR Code Otomatis
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    </h5>
                    <p className="text-[11px] text-slate-500">Tanda tangan digital modern berstandar e-Government &amp; BSrE</p>
                  </div>
                </div>
                {(profil.ttdKepalaSekolahOpsi === 'qr_code' || !profil.ttdKepalaSekolahOpsi) && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                )}
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                {ksQrPreview ? (
                  <img
                    src={ksQrPreview}
                    alt="QR Code Kepala Sekolah"
                    className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-200 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                    <QrCode className="w-8 h-8" />
                  </div>
                )}
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Informasi Tersemat dalam QR:</span>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 text-[11px] leading-tight">
                    Kepala Sekolah: {profil.kepalaSekolah || '-'}
                  </p>
                  <p className="font-mono text-slate-500 text-[10px]">
                    NIP: {profil.nipKepalaSekolah || '-'}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <ShieldCheck className="w-3 h-3" /> Validitas Dokumen Terproteksi
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Otomatis di-*generate* langsung dari nama lengkap &amp; NIP Kepala Sekolah tanpa perlu menyiapkan file gambar apapun.
              </p>
            </div>

            {/* Opsi B: Upload File TTD Manual Gambar */}
            <div
              onClick={() => handleUpdateProfilField('ttdKepalaSekolahOpsi', 'manual_image')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                profil.ttdKepalaSekolahOpsi === 'manual_image'
                  ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      Opsi 2: Upload File TTD Manual (Gambar)
                    </h5>
                    <p className="text-[11px] text-slate-500">Format file PNG transparan, JPG, atau WebP</p>
                  </div>
                </div>
                {profil.ttdKepalaSekolahOpsi === 'manual_image' && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                )}
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {profil.ttdKepalaSekolahGambar ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={profil.ttdKepalaSekolahGambar}
                        alt="Tanda Tangan Manual Kepala Sekolah"
                        className="h-16 max-w-[140px] object-contain bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-emerald-600 block flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Gambar TTD Siap Digunakan
                        </span>
                        <span className="text-[10px] text-slate-400">Otomatis dicetak pada posisi Kepala Sekolah</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage('kepsek');
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800 cursor-pointer transition-colors"
                      title="Hapus Gambar TTD"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2 space-y-2">
                    <p className="text-xs text-slate-500">Belum ada file gambar tanda tangan yang diunggah.</p>
                    <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      Pilih Gambar TTD (PNG/JPG)
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={(e) => handleFileUpload(e, 'kepsek')}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {profil.ttdKepalaSekolahGambar && (
                <div className="flex items-center justify-end">
                  <label className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Ganti Gambar Lain
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => handleFileUpload(e, 'kepsek')}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: TTD GURU & WALI KELAS                                             */}
      {/* ========================================================================= */}
      {activeTab === 'guru' && (
        <div className="space-y-6">
          {/* Information & Rule Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Pengaturan Tanda Tangan Individual Tiap Guru &amp; Wali Kelas
                </h4>
                <p className="text-[11px] text-slate-500">
                  Tanda tangan disesuaikan secara terperinci untuk masing-masing pendidik.
                </p>
              </div>
            </div>
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Aturan Otomatis:</strong> Anda dapat mengunggah file gambar tanda tangan (PNG/JPG transparan) untuk masing-masing guru. Jika dibiarkan kosong / tanpa gambar tanda tangan, sistem <strong>secara otomatis menghasilkan Kode QR Verifikasi Digital Resmi</strong> (berisi Nama Lengkap, Gelar, dan NIP guru yang bersangkutan).
              </div>
            </div>
          </div>

          {/* Teacher Specific Signatures Directory */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                Daftar Pendidik ({gurus.length} Guru Terdaftar)
              </h4>
              <span className="text-[11px] text-slate-400">Atur berkas TTD atau gunakan QR Code otomatis</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gurus.map((g) => {
                const hasCustomImg = Boolean(g.ttdGambar && g.ttdGambar.trim());
                const cleanName = formatNamaDenganGelar(g.namaGuru, g.gelar);

                return (
                  <div
                    key={g.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-black text-slate-800 dark:text-white">
                            {cleanName}
                          </h5>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            NIP. {g.nip || '-'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {g.kelasWali && (
                              <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-md">
                                Wali {g.kelasWali}
                              </span>
                            )}
                            <span className="text-[9px] font-medium text-slate-400">
                              {g.mataPelajaranUtama || 'Guru'}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                          hasCustomImg
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                          {hasCustomImg ? 'Gambar TTD' : 'QR Otomatis'}
                        </span>
                      </div>

                      {/* Preview Box */}
                      <div className="mt-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center gap-3">
                        {hasCustomImg ? (
                          <img
                            src={g.ttdGambar}
                            alt="TTD Guru"
                            className="h-12 max-w-[110px] object-contain bg-white rounded p-1 border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-white rounded border border-slate-200 flex items-center justify-center p-1 shrink-0">
                            <QrCode className="w-8 h-8 text-blue-600" />
                          </div>
                        )}
                        <div className="text-[11px] leading-snug">
                          {hasCustomImg ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              Gambar Tanda Tangan Terpasang
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300">
                              Menggunakan <strong>QR Code Terverifikasi</strong> (Nama, Gelar &amp; NIP).
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {hasCustomImg ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveImage('guru_specific', g.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Hapus &amp; Reset ke QR
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Tanpa upload = QR Aktif</span>
                      )}

                      <label className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-xl cursor-pointer transition-colors shadow-xs">
                        <Upload className="w-3 h-3" />
                        {hasCustomImg ? 'Ganti File TTD' : 'Unggah File TTD'}
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={(e) => handleFileUpload(e, 'guru_specific', g.id)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB: SIMULASI PRATINJAU DOKUMEN CETAK PDF                               */}
      {/* ========================================================================= */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Pilih guru untuk melihat simulasi hasil cetak bagian tanda tangan di berkas PDF:
              </span>
            </div>
            <select
              value={selectedGuruId || gurus[0]?.id || ''}
              onChange={(e) => setSelectedGuruId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-white"
            >
              {gurus.map(g => (
                <option key={g.id} value={g.id}>
                  {formatNamaDenganGelar(g.namaGuru, g.gelar)} {g.kelasWali ? `(${g.kelasWali})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 p-8 rounded-3xl shadow-md max-w-3xl mx-auto space-y-6">
            {/* Kop document preview watermark */}
            <div className="border-b-2 border-slate-800 pb-3 text-center space-y-1">
              <h4 className="text-sm font-black tracking-wider uppercase text-slate-900 dark:text-white">
                {profil.namaSekolah || 'NAMA SEKOLAH DASAR NEGERI'}
              </h4>
              <p className="text-[10px] text-slate-500">
                {profil.alamat || 'Alamat Lengkap Sekolah'} | NPSN: {profil.npsn || '20401234'} | Akreditasi: {profil.akreditasi || 'A'}
              </p>
            </div>

            <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">[ AREA KONTEN TABEL / LAPORAN DOKUMEN SISWA ]</span>
            </div>

            {/* Official Signature Grid Simulation */}
            {(() => {
              const activeGuru = gurus.find(g => g.id === (selectedGuruId || gurus[0]?.id)) || gurus[0];
              const guruHasImg = Boolean(activeGuru?.ttdGambar && activeGuru.ttdGambar.trim());

              return (
                <div className="grid grid-cols-2 gap-8 pt-4">
                  {/* Left Box: Kepala Sekolah */}
                  <div className="text-left space-y-1">
                    <p className="text-xs text-slate-800 dark:text-slate-200">Mengetahui,</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Kepala Sekolah</p>

                    <div className="h-20 flex items-center py-1">
                      {profil.ttdKepalaSekolahOpsi === 'manual_image' && profil.ttdKepalaSekolahGambar ? (
                        <img
                          src={profil.ttdKepalaSekolahGambar}
                          alt="TTD Kepala Sekolah"
                          className="h-16 max-w-[150px] object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          {ksQrPreview ? (
                            <img src={ksQrPreview} alt="QR Kepala Sekolah" className="w-16 h-16 bg-white p-0.5 border border-slate-200 rounded" />
                          ) : (
                            <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-400">
                              <QrCode className="w-8 h-8" />
                            </div>
                          )}
                          <span className="text-[8px] font-bold text-slate-500">[ Terverifikasi Digital ]</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white underline">
                        ( {profil.kepalaSekolah || 'Nama Kepala Sekolah'} )
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                        NIP. {profil.nipKepalaSekolah || '__________________________'}
                      </p>
                    </div>
                  </div>

                  {/* Right Box: Guru / Wali Kelas */}
                  <div className="text-left space-y-1 pl-4">
                    <p className="text-xs text-slate-800 dark:text-slate-200">
                      {profil.kabupaten || profil.kecamatan || 'Tempat'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Wali Kelas / Guru Pengampu</p>

                    <div className="h-20 flex items-center py-1">
                      {guruHasImg ? (
                        <img
                          src={activeGuru.ttdGambar}
                          alt="TTD Guru"
                          className="h-16 max-w-[150px] object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          {selectedGuruQrPreview || guruDefaultQrPreview ? (
                            <img src={selectedGuruQrPreview || guruDefaultQrPreview} alt="QR Guru" className="w-16 h-16 bg-white p-0.5 border border-slate-200 rounded" />
                          ) : (
                            <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-400">
                              <QrCode className="w-8 h-8" />
                            </div>
                          )}
                          <span className="text-[8px] font-bold text-slate-500">[ Terverifikasi Digital ]</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white underline">
                        ( {formatNamaDenganGelar(activeGuru?.namaGuru || 'Nama Guru Pengampu', activeGuru?.gelar)} )
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                        NIP. {activeGuru?.nip || '__________________________'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
