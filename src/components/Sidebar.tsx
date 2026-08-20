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
      <div className="space-y-1.5">
        {/* 1. Profil Sekolah */}
        <button
          id="sidebar_tab_profil_sekolah"
          onClick={() => setActiveTab('profil_sekolah')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'profil_sekolah'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
              : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
        >
          <School className={`w-4 h-4 shrink-0 ${activeTab === 'profil_sekolah' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
          <span className="truncate text-black dark:text-white">Profil Sekolah</span>
        </button>

        {/* 2. Profil Guru */}
        <button
          id="sidebar_tab_profil_guru"
          onClick={() => setActiveTab('profil_guru')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'profil_guru'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
              : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
        >
          <UserCheck className={`w-4 h-4 shrink-0 ${activeTab === 'profil_guru' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
          <span className="truncate text-black dark:text-white">Profil Guru</span>
        </button>

        {/* 3. SUB MENU: Pengelolaan Kelas (Accordion) */}
        <div className="pt-1">
          <button
            onClick={() => toggleSubMenu('pengelolaan_kelas')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
              isPengelolaanActive
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <FolderKanban className={`w-4 h-4 shrink-0 ${isPengelolaanActive ? 'text-blue-700 dark:text-blue-400' : 'text-black dark:text-slate-200'}`} />
              <span className="font-bold text-black dark:text-white">Pengelolaan Kelas</span>
            </div>
            {openSubMenus.pengelolaan_kelas ? (
              <ChevronDown className="w-4 h-4 text-black dark:text-slate-200" />
            ) : (
              <ChevronRight className="w-4 h-4 text-black dark:text-slate-200" />
            )}
          </button>

          {openSubMenus.pengelolaan_kelas && (
            <div className="ml-3 pl-3 my-1.5 border-l-2 border-slate-400 dark:border-slate-600 space-y-1">
              <button
                id="sidebar_tab_mata_pelajaran"
                onClick={() => setActiveTab('mata_pelajaran')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'mata_pelajaran'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <BookOpen className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'mata_pelajaran' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Mata Pelajaran</span>
              </button>

              <button
                id="sidebar_tab_jadwal_pelajaran"
                onClick={() => setActiveTab('jadwal_pelajaran')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'jadwal_pelajaran'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <Calendar className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'jadwal_pelajaran' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Jadwal Pelajaran</span>
              </button>

              <button
                id="sidebar_tab_data_siswa"
                onClick={() => setActiveTab('data_siswa')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'data_siswa'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <Users className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'data_siswa' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Data Siswa</span>
              </button>

              <button
                id="sidebar_tab_absensi"
                onClick={() => setActiveTab('absensi')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'absensi'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <CheckSquare className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'absensi' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Absensi Siswa</span>
              </button>

              <button
                id="sidebar_tab_tugas_harian"
                onClick={() => setActiveTab('tugas_harian')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'tugas_harian'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'tugas_harian' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Tugas Google Form</span>
              </button>

              <button
                id="sidebar_tab_asesmen"
                onClick={() => setActiveTab('asesmen')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'asesmen'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <Award className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'asesmen' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Asesmen Kurikulum</span>
              </button>

              <button
                id="sidebar_tab_temuan_khusus"
                onClick={() => setActiveTab('temuan_khusus')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'temuan_khusus'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'temuan_khusus' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Temuan Khusus</span>
              </button>

              <button
                id="sidebar_tab_kalender_akademik"
                onClick={() => setActiveTab('kalender_akademik')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'kalender_akademik'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <FileText className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'kalender_akademik' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
                <span className="truncate text-black dark:text-white">Kalender &amp; Jadwal</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. Buku Digital & Modul */}
        <button
          id="sidebar_tab_buku_digital_admin"
          onClick={() => setActiveTab('buku_digital_admin')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'buku_digital_admin'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
              : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
        >
          <Library className={`w-4 h-4 shrink-0 ${activeTab === 'buku_digital_admin' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
          <span className="truncate text-black dark:text-white">Buku Digital &amp; Modul</span>
        </button>

        {/* 5. SUB MENU: Asisten & AI Guru (Accordion) */}
        <div className="pt-1">
          <button
            onClick={() => toggleSubMenu('ai_guru')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
              isAiActive
                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800'
                : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className={`w-4 h-4 shrink-0 ${isAiActive ? 'text-indigo-700 dark:text-indigo-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span className="font-bold text-black dark:text-white">Asisten &amp; AI Guru</span>
            </div>
            {openSubMenus.ai_guru ? (
              <ChevronDown className="w-4 h-4 text-black dark:text-slate-200" />
            ) : (
              <ChevronRight className="w-4 h-4 text-black dark:text-slate-200" />
            )}
          </button>

          {openSubMenus.ai_guru && (
            <div className="ml-3 pl-3 my-1.5 border-l-2 border-indigo-400 dark:border-indigo-600 space-y-1">
              {/* AI Tutor Guru */}
              <button
                id="sidebar_tab_ai_tutor"
                onClick={() => setActiveTab('ai_tutor')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ai_tutor'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300'
                }`}
              >
                <Bot className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'ai_tutor' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <span className="truncate text-black dark:text-white">AI Tutor Guru</span>
              </button>

              {/* AI Generator Soal */}
              <button
                id="sidebar_tab_ai_generator_soal"
                onClick={() => setActiveTab('ai_generator_soal')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ai_generator_soal'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300'
                }`}
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'ai_generator_soal' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
                <span className="truncate text-black dark:text-white">AI Generator Soal</span>
              </button>

              {/* AI Perangkat Ajar */}
              <button
                id="sidebar_tab_ai_perangkat_ajar"
                onClick={() => setActiveTab('ai_perangkat_ajar')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ai_perangkat_ajar'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-black dark:text-white hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'ai_perangkat_ajar' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                <span className="truncate text-black dark:text-white">AI Perangkat Ajar</span>
              </button>
            </div>
          )}
        </div>

        {/* 6. Pengaturan Aplikasi */}
        <div className="pt-2 border-t border-slate-300 dark:border-slate-800">
          {currentRole === 'operator' && (
            <button
              id="sidebar_tab_aplikasi_setting"
              onClick={() => setActiveTab('aplikasi_setting')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'aplikasi_setting'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'aplikasi_setting' ? 'text-white' : 'text-black dark:text-slate-200'}`} />
              <span className="truncate text-black dark:text-white">Pengaturan Aplikasi</span>
            </button>
          )}
        </div>
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
      <nav className="space-y-1.5">
        {items.map(item => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar_tab_${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-black dark:text-slate-200'}`} />
              <span className="truncate text-black dark:text-white">{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="w-full h-full bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between shrink-0 border-r border-[#DCE8F7] dark:border-slate-800">
      <div className="space-y-3">
        <div className="px-3 py-1.5 text-[11px] font-extrabold text-black dark:text-slate-200 uppercase tracking-widest">
          Navigasi Utama ({currentRole === 'operator' ? 'Operator' : currentRole === 'guru' ? 'Guru' : currentRole === 'siswa' ? 'Siswa' : 'Orang Tua'})
        </div>

        {currentRole === 'operator' || currentRole === 'guru'
          ? renderTeacherOperatorNav()
          : renderStudentParentNav()}
      </div>

      {/* Footer Branding inside sidebar */}
      <div className="mt-6 border-t border-slate-300 dark:border-slate-800 pt-4 px-1 space-y-1.5 shrink-0">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <GraduationCap className="w-5 h-5 shrink-0" />
          <span className="font-extrabold text-xs tracking-wider text-black dark:text-white">Kelas Ku v2.0 2026</span>
        </div>
        <p className="text-[11px] text-black dark:text-slate-200 font-semibold leading-relaxed">
          Pengelolaan Kelas Kurikulum Merdeka, Terintegrasi Google Apps &amp; Gemini AI.
        </p>
      </div>
    </div>
  );
}
