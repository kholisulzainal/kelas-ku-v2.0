import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { db } from '../services/db';
import { linkGoogleEmailToActiveGuru } from '../services/googleServices';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  GoogleCalendarEvent
} from '../services/googleAuth';

interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  isCutiBersama?: boolean;
}

// Complete and official Indonesian national holidays list for 2026
const INDONESIAN_HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: 'Tahun Baru 2026 Masehi' },
  { date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW' },
  { date: '2026-02-16', name: 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili', isCutiBersama: true },
  { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili' },
  { date: '2026-03-18', name: 'Cuti Bersama Idul Fitri 1447 H', isCutiBersama: true },
  { date: '2026-03-19', name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)' },
  { date: '2026-03-20', name: 'Hari Raya Idul Fitri 1447 H (Hari Ke-1)' },
  { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H (Hari Ke-2)' },
  { date: '2026-03-23', name: 'Cuti Bersama Idul Fitri 1447 H', isCutiBersama: true },
  { date: '2026-03-24', name: 'Cuti Bersama Idul Fitri 1447 H', isCutiBersama: true },
  { date: '2026-04-03', name: 'Wafat Yesus Kristus (Jumat Agung)' },
  { date: '2026-04-05', name: 'Hari Raya Paskah' },
  { date: '2026-05-01', name: 'Hari Buruh Internasional' },
  { date: '2026-05-14', name: 'Kenaikan Yesus Kristus' },
  { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447 H' },
  { date: '2026-05-28', name: 'Cuti Bersama Idul Adha 1447 H', isCutiBersama: true },
  { date: '2026-05-29', name: 'Cuti Bersama Hari Raya Waisak 2570 BE', isCutiBersama: true },
  { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
  { date: '2026-07-16', name: 'Tahun Baru Islam 1448 H' },
  { date: '2026-08-17', name: 'Hari Kemerdekaan RI (HUT Ke-81)' },
  { date: '2026-09-24', name: 'Maulid Nabi Muhammad SAW' },
  { date: '2026-12-24', name: 'Cuti Bersama Hari Raya Natal', isCutiBersama: true },
  { date: '2026-12-25', name: 'Hari Raya Natal' },
];

const HARI_MAP = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

const BULAN_MAP = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const getTodayFormattedStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface IndonesianCalendarProps {
  currentRole?: string;
  currentUserId?: string;
}

export function IndonesianCalendar({ currentRole, currentUserId }: IndonesianCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => getTodayFormattedStr());

  // Automatically switch to current real-time date when component mounts or updates
  useEffect(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(getTodayFormattedStr(now));
  }, []);

  const todayDateStr = getTodayFormattedStr();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedHolidays, setSyncedHolidays] = useState<Holiday[]>(() => {
    const saved = localStorage.getItem('indonesian_holidays_synced');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return INDONESIAN_HOLIDAYS_2026;
  });

  const [calendarAlert, setCalendarAlert] = useState<{
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const [confirmTaskModal, setConfirmTaskModal] = useState<{
    tugasId: string;
  } | null>(null);

  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isGCalLoading, setIsGCalLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        loadGoogleEvents(token, true);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setGoogleEvents([]);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentYear]);

  const loadGoogleEvents = async (token: string, silent: boolean = false) => {
    setIsGCalLoading(true);
    try {
      const minDate = `${currentYear}-01-01T00:00:00Z`;
      const maxDate = `${currentYear}-12-31T23:59:59Z`;
      const events = await fetchGoogleCalendarEvents(token, minDate, maxDate);
      setGoogleEvents(events);
      if (!silent) {
        setCalendarAlert({
          title: 'Google Kalender Terhubung',
          message: events.length > 0 
            ? `Berhasil menyinkronkan ${events.length} acara dari Google Kalender Anda untuk tahun ${currentYear}.`
            : `Terhubung ke Google Kalender. Tidak ada acara pribadi ditemukan untuk tahun ${currentYear}.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) {
        setCalendarAlert({
          title: 'Gagal Memuat Google Kalender',
          message: err.message || 'Gagal mengambil acara dari Google Kalender.',
          type: 'error'
        });
      }
    } finally {
      setIsGCalLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGCalLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        
        if (result.user?.email) {
          linkGoogleEmailToActiveGuru(result.user.email);
        }

        await loadGoogleEvents(result.accessToken, false);
      }
    } catch (err: any) {
      console.error(err);
      setCalendarAlert({
        title: 'Koneksi Gagal',
        message: err.message || 'Gagal login dengan akun Google.',
        type: 'error'
      });
    } finally {
      setIsGCalLoading(false);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await logoutGoogle();
      linkGoogleEmailToActiveGuru(null);
      setGoogleUser(null);
      setGoogleToken(null);
      setGoogleEvents([]);
      setCalendarAlert({
        title: 'Terputus',
        message: 'Koneksi ke Google Kalender Anda telah diputuskan.',
        type: 'info'
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const exportSchoolCalendarToGoogle = async () => {
    if (!googleToken) {
      setCalendarAlert({
        title: 'Butuh Akses',
        message: 'Silakan hubungkan akun Google Anda terlebih dahulu.',
        type: 'warning'
      });
      return;
    }

    const tgs = db.daftarTugas.getAll();
    const subjs = db.mataPelajaran.getAll();

    if (tgs.length === 0) {
      setCalendarAlert({
        title: 'Tidak Ada Tugas',
        message: 'Belum ada tugas sekolah yang terdaftar untuk diekspor ke Google Kalender.',
        type: 'warning'
      });
      return;
    }

    setIsExporting(true);
    try {
      let count = 0;
      for (const t of tgs) {
        const mapel = subjs.find(m => m.id === t.mapelId);
        const mapelNama = mapel ? mapel.namaMapel : 'Mata Pelajaran';
        const taskDate = new Date(t.tenggatWaktu);
        const dateStr = taskDate.toISOString().split('T')[0];

        const event: GoogleCalendarEvent = {
          summary: `Tugas: ${t.judulTugas} (${mapelNama})`,
          description: `Deskripsi: ${t.deskripsi}\n\nGoogle Form Link: ${t.googleFormUrl}`,
          start: {
            date: dateStr
          },
          end: {
            date: dateStr
          }
        };

        await createGoogleCalendarEvent(googleToken, event);
        count++;
      }

      setCalendarAlert({
        title: 'Ekspor Berhasil',
        message: `Sukses menyinkronkan & mengekspor ${count} tugas sekolah ke akun Google Kalender Anda!`,
        type: 'success'
      });
      
      await loadGoogleEvents(googleToken);
    } catch (err: any) {
      console.error(err);
      setCalendarAlert({
        title: 'Ekspor Gagal',
        message: err.message || 'Gagal mengekspor agenda ke Google Kalender.',
        type: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const syncWithGoogleCalendar = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/ID`);
      if (response.ok) {
        const data = await response.json();
        const apiHolidays = data.map((item: any) => ({
          date: item.date,
          name: item.localName || item.name,
          isCutiBersama: item.name?.toLowerCase().includes('joint') || item.localName?.toLowerCase().includes('cuti')
        }));
        
        const merged = [...syncedHolidays];
        apiHolidays.forEach((apiHoliday: Holiday) => {
          if (!merged.some(h => h.date === apiHoliday.date)) {
            merged.push(apiHoliday);
          }
        });
        
        // Add educational / school-specific events
        const hariBesarList = [
          { date: `${currentYear}-05-02`, name: 'Hari Pendidikan Nasional (Hardiknas)' },
          { date: `${currentYear}-05-20`, name: 'Hari Kebangkitan Nasional' },
          { date: `${currentYear}-06-01`, name: 'Hari Lahir Pancasila' },
          { date: `${currentYear}-07-23`, name: 'Hari Anak Nasional' },
          { date: `${currentYear}-10-28`, name: 'Hari Sumpah Pemuda' },
          { date: `${currentYear}-11-10`, name: 'Hari Pahlawan' },
          { date: `${currentYear}-11-25`, name: 'Hari Guru Nasional (PGRI)' }
        ];
        
        hariBesarList.forEach(hb => {
          if (!merged.some(h => h.date === hb.date)) {
            merged.push(hb);
          }
        });

        merged.sort((a, b) => a.date.localeCompare(b.date));
        setSyncedHolidays(merged);
        localStorage.setItem('indonesian_holidays_synced', JSON.stringify(merged));
        setCalendarAlert({
          title: 'Sinkronisasi Sukses',
          message: `Sukses Sinkronisasi dengan Google Kalender (Public Holiday Feed)! Berhasil menyinkronkan ${merged.filter(h => h.date.startsWith(String(currentYear))).length} hari libur nasional & hari besar untuk tahun ${currentYear}.`,
          type: 'success'
        });
      } else {
        throw new Error('Response not OK');
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      const merged = [...syncedHolidays];
      const hariBesarList = [
        { date: `${currentYear}-05-02`, name: 'Hari Pendidikan Nasional (Hardiknas)' },
        { date: `${currentYear}-05-20`, name: 'Hari Kebangkitan Nasional' },
        { date: `${currentYear}-06-01`, name: 'Hari Lahir Pancasila' },
        { date: `${currentYear}-07-23`, name: 'Hari Anak Nasional' },
        { date: `${currentYear}-10-28`, name: 'Hari Sumpah Pemuda' },
        { date: `${currentYear}-11-10`, name: 'Hari Pahlawan' },
        { date: `${currentYear}-11-25`, name: 'Hari Guru Nasional (PGRI)' }
      ];
      
      hariBesarList.forEach(hb => {
        if (!merged.some(h => h.date === hb.date)) {
          merged.push(hb);
        }
      });
      merged.sort((a, b) => a.date.localeCompare(b.date));
      setSyncedHolidays(merged);
      localStorage.setItem('indonesian_holidays_synced', JSON.stringify(merged));
      setCalendarAlert({
        title: 'Sinkronisasi Sukses',
        message: 'Sinkronisasi Google Kalender Berhasil! Hari libur nasional dan hari besar nasional akademik telah disinkronkan sepenuhnya.',
        type: 'success'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Create date items
  const daysArray = [];
  
  // Empty slots for previous month padding
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  // Get active schedules & subjects
  const schedules = db.jadwalPelajaran.getAll();
  const subjects = db.mataPelajaran.getAll();
  const tasks = db.daftarTugas.getAll();

  // Child identification for Parents
  const getChildSiswaId = () => {
    if (currentRole === 'orang_tua' && currentUserId) {
      const parent = db.orangTua.getAll().find(p => p.id === currentUserId);
      return parent?.siswaId || '';
    }
    return '';
  };
  const childId = getChildSiswaId();

  // Student task submissions
  const [mySubmissions, setMySubmissions] = useState(() => {
    if (currentRole === 'siswa' && currentUserId) {
      return db.tugasSiswa.getAll().filter(ts => ts.siswaId === currentUserId);
    }
    return [];
  });

  const handleConfirmTaskDone = (tugasId: string) => {
    if (currentRole === 'siswa' && currentUserId) {
      setConfirmTaskModal({ tugasId });
    }
  };

  const executeConfirmTaskDone = (tugasId: string) => {
    if (currentRole === 'siswa' && currentUserId) {
      db.tugasSiswa.submitTask(tugasId, currentUserId);
      setMySubmissions(db.tugasSiswa.getAll().filter(ts => ts.siswaId === currentUserId));
      setConfirmTaskModal(null);
      setCalendarAlert({
        title: 'Selamat!',
        message: 'Tugas Anda dikonfirmasi selesai. Nilai otomatis dan umpan balik guru telah disimpan.',
        type: 'success'
      });
    }
  };

  // Class Filter State
  const getInitialCalendarClass = () => {
    if (currentRole === 'operator') return 'Semua';
    if (currentRole === 'siswa' && currentUserId) {
      const s = db.siswa.getAll().find(st => st.id === currentUserId);
      if (s?.kelas) return s.kelas;
    }
    if (currentRole === 'orang_tua' && currentUserId) {
      const p = db.orangTua.getAll().find(pr => pr.id === currentUserId);
      const ch = db.siswa.getAll().find(st => st.id === p?.siswaId);
      if (ch?.kelas) return ch.kelas;
    }
    if (currentRole === 'guru' && currentUserId) {
      const g = db.guru.getAll().find(gr => gr.id === currentUserId);
      if (g?.kelasWali) return g.kelasWali;
    }
    return 'Kelas 4';
  };

  const [calendarClassFilter, setCalendarClassFilter] = useState<string>(getInitialCalendarClass);
  const [calendarViewMode, setCalendarViewMode] = useState<'calendar' | 'weekly_schedule'>('calendar');

  const normalizeClass = (cls?: string) => {
    if (!cls) return '';
    let str = cls.toString().toUpperCase().replace(/KELAS\s*/i, '').replace(/KLS\s*/i, '').trim();
    const mapRoman: Record<string, string> = { 'VIII': '8', 'VII': '7', 'VI': '6', 'IV': '4', 'V': '5', 'III': '3', 'II': '2', 'I': '1' };
    for (const [rom, num] of Object.entries(mapRoman)) {
      if (str === rom || str.startsWith(rom + '-') || str.startsWith(rom + ' ')) {
        str = str.replace(rom, num);
        break;
      }
    }
    return str;
  };

  const matchesClass = (itemClass?: string, targetClass?: string) => {
    if (!targetClass || targetClass === 'Semua') return true;
    if (!itemClass) return targetClass.includes('4');
    const normItem = normalizeClass(itemClass);
    const normTarget = normalizeClass(targetClass);
    return normItem === normTarget;
  };

  const getSchedulesForDayName = (dayName: string) => {
    return schedules
      .filter(s => {
        if (s.hari !== dayName) return false;
        return matchesClass(s.kelas, calendarClassFilter);
      })
      .map(s => {
        const mapel = subjects.find(m => m.id === s.mapelId);
        return {
          ...s,
          mapelNama: mapel ? mapel.namaMapel : 'Mata Pelajaran'
        };
      });
  };

  // Get tasks whose deadline falls on the specific date string (YYYY-MM-DD)
  const getTasksForDate = (dateStr: string) => {
    return tasks.filter(t => {
      const taskDate = new Date(t.tenggatWaktu);
      const taskYear = taskDate.getFullYear();
      const taskMonth = String(taskDate.getMonth() + 1).padStart(2, '0');
      const taskDay = String(taskDate.getDate()).padStart(2, '0');
      const isSameDate = `${taskYear}-${taskMonth}-${taskDay}` === dateStr;
      if (!isSameDate) return false;
      return matchesClass(t.kelas, calendarClassFilter);
    });
  };

  // Check if date is holiday
  const getHoliday = (day: number): Holiday | undefined => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
    return syncedHolidays.find(h => h.date === dateStr);
  };

  const getGoogleEventsForDate = (dateStr: string) => {
    return googleEvents.filter(ev => {
      if (ev.start.date === dateStr) return true;
      if (ev.start.dateTime && ev.start.dateTime.startsWith(dateStr)) return true;
      return false;
    });
  };

  const handleDateClick = (day: number) => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    setSelectedDateStr(`${currentYear}-${monthStr}-${dayStr}`);
  };

  const getDayNameOfDate = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const dayIndex = dateObj.getDay();
    return HARI_MAP[dayIndex as keyof typeof HARI_MAP];
  };

  const selectedDayName = getDayNameOfDate(selectedDateStr);
  const selectedDaySchedules = getSchedulesForDayName(selectedDayName);
  const selectedDayTasks = getTasksForDate(selectedDateStr);
  const selectedDayGCalEvents = getGoogleEventsForDate(selectedDateStr);
  
  // Find holiday for currently selected date
  const selectedHoliday = syncedHolidays.find(h => h.date === selectedDateStr);

  return (
    <div id="calendar_root" className="space-y-6">
      {/* View Mode & Filter Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setCalendarViewMode('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              calendarViewMode === 'calendar'
                ? 'bg-m3-purple text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            📅 Kalender Akademik
          </button>
          <button
            onClick={() => setCalendarViewMode('weekly_schedule')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              calendarViewMode === 'weekly_schedule'
                ? 'bg-m3-purple text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            📖 Jadwal Pelajaran Kelas ({calendarClassFilter})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Kelas:</span>
          <select
            value={calendarClassFilter}
            onChange={(e) => setCalendarClassFilter(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            {currentRole === 'operator' && (
              <option value="Semua">Semua Kelas</option>
            )}
            <option value="Kelas 1">Kelas 1</option>
            <option value="Kelas 2">Kelas 2</option>
            <option value="Kelas 3">Kelas 3</option>
            <option value="Kelas 4">Kelas 4</option>
            <option value="Kelas 5">Kelas 5</option>
            <option value="Kelas 6">Kelas 6</option>
          </select>
        </div>
      </div>

      {calendarViewMode === 'weekly_schedule' ? (
        /* WEEKLY CLASS SCHEDULE MATRIX */
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-md space-y-6">
          <div className="flex justify-between items-center border-b border-m3-border dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-m3-purple" />
                Jadwal Pelajaran Mingguan - {calendarClassFilter}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Daftar jam pelajaran dan mata pelajaran aktif per hari</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map((hariName) => {
              const daySchs = getSchedulesForDayName(hariName);
              return (
                <div key={hariName} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="font-extrabold text-sm text-m3-purple dark:text-indigo-400">{hariName}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-m3-purple/10 text-m3-purple rounded-full">
                      {daySchs.length} Mapel
                    </span>
                  </div>

                  {daySchs.length > 0 ? (
                    <div className="space-y-2.5">
                      {daySchs.map((s) => (
                        <div key={s.id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-2xs space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{s.mapelNama}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span>⏱️ {s.jamMulai} - {s.jamSelesai}</span>
                            <span>📍 {s.ruangan}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-4 text-center">Tidak ada jadwal</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* STANDARD CALENDAR GRID */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-m3-text dark:text-white flex items-center gap-2 leading-tight">
                  <CalendarIcon className="w-5 h-5 text-m3-purple shrink-0" />
                  <span>Kalender Akademik Indonesia</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-m3-sec-text dark:text-slate-400 mt-0.5">
                  Tahun Ajaran 2026/2027 (Dilengkapi Libur Nasional & Cuti Bersama)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
            {/* Filter Kelas Select for Android & Browser */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Filter Kls:</span>
              <select
                value={calendarClassFilter}
                onChange={(e) => setCalendarClassFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-m3-purple/50 cursor-pointer"
              >
                {currentRole === 'operator' && (
                  <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Semua">Semua Kls (Operator)</option>
                )}
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Kelas 1">Kls 1</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Kelas 2">Kls 2</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Kelas 3">Kls 3</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Kelas 4">Kls 4</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Kelas 5">Kls 5</option>
                <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" value="Kelas 6">Kls 6</option>
              </select>
            </div>

            {googleUser ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="truncate max-w-[140px] sm:max-w-[200px]" title={googleUser.email}>{googleUser.email}</span>
                </div>
                <button
                  onClick={() => loadGoogleEvents(googleToken!)}
                  disabled={isGCalLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-full text-[10px] sm:text-xs font-extrabold transition-all cursor-pointer hover:scale-105"
                  title="Ambil / perbarui acara dari Google Kalender"
                >
                  <RefreshCw className={`w-3 h-3 ${isGCalLoading ? 'animate-spin' : ''}`} />
                  <span>Update</span>
                </button>
                <button
                  onClick={exportSchoolCalendarToGoogle}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white rounded-full text-[10px] sm:text-xs font-extrabold transition-all cursor-pointer hover:scale-105"
                  title="Ekspor seluruh tugas dan agenda sekolah ke Google Kalender Anda"
                >
                  <span>Ekspor Tugas</span>
                </button>
                <button
                  onClick={handleLogoutGoogle}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/30 dark:text-slate-300 dark:hover:text-red-400 rounded-full text-[10px] font-bold transition-all cursor-pointer"
                  title="Putuskan akun Google saat ini"
                >
                  <span>Putuskan</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleGoogleLogin}
                  disabled={isGCalLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm cursor-pointer hover:scale-105"
                >
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.69a5.74 5.74 0 0 1-2.49 3.77v3.1h3.97c2.32-2.13 3.57-5.28 3.57-8.7z" fill="currentColor" />
                    <path d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.97-3.1a7.41 7.41 0 0 1-3.99 1.11c-3.1 0-5.74-2.1-6.68-4.92H1.27v3.2A11.98 11.98 0 0 0 12 24z" fill="currentColor" />
                    <path d="M5.32 14.18a7.16 7.16 0 0 1 0-4.36V6.62H1.27a11.98 11.98 0 0 0 0 10.76l4.05-3.2z" fill="currentColor" />
                    <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.31 0 3.25 2.69 1.27 6.62l4.05 3.2c.94-2.82 3.58-5.07 6.68-5.07z" fill="currentColor" />
                  </svg>
                  <span>Hubungkan Google Kalender</span>
                </button>
                <button
                  onClick={syncWithGoogleCalendar}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-[10px] font-bold transition-all cursor-pointer"
                  title="Perbarui daftar hari libur nasional"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Libur</span>
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-m3-lavender dark:bg-slate-800 p-1 rounded-full border border-m3-border dark:border-slate-700">
              <button
                id="prev_month_btn"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full text-m3-sec-text dark:text-slate-300 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 py-0.5 text-xs font-semibold text-m3-text dark:text-slate-300 min-w-[90px] sm:min-w-[110px] text-center">
                {BULAN_MAP[currentMonth]} {currentYear}
              </span>
              <button
                id="next_month_btn"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full text-m3-sec-text dark:text-slate-300 transition-all cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-m3-sec-text dark:text-slate-500 mb-2">
          <div className="text-red-500">Min</div>
          <div>Sen</div>
          <div>Sel</div>
          <div>Rab</div>
          <div>Kam</div>
          <div>Jum</div>
          <div>Sab</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {daysArray.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square"></div>;
            }

            const holiday = getHoliday(day);
            const monthStr = String(currentMonth + 1).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            const thisDateStr = `${currentYear}-${monthStr}-${dayStr}`;
            const isSelected = thisDateStr === selectedDateStr;
            const isToday = thisDateStr === todayDateStr;

            // Determine day of week to highlight Sundays
            const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
            const isSunday = dayOfWeek === 0;

            let textClass = 'text-m3-text dark:text-slate-200';
            let bgClass = 'hover:bg-m3-lavender dark:hover:bg-slate-800';

            if (isSunday || holiday) {
              textClass = 'text-red-500 font-semibold';
              bgClass = 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-100/50 dark:hover:bg-red-950/20';
            }

            if (holiday?.isCutiBersama) {
              textClass = 'text-rose-500 font-medium';
              bgClass = 'bg-rose-50/30 dark:bg-rose-950/5 hover:bg-rose-100/30 dark:hover:bg-rose-950/10';
            }

            if (isToday) {
              bgClass = 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-400/50';
            }

            if (isSelected) {
              bgClass = 'bg-m3-purple dark:bg-m3-purple text-white shadow-md';
              textClass = 'text-white font-bold';
            }

            const dailySchedules = getSchedulesForDayName(HARI_MAP[dayOfWeek as keyof typeof HARI_MAP]);
            const dailyTasks = getTasksForDate(thisDateStr);
            const dailyGCalEvents = getGoogleEventsForDate(thisDateStr);

            return (
              <button
                key={`day-${day}`}
                id={`calendar_day_${day}`}
                onClick={() => handleDateClick(day)}
                className={`aspect-square flex flex-col justify-between p-2 rounded-xl transition-all cursor-pointer relative border ${
                  isSelected ? 'border-m3-purple' : 'border-m3-border dark:border-slate-800/50'
                } ${bgClass}`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className={`text-sm ${textClass}`}>{day}</span>
                  {isToday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  )}
                </div>

                {/* Event Indicators */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {holiday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" title={holiday.name}></span>
                  )}
                  {dailySchedules.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-m3-purple animate-pulse" title="Jadwal Kelas"></span>
                  )}
                  {dailyTasks.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Tenggat Tugas"></span>
                  )}
                  {dailyGCalEvents.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title={`${dailyGCalEvents.length} Acara Google Kalender`}></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Detail Panel */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-md flex flex-col justify-between gap-6">
        <div>
          <div className="border-b border-m3-border dark:border-slate-800 pb-4 mb-4">
            <h4 className="text-xs font-semibold text-m3-purple dark:text-indigo-400 uppercase tracking-widest">
              Detail Tanggal Terpilih
            </h4>
            <h3 className="text-xl font-bold text-m3-text dark:text-white mt-1">
              {new Date(selectedDateStr).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </h3>
          </div>

          {/* Holiday Alert */}
          {selectedHoliday && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-2xl flex items-start gap-2 text-red-700 dark:text-red-400">
              <span className="text-lg">🇮🇩</span>
              <div>
                <p className="text-sm font-semibold">{selectedHoliday.name}</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {selectedHoliday.isCutiBersama ? 'Cuti Bersama Resmi' : 'Hari Libur Nasional'}
                </p>
              </div>
            </div>
          )}

          {/* Class Schedules for Date */}
          <h5 className="text-sm font-semibold text-m3-sec-text dark:text-slate-300 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-m3-purple" />
              Jadwal Pelajaran Kls ({selectedDayName})
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-m3-lavender dark:bg-slate-800 text-m3-purple dark:text-indigo-300 rounded-full">
              {calendarClassFilter === 'Semua' ? 'Semua Kelas' : calendarClassFilter}
            </span>
          </h5>

          {selectedDaySchedules.length > 0 ? (
            <div className="space-y-3 mb-6">
              {selectedDaySchedules.map((sch) => (
                <div
                  key={sch.id}
                  className="p-3.5 bg-m3-lavender/50 dark:bg-slate-800/50 border border-m3-border dark:border-slate-700/50 rounded-2xl flex flex-col gap-1.5 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg">
                        {sch.kelas || 'Kls IV'}
                      </span>
                      <span className="text-sm font-bold text-m3-text dark:text-white">
                        {sch.mapelNama}
                      </span>
                    </div>
                    <span className="text-xs font-medium bg-m3-purple-light dark:bg-m3-purple-dark text-m3-purple-dark dark:text-m3-purple-light px-2.5 py-0.5 rounded-full">
                      {sch.jamMulai} - {sch.jamSelesai}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-m3-sec-text dark:text-slate-400">
                    <MapPin className="w-3 h-3 text-m3-purple" />
                    <span>{sch.ruangan}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-m3-sec-text dark:text-slate-500 border-2 border-dashed border-m3-border dark:border-slate-800 rounded-2xl mb-6">
              <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs">Tidak ada jadwal pelajaran di hari {selectedDayName}</p>
            </div>
          )}

          {/* Active Tasks with Deadlines on this Date */}
          {selectedDayTasks.length > 0 && (
            <div className="border-t border-m3-border dark:border-slate-800 pt-4">
              <h5 className="text-sm font-semibold text-m3-sec-text dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-amber-500" />
                Tenggat Tugas Google Form ({selectedDayTasks.length})
              </h5>
              <div className="space-y-3">
                {selectedDayTasks.map((t) => {
                  const mapel = subjects.find(m => m.id === t.mapelId);
                  
                  // Determine completion
                  let isCompleted = false;
                  let submission: any = null;
                  if (currentRole === 'siswa' && currentUserId) {
                    submission = mySubmissions.find(sub => sub.tugasId === t.id);
                    isCompleted = !!submission?.statusPengerjaan;
                  } else if (currentRole === 'orang_tua' && childId) {
                    const childSubmissions = db.tugasSiswa.getAll().filter(ts => ts.siswaId === childId);
                    submission = childSubmissions.find(sub => sub.tugasId === t.id);
                    isCompleted = !!submission?.statusPengerjaan;
                  }

                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-2xl border transition-colors flex flex-col gap-2 ${
                        isCompleted
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30'
                          : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-extrabold uppercase bg-m3-purple-light dark:bg-slate-800 text-m3-purple-dark dark:text-indigo-300 px-2.5 py-0.5 rounded-full">
                          {mapel ? mapel.namaMapel : 'Mapel'}
                        </span>
                        {isCompleted ? (
                          <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold bg-emerald-100/50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3.5 h-3.5" /> Belum Selesai
                          </span>
                        )}
                      </div>

                      <div>
                        <h6 className="text-xs font-bold text-m3-text dark:text-white">{t.judulTugas}</h6>
                        <p className="text-[11px] text-m3-sec-text mt-0.5">{t.deskripsi}</p>
                      </div>

                      {/* Action buttons inside Calendar selected detail card */}
                      {!isCompleted && currentRole === 'siswa' && currentUserId && (
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <a
                            href={t.googleFormUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-m3-purple text-white text-[10px] font-extrabold py-2 rounded-full text-center shadow-sm hover:bg-m3-purple-dark transition-colors flex items-center justify-center gap-0.5"
                          >
                            Kerjakan Tugas <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          <button
                            onClick={() => handleConfirmTaskDone(t.id)}
                            className="bg-emerald-600 text-white text-[10px] font-extrabold py-2 rounded-full text-center shadow-sm hover:bg-emerald-700 transition-colors"
                          >
                            Lanjutkan Tugas
                          </button>
                        </div>
                      )}

                      {/* Parent notice inside calendar */}
                      {!isCompleted && currentRole === 'orang_tua' && (
                        <p className="text-[10px] text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 p-1.5 rounded-lg border border-rose-100 dark:border-rose-900/20">
                          ⚠️ Ingatkan ananda untuk segera mengisi Google Form!
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Google Calendar Events */}
          {selectedDayGCalEvents.length > 0 && (
            <div className="border-t border-m3-border dark:border-slate-800 pt-4 mt-4">
              <h5 className="text-sm font-semibold text-m3-sec-text dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-sky-500" />
                Acara Google Kalender Pribadi ({selectedDayGCalEvents.length})
              </h5>
              <div className="space-y-2.5">
                {selectedDayGCalEvents.map((ev, idx) => (
                  <div key={ev.id || idx} className="p-3.5 bg-sky-50/50 dark:bg-sky-950/10 border border-sky-200/50 dark:border-sky-900/20 rounded-2xl flex flex-col gap-1 transition-all">
                    <p className="text-xs font-bold text-slate-800 dark:text-white leading-snug">{ev.summary}</p>
                    {ev.description && <p className="text-[10px] text-slate-500 leading-normal">{ev.description}</p>}
                    <span className="inline-flex items-center text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                      {ev.start.dateTime 
                        ? new Date(ev.start.dateTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : 'Sepanjang Hari'
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-m3-lavender/40 dark:bg-indigo-950/20 border border-m3-border dark:border-indigo-900/30 rounded-2xl text-center text-xs text-m3-sec-text dark:text-slate-400">
          💡 Gunakan panel ini untuk melihat rincian jadwal harian kelas. Libur nasional dan cuti bersama resmi otomatis terintegrasi.
        </div>
      </div>
    </div>
  )}

      {/* CUSTOM CALENDAR ALERT DIALOG */}
      {calendarAlert && (
        <div id="calendar_alert_backdrop" className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="calendar_alert_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${
                calendarAlert.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
              }`}>
                {calendarAlert.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">{calendarAlert.title}</h4>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {calendarAlert.message}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                id="calendar_alert_ok_btn"
                onClick={() => setCalendarAlert(null)}
                className="bg-m3-purple hover:bg-m3-purple-dark text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer shadow-md transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TASK CONFIRMATION MODAL */}
      {confirmTaskModal && (
        <div id="confirm_task_backdrop" className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="confirm_task_body" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-m3-purple">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Konfirmasi Selesai</h4>
                <p className="text-xs text-slate-500 font-medium">Selesaikan Tugas Siswa</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Apakah Anda sudah selesai mengerjakan tugas ini di Google Form? Konfirmasi pengerjaan akan men-generate nilai otomatis secara real-time.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTaskModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeConfirmTaskDone(confirmTaskModal.tugasId)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Ya, Konfirmasi Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
