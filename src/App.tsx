import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { GuruDashboard } from './pages/GuruDashboard';
import { SiswaDashboard } from './pages/SiswaDashboard';
import { OrangTuaDashboard } from './pages/OrangTuaDashboard';
import { IndonesianCalendar } from './components/IndonesianCalendar';
import { Login } from './pages/Login';
import { AutoLogoutManager } from './components/AutoLogoutManager';
import { db } from './services/db';
import { UserRole } from './types';
import { X } from 'lucide-react';
import { pullAllFromSupabase, getSupabaseConfig } from './services/supabase';
import { startRealtimeSync } from './services/realtimeSync';

function MainApp() {
  const { theme } = useTheme();
  
  // Login / Session state
  const [isLoggedIn, setIsLoggedIn] = useState(() => db.isLoggedIn());

  // Active User / Role states
  const [currentRole, setCurrentRole] = useState<UserRole>(() => db.getCurrentUser().role);
  const [currentUserId, setCurrentUserId] = useState<string>(() => db.getCurrentUser().id);

  // Auto sync and Realtime listener on mount
  useEffect(() => {
    // 1. Trigger pull ONLY if Supabase is explicitly configured
    const { url, anonKey } = getSupabaseConfig();
    if (url && anonKey) {
      pullAllFromSupabase()
        .then((res) => {
          if (res.success) {
            console.log('[Auto Sync] Pulled all tables from Supabase successfully on load.');
            window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: '' } }));
          }
        })
        .catch((err) => {
          console.error('[Auto Sync] Error during auto-pull on load:', err);
        });

      // 2. Start real-time Postgres subscription channel
      const unsubscribe = startRealtimeSync();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);
  
  // Navigation states
  const [activeTab, setActiveTab] = useState<string>(() => {
    const role = db.getCurrentUser().role;
    if (role === 'operator') return 'profil_sekolah';
    if (role === 'guru') return 'profil_sekolah';
    if (role === 'siswa') return 'siswa_tugas';
    return 'ortu_notif_tugas';
  });

  // Mobile menu drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Notification center sidebar drawer state
  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);

  // Sync default tabs when role shifts or logged-in state changes
  useEffect(() => {
    if (!isLoggedIn) return;
    if (currentRole === 'operator') {
      setActiveTab('profil_sekolah');
    } else if (currentRole === 'guru') {
      setActiveTab('profil_sekolah');
    } else if (currentRole === 'siswa') {
      setActiveTab('siswa_tugas');
    } else {
      setActiveTab('ortu_notif_tugas');
    }
    setIsMobileSidebarOpen(false);
  }, [currentRole, isLoggedIn]);

  const handleRoleChange = (role: UserRole, id: string) => {
    db.setCurrentUser(role, id);
    setCurrentRole(role);
    setCurrentUserId(id);
  };

  const handleLogout = () => {
    db.logout();
    setIsLoggedIn(false);
  };

  const handleLoginSuccess = (role: UserRole, id: string) => {
    setCurrentRole(role);
    setCurrentUserId(id);
    setIsLoggedIn(true);
  };

  // Render login stage if not authenticated
  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render main screen based on active selection
  const renderContent = () => {
    if (activeTab === 'kalender_akademik') {
      return <IndonesianCalendar currentRole={currentRole} currentUserId={currentUserId} />;
    }

    switch (currentRole) {
      case 'operator':
      case 'guru':
        return <GuruDashboard activeTab={activeTab} />;
      case 'siswa':
        return <SiswaDashboard activeTab={activeTab} siswaId={currentUserId} />;
      case 'orang_tua':
        return <OrangTuaDashboard activeTab={activeTab} parentId={currentUserId} />;
      default:
        return <div className="text-center py-10">Pilih Peran Untuk Memulai</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-m3-bg dark:bg-slate-950 text-m3-text dark:text-slate-100 transition-colors duration-300">
      {/* Background inactivity tracker with automatic session controller */}
      <AutoLogoutManager onLogout={handleLogout} />

      {/* Dynamic Header with Hamburger Toggle */}
      <Header
        currentRole={currentRole}
        currentUserId={currentUserId}
        onRoleChange={handleRoleChange}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        onToggleNotifications={() => setIsNotifCenterOpen(!isNotifCenterOpen)}
      />

      {/* Slide-out Notification Center Sidebar Drawer */}
      <NotificationCenter
        isOpen={isNotifCenterOpen}
        onClose={() => setIsNotifCenterOpen(false)}
        currentRole={currentRole}
        currentUserId={currentUserId}
      />

      <div className="flex flex-col lg:flex-row flex-1 relative">
        {/* Navigation Sidebar for Desktop */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-m3-border dark:border-slate-800/50 bg-white dark:bg-slate-950 min-h-[calc(100vh-73px)]">
          <Sidebar
            currentRole={currentRole}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </aside>

        {/* Sliding Navigation Sidebar for Mobile */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <>
              {/* Dark Overlay backdrop */}
              <motion.div
                key="sidebar-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileSidebarOpen(false)}
                className="fixed inset-0 z-50 bg-slate-950 lg:hidden cursor-pointer"
              />

              {/* Drawer layout */}
              <motion.div
                key="sidebar-drawer"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed inset-y-0 left-0 z-55 w-76 max-w-[85vw] bg-white dark:bg-slate-950 shadow-2xl border-r border-m3-border dark:border-slate-800 lg:hidden flex flex-col h-full overflow-hidden"
              >
                {/* Drawer Header inside menu */}
                <div className="flex items-center justify-between p-5 border-b border-m3-border dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-xs font-extrabold text-m3-purple dark:text-indigo-400 uppercase tracking-widest">
                    Portal Menu ({currentRole})
                  </span>
                  <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
                    aria-label="Tutup Menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sidebar component inside scroll container */}
                <div className="flex-1 overflow-y-auto">
                  <Sidebar
                    currentRole={currentRole}
                    activeTab={activeTab}
                    setActiveTab={(tab) => {
                      setActiveTab(tab);
                      setIsMobileSidebarOpen(false); // Auto hide menu on tap
                    }}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Dynamic Main Stage */}
        <main className="flex-1 p-4 sm:p-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentRole}-${activeTab}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
