import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  X,
  Calendar,
  AlertTriangle,
  Megaphone,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  BookOpen,
  Send,
  User,
  Check,
  Eye,
  Info
} from 'lucide-react';
import { db } from '../services/db';
import { Notifikasi, UserRole, DaftarTugas } from '../types';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  currentUserId: string;
}

export function NotificationCenter({ isOpen, onClose, currentRole, currentUserId }: NotificationCenterProps) {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'deadlines' | 'warnings' | 'announcements'>('all');
  const [notifs, setNotifs] = useState<Notifikasi[]>([]);
  const [tasks, setTasks] = useState<DaftarTugas[]>([]);
  const [mapels, setMapels] = useState(() => db.mataPelajaran.getAll());
  const [siswas, setSiswas] = useState(() => db.siswa.getAll());
  
  // Custom Announcement Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formTargetRole, setFormTargetRole] = useState<UserRole>('siswa');
  const [formSuccessMessage, setFormSuccessMessage] = useState('');

  // Auto-reload data periodically
  useEffect(() => {
    if (!isOpen) return;

    const loadData = () => {
      // 1. Load Notifications
      const allNotifs = db.notifikasi.getAll();
      const filteredNotifs = allNotifs.filter(n => {
        const matchesRole = n.penerimaRole === currentRole;
        const matchesUser = !n.penerimaUserId || n.penerimaUserId === currentUserId;
        return matchesRole && matchesUser;
      });
      setNotifs(filteredNotifs);

      // 2. Load Tasks
      setTasks(db.daftarTugas.getAll());
      setMapels(db.mataPelajaran.getAll());
      setSiswas(db.siswa.getAll());
    };

    loadData();

    window.addEventListener('supabase-data-updated', loadData);
    window.addEventListener('notifikasi-updated', loadData);
    window.addEventListener('storage', loadData);

    // Only run periodic background check if modal is open, at 20 seconds
    let interval: any = null;
    if (isOpen) {
      interval = setInterval(loadData, 20000);
    }

    return () => {
      window.removeEventListener('supabase-data-updated', loadData);
      window.removeEventListener('notifikasi-updated', loadData);
      window.removeEventListener('storage', loadData);
      if (interval) clearInterval(interval);
    };
  }, [isOpen, currentRole, currentUserId]);

  // Calculations:
  // --- Individual Student Attendance Rate
  const getStudentAttendanceDetails = (studentId: string) => {
    const studentAbsen = db.absensi.getAll().filter(a => a.siswaId === studentId);
    if (studentAbsen.length === 0) {
      return { rate: 100, total: 0, hadir: 0, sakit: 0, izin: 0, alfa: 0 };
    }
    const total = studentAbsen.length;
    const hadir = studentAbsen.filter(a => a.status === 'hadir').length;
    const sakit = studentAbsen.filter(a => a.status === 'sakit').length;
    const izin = studentAbsen.filter(a => a.status === 'izin').length;
    const alfa = studentAbsen.filter(a => a.status === 'alfa').length;
    const rate = Math.round((hadir / total) * 100);
    return { rate, total, hadir, sakit, izin, alfa };
  };

  // --- Get Attendance Warnings
  const getAttendanceWarnings = () => {
    const warnings: Array<{
      id: string;
      title: string;
      message: string;
      severity: 'high' | 'medium';
      type: 'warning';
      extra?: string;
    }> = [];

    if (currentRole === 'guru') {
      // Show all students under 90% attendance
      siswas.forEach(s => {
        const att = getStudentAttendanceDetails(s.id);
        if (att.total > 0 && att.rate < 90) {
          warnings.push({
            id: `att-warn-${s.id}`,
            title: `Kehadiran Rendah: ${s.namaSiswa}`,
            message: `${s.namaSiswa} (${s.kelas}) memiliki tingkat kehadiran ${att.rate}%. Terbaca ${att.alfa} kali Alfa dan ${att.sakit + att.izin} kali Izin/Sakit.`,
            severity: att.rate < 80 ? 'high' : 'medium',
            type: 'warning',
            extra: `Kelas: ${s.kelas}`
          });
        }
      });

      // Show if today's roll call is missing for Wali Kelas
      // Let's check if the current teacher is a Wali Kelas
      const gurus = db.guru.getAll();
      const loggedInGuru = gurus.find(g => g.id === currentUserId);
      const isWaliKelas = loggedInGuru?.isWaliKelas === true || loggedInGuru?.id === 'guru-1';
      
      if (isWaliKelas) {
        const targetClass = loggedInGuru?.id === 'guru-1' ? 'Kelas 4' : 'Kelas Wali';
        const todayStr = new Date().toISOString().split('T')[0];
        const classStudents = siswas.filter(s => s.kelas === targetClass || targetClass === 'Kelas 4');
        const studentIds = new Set(classStudents.map(s => s.id));
        const todayAbsen = db.absensi.getAll().filter(a => a.tanggal === todayStr && studentIds.has(a.siswaId));
        
        if (todayAbsen.length === 0 && classStudents.length > 0) {
          warnings.push({
            id: `att-today-missing`,
            title: `Presensi Hari Ini Belum Diisi`,
            message: `Pencatatan kehadiran harian untuk ${targetClass} pada tanggal ${todayStr} belum direkam.`,
            severity: 'high',
            type: 'warning'
          });
        }
      }
    } else if (currentRole === 'siswa') {
      const att = getStudentAttendanceDetails(currentUserId);
      if (att.total > 0 && att.rate < 90) {
        warnings.push({
          id: `att-warn-self`,
          title: `Peringatan Kehadiran Saya`,
          message: `Persentase kehadiran Anda saat ini adalah ${att.rate}%. Pertahankan kehadiran Anda agar tetap di atas 90% sebagai syarat kelayakan akademik.`,
          severity: att.rate < 80 ? 'high' : 'medium',
          type: 'warning'
        });
      }
    } else if (currentRole === 'orang_tua') {
      const ortuList = db.orangTua.getAll();
      const parent = ortuList.find(o => o.id === currentUserId);
      if (parent) {
        const student = siswas.find(s => s.id === parent.siswaId);
        if (student) {
          const att = getStudentAttendanceDetails(student.id);
          if (att.total > 0 && att.rate < 90) {
            warnings.push({
              id: `att-warn-child`,
              title: `Peringatan Kehadiran Anak: ${student.namaSiswa}`,
              message: `Kehadiran Ananda ${student.namaSiswa} berada di angka ${att.rate}% (${att.alfa} kali Alfa). Harap berkoordinasi dengan wali kelas terkait absensi ini.`,
              severity: att.rate < 80 ? 'high' : 'medium',
              type: 'warning'
            });
          }
        }
      }
    }

    return warnings;
  };

  // --- Get Task Deadlines
  const getDeadlineAlerts = () => {
    const alerts: Array<{
      id: string;
      title: string;
      message: string;
      dueDate: string;
      timeLeft: string;
      subject: string;
      severity: 'high' | 'medium' | 'info';
      completed: boolean;
    }> = [];

    const now = new Date();

    if (currentRole === 'siswa') {
      // Get student tasks
      const studentTasks = tasks;
      const submissions = db.tugasSiswa.getAll().filter(ts => ts.siswaId === currentUserId);

      studentTasks.forEach(task => {
        const sub = submissions.find(ts => ts.tugasId === task.id);
        const isCompleted = sub?.statusPengerjaan === true;
        const mapel = mapels.find(m => m.id === task.mapelId);

        const dueTime = new Date(task.tenggatWaktu);
        const diffMs = dueTime.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let timeLeft = '';
        let severity: 'high' | 'medium' | 'info' = 'info';

        if (diffMs < 0) {
          timeLeft = 'Telah melewati tenggat waktu';
          severity = 'high';
        } else if (diffDays === 1) {
          timeLeft = 'Besok!';
          severity = 'high';
        } else if (diffDays <= 3) {
          timeLeft = `${diffDays} hari lagi`;
          severity = 'medium';
        } else {
          timeLeft = `${diffDays} hari lagi`;
          severity = 'info';
        }

        alerts.push({
          id: task.id,
          title: task.judulTugas,
          message: task.deskripsi || 'Silakan kerjakan tugas formulir ini',
          dueDate: task.tenggatWaktu.replace('T', ' '),
          timeLeft,
          subject: mapel?.namaMapel || 'Mata Pelajaran',
          severity: isCompleted ? 'info' : severity,
          completed: isCompleted
        });
      });
    } else if (currentRole === 'orang_tua') {
      const parent = db.orangTua.getAll().find(o => o.id === currentUserId);
      if (parent) {
        const childId = parent.siswaId;
        const studentTasks = tasks;
        const childSubmissions = db.tugasSiswa.getAll().filter(ts => ts.siswaId === childId);

        studentTasks.forEach(task => {
          const sub = childSubmissions.find(ts => ts.tugasId === task.id);
          const isCompleted = sub?.statusPengerjaan === true;
          const mapel = mapels.find(m => m.id === task.mapelId);

          const dueTime = new Date(task.tenggatWaktu);
          const diffMs = dueTime.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          let timeLeft = '';
          let severity: 'high' | 'medium' | 'info' = 'info';

          if (diffMs < 0) {
            timeLeft = 'Terlambat';
            severity = 'high';
          } else if (diffDays === 1) {
            timeLeft = 'Besok';
            severity = 'high';
          } else {
            timeLeft = `${diffDays} hari lagi`;
            severity = 'medium';
          }

          alerts.push({
            id: task.id,
            title: `${task.judulTugas} (Anak)`,
            message: isCompleted ? 'Sudah diselesaikan oleh anak' : 'Belum diselesaikan oleh anak',
            dueDate: task.tenggatWaktu.replace('T', ' '),
            timeLeft,
            subject: mapel?.namaMapel || 'Mata Pelajaran',
            severity: isCompleted ? 'info' : severity,
            completed: isCompleted
          });
        });
      }
    } else if (currentRole === 'guru') {
      // Show assignments created by teacher and their completion stats
      tasks.forEach(task => {
        const mapel = mapels.find(m => m.id === task.mapelId);
        const relatedSubmissions = db.tugasSiswa.getAll().filter(ts => ts.tugasId === task.id);
        const completedCount = relatedSubmissions.filter(ts => ts.statusPengerjaan === true).length;
        const totalCount = relatedSubmissions.length;
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        const dueTime = new Date(task.tenggatWaktu);
        const diffMs = dueTime.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let timeLeft = '';
        let severity: 'high' | 'medium' | 'info' = 'info';

        if (diffMs < 0) {
          timeLeft = 'Telah Berakhir';
          severity = 'info';
        } else if (diffDays <= 2) {
          timeLeft = `${diffDays} hari lagi`;
          severity = 'high';
        } else {
          timeLeft = `${diffDays} hari lagi`;
          severity = 'medium';
        }

        alerts.push({
          id: task.id,
          title: task.judulTugas,
          message: `Pengumpulan: ${completedCount} dari ${totalCount} siswa (${percent}%)`,
          dueDate: task.tenggatWaktu.replace('T', ' '),
          timeLeft,
          subject: mapel?.namaMapel || 'Mata Pelajaran',
          severity,
          completed: percent === 100
        });
      });
    }

    return alerts.sort((a, b) => {
      // Sort incomplete and high severity first
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const severityWeight = { high: 3, medium: 2, info: 1 };
      return severityWeight[b.severity] - severityWeight[a.severity];
    });
  };

  const attendanceWarnings = getAttendanceWarnings();
  const deadlineAlerts = getDeadlineAlerts();

  // Combine and calculate counts
  const totalWarnings = attendanceWarnings.length;
  const totalDeadlines = deadlineAlerts.filter(d => !d.completed).length;
  const totalUnreadAnnouncements = notifs.filter(n => !n.dibaca).length;
  
  const totalActiveAlerts = totalWarnings + totalDeadlines + totalUnreadAnnouncements;

  const handleMarkAsRead = (id: string) => {
    db.notifikasi.markAsRead(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, dibaca: true } : n));
  };

  const handleMarkAllRead = () => {
    db.notifikasi.markAllAsRead(currentRole);
    setNotifs(prev => prev.map(n => ({ ...n, dibaca: true })));
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formMessage.trim()) return;

    db.notifikasi.add({
      penerimaRole: formTargetRole,
      judul: formTitle,
      pesan: formMessage
    });

    setFormTitle('');
    setFormMessage('');
    setShowCreateForm(false);
    setFormSuccessMessage('Pengumuman berhasil disebarkan secara instan!');
    
    setTimeout(() => {
      setFormSuccessMessage('');
    }, 4000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Sidebar Drawer Overlay Back-drop */}
          <motion.div
            key="notif-center-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/80 cursor-pointer"
          />

          {/* Right Sliding Panel */}
          <motion.div
            key="notif-center-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-55 w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden"
          >
            {/* Header section */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl relative">
                  <Bell className="w-5 h-5 animate-pulse" />
                  {totalActiveAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center">
                      {totalActiveAlerts}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Pusat Informasi & Notifikasi
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Pantau tugas harian, absensi, & info akademik
                  </p>
                </div>
              </div>
              <button
                id="close_notif_center_btn"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="bg-indigo-600 dark:bg-indigo-950/30 text-white p-3.5 px-5 text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-indigo-100">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                Status Ringkasan Hari Ini:
              </span>
              <span className="bg-indigo-500 dark:bg-indigo-900/40 px-2.5 py-0.5 rounded-full font-bold text-[10px] text-indigo-50 border border-indigo-400/20">
                {totalActiveAlerts === 0 ? 'Semua Beres! 🎉' : `${totalActiveAlerts} Perhatian`}
              </span>
            </div>

            {/* Sub Tabs Bar */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 gap-1">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'deadlines', label: 'Tenggat', count: totalDeadlines },
                { id: 'warnings', label: 'Absensi', count: totalWarnings },
                { id: 'announcements', label: 'Pengumuman', count: totalUnreadAnnouncements }
              ].map(subTab => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id as any)}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all cursor-pointer relative ${
                    activeSubTab === subTab.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <span className="block truncate">{subTab.label}</span>
                  {subTab.count !== undefined && subTab.count > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                      {subTab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Main Interactive Alerts List Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 dark:bg-slate-900/10">
              {formSuccessMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{formSuccessMessage}</span>
                </div>
              )}

              {/* Broadcaster announcement widget for Teacher/Operator */}
              {currentRole === 'guru' && activeSubTab === 'announcements' && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-indigo-100 dark:border-indigo-950/40 p-4 shadow-sm space-y-3">
                  <button
                    id="toggle_create_ann_btn"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="w-full flex items-center justify-between bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 p-2.5 px-4 rounded-2xl text-xs font-bold text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer border border-indigo-100/20"
                  >
                    <span className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-indigo-500" />
                      Rilis Pengumuman Instan Baru
                    </span>
                    <Plus className={`w-4 h-4 transform transition-transform ${showCreateForm ? 'rotate-45' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showCreateForm && (
                      <motion.form
                        onSubmit={handleCreateAnnouncement}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden pt-1"
                      >
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Penerima Pengumuman
                          </label>
                          <select
                            value={formTargetRole}
                            onChange={(e) => setFormTargetRole(e.target.value as any)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="siswa">Seluruh Siswa</option>
                            <option value="orang_tua">Seluruh Orang Tua / Wali</option>
                            <option value="guru">Seluruh Guru</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Judul Pengumuman
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Pengumpulan Buku Raport Keluar..."
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            required
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Isi Pesan Informasi
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan detail pengumuman yang ingin disampaikan..."
                            value={formMessage}
                            onChange={(e) => setFormMessage(e.target.value)}
                            required
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Kirim Pengumuman Instan
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* LISTS SECTIONS */}

              {/* 1. UPCOMING DEADLINES */}
              {(activeSubTab === 'all' || activeSubTab === 'deadlines') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      Tenggat Tugas Terdekat
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Total: {deadlineAlerts.length}
                    </span>
                  </div>

                  {deadlineAlerts.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-400 font-medium">
                      Tidak ada batas pengumpulan tugas dalam waktu dekat.
                    </div>
                  ) : (
                    deadlineAlerts.map(alert => (
                      <div
                        key={alert.id}
                        className={`bg-white dark:bg-slate-900 p-4 rounded-3xl border shadow-sm transition-all relative overflow-hidden ${
                          alert.completed
                            ? 'border-emerald-100 dark:border-emerald-950/40 opacity-75'
                            : alert.severity === 'high'
                            ? 'border-rose-200 dark:border-rose-950/60 ring-1 ring-rose-100 dark:ring-0'
                            : 'border-slate-150 dark:border-slate-800/80'
                        }`}
                      >
                        {/* High priority indicator */}
                        {!alert.completed && alert.severity === 'high' && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100/20">
                              {alert.subject}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                              {alert.title}
                            </h4>
                            <p className="text-[10px] text-slate-500 line-clamp-2">
                              {alert.message}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              alert.completed
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                : alert.severity === 'high'
                                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                            }`}>
                              {alert.completed && <Check className="w-3 h-3" />}
                              {alert.timeLeft}
                            </span>
                            <span className="block text-[8px] text-slate-400 font-mono mt-1">
                              Selesai: {alert.dueDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 2. ATTENDANCE WARNINGS */}
              {(activeSubTab === 'all' || activeSubTab === 'warnings') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                      Pemberitahuan & Peringatan Presensi
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Total: {attendanceWarnings.length}
                    </span>
                  </div>

                  {attendanceWarnings.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-400 font-medium">
                      Kehadiran sangat bagus! Tidak ada peringatan presensi.
                    </div>
                  ) : (
                    attendanceWarnings.map((warn, index) => (
                      <div
                        key={warn.id || index}
                        className={`bg-white dark:bg-slate-900 p-4 rounded-3xl border shadow-sm flex gap-3 relative ${
                          warn.severity === 'high'
                            ? 'border-rose-200 dark:border-rose-950/60 bg-rose-50/10'
                            : 'border-amber-200 dark:border-amber-950/40 bg-amber-50/10'
                        }`}
                      >
                        <div className={`p-2 rounded-xl h-fit shrink-0 ${
                          warn.severity === 'high'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-500'
                        }`}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {warn.title}
                            </h4>
                            {warn.extra && (
                              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {warn.extra}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal font-medium">
                            {warn.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 3. SYSTEM ANNOUNCEMENTS */}
              {(activeSubTab === 'all' || activeSubTab === 'announcements') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Megaphone className="w-3.5 h-3.5 text-m3-purple" />
                      Informasi & Pengumuman
                    </span>
                    {totalUnreadAnnouncements > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        Baca Semua
                      </button>
                    )}
                  </div>

                  {notifs.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-400 font-medium">
                      Belum ada pemberitahuan atau pengumuman untuk Anda.
                    </div>
                  ) : (
                    notifs.map(n => (
                      <div
                        key={n.id}
                        onClick={() => !n.dibaca && handleMarkAsRead(n.id)}
                        className={`p-4 rounded-3xl border transition-all text-xs flex gap-3 relative cursor-pointer ${
                          n.dibaca
                            ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 hover:border-slate-200'
                            : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-950/60 text-slate-800 dark:text-slate-200 shadow-sm ring-1 ring-indigo-50 dark:ring-0 hover:border-indigo-300'
                        }`}
                      >
                        <div className={`p-2 rounded-xl h-fit shrink-0 ${
                          n.dibaca
                            ? 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500'
                        }`}>
                          <Megaphone className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold leading-snug break-words">
                              {n.judul}
                            </h4>
                            {!n.dibaca && (
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0"></span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed whitespace-normal break-words font-medium">
                            {n.pesan}
                          </p>
                          <div className="pt-1 flex items-center justify-between text-[8px] text-slate-400">
                            <span>Oleh: Sistem Akademik</span>
                            <span className="font-mono">{n.tanggal}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Sticky Footer Info */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 text-center text-[9px] text-slate-400 font-semibold uppercase tracking-widest">
              Kelas Ku v2.0 2026 © 2026
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
