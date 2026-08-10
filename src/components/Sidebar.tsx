import React from 'react';
import {
  School,
  UserCheck,
  BookOpen,
  Calendar,
  Users,
  CheckSquare,
  Award,
  AlertOctagon,
  FileText,
  Bookmark,
  GraduationCap,
  Settings,
  Library,
  Sun,
  Moon,
  Laptop,
  Palette
} from 'lucide-react';
import { UserRole } from '../types';
import { useTheme } from './ThemeContext';

interface SidebarProps {
  currentRole: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ currentRole, activeTab, setActiveTab }: SidebarProps) {
  const { theme, setTheme } = useTheme();

  // Navigation items based on role
  const getNavItems = () => {
    if (currentRole === 'operator') {
      return [
        { id: 'profil_sekolah', label: 'Profil Sekolah', icon: School },
        { id: 'profil_guru', label: 'Profil Guru', icon: UserCheck },
        { id: 'mata_pelajaran', label: 'Mata Pelajaran', icon: BookOpen },
        { id: 'jadwal_pelajaran', label: 'Jadwal Pelajaran', icon: Calendar },
        { id: 'data_siswa', label: 'Data Siswa', icon: Users },
        { id: 'absensi', label: 'Absensi Siswa', icon: CheckSquare },
        { id: 'tugas_harian', label: 'Tugas Google Form', icon: Bookmark },
        { id: 'asesmen', label: 'Asesmen Kurikulum', icon: Award },
        { id: 'buku_digital_admin', label: 'Buku Digital & Modul', icon: Library },
        { id: 'temuan_khusus', label: 'Temuan Khusus', icon: AlertOctagon },
        { id: 'kalender_akademik', label: 'Kalender & Jadwal', icon: FileText },
        { id: 'aplikasi_setting', label: 'Pengaturan Aplikasi', icon: Settings }
      ];
    } else if (currentRole === 'guru') {
      return [
        { id: 'profil_sekolah', label: 'Profil Sekolah', icon: School },
        { id: 'profil_guru', label: 'Profil Guru', icon: UserCheck },
        { id: 'mata_pelajaran', label: 'Mata Pelajaran', icon: BookOpen },
        { id: 'jadwal_pelajaran', label: 'Jadwal Pelajaran', icon: Calendar },
        { id: 'data_siswa', label: 'Data Siswa', icon: Users },
        { id: 'absensi', label: 'Absensi Siswa', icon: CheckSquare },
        { id: 'tugas_harian', label: 'Tugas Google Form', icon: Bookmark },
        { id: 'asesmen', label: 'Asesmen Kurikulum', icon: Award },
        { id: 'buku_digital_admin', label: 'Buku Digital & Modul', icon: Library },
        { id: 'temuan_khusus', label: 'Temuan Khusus', icon: AlertOctagon },
        { id: 'kalender_akademik', label: 'Kalender & Jadwal', icon: FileText }
      ];
    } else if (currentRole === 'siswa') {
      return [
        { id: 'siswa_tugas', label: 'Tugas Harian Saya', icon: Bookmark },
        { id: 'siswa_nilai', label: 'Laporan Nilai Saya', icon: Award },
        { id: 'siswa_absensi', label: 'Rekap Absensi Saya', icon: CheckSquare },
        { id: 'buku_digital', label: 'Buku Digital', icon: Library },
        { id: 'kalender_akademik', label: 'Kalender & Jadwal Kelas', icon: Calendar }
      ];
    } else {
      // Orang Tua
      return [
        { id: 'ortu_notif_tugas', label: 'Status Tugas Anak', icon: Bookmark },
        { id: 'ortu_rekap_nilai', label: 'Laporan Nilai Anak', icon: Award },
        { id: 'ortu_absensi', label: 'Kehadiran Anak', icon: CheckSquare },
        { id: 'buku_digital', label: 'Buku Digital', icon: Library },
        { id: 'kalender_akademik', label: 'Kalender Sekolah', icon: Calendar }
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="w-full h-full bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between shrink-0 border-r border-[#DCE8F7] dark:border-slate-800">
      <div className="space-y-2">
        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Navigasi Utama ({currentRole === 'operator' ? 'Operator' : currentRole === 'guru' ? 'Guru' : currentRole === 'siswa' ? 'Siswa' : 'Orang Tua'})
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`sidebar_tab_${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800/70 hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Branding inside sidebar */}
      <div className="mt-6 border-t border-[#DCE8F7] dark:border-slate-800 pt-4 px-2 space-y-3">
        {/* Dedicated Sidebar Theme Control Selector */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-[14px] border border-[#DCE8F7] dark:border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              Kontrol Tema Tampilan
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              id="sidebar_theme_light_btn"
              onClick={() => setTheme('light')}
              title="Mode Terang"
              className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Terang</span>
            </button>
            <button
              id="sidebar_theme_dark_btn"
              onClick={() => setTheme('dark')}
              title="Mode Gelap"
              className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Gelap</span>
            </button>
            <button
              id="sidebar_theme_system_btn"
              onClick={() => setTheme('system')}
              title="Mode Otomatis"
              className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                theme === 'system'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Otomatis</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <GraduationCap className="w-5 h-5 shrink-0" />
          <span className="font-bold text-xs tracking-wider">Kelas Ku v2.0 2026</span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          Pengelolaan Kelas Kurikulum Merdeka &amp; Terintegrasi Google Apps.
        </p>
        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1">
          Pengembang: Kholisul Zainal A.S, S.Pd.
        </p>
      </div>
    </div>
  );
}

