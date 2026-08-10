import React from 'react';
import { GraduationCap, Code2, ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 sm:p-5 transition-colors shadow-2xs">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        {/* Left Branding */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 tracking-tight">
                Kelas Ku
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-bold text-xs bg-blue-50 dark:bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                v2.0 2026
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pengelolaan Kelas Kurikulum Merdeka &amp; Terintegrasi Google Apps.
            </p>
          </div>
        </div>

        {/* Right Developer Info */}
        <div className="flex flex-col items-center sm:items-end text-xs text-slate-500 dark:text-slate-400 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <Code2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Pengembang: <strong className="text-slate-900 dark:text-white font-semibold">Kholisul Zainal A.S, S.Pd.</strong></span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sistem Informasi Manajemen Sekolah</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
