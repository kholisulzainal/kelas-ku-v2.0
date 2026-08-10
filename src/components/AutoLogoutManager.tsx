import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ShieldAlert, LogOut, Check } from 'lucide-react';

interface AutoLogoutManagerProps {
  onLogout: () => void;
}

export function AutoLogoutManager({ onLogout }: AutoLogoutManagerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [minutesSetting, setMinutesSetting] = useState<number>(() => {
    const saved = localStorage.getItem('auto_logout_minutes');
    if (saved === 'off') return 0; // 0 means disabled
    return saved ? parseInt(saved, 10) : 5; // Default is 5 minutes
  });

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync settings when updated in Header
  useEffect(() => {
    const handleSettingChange = () => {
      const saved = localStorage.getItem('auto_logout_minutes');
      if (saved === 'off') {
        setMinutesSetting(0);
      } else {
        setMinutesSetting(saved ? parseInt(saved, 10) : 5);
      }
      // Reset activity on setting change
      lastActivityRef.current = Date.now();
      setShowWarning(false);
    };

    window.addEventListener('auto-logout-setting-changed', handleSettingChange);
    return () => {
      window.removeEventListener('auto-logout-setting-changed', handleSettingChange);
    };
  }, []);

  // Set up user activity tracking
  useEffect(() => {
    if (minutesSetting === 0) {
      // Disabled
      if (timerRef.current) clearInterval(timerRef.current);
      if (warningTimerRef.current) clearInterval(warningTimerRef.current);
      setShowWarning(false);
      return;
    }

    const resetActivity = () => {
      const now = Date.now();
      // Throttle activity updates to once every 5 seconds to reduce CPU overhead
      if (now - lastActivityRef.current > 5000) {
        lastActivityRef.current = now;
      }
      if (showWarning) {
        setShowWarning(false);
      }
    };

    // Track common user input events
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetActivity, { passive: true });
    });

    // Check inactivity periodically
    const checkInterval = 5000; // Check every 5 seconds
    timerRef.current = setInterval(() => {
      if (showWarning) return; // Warning countdown handles itself

      const inactiveTimeMs = Date.now() - lastActivityRef.current;
      const timeoutMs = minutesSetting * 60 * 1000;
      const warningThresholdMs = timeoutMs - 30 * 1000; // Show warning 30 seconds before logout

      // For short timeouts (e.g., 1 minute), adjust warning threshold to 15 seconds
      const warningDurationSec = minutesSetting === 1 ? 15 : 30;
      const adjustedThresholdMs = timeoutMs - warningDurationSec * 1000;

      if (inactiveTimeMs >= adjustedThresholdMs) {
        setCountdown(warningDurationSec);
        setShowWarning(true);
      }
    }, checkInterval);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetActivity);
      });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [minutesSetting, showWarning]);

  // Handle countdown timer inside warning state
  useEffect(() => {
    if (!showWarning) {
      if (warningTimerRef.current) {
        clearInterval(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      return;
    }

    warningTimerRef.current = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (warningTimerRef.current) {
        clearInterval(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [showWarning]);

  // Trigger logout safely when countdown reaches 0
  useEffect(() => {
    if (showWarning && countdown === 0) {
      handleAutoLogout();
    }
  }, [showWarning, countdown]);

  const handleKeepLoggedIn = () => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  };

  const handleAutoLogout = () => {
    setShowWarning(false);
    // Set a flag so Login page can display an auto-logout message
    localStorage.setItem('auto_logged_out_flag', 'true');
    onLogout();
  };

  const maxWarningDuration = minutesSetting === 1 ? 15 : 30;
  const progressPercent = (countdown / maxWarningDuration) * 100;

  return (
    <AnimatePresence>
      {showWarning && (
        <div 
          id="auto_logout_backdrop" 
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            id="auto_logout_modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden space-y-5"
          >
            {/* Animated countdown indicator line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 dark:bg-slate-800">
              <div 
                className="h-full bg-amber-500 transition-all duration-1000 rounded-r-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Icon & Title */}
            <div className="flex items-center gap-4 pt-2">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl shrink-0 text-amber-500 animate-pulse">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Sesi Masuk Berakhir
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Keamanan Sesi Pengguna Aktif
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Anda terdeteksi tidak aktif selama beberapa menit. Demi melindungi data pribadi Anda di lingkungan bersama, sesi akan ditutup otomatis.
              </p>
              
              <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Keluar otomatis dalam:
                </span>
                <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                  {countdown} detik
                </span>
              </div>
            </div>

            {/* Option Buttons */}
            <div className="flex flex-col xs:flex-row gap-2.5 pt-1.5 justify-end">
              <button
                type="button"
                onClick={handleAutoLogout}
                className="order-2 xs:order-1 flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar Sekarang
              </button>
              <button
                type="button"
                onClick={handleKeepLoggedIn}
                className="order-1 xs:order-2 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Check className="w-3.5 h-3.5" />
                Tetap Masuk
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
