import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Award,
  CheckSquare,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  Activity,
  Calendar,
  Camera,
  Mail
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../services/db';
import { syncRow } from '../services/sync.service';
import { exportToCSV } from '../utils/export';
import { Absensi, Asesmen, DaftarTugas, TugasSiswa } from '../types';
import { StudentAssignmentCard } from '../components/StudentAssignmentCard';
import { BukuDigitalView } from '../components/BukuDigitalView';
import { isTaskForStudentClass } from '../utils/classMatcher';
import { tugasService } from '../services/tugas.service';

interface SiswaDashboardProps {
  activeTab: string;
  siswaId: string;
}

export function SiswaDashboard({ activeTab, siswaId }: SiswaDashboardProps) {
  const currentSiswa = db.siswa.getAll().find(s => s.id === siswaId);
  const candidateIds = Array.from(new Set([
    siswaId,
    currentSiswa?.email?.toLowerCase(),
    currentSiswa?.nisn
  ].filter(Boolean) as string[]));

  // Load States
  const [tasks, setTasks] = useState<DaftarTugas[]>(db.daftarTugas.getAll());
  const [mySubmissions, setMySubmissions] = useState<TugasSiswa[]>(
    db.tugasSiswa.getAll().filter(ts => candidateIds.includes(ts.siswaId))
  );
  const [myGrades, setMyGrades] = useState<Asesmen[]>(
    db.asesmen.getAll().filter(a => candidateIds.includes(a.siswaId))
  );
  const [myAttendance, setMyAttendance] = useState<Absensi[]>(
    db.absensi.getAll().filter(a => candidateIds.includes(a.siswaId))
  );
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<number>(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState(currentSiswa?.fotoUrl || '');
  const [emailInput, setEmailInput] = useState(currentSiswa?.email || `${siswaId}@sd.id`);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [avatarTab, setAvatarTab] = useState<'boys' | 'girls'>('boys');
  const siswaKelas = currentSiswa?.kelas || 'Kelas 4';
  const subjects = db.mataPelajaran.getAll().filter(m => !m.kelas || m.kelas === siswaKelas);

  const handleSaveProfile = async () => {
    if (currentSiswa) {
      const cleanEmail = emailInput.trim().toLowerCase();
      const updated = { ...currentSiswa, fotoUrl: photoUrlInput, email: cleanEmail };
      db.siswa.upsert(updated);

      // Force immediate sync to active database (Supabase / Firebase)
      await syncRow('siswa', updated, true);
      await syncRow('profiles', {
        id: currentSiswa.id,
        full_name: currentSiswa.namaSiswa,
        email: cleanEmail,
        role: 'siswa'
      }, true);

      setSaveSuccessMsg('Profil & Email berhasil disimpan ke Database! Nilai Google Form akan tersinkron otomatis.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      setShowPhotoModal(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrlInput(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    // Sync states on real-time event or fallback interval
    const sync = async () => {
      const fetchedTasks = await tugasService.getDaftarTugas();
      await tugasService.getTugasSiswa().catch(() => {});

      const sObj = db.siswa.getAll().find(s => s.id === siswaId);
      const cIds = Array.from(new Set([
        siswaId,
        sObj?.id,
        sObj?.email?.toLowerCase(),
        sObj?.nisn,
        sObj?.namaSiswa?.toLowerCase()
      ].filter(Boolean) as string[]));

      setTasks(fetchedTasks && fetchedTasks.length > 0 ? fetchedTasks : db.daftarTugas.getAll());
      setMySubmissions(db.tugasSiswa.getAll().filter(ts => cIds.includes(ts.siswaId) || cIds.some(c => ts.siswaId?.toLowerCase?.() === c)));
      setMyGrades(db.asesmen.getAll().filter(a => cIds.includes(a.siswaId) || cIds.some(c => a.siswaId?.toLowerCase?.() === c)));
      setMyAttendance(db.absensi.getAll().filter(a => cIds.includes(a.siswaId)));
    };

    sync();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('supabase-data-updated', sync);
    window.addEventListener('penilaians-updated', sync);
    window.addEventListener('asesmens-updated', sync);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(sync, 30000); // 30s fallback interval

    return () => {
      window.removeEventListener('supabase-data-updated', sync);
      window.removeEventListener('penilaians-updated', sync);
      window.removeEventListener('asesmens-updated', sync);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [siswaId]);

  // Calculations for attendance rekap
  const totalDays = myAttendance.length;
  const hadirCount = myAttendance.filter(a => a.status === 'hadir').length;
  const sakitCount = myAttendance.filter(a => a.status === 'sakit').length;
  const izinCount = myAttendance.filter(a => a.status === 'izin').length;
  const alfaCount = myAttendance.filter(a => a.status === 'alfa').length;
  const kehadiranRate = totalDays > 0 ? Math.round((hadirCount / totalDays) * 100) : 100;

  // Formatting chart data for grades
  const getChartData = () => {
    // Map average grades by subject
    return subjects.map(sub => {
      const gradesOfSub = myGrades.filter(g => g.mapelId === sub.id);
      const avg = gradesOfSub.length > 0 
        ? Math.round(gradesOfSub.reduce((acc, g) => acc + g.nilai, 0) / gradesOfSub.length)
        : 0;
      return {
        name: sub.namaMapel,
        Nilai: avg,
        KKM: sub.kkm
      };
    });
  };

  // Submit confirmation handler with real-time Google Form & Supabase Sync simulation
  const handleConfirmTaskDone = (tugasId: string) => {
    setSyncingTaskId(tugasId);
    setSyncStep(1);

    setTimeout(() => {
      setSyncStep(2);
      setTimeout(() => {
        setSyncStep(3);
        setTimeout(() => {
          setSyncStep(4);
          // Perform actual save in DB (Simulating real Supabase write)
          db.tugasSiswa.submitTask(tugasId, siswaId);
          // Refresh local states
          setMySubmissions(db.tugasSiswa.getAll().filter(ts => ts.siswaId === siswaId));
          setMyGrades(db.asesmen.getAll().filter(a => a.siswaId === siswaId));
          
          setTimeout(() => {
            setSyncingTaskId(null);
            setSyncStep(0);
          }, 1500);
        }, 1200);
      }, 1000);
    }, 1000);
  };

  // Exports
  const exportMyGradesCSV = () => {
    const formatted = myGrades.map(g => {
      const mapel = subjects.find(m => m.id === g.mapelId);
      return {
        namaPenilaian: g.namaPenilaian,
        mapel: mapel ? mapel.namaMapel : 'Mapel',
        tipe: g.tipe.toUpperCase(),
        nilai: g.nilai,
        kkm: mapel ? (Number(mapel.kkm) || 70) : 70,
        status: g.nilai >= (mapel ? (Number(mapel.kkm) || 70) : 70) ? 'TUNTAS' : 'REMEDIAL',
        deskripsi: g.deskripsiKompetensi || '-'
      };
    });
    exportToCSV(
      formatted,
      [
        { key: 'namaPenilaian', label: 'Kegiatan Penilaian' },
        { key: 'mapel', label: 'Mata Pelajaran' },
        { key: 'tipe', label: 'Jenis Penilaian' },
        { key: 'nilai', label: 'Nilai Anda' },
        { key: 'kkm', label: 'KKM Kelulusan' },
        { key: 'status', label: 'Status Kelulusan' },
        { key: 'deskripsi', label: 'Capaian Pembelajaran' }
      ],
      `Laporan_Nilai_Siswa_${currentSiswa?.namaSiswa || 'Siswa'}`
    );
  };

  const exportMyAttendanceCSV = () => {
    const formatted = myAttendance.map(a => ({
      tanggal: a.tanggal,
      status: a.status.toUpperCase(),
      keterangan: a.keterangan || '-'
    }));
    exportToCSV(
      formatted,
      [
        { key: 'tanggal', label: 'Tanggal Belajar' },
        { key: 'status', label: 'Status Kehadiran' },
        { key: 'keterangan', label: 'Keterangan/Sebab' }
      ],
      `Rekap_Absensi_Siswa_${currentSiswa?.namaSiswa || 'Siswa'}`
    );
  };

  return (
    <div id="siswa_dashboard_container" className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-m3-purple to-[#21005D] text-white p-6 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={() => {
              setPhotoUrlInput(currentSiswa?.fotoUrl || '');
              setEmailInput(currentSiswa?.email || `${siswaId}@sd.id`);
              setShowPhotoModal(true);
            }} 
            className="group relative cursor-pointer outline-none shrink-0"
            title="Klik untuk mengubah profil & email"
          >
            <div className="relative rounded-full overflow-hidden border-2 border-white/20 shadow-md">
              {currentSiswa?.fotoUrl ? (
                <img
                  src={currentSiswa.fotoUrl}
                  alt={currentSiswa.namaSiswa}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover shrink-0 aspect-square group-hover:opacity-75 transition-opacity"
                />
              ) : (
                <div className="w-16 h-16 bg-white/10 flex items-center justify-center font-bold text-lg group-hover:bg-white/20 transition-all">
                  {currentSiswa?.namaSiswa ? currentSiswa.namaSiswa.substring(0, 2).toUpperCase() : 'SD'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full p-1 border border-white text-[9px] shadow-sm flex items-center justify-center">
              ✏️
            </span>
          </button>

          <div>
            <h2 className="text-xl font-extrabold">Halo, {currentSiswa?.namaSiswa}! 👋</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-amber-200 border border-white/20">
                <Mail className="w-3 h-3 text-amber-300" /> Email: {currentSiswa?.email || `${siswaId}@sd.id`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPhotoUrlInput(currentSiswa?.fotoUrl || '');
                  setEmailInput(currentSiswa?.email || `${siswaId}@sd.id`);
                  setShowPhotoModal(true);
                }}
                className="text-[10px] font-extrabold text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
              >
                Atur Email Google
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 px-5 py-3 rounded-2xl text-xs backdrop-blur-sm border border-white/10 text-right min-w-[160px]">
          <div className="font-extrabold text-sm text-white leading-tight">{currentSiswa?.namaSiswa}</div>
          <div className="text-m3-purple-light text-xs font-semibold mt-1">Kelas {currentSiswa?.kelas}</div>
          <button 
            type="button" 
            onClick={() => {
              setPhotoUrlInput(currentSiswa?.fotoUrl || '');
              setEmailInput(currentSiswa?.email || `${siswaId}@sd.id`);
              setShowPhotoModal(true);
            }}
            className="mt-2 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer inline-flex items-center gap-1"
          >
            <Mail className="w-3 h-3" /> Edit Email & Profil
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* 1. TUGAS HARIAN SAYA */}
      {activeTab === 'siswa_tugas' && (
        <div id="student_tasks_view" className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-m3-text dark:text-white flex items-center gap-1.5">
                <Bookmark className="w-5 h-5 text-m3-purple" />
                Tugas Google Form Aktif
              </h3>
              <p className="text-xs text-m3-sec-text">Kerjakan tugas di Google Form. Nilai akan otomatis tersinkronisasi langsung melalui Webhook Google Form.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tasks.filter(t => isTaskForStudentClass(t.kelas, siswaKelas, t, subjects)).length > 0 ? (
              tasks.filter(t => isTaskForStudentClass(t.kelas, siswaKelas, t, subjects)).map((t) => {
                const mapel = subjects.find(m => m.id === t.mapelId);

                return (
                  <StudentAssignmentCard
                    key={t.id}
                    task={t}
                    studentId={siswaId}
                    mapelName={mapel?.namaMapel}
                    onStatusUpdated={() => {
                      const sObj = db.siswa.getAll().find(s => s.id === siswaId);
                      const cIds = Array.from(new Set([
                        siswaId,
                        sObj?.email?.toLowerCase(),
                        sObj?.nisn
                      ].filter(Boolean) as string[]));
                      setMySubmissions(db.tugasSiswa.getAll().filter(ts => cIds.includes(ts.siswaId)));
                    }}
                  />
                );
              })
            ) : (
              <div className="col-span-1 md:col-span-2 p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <Bookmark className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Belum Ada Tugas Aktif untuk Kelas Anda ({siswaKelas})</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Tugas yang dirilis guru akan muncul secara otomatis di halaman ini.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. LAPORAN NILAI SAYA */}
      {activeTab === 'siswa_nilai' && (
        <div id="student_grades_view" className="space-y-6">
          <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-4">
            <div>
              <h3 className="text-base font-bold text-m3-text dark:text-white flex items-center gap-1.5">
                <Award className="w-5 h-5 text-m3-purple" />
                Laporan Hasil Belajar Kurikulum Merdeka
              </h3>
              <p className="text-xs text-m3-sec-text">Analisis rata-rata nilai mata pelajaran harian serta sumatif</p>
            </div>
            <button
              id="export_my_grades_btn"
              onClick={exportMyGradesCSV}
              className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Nilai Saya (Excel)
            </button>
          </div>

          {/* Visual Chart Analysis */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
            <h4 className="text-xs font-bold text-m3-sec-text uppercase tracking-widest mb-4 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Grafik Analisis Nilai vs KKM Kelas
            </h4>
            <div className="h-48 sm:h-64 md:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={45} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="Nilai" fill="#6750A4" radius={[6, 6, 0, 0]} name="Nilai Rata-rata" />
                  <Bar dataKey="KKM" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Batas KKM" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Grades List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-m3-border dark:border-slate-800">
              <h4 className="text-sm font-bold text-m3-text dark:text-white">Daftar Transkrip Nilai Siswa</h4>
            </div>

            {/* Mobile View Card Layout (Highly Responsive and Elegant) */}
            <div className="block sm:hidden divide-y divide-m3-border dark:divide-slate-800/50">
              {myGrades.length > 0 ? (
                myGrades.map((g) => {
                  const mapel = subjects.find(m => m.id === g.mapelId);
                  const effectiveKkm = mapel ? (Number(mapel.kkm) || 70) : 70;
                  const isRemedial = g.nilai < effectiveKkm;
                  return (
                    <div key={g.id} className="p-4 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-m3-purple dark:text-indigo-400">
                            {mapel ? mapel.namaMapel : '-'}
                          </span>
                          <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                            {g.namaPenilaian}
                          </h5>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-base font-black font-mono text-m3-purple dark:text-indigo-400">
                            {g.nilai} <span className="text-[9px] font-normal text-slate-400">Poin</span>
                          </span>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 text-[8px] uppercase font-extrabold rounded-full ${
                            isRemedial ? 'bg-red-50 text-red-600 dark:bg-red-950/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                          }`}>
                            {isRemedial ? 'Remedial' : 'Tuntas'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1.5">
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${
                          g.tipe === 'harian' ? 'bg-m3-purple-light text-m3-purple-dark' :
                          g.tipe === 'sts' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40' :
                          'bg-pink-50 text-pink-600 dark:bg-pink-950/40'
                        }`}>
                          {g.tipe}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                          KKM: {effectiveKkm}
                        </span>
                      </div>

                      {g.deskripsiKompetensi && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/50 mt-1">
                          <span className="block font-bold text-[9px] uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-0.5">Capaian Kompetensi:</span>
                          <p className="leading-relaxed text-[11px] font-medium">{g.deskripsiKompetensi}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Belum ada transkrip nilai asesmen.
                </div>
              )}
            </div>

            {/* Desktop View Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-m3-lavender/50 dark:bg-slate-800/50 text-m3-sec-text dark:text-slate-400 font-bold text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4">Mata Pelajaran</th>
                    <th className="px-6 py-4">Nama Asesmen</th>
                    <th className="px-6 py-4">Tipe Asesmen</th>
                    <th className="px-6 py-4">Nilai Diperoleh</th>
                    <th className="px-6 py-4">Capaian Kompetensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-border dark:divide-slate-800 text-m3-sec-text dark:text-slate-300">
                  {myGrades.map((g) => {
                    const mapel = subjects.find(m => m.id === g.mapelId);
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                        <td className="px-6 py-4 font-bold text-m3-text dark:text-white">
                          {mapel ? mapel.namaMapel : '-'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-m3-text dark:text-white">{g.namaPenilaian}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                            g.tipe === 'harian' ? 'bg-m3-purple-light text-m3-purple-dark' :
                            g.tipe === 'sts' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40' :
                            'bg-pink-50 text-pink-600 dark:bg-pink-950/40'
                          }`}>
                            {g.tipe}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-m3-purple dark:text-indigo-400 text-sm">
                          {g.nilai} Poin
                        </td>
                        <td className="px-6 py-4 text-xs text-m3-sec-text max-w-xs truncate">
                          {g.deskripsiKompetensi || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. REKAPITULASI ABSENSI SAYA */}
      {activeTab === 'siswa_absensi' && (
        <div id="student_attendance_view" className="space-y-6">
          <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-4">
            <div>
              <h3 className="text-base font-bold text-m3-text dark:text-white flex items-center gap-1.5">
                <CheckSquare className="w-5 h-5 text-m3-purple" />
                Rekapitulasi Kehadiran & Presensi
              </h3>
              <p className="text-xs text-m3-sec-text">Ringkasan tingkat kehadiran Anda sepanjang semester berjalan</p>
            </div>
            <button
              id="export_my_attendance_btn"
              onClick={exportMyAttendanceCSV}
              className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Kehadiran (Excel)
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm text-center">
              <span className="text-xs text-m3-sec-text">Hadir</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{hadirCount} Hari</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm text-center">
              <span className="text-xs text-m3-sec-text">Sakit</span>
              <p className="text-2xl font-bold text-amber-500 mt-1">{sakitCount} Hari</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm text-center">
              <span className="text-xs text-m3-sec-text">Izin</span>
              <p className="text-2xl font-bold text-blue-500 mt-1">{izinCount} Hari</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm text-center">
              <span className="text-xs text-m3-sec-text">Alfa</span>
              <p className="text-2xl font-bold text-red-500 mt-1">{alfaCount} Hari</p>
            </div>
            <div className="bg-gradient-to-br from-m3-purple to-[#21005D] p-4 rounded-3xl text-white text-center shadow-sm col-span-2 lg:col-span-1 flex flex-col justify-center">
              <span className="text-xs text-m3-purple-light">Rasio Kehadiran</span>
              <p className="text-2xl font-extrabold mt-1">{kehadiranRate}%</p>
            </div>
          </div>

          {/* Log List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm overflow-hidden max-w-2xl mx-auto">
            <div className="p-4 border-b border-m3-border dark:border-slate-800">
              <h4 className="text-sm font-bold text-m3-text dark:text-white flex items-center gap-1">
                <Activity className="w-4 h-4 text-m3-purple" />
                Daftar Riwayat Kehadiran Siswa
              </h4>
            </div>
            <div className="divide-y divide-m3-border dark:divide-slate-800">
              {myAttendance.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50/40 transition-all">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-m3-sec-text" />
                    <span className="font-semibold text-m3-text dark:text-slate-200">
                      {new Date(a.tanggal).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                    a.status === 'hadir' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                    a.status === 'sakit' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' :
                    'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400'
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. BUKU DIGITAL SAYA */}
      {activeTab === 'buku_digital' && (
        <div id="student_digital_books_view">
          <BukuDigitalView currentRole="siswa" currentUserId={siswaId} />
        </div>
      )}

      {syncingTaskId && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6 text-center transform transition-transform duration-300 scale-100">
            <div className="flex justify-center">
              <div className="relative flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600/20 border-t-emerald-600"></div>
                <Bookmark className="absolute text-emerald-600 w-6 h-6 animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-base font-bold text-slate-800 dark:text-white">Sinkronisasi Real-Time Database</h4>
              <p className="text-xs text-slate-500">Sinkronisasi data pengerjaan Google Form Kurikulum Merdeka Anda dengan Database Supabase</p>
            </div>

            <div className="space-y-3.5 text-left bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  syncStep >= 1 ? 'bg-emerald-600 text-white animate-bounce' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {syncStep > 1 ? '✓' : '1'}
                </span>
                <span className={`font-semibold ${syncStep >= 1 ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                  Menghubungkan ke API Google Form...
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  syncStep >= 2 ? 'bg-emerald-600 text-white animate-bounce' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {syncStep > 2 ? '✓' : '2'}
                </span>
                <span className={`font-semibold ${syncStep >= 2 ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                  Mengunduh respons & nilai pengerjaan...
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  syncStep >= 3 ? 'bg-emerald-600 text-white animate-bounce' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {syncStep > 3 ? '✓' : '3'}
                </span>
                <span className={`font-semibold ${syncStep >= 3 ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                  Menyimpan & sinkronisasi data dengan Supabase...
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  syncStep >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {syncStep >= 4 ? '✓' : '4'}
                </span>
                <span className={`font-semibold ${syncStep >= 4 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  Sinkronisasi Berhasil! Nilai terekam real-time.
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-600 h-2 transition-all duration-500 ease-out"
                style={{ width: `${(syncStep / 4) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT PROFILE & EMAIL EDITING MODAL */}
      {showPhotoModal && (
        <div 
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in pointer-events-auto"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative z-[101] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 transform transition-transform duration-300 scale-100 pointer-events-auto"
          >
            <div className="text-center space-y-1">
              <h4 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                <Mail className="w-5 h-5 text-m3-purple" /> Pengaturan Email & Profil Siswa
              </h4>
              <p className="text-[11px] text-slate-500">
                Atur email Google kamu agar nilai kuis Google Form otomatis tersinkron ke akun ini.
              </p>
            </div>

            {/* EMAIL INPUT FIELD */}
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-amber-600" /> Email Google / Google Form Siswa:
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="contoh: kholisulzainal@gmail.com atau siswa1@sd.id"
                className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 italic leading-snug">
                *Pastikan email ini persis sama dengan email yang kamu masukkan saat mengerjakan Google Form.
              </p>
            </div>

            {/* PREVIEW & DEVICE UPLOAD */}
            <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-800/70 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 self-start">
                Foto Profil:
              </span>
              {photoUrlInput ? (
                <img 
                  src={photoUrlInput} 
                  alt="Preview" 
                  className="w-20 h-20 rounded-full object-cover shrink-0 aspect-square border-4 border-m3-purple shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xl border-4 border-slate-300 dark:border-slate-600">
                  SD
                </div>
              )}
              
              {/* UPLOAD FROM PHONE */}
              <div className="w-full">
                <label className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs w-full text-center">
                  <Camera className="w-4 h-4" />
                  <span>Pilih / Ambil Foto Baru</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="flex-1 py-2 rounded-xl bg-m3-purple hover:bg-m3-purple-dark text-white text-xs font-bold shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Profil & Email</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
