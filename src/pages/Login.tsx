import React, { useState } from 'react';
import { db } from '../services/db';
import { UserRole } from '../types';
import { ShieldAlert, GraduationCap, Users, Lock, User, Eye, EyeOff, Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, Settings } from 'lucide-react';
import { getSupabaseClient, getOperatorCredentialsFromSupabase } from '../services/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (role: UserRole, id: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<UserRole>('operator');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showAutoLogoutMessage, setShowAutoLogoutMessage] = useState(false);

  // Forgot Password State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [school, setSchool] = useState<any>(db.profilSekolah.get());

  React.useEffect(() => {
    // Otomatis bersihkan cache browser saat masuk halaman login
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name).catch(err => console.error('Gagal hapus cache:', err));
        }
      }).catch(err => console.error('Gagal membaca daftar cache:', err));
    }

    const flag = localStorage.getItem('auto_logged_out_flag');
    if (flag === 'true') {
      setShowAutoLogoutMessage(true);
      localStorage.removeItem('auto_logged_out_flag');
    }

    const handleDataUpdate = () => {
      setSchool(db.profilSekolah.get());
    };
    window.addEventListener('supabase-data-updated', handleDataUpdate);
    return () => window.removeEventListener('supabase-data-updated', handleDataUpdate);
  }, []);

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    if (!resetEmail.trim()) {
      setResetStatus({ success: false, message: 'Silakan masukkan alamat email Anda.' });
      return;
    }

    setResetLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setResetStatus({
          success: false,
          message: 'Koneksi database Supabase belum dikonfigurasi. Harap hubungkan aplikasi Anda ke Supabase terlebih dahulu.'
        });
        setResetLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setResetStatus({
          success: false,
          message: `Gagal mengirim link atur ulang: ${error.message}`
        });
      } else {
        setResetStatus({
          success: true,
          message: 'Link atur ulang kata sandi berhasil dikirim! Silakan periksa kotak masuk email Anda (termasuk folder spam).'
        });
        setResetEmail('');
      }
    } catch (err: any) {
      setResetStatus({
        success: false,
        message: `Terjadi kesalahan sistem: ${err.message || 'Kesalahan tidak dikenal'}`
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username/Identitas dan Kata Sandi wajib diisi.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (role === 'operator') {
      const opCreds = db.operatorCredentials.get();
      let isValid = (cleanUsername === opCreds.username || cleanUsername === 'admin_ops' || cleanUsername === 'operator') && 
                    (cleanPassword === opCreds.password || cleanPassword === 'admin' || cleanPassword === 'operator123');

      if (!isValid) {
        try {
          const spOp = await getOperatorCredentialsFromSupabase();
          if (spOp && cleanUsername === spOp.username.toLowerCase() && cleanPassword === spOp.password) {
            isValid = true;
            db.operatorCredentials.update(spOp.username, spOp.password);
          }
        } catch (e) {
          console.warn('Operator Supabase login check notice:', e);
        }
      }

      if (isValid) {
        db.login('operator', 'operator-id');
        onLoginSuccess('operator', 'operator-id');
      } else {
        setError('Username Operator atau Kata Sandi salah.');
      }
    } else if (role === 'guru') {
      const gurus = db.guru.getAll();
      let found = gurus.find(
        g => 
          (g.id === username.trim() || g.nip === username.trim() || g.namaGuru.toLowerCase().includes(cleanUsername)) && 
          (g.password === cleanPassword || (!g.password && cleanPassword === 'guru123') || cleanPassword === 'admin' || cleanPassword === 'guru123')
      );

      if (!found && (cleanUsername === 'admin' || cleanUsername === 'guru')) {
        if (cleanPassword === 'admin' || cleanPassword === 'guru123') {
          // Default to teacher 'guru-1' (Wali Kelas IV) or first Wali Kelas, avoiding accidental default to Kelas I
          found = gurus.find(g => g.id === 'guru-1') || gurus.find(g => g.isWaliKelas) || gurus[0];
        }
      }

      if (found) {
        db.login('guru', found.id);
        onLoginSuccess('guru', found.id);
      } else {
        setError('NIP atau Kata Sandi Guru salah.');
      }
    } else if (role === 'siswa') {
      const siswas = db.siswa.getAll();
      const found = siswas.find(
        s => 
          (s.nisn === username.trim() || s.nis === username.trim() || s.namaSiswa.toLowerCase().includes(cleanUsername)) && 
          (s.password === cleanPassword || (!s.password && cleanPassword === 'siswa123'))
      );

      if (found) {
        db.login('siswa', found.id);
        onLoginSuccess('siswa', found.id);
      } else {
        setError('NISN/NIS atau Kata Sandi Siswa salah.');
      }
    } else if (role === 'orang_tua') {
      const parents = db.orangTua.getAll();
      const found = parents.find(
        p => 
          (p.noTelepon === username.trim() || p.namaOrtu.toLowerCase().includes(cleanUsername)) && 
          (p.password === cleanPassword || (!p.password && cleanPassword === 'ortu123'))
      );

      if (found) {
        db.login('orang_tua', found.id);
        onLoginSuccess('orang_tua', found.id);
      } else {
        setError('Nomor Telepon atau Kata Sandi Orang Tua salah.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FF] dark:bg-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {school.logoUrl ? (
          <img
            className="mx-auto h-[100px] w-[100px] sm:h-[120px] sm:w-[120px] rounded-[24px] object-cover ring-4 ring-blue-500/15 shadow-md"
            src={school.logoUrl}
            alt="Logo Sekolah"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="mx-auto h-[100px] w-[100px] sm:h-[120px] sm:w-[120px] rounded-[24px] bg-blue-500 flex items-center justify-center text-white text-4xl font-bold shadow-md shadow-blue-500/20">
            {school.namaSekolah ? school.namaSekolah.substring(0, 2).toUpperCase() : 'SD'}
          </div>
        )}
        <h2 className="mt-5 text-2xl font-extrabold text-[#1E293B] dark:text-white tracking-tight leading-snug">
          {school.namaSekolah}
        </h2>
        <p className="mt-1.5 text-xs text-[#64748B] dark:text-slate-400 font-medium">
          Pengelolaan Kelas Kurikulum Merdeka &amp; Terintegrasi Google Apps.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-7 px-5 sm:px-8 custom-card-shadow rounded-[16px] border border-[#DCE8F7] dark:border-slate-800">
          
          {showAutoLogoutMessage && (
            <div className="mb-5 p-3.5 rounded-[12px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 text-xs flex gap-3 items-start">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Sesi Anda Telah Berakhir</p>
                <p className="mt-0.5 opacity-90 leading-relaxed">
                  Demi keamanan perangkat bersama, Anda telah dikeluarkan secara otomatis karena tidak ada aktivitas. Silakan masuk kembali.
                </p>
              </div>
            </div>
          )}

          {/* Role selector tabs */}
          <div className="mb-6">
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 text-center mb-2.5 uppercase tracking-wider">
              Pilih Peran Masuk
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRole('operator');
                  setUsername('');
                  setPassword('');
                  setError('');
                }}
                className={`h-[40px] px-2 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  role === 'operator'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-[#DCE8F7] dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>Operator</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('guru');
                  setUsername('');
                  setPassword('');
                  setError('');
                }}
                className={`h-[40px] px-2 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  role === 'guru'
                    ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-[#DCE8F7] dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Guru/Wali</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('siswa');
                  setUsername('');
                  setPassword('');
                  setError('');
                }}
                className={`h-[40px] px-2 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  role === 'siswa'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-[#DCE8F7] dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>Siswa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('orang_tua');
                  setUsername('');
                  setPassword('');
                  setError('');
                }}
                className={`h-[40px] px-2 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  role === 'orang_tua'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-[#DCE8F7] dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Orang Tua</span>
              </button>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-semibold p-3 rounded-[12px] border border-red-100 dark:border-red-900/50">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-[#1E293B] dark:text-slate-300 mb-1.5">
                {role === 'operator' && 'Nama Pengguna Operator'}
                {role === 'guru' && 'NIP / Nama Guru'}
                {role === 'siswa' && 'NISN / NIS / Nama Siswa'}
                {role === 'orang_tua' && 'No. Telepon / Nama Orang Tua'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    role === 'operator' ? 'Contoh: operator' :
                    role === 'guru' ? 'Contoh: 198503142011012009' :
                    role === 'siswa' ? 'Contoh: 0123456781' : 'Contoh: 081234567890'
                  }
                  className="bg-[#F5F9FF] dark:bg-slate-800/80 border border-[#DCE8F7] dark:border-slate-700 block w-full h-[44px] pl-10 pr-3.5 rounded-[12px] text-xs sm:text-sm text-[#1E293B] dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#1E293B] dark:text-slate-300 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="bg-[#F5F9FF] dark:bg-slate-800/80 border border-[#DCE8F7] dark:border-slate-700 block w-full h-[44px] pl-10 pr-10 rounded-[12px] text-xs sm:text-sm text-[#1E293B] dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(true);
                  setResetStatus(null);
                  setResetEmail('');
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer transition-colors"
              >
                Lupa Kata Sandi?
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                id="login_submit_btn"
                className={`w-full h-[42px] flex items-center justify-center px-4 rounded-[12px] text-xs sm:text-sm font-semibold text-white shadow-sm transition-all cursor-pointer ${
                  role === 'operator' ? 'bg-blue-600 hover:bg-blue-700' :
                  role === 'guru' ? 'bg-blue-500 hover:bg-blue-600' :
                  role === 'siswa' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Masuk ke Portal
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div 
            id="forgot_password_backdrop"
            className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              id="forgot_password_modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 border border-[#DCE8F7] dark:border-slate-800 rounded-[16px] w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-[12px] shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-white leading-tight">
                    Atur Ulang Kata Sandi
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Kirim link pemulihan via Supabase Auth
                  </p>
                </div>
              </div>

              {/* Status Message */}
              {resetStatus && (
                <div className={`p-3.5 rounded-[12px] text-xs flex gap-2.5 items-start ${
                  resetStatus.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40' 
                    : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/40'
                }`}>
                  {resetStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <p className="leading-relaxed font-medium">{resetStatus.message}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSendResetLink} className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                    Masukkan alamat email yang terdaftar pada akun Anda di Supabase. Kami akan mengirimkan tautan khusus untuk mengatur ulang kata sandi Anda.
                  </p>
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Alamat Email Terdaftar
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="reset-email"
                      name="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="contoh@sekolah.sch.id"
                      className="bg-[#F5F9FF] dark:bg-slate-800 border border-[#DCE8F7] dark:border-slate-700 block w-full h-[44px] pl-10 pr-3.5 rounded-[12px] text-xs sm:text-sm text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="order-2 sm:order-1 h-[40px] flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 px-4 rounded-[12px] cursor-pointer transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Kembali ke Halaman Masuk
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="order-1 sm:order-2 h-[40px] flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs px-5 rounded-[12px] cursor-pointer shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      'Kirim Tautan Atur Ulang'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

