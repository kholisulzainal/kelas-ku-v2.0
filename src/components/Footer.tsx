import React from 'react';

export function Footer() {
  return (
    <footer className="mt-3 sm:mt-6 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xs rounded-xl sm:rounded-2xl py-2 px-3 sm:py-3.5 sm:px-5 transition-colors">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-4 text-center sm:text-left">
        {/* Left Branding */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-start text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Kelas Ku <span className="text-blue-600 dark:text-blue-400 font-semibold">v2.0 2026</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
            Pengelolaan Kelas Kurikulum Merdeka, Terintegrasi Google Apps &amp; Gemini AI
          </span>
        </div>

        {/* Right Developer Info */}
        <div className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
          Pengembang: <strong className="text-slate-700 dark:text-slate-300 font-medium">Kholisul Zainal A.S, S.Pd.</strong>
        </div>
      </div>
    </footer>
  );
}
