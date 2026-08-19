import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Award,
  CheckSquare,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  Activity,
  Calendar,
  Heart
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../services/db';
import { exportToCSV } from '../utils/export';
import { Absensi, Asesmen, DaftarTugas, TugasSiswa } from '../types';
import { BukuDigitalView } from '../components/BukuDigitalView';
import { isTaskForStudentClass } from '../utils/classMatcher';
import { tugasService } from '../services/tugas.service';

interface OrangTuaDashboardProps {
  activeTab: string;
  parentId: string;
}

export function OrangTuaDashboard({ activeTab, parentId }: OrangTuaDashboardProps) {
  const currentParent = db.orangTua.getAll().find(p => p.id === parentId);
  const targetSiswaId = currentParent ? currentParent.siswaId : '';
  const currentSiswa = db.siswa.getAll().find(s => s.id === targetSiswaId);

  // States
  const [tasks, setTasks] = useState<DaftarTugas[]>(db.daftarTugas.getAll());
  const [childSubmissions, setChildSubmissions] = useState<TugasSiswa[]>(db.tugasSiswa.getAll().filter(ts => ts.siswaId === targetSiswaId));
  const [childGrades, setChildGrades] = useState<Asesmen[]>(db.asesmen.getAll().filter(a => a.siswaId === targetSiswaId));
  const [childAttendance, setChildAttendance] = useState<Absensi[]>(db.absensi.getAll().filter(a => a.siswaId === targetSiswaId));
  const childKelas = currentSiswa?.kelas || 'Kelas 4';
  const subjects = db.mataPelajaran.getAll().filter(m => !m.kelas || m.kelas === childKelas);

  useEffect(() => {
    // Sync states on real-time event or fallback interval
    const sync = async () => {
      const fetchedTasks = await tugasService.getDaftarTugas();
      await tugasService.getTugasSiswa().catch(() => {});

      setTasks(fetchedTasks && fetchedTasks.length > 0 ? fetchedTasks : db.daftarTugas.getAll());
      setChildSubmissions(db.tugasSiswa.getAll().filter(ts => ts.siswaId === targetSiswaId));
      setChildGrades(db.asesmen.getAll().filter(a => a.siswaId === targetSiswaId));
      setChildAttendance(db.absensi.getAll().filter(a => a.siswaId === targetSiswaId));
    };

    sync();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('supabase-data-updated', sync);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(sync, 30000); // 30s fallback interval

    return () => {
      window.removeEventListener('supabase-data-updated', sync);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [targetSiswaId]);

  // Calculations
  const totalDays = childAttendance.length;
  const hadirCount = childAttendance.filter(a => a.status === 'hadir').length;
  const sakitCount = childAttendance.filter(a => a.status === 'sakit').length;
  const izinCount = childAttendance.filter(a => a.status === 'izin').length;
  const alfaCount = childAttendance.filter(a => a.status === 'alfa').length;
  const kehadiranRate = totalDays > 0 ? Math.round((hadirCount / totalDays) * 100) : 100;

  // Chart data
  const getChartData = () => {
    return subjects.map(sub => {
      const gradesOfSub = childGrades.filter(g => g.mapelId === sub.id);
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

  // CSV Exports
  const exportChildGradesCSV = () => {
    const formatted = childGrades.map(g => {
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
        { key: 'nilai', label: 'Nilai Ananda' },
        { key: 'kkm', label: 'Batas KKM' },
        { key: 'status', label: 'Kelulusan' },
        { key: 'deskripsi', label: 'Kompetensi Capaian' }
      ],
      `Rekap_Nilai_Ananda_${currentSiswa?.namaSiswa || 'Siswa'}`
    );
  };

  const exportChildAttendanceCSV = () => {
    const formatted = childAttendance.map(a => ({
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
      `Rekap_Kehadiran_Ananda_${currentSiswa?.namaSiswa || 'Siswa'}`
    );
  };

  return (
    <div id="ortu_dashboard_container" className="space-y-6">
      {/* Ortu Welcome Badge */}
      <div className="bg-gradient-to-r from-m3-purple to-[#21005D] text-white p-6 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative rounded-full overflow-hidden border-2 border-white/20 shadow-md shrink-0">
            {currentSiswa?.fotoUrl ? (
              <img
                src={currentSiswa.fotoUrl}
                alt={currentSiswa.namaSiswa}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover shrink-0 aspect-square"
              />
            ) : (
              <div className="w-16 h-16 bg-white/10 flex items-center justify-center font-bold text-lg">
                {currentSiswa?.namaSiswa ? currentSiswa.namaSiswa.substring(0, 2).toUpperCase() : 'SD'}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              Selamat Datang, Bapak/Ibu Wali Murid! <Heart className="w-5 h-5 fill-white text-rose-400" />
            </h2>
            <p className="text-xs text-m3-purple-light mt-1 max-w-xl">
              Portal pengawasan tumbuh kembang anak terintegrasi. Pantau penyelesaian tugas harian, nilai akademik, serta kehadiran ananda di sekolah.
            </p>
          </div>
        </div>
        
        <div className="bg-white/10 px-5 py-3 rounded-2xl text-xs backdrop-blur-sm border border-white/10 text-right min-w-[160px]">
          <div className="font-extrabold text-sm text-white leading-tight">{currentSiswa?.namaSiswa || 'Ahmad Fauzi'}</div>
          <div className="text-m3-purple-light text-xs font-semibold mt-1">{currentSiswa?.kelas || 'Kelas 4-A'}</div>
          <div className="text-[10px] text-emerald-400 mt-1 font-bold">Wali dari {currentSiswa?.namaSiswa}</div>
        </div>
      </div>

      {/* 1. STATUS TUGAS ANAK */}
      {activeTab === 'ortu_notif_tugas' && (
        <div id="parent_tasks_view" className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-m3-text dark:text-white flex items-center gap-1.5">
                <Bookmark className="w-5 h-5 text-m3-purple" />
                Daftar Tugas & Status Pengerjaan Anak
              </h3>
              <p className="text-xs text-m3-sec-text">Awasi apakah ananda telah menyelesaikan Google Form yang didelegasikan guru</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tasks.filter(t => isTaskForStudentClass(t.kelas, childKelas, t, subjects)).map((t) => {
              const mapel = subjects.find(m => m.id === t.mapelId);
              const submission = childSubmissions.find(sub => sub.tugasId === t.id);

              const candidateIds = Array.from(new Set([
                currentSiswa?.id,
                currentSiswa?.email?.toLowerCase(),
                currentSiswa?.nisn
              ].filter(Boolean) as string[]));

              const matchPnl = db.penilaian.getAll().find(
                p => candidateIds.includes(p.siswaId) && (p.id.includes(t.id) || p.namaPenilaian === t.judulTugas)
              );

              const effectiveScore = submission?.score ?? submission?.nilai ?? matchPnl?.nilai ?? null;
              const isCompleted = Boolean(submission?.statusPengerjaan || effectiveScore != null);

              return (
                <div
                  key={t.id}
                  className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between transition-colors ${
                    isCompleted
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30'
                      : 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold bg-m3-lavender text-m3-purple-dark px-3 py-1 rounded-full border border-m3-border">
                        {mapel ? mapel.namaMapel : 'Mapel'}
                      </span>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Selesai
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-bold bg-rose-50 dark:bg-rose-950/20 px-2.5 py-0.5 rounded-full">
                          <AlertCircle className="w-3.5 h-3.5" /> Belum Selesai
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-m3-text dark:text-white mt-3">{t.judulTugas}</h4>
                    <p className="text-xs text-m3-sec-text mt-1">Deskripsi Tugas: {t.deskripsi}</p>

                    <div className="mt-4 bg-m3-lavender/30 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-m3-border dark:border-slate-800 space-y-1.5 text-xs">
                      <p className="flex justify-between">
                        <span className="text-m3-sec-text">Tenggat Pengumpulan:</span>
                        <span className="font-semibold text-m3-text dark:text-slate-300">
                          {new Date(t.tenggatWaktu).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </p>
                      {isCompleted && (
                        <>
                          <p className="flex justify-between border-t border-m3-border dark:border-slate-800 pt-1.5">
                            <span className="text-m3-sec-text">Nilai Diperoleh:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              {effectiveScore != null ? `${effectiveScore} Poin` : 'Menunggu Sinkronisasi Nilai'}
                            </span>
                          </p>
                          <p className="text-[11px] text-m3-sec-text italic mt-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-m3-border">
                            Feedback Guru: "{submission?.umpanBalik && !submission.umpanBalik.includes('Menunggu') ? submission.umpanBalik : (effectiveScore != null ? 'Tugas telah dinilai dan disinkronkan ke rapor.' : 'Tugas dikirim. Menunggu sinkronisasi nilai dari Webhook Google Form.')}"
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {!isCompleted && (
                    <div className="mt-4 pt-3.5 border-t border-rose-200 dark:border-rose-900/20 text-center text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50/50 dark:bg-rose-950/10 py-2 px-4 rounded-full">
                      ⚠️ Mohon ingatkan ananda untuk segera mengisi Google Form tugas tersebut!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. REKAPITULASI NILAI ANAK */}
      {activeTab === 'ortu_rekap_nilai' && (
        <div id="parent_grades_view" className="space-y-6">
          <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-4">
            <div>
              <h3 className="text-base font-bold text-m3-text dark:text-white flex items-center gap-1.5">
                <Award className="w-5 h-5 text-m3-purple" />
                Laporan Capaian Hasil Belajar Ananda
              </h3>
              <p className="text-xs text-m3-sec-text">Transkrip nilai otentik kurikulum merdeka ananda</p>
            </div>
            <button
              id="export_child_grades_btn"
              onClick={exportChildGradesCSV}
              className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Laporan (Excel)
            </button>
          </div>

          {/* Visual Recharts for parents */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm">
            <h4 className="text-xs font-bold text-m3-sec-text uppercase tracking-widest mb-4 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Grafik Hasil Belajar Mingguan vs Standar Kelulusan Kelas
            </h4>
            <div className="h-48 sm:h-64 md:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={45} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="Nilai" fill="#6750A4" radius={[6, 6, 0, 0]} name="Nilai Rata-rata Ananda" />
                  <Bar dataKey="KKM" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Batas KKM" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-m3-border dark:border-slate-800">
              <h4 className="text-sm font-bold text-m3-text dark:text-white">Transkrip Nilai Akademis Lengkap</h4>
            </div>

            {/* Mobile View Card List (Optimized and proportionate) */}
            <div className="block sm:hidden divide-y divide-m3-border dark:divide-slate-800/50">
              {childGrades.length > 0 ? (
                childGrades.map((g) => {
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
                  Belum ada transkrip nilai asesmen ananda.
                </div>
              )}
            </div>

            {/* Desktop View Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-m3-lavender/50 dark:bg-slate-800/50 text-m3-sec-text dark:text-slate-400 font-bold text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4">Mata Pelajaran</th>
                    <th className="px-6 py-4">Jenis Penilaian / Uji Kompetensi</th>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4">Skor</th>
                    <th className="px-6 py-4">Capaian Kompetensi Belajar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-border dark:divide-slate-800 text-m3-sec-text dark:text-slate-300">
                  {childGrades.map((g) => {
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

      {/* 3. KEHADIRAN ANAK */}
      {activeTab === 'ortu_absensi' && (
        <div id="parent_attendance_view" className="space-y-6">
          <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm gap-4">
            <div>
              <h3 className="text-base font-bold text-m3-text dark:text-white flex items-center gap-1.5">
                <CheckSquare className="w-5 h-5 text-m3-purple" />
                Rekapitulasi Kehadiran & Absensi Ananda
              </h3>
              <p className="text-xs text-m3-sec-text">Log kehadiran harian kelas untuk memantau ketertiban sekolah</p>
            </div>
            <button
              id="export_child_attendance_btn"
              onClick={exportChildAttendanceCSV}
              className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Absensi (Excel)
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
              <span className="text-xs text-m3-purple-light">Kehadiran Rasio</span>
              <p className="text-2xl font-extrabold mt-1">{kehadiranRate}%</p>
            </div>
          </div>

          {/* Log List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800/80 shadow-sm overflow-hidden max-w-2xl mx-auto">
            <div className="p-4 border-b border-m3-border dark:border-slate-800">
              <h4 className="text-sm font-bold text-m3-text dark:text-white flex items-center gap-1">
                <Activity className="w-4 h-4 text-m3-purple" />
                Histori Kehadiran Lengkap Ananda
              </h4>
            </div>
            <div className="divide-y divide-m3-border dark:divide-slate-800">
              {childAttendance.map((a) => (
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
        <div id="parent_digital_books_view">
          <BukuDigitalView currentRole="orang_tua" studentKelas={childKelas} />
        </div>
      )}
    </div>
  );
}
