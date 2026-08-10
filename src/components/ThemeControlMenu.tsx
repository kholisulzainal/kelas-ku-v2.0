import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check, Palette, Sparkles, X } from 'lucide-react';
import { useTheme, ThemeMode } from './ThemeContext';

interface ThemeControlMenuProps {
  buttonClassName?: string;
  showLabel?: boolean;
}

export function ThemeControlMenu({ buttonClassName, showLabel = true }: ThemeControlMenuProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const themeOptions: { id: ThemeMode; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'light',
      label: 'Mode Terang (Light)',
      desc: 'Tampilan cerah dengan latar putih bersih untuk siang hari',
      icon: <Sun className="w-4 h-4 text-amber-500" />
    },
    {
      id: 'dark',
      label: 'Mode Gelap (Dark)',
      desc: 'Tampilan redup untuk kenyamanan mata di malam hari',
      icon: <Moon className="w-4 h-4 text-indigo-400" />
    },
    {
      id: 'system',
      label: 'Otomatis (Sistem)',
      desc: 'Mengikuti pengaturan tema bawaan perangkat Anda',
      icon: <Laptop className="w-4 h-4 text-blue-500" />
    }
  ];

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      <button
        id="theme_control_trigger_btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Buka Pengontrol Tema Tampilan"
        aria-label="Pengontrol Tema Tampilan"
        className={
          buttonClassName ||
          "h-[40px] px-3 sm:px-3.5 rounded-[12px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 font-semibold border border-[#DCE8F7] dark:border-slate-700/60 cursor-pointer flex items-center justify-center gap-1.5 text-xs shrink-0 transition-all shadow-xs"
        }
      >
        <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        {showLabel && (
          <span className="font-bold text-slate-700 dark:text-slate-200 hidden sm:inline">
            Tema: {theme === 'light' ? 'Terang' : theme === 'dark' ? 'Gelap' : 'Sistem'}
          </span>
        )}
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          id="theme_control_menu_dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl bg-white dark:bg-slate-900 border border-m3-border dark:border-slate-800 shadow-2xl z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Pengontrol Tema Tampilan</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Pilih mode warna aktif aplikasi</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Active Status Pill */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Status Aktif Perangkat:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Mode {resolvedTheme === 'dark' ? 'Gelap' : 'Terang'}
            </span>
          </div>

          {/* Theme List Options */}
          <div className="space-y-1.5">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                  }}
                  className={`w-full p-2.5 rounded-xl text-left border flex items-start gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${
                        isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {opt.label}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Color Palette Preview Swatches */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
              Palet Warna Aplikasi Merdeka
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="h-6 rounded-lg bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold">Utama</div>
              <div className="h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[9px] text-white font-bold">Aksen</div>
              <div className="h-6 rounded-lg bg-emerald-500 flex items-center justify-center text-[9px] text-white font-bold">Sukses</div>
              <div className="h-6 rounded-lg bg-amber-500 flex items-center justify-center text-[9px] text-white font-bold">Peringatan</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
