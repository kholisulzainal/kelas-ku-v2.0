import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check, ChevronDown } from 'lucide-react';
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

  const themeOptions: { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'system',
      label: 'Default',
      icon: Laptop
    },
    {
      id: 'light',
      label: 'Terang',
      icon: Sun
    },
    {
      id: 'dark',
      label: 'Gelap',
      icon: Moon
    }
  ];

  const currentOption = themeOptions.find((o) => o.id === theme) || themeOptions[0];
  const CurrentIcon = theme === 'system' ? Laptop : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      <button
        id="theme_control_trigger_btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Pilih Tema: Terang, Gelap, atau Otomatis"
        aria-label="Pilih Tema"
        className={
          buttonClassName ||
          "h-[40px] px-3 rounded-[12px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-[#DCE8F7] dark:border-slate-700/60 cursor-pointer flex items-center justify-center gap-1.5 text-xs shrink-0 transition-all shadow-xs"
        }
      >
        <CurrentIcon className={`w-4 h-4 shrink-0 ${resolvedTheme === 'dark' ? 'text-amber-400' : 'text-amber-500'}`} />
        {showLabel && (
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {currentOption.label}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-slate-400 opacity-70 ml-0.5" />
      </button>

      {/* Simple Popover Dropdown Menu */}
      {isOpen && (
        <div
          id="theme_control_menu_dropdown"
          className="absolute right-0 mt-1.5 w-40 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-100"
        >
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                id={`btn_theme_opt_${opt.id}`}
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  <span>{opt.label}</span>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

