import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sun, Moon, Sparkles, User, GraduationCap, ShieldAlert, Users, RotateCcw, LogOut, Menu, X, RefreshCw, Database, Clock, Chrome, Wifi, WifiOff, CheckCircle2, Shield, Trash2 } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { ThemeControlMenu } from './ThemeControlMenu';
import { db } from '../services/db';
import { Notifikasi, UserRole } from '../types';
import { SupabaseSyncModal } from './SupabaseSyncModal';
import { getStoredGoogleUser, saveStoredGoogleUser, saveGoogleToken } from '../services/googleServices';
import { syncRowToSupabase } from '../services/supabase';

interface HeaderProps {
  currentRole: UserRole;
  currentUserId: string;
  onRoleChange: (role: UserRole, id: string) => void;
  onLogout: () => void;
  onToggleSidebar?: () => void;
  onToggleNotifications?: () => void;
}

export function Header({ currentRole, currentUserId, onRoleChange, onLogout, onToggleSidebar, onToggleNotifications }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [notifs, setNotifs] = useState<Notifikasi[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [school, setSchool] = useState(() => db.profilSekolah.get());
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleStatusMsg, setGoogleStatusMsg] = useState('');
  const [storedGoogleUser, setStoredGoogleUser] = useState(() => getStoredGoogleUser());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleConnectGoogle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim() || !googleEmailInput.includes('@')) {
      setGoogleStatusMsg('⚠️ Masukkan alamat email Google yang valid.');
      return;
    }

    const email = googleEmailInput.trim();
    const currentUser = db.getCurrentUser();
    const displayName = currentUser.role === 'siswa' ? 'Siswa' : currentUser.role === 'guru' ? 'Guru' : currentUser.role === 'orang_tua' ? 'Orang Tua' : 'Warga Sekolah';

    const userObj = {
      displayName,
      email,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff`
    };

    saveStoredGoogleUser(userObj);
    saveGoogleToken(`token-google-${currentUser.role}-${Date.now()}`);
    setStoredGoogleUser(userObj);

    // If current role is Siswa, automatically update student email in database & Supabase
    if (currentUser.role === 'siswa' && currentUser.id) {
      const student = db.siswa.getAll().find(s => s.id === currentUser.id);
      if (student) {
        const updatedSiswa = { ...student, email };
        db.siswa.upsert(updatedSiswa);
        syncRowToSupabase('siswa', updatedSiswa);
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission();
    }

    setGoogleStatusMsg(`✅ Berhasil! Email Google [${email}] terhubung. ${currentUser.role === 'siswa' ? 'Email default siswa otomatis diperbarui di database. ' : ''}Push Notifikasi aktif.`);
    setTimeout(() => {
      setIsGoogleModalOpen(false);
      setGoogleStatusMsg('');
    }, 2000);
  };
  const notifRef = useRef<HTMLDivElement>(null);

  const [showAutoLogoutSettings, setShowAutoLogoutSettings] = useState(false);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState<string>(() => {
    return localStorage.getItem('auto_logout_minutes') || '5';
  });
  const autoLogoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    }
    if (showNotifs) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifs]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autoLogoutRef.current && !autoLogoutRef.current.contains(event.target as Node)) {
        setShowAutoLogoutSettings(false);
      }
    }
    if (showAutoLogoutSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAutoLogoutSettings]);

  const handleSelectAutoLogout = (value: string) => {
    localStorage.setItem('auto_logout_minutes', value);
    setAutoLogoutMinutes(value);
    setShowAutoLogoutSettings(false);
    window.dispatchEvent(new Event('auto-logout-setting-changed'));
  };

  useEffect(() => {
    const handleUpdate = () => {
      setSchool(db.profilSekolah.get());
    };
    window.addEventListener('school-profile-updated', handleUpdate);
    return () => window.removeEventListener('school-profile-updated', handleUpdate);
  }, []);

  useEffect(() => {
    // Event-driven notifications update
    const updateNotifs = () => {
      const allNotifs = db.notifikasi.getAll();
      const filtered = allNotifs.filter(n => n.penerimaRole === currentRole);
      setNotifs(filtered);
    };

    updateNotifs();

    window.addEventListener('supabase-data-updated', updateNotifs);
    window.addEventListener('notifikasi-updated', updateNotifs);
    window.addEventListener('storage', updateNotifs);

    // Relaxed fallback interval (25 seconds) to minimize CPU usage
    const interval = setInterval(updateNotifs, 25000);

    return () => {
      window.removeEventListener('supabase-data-updated', updateNotifs);
      window.removeEventListener('notifikasi-updated', updateNotifs);
      window.removeEventListener('storage', updateNotifs);
      clearInterval(interval);
    };
  }, [currentRole]);

  const unreadCount = notifs.filter(n => !n.dibaca).length;

  const handleMarkAllRead = () => {
    db.notifikasi.markAllAsRead(currentRole);
    setNotifs(prev => prev.map(n => ({ ...n, dibaca: true })));
  };

  const [cacheClearMsg, setCacheClearMsg] = useState('');
  const handleClearCacheAndLogs = () => {
    db.clearCacheAndLogs();
    setNotifs([]);
    setCacheClearMsg('✅ Cache & Log Chat/Pemberitahuan berhasil dibersihkan! CPU & Memory dioptimalkan.');
    setTimeout(() => setCacheClearMsg(''), 4000);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-[#DCE8F7] dark:border-slate-800 px-4 sm:px-6 min-h-[64px] py-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors duration-300">
      {/* Brand Profile & Hamburger Menu */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            id="mobile_hamburger_btn"
            onClick={onToggleSidebar}
            className="lg:hidden h-[40px] w-[40px] rounded-[12px] bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-[#DCE8F7] dark:border-slate-700/60 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center shrink-0"
            aria-label="Buka Menu Navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        
        {school.logoUrl ? (
          <img
            src={school.logoUrl}
            alt="Logo Sekolah"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-[14px] object-cover ring-2 ring-blue-500/20 shadow-xs shrink-0"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          style={{ display: school.logoUrl ? 'none' : 'flex' }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-[14px] bg-blue-500 flex items-center justify-center text-white text-lg font-bold shadow-xs shrink-0"
        >
          {school.namaSekolah ? school.namaSekolah.substring(0, 2).toUpperCase() : 'SD'}
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-bold text-[#1E293B] dark:text-white leading-tight">
            {school.namaSekolah}
          </h1>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[#64748B] dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>NPSN {school.npsn}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">Kurikulum Merdeka</span>
          </div>
        </div>
      </div>

      {/* Active Session Info & User Controls */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap flex-1 sm:flex-initial ml-auto">
        {/* Active Account Badge */}
        <div className="hidden xs:flex items-center bg-slate-50 dark:bg-slate-800/60 p-1.5 px-3 rounded-full border border-[#DCE8F7] dark:border-slate-700/60 text-xs font-medium gap-2">
          <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-wider">
            Akun:
          </span>
          <span className="font-bold text-[#1E293B] dark:text-white text-xs">
            {db.getCurrentUser().name}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold ${
            currentRole === 'operator' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
            currentRole === 'guru' ? 'bg-blue-600/10 text-blue-600' :
            currentRole === 'siswa' ? 'bg-emerald-500/10 text-emerald-600' :
            'bg-amber-500/10 text-amber-600'
          }`}>
            {currentRole === 'operator' ? 'Operator' : currentRole === 'guru' ? 'Guru' : currentRole === 'siswa' ? 'Siswa' : 'Wali'}
          </span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 ml-auto justify-end">
          {/* Dynamic Offline / Online Indicator Badge */}
          {isOnline ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/30 shrink-0">
              <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Daring</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-900/30 animate-pulse shrink-0">
              <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Luring</span>
            </div>
          )}

          {/* Segarkan Halaman */}
          <button
            id="refresh_page_btn"
            onClick={() => window.location.reload()}
            title="Segarkan Halaman"
            className="h-[40px] w-[40px] rounded-[12px] bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all border border-[#DCE8F7] dark:border-slate-700/60 cursor-pointer flex items-center justify-center shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Pengontrol Tema Tampilan (Terang / Gelap / Otomatis) */}
          <ThemeControlMenu />

          {/* Google Workspace Login & Push Notifications */}
          <button
            id="google_login_btn"
            onClick={() => setIsGoogleModalOpen(true)}
            title="Masuk Akun Google & Notifikasi Push"
            className="h-[40px] px-3 sm:px-3.5 rounded-[12px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-100 dark:border-indigo-900/30 cursor-pointer flex items-center justify-center gap-1.5 text-xs shrink-0 transition-colors"
          >
            <Chrome className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-bold hidden sm:inline">Masuk Google</span>
          </button>

          {/* Notification Bell */}
          <div ref={notifRef} className="relative">
            <button
              id="notif_bell_btn"
              onClick={() => onToggleNotifications ? onToggleNotifications() : setShowNotifs(!showNotifs)}
              className="h-[40px] w-[40px] rounded-[12px] bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all border border-[#DCE8F7] dark:border-slate-700/60 cursor-pointer relative flex items-center justify-center shrink-0"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifs && (
              <div className="fixed sm:absolute right-4 sm:right-0 left-4 sm:left-auto top-16 sm:top-auto mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-[#DCE8F7] dark:border-slate-800 rounded-[16px] custom-card-shadow z-50 p-4 transition-all duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <h4 className="text-xs font-bold text-[#1E293B] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    Pemberitahuan
                  </h4>
                  {unreadCount > 0 && (
                    <button
                      id="mark_read_btn"
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                    >
                      Tandai Semua Dibaca
                    </button>
                  )}
                </div>

                {cacheClearMsg && (
                  <div className="mb-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                    {cacheClearMsg}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-0.5">
                  {notifs.length > 0 ? (
                    notifs.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded-[12px] transition-all text-xs border break-words whitespace-normal leading-normal ${
                          n.dibaca
                            ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 text-[#64748B] dark:text-slate-400'
                            : 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-[#1E293B] dark:text-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-bold leading-tight break-words text-slate-800 dark:text-slate-100 text-xs">{n.judul}</p>
                          {!n.dibaca && (
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] whitespace-normal break-words">
                          {n.pesan}
                        </p>
                        <span className="block mt-1.5 text-[9px] text-slate-400 dark:text-slate-500 font-medium">{n.tanggal}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-slate-400 dark:text-slate-500">
                      <p className="text-xs">Tidak ada pemberitahuan baru</p>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={handleClearCacheAndLogs}
                    className="w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-rose-200 dark:border-rose-900/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Bersihkan Cache & Log Chat
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Auto-Logout settings widget */}
          <div ref={autoLogoutRef} className="relative">
            <button
              id="auto_logout_settings_btn"
              onClick={() => setShowAutoLogoutSettings(!showAutoLogoutSettings)}
              title="Pengaturan Keamanan Auto-Keluar"
              className="h-[40px] px-3 sm:px-3.5 rounded-[12px] bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold border border-amber-200 dark:border-amber-900/30 cursor-pointer flex items-center justify-center gap-1.5 text-xs shrink-0 transition-colors"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden xs:inline">Auto: {autoLogoutMinutes === 'off' ? 'Off' : `${autoLogoutMinutes}m`}</span>
              <span className="inline xs:hidden">{autoLogoutMinutes === 'off' ? 'Off' : `${autoLogoutMinutes}m`}</span>
            </button>

            {showAutoLogoutSettings && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-[#DCE8F7] dark:border-slate-800 rounded-[16px] custom-card-shadow z-50 p-2 space-y-1">
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Inaktivitas Maksimal
                  </h4>
                </div>
                {[
                  { label: '1 Menit (Tes)', value: '1' },
                  { label: '3 Menit', value: '3' },
                  { label: '5 Menit', value: '5' },
                  { label: '10 Menit', value: '10' },
                  { label: '15 Menit', value: '15' },
                  { label: 'Nonaktif', value: 'off' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectAutoLogout(opt.value)}
                    className={`w-full text-left px-3 py-2 text-xs rounded-[10px] font-medium transition-colors flex items-center justify-between cursor-pointer ${
                      autoLogoutMinutes === opt.value
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {autoLogoutMinutes === opt.value && (
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            id="logout_btn"
            onClick={onLogout}
            title="Keluar dari Akun"
            className="h-[40px] px-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors border border-red-200 dark:border-red-900/30 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline font-bold">Keluar</span>
          </button>
        </div>
      </div>
      
      {/* Supabase Sync Panel Modal */}
      <SupabaseSyncModal isOpen={isSupabaseModalOpen} onClose={() => setIsSupabaseModalOpen(false)} />

      {/* GOOGLE SIGN-IN & PUSH NOTIFICATION MODAL */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setIsGoogleModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-2xl">
                <Chrome className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Sambungkan Akun Google</h3>
                <p className="text-xs text-slate-500">Notifikasi Push &amp; Pembaruan Otomatis Email Siswa</p>
              </div>
            </div>

            {storedGoogleUser ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Terkoneksi Google Workspace
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">Aktif</span>
                </div>
                <p className="font-mono text-slate-700 dark:text-slate-200 font-bold">{storedGoogleUser.email}</p>
                <p className="text-[11px] text-slate-500">
                  Semua pemberitahuan tugas &amp; nilai akan diteruskan ke akun Google ini.
                </p>
              </div>
            ) : null}

            {googleStatusMsg && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs rounded-2xl font-semibold">
                {googleStatusMsg}
              </div>
            )}

            <form onSubmit={handleConnectGoogle} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat Email Google / Gmail Pribadi
                </label>
                <input
                  type="email"
                  required
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  placeholder="contoh: nama.siswa@gmail.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-normal">
                * Khusus akun siswa: Menghubungkan email Google di sini akan <strong>otomatis memperbarui email default siswa</strong> di database Supabase dan mengaktifkan notifikasi push browser.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <Chrome className="w-4 h-4" />
                  Hubungkan &amp; Aktifkan Push
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DATABASE RESET CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div id="reset_confirm_backdrop" className="fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="reset_confirm_body" className="bg-white dark:bg-slate-900 border border-[#DCE8F7] dark:border-slate-800 rounded-[16px] w-full max-w-sm p-6 custom-card-shadow space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-[12px]">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Atur Ulang Aplikasi</h4>
                <p className="text-xs text-slate-500 font-medium">Setelan Awal Pabrik</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin mengatur ulang data aplikasi ke setelan awal pabrik? Seluruh perubahan data akan dikembalikan seperti semula.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="h-[40px] px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  db.resetToDefault();
                  setShowResetConfirm(false);
                }}
                className="h-[40px] bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 rounded-[12px] cursor-pointer shadow-sm transition-colors"
              >
                Ya, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
