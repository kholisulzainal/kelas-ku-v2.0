import React, { useState } from 'react';
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
  Bot,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  FolderKanban
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentRole: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ currentRole, activeTab, setActiveTab }: SidebarProps) {
  // Accordion state for sub-menus (Closed by default as requested)
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    pengelolaan_kelas: false,
    ai_guru: false
  });

  const toggleSubMenu = (key: string) => {
    setOpenSubMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Render method for Teacher and Operator roles with Accordion Sub-menus
  const renderTeacherOperatorNav = () => {
    const isPengelolaanActive = [
      'mata_pelajaran',
      'jadwal_pelajaran',
      'data_siswa',
      'absensi',
      'tugas_harian',
      'asesmen',
      'temuan_khusus',
      'kalender_akademik'
    ].includes(activeTab);

    const isAiActive = ['ai_tutor', 'ai_generator_soal', 'ai_perangkat_ajar'].includes(activeTab);

    return (
      <div className="space-y-1">
        {/* 1. Profil Sekolah */}
        <button
          id="sidebar_tab_profil_sekolah"
          onClick={() => setActiveTab('profil_sekolah')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'profil_sekolah'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800/70 hover:text-blue-600 dark:hover:text-white'
          }`}
        >
          <School className={`w-4 h-4 shrink-0 ${activeTab === 'profil_sekolah' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span className="truncate">Profil Sekolah</span>
        </button>

        {/* 2. Profil Guru */}
        <button
          id="sidebar_tab_profil_guru"
          onClick={() => setActiveTab('profil_guru')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'profil_guru'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800/70 hover:text-blue-600 dark:hover:text-white'
          }`}
        >
          <UserCheck className={`w-4 h-4 shrink-0 ${activeTab === 'profil_guru' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span className="truncate">Profil Guru</span>
        </button>

        {/* 3. SUB MENU: Pengelolaan Kelas (Accordion) */}
        <div className="pt-1">
          <button
            onClick={() => toggleSubMenu('pengelolaan_kelas')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
              isPengelolaanActive
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <FolderKanban className={`w-4 h-4 shrink-0 ${isPengelolaanActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>Pengelolaan Kelas</span>
            </div>
            {openSubMenus.pengelolaan_kelas ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSubMenus.pengelolaan_kelas && (
            <div className="ml-3 pl-3 my-1 border-l-2 border-slate-200 dark:border-slate-800 space-y-0.5">
              <button
                id="sidebar_tab_mata_pelajaran"
                onClick={() => setActiveTab('mata_pelajaran')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'mata_pelajaran'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Mata Pelajaran</span>
              </button>

              <button
                id="sidebar_tab_jadwal_pelajaran"
                onClick={() => setActiveTab('jadwal_pelajaran')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'jadwal_pelajaran'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Jadwal Pelajaran</span>
              </button>

              <button
                id="sidebar_tab_data_siswa"
                onClick={() => setActiveTab('data_siswa')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'data_siswa'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Data Siswa</span>
              </button>

              <button
                id="sidebar_tab_absensi"
                onClick={() => setActiveTab('absensi')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'absensi'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Absensi Siswa</span>
              </button>

              <button
                id="sidebar_tab_tugas_harian"
                onClick={() => setActiveTab('tugas_harian')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'tugas_harian'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Tugas Google Form</span>
              </button>

              <button
                id="sidebar_tab_asesmen"
                onClick={() => setActiveTab('asesmen')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'asesmen'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Asesmen Kurikulum</span>
              </button>

              <button
                id="sidebar_tab_temuan_khusus"
                onClick={() => setActiveTab('temuan_khusus')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'temuan_khusus'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Temuan Khusus</span>
              </button>

              <button
                id="sidebar_tab_kalender_akademik"
                onClick={() => setActiveTab('kalender_akademik')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'kalender_akademik'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Kalender &amp; Jadwal</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. Buku Digital & Modul */}
        <button
          id="sidebar_tab_buku_digital_admin"
          onClick={() => setActiveTab('buku_digital_admin')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'buku_digital_admin'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800/70 hover:text-blue-600 dark:hover:text-white'
          }`}
        >
          <Library className={`w-4 h-4 shrink-0 ${activeTab === 'buku_digital_admin' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span className="truncate">Buku Digital &amp; Modul</span>
        </button>

        {/* 5. SUB MENU: Asisten & AI Guru (Accordion) */}
        <div className="pt-1">
          <button
            onClick={() => toggleSubMenu('ai_guru')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
              isAiActive
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className={`w-4 h-4 shrink-0 ${isAiActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'}`} />
              <span>Asisten &amp; AI Guru</span>
            </div>
            {openSubMenus.ai_guru ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSubMenus.ai_guru && (
            <div className="ml-3 pl-3 my-1 border-l-2 border-indigo-200 dark:border-indigo-900/60 space-y-0.5">
              {/* AI Tutor Guru (NO EMOJI) */}
              <button
                id="sidebar_tab_ai_tutor"
                onClick={() => setActiveTab('ai_tutor')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'ai_tutor'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800'
                }`}
              >
                <Bot className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                <span className="truncate">AI Tutor Guru</span>
              </button>

              {/* AI Generator Soal */}
              <button
                id="sidebar_tab_ai_generator_soal"
                onClick={() => setActiveTab('ai_generator_soal')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'ai_generator_soal'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span className="truncate">AI Generator Soal</span>
              </button>

              {/* AI Perangkat Ajar */}
              <button
                id="sidebar_tab_ai_perangkat_ajar"
                onClick={() => setActiveTab('ai_perangkat_ajar')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'ai_perangkat_ajar'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span className="truncate">AI Perangkat Ajar</span>
              </button>
            </div>
          )}
        </div>

        {/* 6. Pengaturan Aplikasi (For Operator) */}
        {currentRole === 'operator' && (
          <button
            id="sidebar_tab_aplikasi_setting"
            onClick={() => setActiveTab('aplikasi_setting')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer mt-2 ${
              activeTab === 'aplikasi_setting'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800/70 hover:text-blue-600 dark:hover:text-white'
            }`}
          >
            <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'aplikasi_setting' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="truncate">Pengaturan Aplikasi</span>
          </button>
        )}
      </div>
    );
  };

  const renderStudentParentNav = () => {
    const isSiswa = currentRole === 'siswa';
    const items = isSiswa
      ? [
          { id: 'siswa_tugas', label: 'Tugas Harian Saya', icon: Bookmark },
          { id: 'siswa_nilai', label: 'Laporan Nilai Saya', icon: Award },
          { id: 'siswa_absensi', label: 'Rekap Absensi Saya', icon: CheckSquare },
          { id: 'buku_digital', label: 'Buku Digital', icon: Library },
          { id: 'kalender_akademik', label: 'Kalender & Jadwal Kelas', icon: Calendar }
        ]
      : [
          { id: 'ortu_notif_tugas', label: 'Status Tugas Anak', icon: Bookmark },
          { id: 'ortu_rekap_nilai', label: 'Laporan Nilai Anak', icon: Award },
          { id: 'ortu_absensi', label: 'Kehadiran Anak', icon: CheckSquare },
          { id: 'buku_digital', label: 'Buku Digital', icon: Library },
          { id: 'kalender_akademik', label: 'Kalender Sekolah', icon: Calendar }
        ];

    return (
      <nav className="space-y-1">
        {items.map(item => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar_tab_${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800/70 hover:text-blue-600 dark:hover:text-white'
              }`}
            >
              <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="w-full h-full bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between shrink-0 border-r border-[#DCE8F7] dark:border-slate-800">
      <div className="space-y-3">
        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Navigasi Utama ({currentRole === 'operator' ? 'Operator' : currentRole === 'guru' ? 'Guru' : currentRole === 'siswa' ? 'Siswa' : 'Orang Tua'})
        </div>

        {currentRole === 'operator' || currentRole === 'guru'
          ? renderTeacherOperatorNav()
          : renderStudentParentNav()}
      </div>

      {/* Footer Branding inside sidebar */}
      <div className="mt-6 border-t border-[#DCE8F7] dark:border-slate-800 pt-4 px-1 space-y-1.5 shrink-0">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <GraduationCap className="w-5 h-5 shrink-0" />
          <span className="font-bold text-xs tracking-wider">Kelas Ku v2.0 2026</span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Pengelolaan Kelas Kurikulum Merdeka, Terintegrasi Google Apps &amp; Gemini AI.
        </p>
      </div>
    </div>
  );
}


