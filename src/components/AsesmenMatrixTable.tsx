import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Save,
  Search,
  CheckCircle2,
  Trash2,
  Download,
  Upload,
  Award,
  BookOpen,
  Users,
  RefreshCw
} from 'lucide-react';
import { db } from '../services/db';
import { Siswa, MataPelajaran, Asesmen, UserRole } from '../types';
import * as XLSX from 'xlsx';

interface AsesmenMatrixTableProps {
  currentRole: UserRole;
  activeClassFilter: string;
  loggedInUserId?: string;
  isCurrentGuruWaliKelas?: boolean;
  isGuruMapel?: boolean;
  isRealWaliKelas?: boolean;
  loggedInGuru?: any;
  myMapelIds?: string[];
}

export function AsesmenMatrixTable({
  currentRole,
  activeClassFilter,
  loggedInUserId,
  isCurrentGuruWaliKelas,
  isGuruMapel,
  isRealWaliKelas,
  loggedInGuru,
  myMapelIds
}: AsesmenMatrixTableProps) {
  const [siswas, setSiswas] = useState<Siswa[]>(() => db.siswa.getAll());
  const [mapels, setMapels] = useState<MataPelajaran[]>(() => db.mataPelajaran.getAll());
  const [asesmens, setAsesmens] = useState<Asesmen[]>(() => db.asesmen.getAll());
  const [daftarTugas] = useState(() => db.daftarTugas.getAll());

  const [selectedMapelId, setSelectedMapelId] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Default number of harian/task columns = 5, or max assignments found
  const [harianColCount, setHarianColCount] = useState<number>(5);

  const refreshData = () => {
    setSiswas(db.siswa.getAll());
    setMapels(db.mataPelajaran.getAll());
    setAsesmens(db.asesmen.getAll());
  };

  useEffect(() => {
    const handleSync = () => refreshData();
    window.addEventListener('supabase-data-updated', handleSync);
    return () => window.removeEventListener('supabase-data-updated', handleSync);
  }, []);

  // Filter students based on active class filter
  const filteredStudents = siswas.filter(s => {
    const matchClass = activeClassFilter === 'Semua' || s.kelas === activeClassFilter;
    const matchSearch = !searchQuery.trim() ||
      s.namaSiswa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn.includes(searchQuery);
    return matchClass && matchSearch;
  });

  // All subjects allowed for this user role
  const availableMapels = mapels.filter(m => {
    if (isGuruMapel || (currentRole === 'guru' && !isCurrentGuruWaliKelas)) {
      if (myMapelIds && myMapelIds.length > 0) {
        return myMapelIds.includes(m.id);
      }
      if (loggedInGuru?.mataPelajaranUtama) {
        const lowerSubject = m.namaMapel.toLowerCase();
        const lowerGuruMapel = loggedInGuru.mataPelajaranUtama.toLowerCase();
        return m.guruPengampuId === loggedInUserId || m.guruPengampuId === loggedInGuru.id || lowerSubject.includes(lowerGuruMapel);
      }
      return m.guruPengampuId === loggedInUserId || m.guruPengampuId === loggedInGuru?.id;
    }
    return true;
  });

  // Filter subjects based on selected mapel or teacher permissions
  const filteredMapels = availableMapels.filter(m => {
    if (selectedMapelId !== 'Semua' && m.id !== selectedMapelId) return false;
    return true;
  });

  // Automatically count max task assignments per subject to adjust harian columns if needed
  useEffect(() => {
    let maxTasks = 5;
    filteredMapels.forEach(m => {
      const tasksCount = daftarTugas.filter(t => t.mapelId === m.id).length;
      if (tasksCount > maxTasks) maxTasks = tasksCount;
    });
    if (maxTasks > harianColCount) {
      setHarianColCount(maxTasks);
    }
  }, [filteredMapels, daftarTugas]);

  // Matrix cell getter
  const getNilaiValue = (siswaId: string, mapelId: string, colName: string, colIndex: number = 0): number | '' => {
    // 1. Check exact namaPenilaian match (e.g. 'T1', 'T2', 'Kuis/STS')
    const matchExact = asesmens.find(
      a => a.siswaId === siswaId && a.mapelId === mapelId && a.namaPenilaian === colName
    );
    if (matchExact !== undefined && matchExact.nilai !== undefined && matchExact.nilai !== null) {
      return matchExact.nilai;
    }

    // 2. If checking for T1, T2, T3 etc., also check if there is an assignment grade matching that index or task title
    if (colName.startsWith('T')) {
      const subjectTasks = daftarTugas.filter(t => t.mapelId === mapelId);
      const targetTask = subjectTasks[colIndex];

      // Find student candidate IDs
      const studentObj = siswas.find(s => s.id === siswaId);
      const candidateIds = Array.from(new Set([
        siswaId,
        studentObj?.email?.toLowerCase(),
        studentObj?.nisn
      ].filter(Boolean) as string[]));

      if (targetTask) {
        // Find score in asesmens by task title OR task ID
        const matchTask = asesmens.find(
          a => candidateIds.includes(a.siswaId) && a.mapelId === mapelId && (a.namaPenilaian === targetTask.judulTugas || a.id.includes(targetTask.id))
        );
        if (matchTask !== undefined && matchTask.nilai !== undefined && matchTask.nilai !== null) {
          return matchTask.nilai;
        }

        // Check tugas_siswa table directly for this task & student
        const allTs = db.tugasSiswa.getAll();
        const tsMatch = allTs.find(
          ts => ts.tugasId === targetTask.id && candidateIds.includes(ts.siswaId) && (ts.score != null || ts.nilai != null)
        );
        if (tsMatch) {
          return tsMatch.score ?? tsMatch.nilai ?? '';
        }
      } else {
        // Fallback: Check general asesmen at index
        const mapelAsesmens = asesmens.filter(a => candidateIds.includes(a.siswaId) && a.mapelId === mapelId);
        if (mapelAsesmens[colIndex] && mapelAsesmens[colIndex].nilai != null) {
          return mapelAsesmens[colIndex].nilai;
        }
      }
    }

    // 3. If checking for Kuis/STS
    if (colName === 'Kuis/STS') {
      const studentObj = siswas.find(s => s.id === siswaId);
      const candidateIds = Array.from(new Set([
        siswaId,
        studentObj?.email?.toLowerCase(),
        studentObj?.nisn
      ].filter(Boolean) as string[]));

      const stsMatch = asesmens.find(
        a => candidateIds.includes(a.siswaId) && a.mapelId === mapelId && (a.tipe === 'sts' || a.namaPenilaian === 'Kuis/STS' || a.namaPenilaian.toLowerCase().includes('kuis') || a.namaPenilaian.toLowerCase().includes('sts'))
      );
      if (stsMatch !== undefined && stsMatch.nilai !== undefined && stsMatch.nilai !== null) {
        return stsMatch.nilai;
      }
    }

    return '';
  };

  // Matrix cell handler (updates state & db in real time)
  const handleScoreChange = (
    siswaId: string,
    mapelId: string,
    tipe: 'harian' | 'sts' | 'sas',
    namaPenilaian: string,
    valStr: string,
    colIndex?: number
  ) => {
    const num = parseInt(valStr, 10);
    const student = siswas.find(s => s.id === siswaId);
    const candidateIds = Array.from(new Set([
      siswaId,
      student?.email?.toLowerCase(),
      student?.nisn
    ].filter(Boolean) as string[]));

    const existing = asesmens.find(
      a => candidateIds.includes(a.siswaId) && a.mapelId === mapelId && a.namaPenilaian === namaPenilaian
    );

    if (isNaN(num) || valStr === '') {
      if (existing) {
        db.asesmen.delete(existing.id);
        refreshData();
      }
      return;
    }

    const cleanScore = Math.min(100, Math.max(0, num));
    const updatedAsesmen: Asesmen = {
      id: existing ? existing.id : `asm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      siswaId,
      mapelId,
      tipe,
      namaPenilaian,
      nilai: cleanScore,
      tanggalPenilaian: new Date().toISOString().split('T')[0],
      dinilaiOlehId: loggedInUserId,
      kelas: student?.kelas || activeClassFilter
    };

    db.asesmen.upsert(updatedAsesmen);

    // Also update tugas_siswa if there is a matching task at this column index
    if (colIndex !== undefined && namaPenilaian.startsWith('T')) {
      const subjectTasks = daftarTugas.filter(t => t.mapelId === mapelId);
      const targetTask = subjectTasks[colIndex];
      if (targetTask) {
        const existingTs = db.tugasSiswa.getAll().find(
          ts => ts.tugasId === targetTask.id && candidateIds.includes(ts.siswaId)
        );
        db.tugasSiswa.upsert({
          id: existingTs?.id || `ts-${targetTask.id}-${siswaId}`,
          tugasId: targetTask.id,
          siswaId: siswaId,
          statusPengerjaan: true,
          status: 'SELESAI',
          score: cleanScore,
          nilai: cleanScore,
          submittedAt: existingTs?.submittedAt || new Date().toISOString(),
          tanggalDikerjakan: existingTs?.tanggalDikerjakan || new Date().toISOString().split('T')[0],
          umpanBalik: 'Nilai diinput oleh guru dari Tabel Asesmen.'
        });
      }
    }

    refreshData();
  };

  // Calculate average for a student in a specific subject
  const calculateRowAverage = (siswaId: string, mapelId: string) => {
    const studentScores = asesmens.filter(a => a.siswaId === siswaId && a.mapelId === mapelId);
    if (studentScores.length === 0) return 0;
    const sum = studentScores.reduce((acc, curr) => acc + curr.nilai, 0);
    return Math.round(sum / studentScores.length);
  };

  // Export matrix to Excel
  const exportMatrixExcel = () => {
    const exportData: any[] = [];

    filteredStudents.forEach(s => {
      filteredMapels.forEach(m => {
        const row: any = {
          'Nama Siswa': s.namaSiswa,
          'NISN': s.nisn,
          'Kelas': s.kelas,
          'Mata Pelajaran': m.namaMapel
        };

        // Add Harian columns
        let totalSum = 0;
        let validCount = 0;

        for (let i = 1; i <= harianColCount; i++) {
          const score = getNilaiValue(s.id, m.id, `T${i}`, i - 1);
          row[`Nilai Harian T${i}`] = score !== '' ? score : '-';
          if (typeof score === 'number') {
            totalSum += score;
            validCount++;
          }
        }

        // Add Kuis / STS Column
        const kuisScore = getNilaiValue(s.id, m.id, 'Kuis/STS', 99);
        row['Nilai Kuis / Tes'] = kuisScore !== '' ? kuisScore : '-';
        if (typeof kuisScore === 'number') {
          totalSum += kuisScore;
          validCount++;
        }

        row['Rata-Rata Nilai Formatif'] = validCount > 0 ? Math.round(totalSum / validCount) : 0;
        exportData.push(row);
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Nilai Excel');
    XLSX.writeFile(workbook, `DAFTAR_NILAI_EXCEL_${activeClassFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Import matrix from Excel
  const handleImportNilaiExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          alert('File Excel kosong atau format tidak sesuai.');
          return;
        }

        let updatedCount = 0;
        const allSiswas = db.siswa.getAll();
        const allMapels = db.mataPelajaran.getAll();

        rows.forEach((row) => {
          const findVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k =>
              keys.some(candidate => k.toLowerCase().replace(/[\s_:-]/g, '') === candidate.toLowerCase().replace(/[\s_:-]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const nisn = String(findVal(['nisn', 'nis']) || '').trim();
          const namaSiswa = String(findVal(['namasiswa', 'nama', 'siswa']) || '').trim();
          const mapelName = String(findVal(['matapelajaran', 'mapel', 'namamapel']) || '').trim();

          const targetStudent = allSiswas.find(s =>
            (nisn && s.nisn === nisn) ||
            (namaSiswa && s.namaSiswa.toLowerCase() === namaSiswa.toLowerCase())
          );

          const targetMapel = allMapels.find(m =>
            mapelName && (m.namaMapel.toLowerCase() === mapelName.toLowerCase() || m.kodeMapel.toLowerCase() === mapelName.toLowerCase())
          );

          if (!targetStudent || !targetMapel) return;

          // Check Harian columns T1, T2, T3...
          for (let i = 1; i <= 20; i++) {
            const val = findVal([`nilaihariant${i}`, `t${i}`, `hariant${i}`]);
            if (val !== undefined && val !== null && val !== '' && val !== '-') {
              const numVal = parseInt(String(val), 10);
              if (!isNaN(numVal)) {
                handleScoreChange(targetStudent.id, targetMapel.id, 'harian', `T${i}`, String(numVal), i - 1);
                updatedCount++;
              }
            }
          }

          // Check Kuis / STS column
          const kuisVal = findVal(['nilaikuistes', 'kuistes', 'kuissts', 'kuis', 'sts']);
          if (kuisVal !== undefined && kuisVal !== null && kuisVal !== '' && kuisVal !== '-') {
            const numVal = parseInt(String(kuisVal), 10);
            if (!isNaN(numVal)) {
              handleScoreChange(targetStudent.id, targetMapel.id, 'sts', 'Kuis/STS', String(numVal), 99);
              updatedCount++;
            }
          }
        });

        refreshData();
        setSaveSuccess(`Berhasil mengimpor ${updatedCount} nilai dari file Excel!`);
        setTimeout(() => setSaveSuccess(''), 4000);
        window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'asesmen' } }));
      } catch (err: any) {
        alert('Gagal membaca file Excel Nilai: ' + (err.message || 'Format tidak valid'));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Tabel Excel Asesmen Kurikulum Terstruktur
          </h3>
          <p className="text-xs text-slate-500">
            Daftar nilai terstruktur per siswa &amp; per mata pelajaran (Kolom Harian T1-T5+, Kuis/Tes, dan Rata-rata Otomatis).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mapel Filter */}
          <select
            value={selectedMapelId}
            onChange={(e) => setSelectedMapelId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
          >
            <option value="Semua">Semua Mapel Saya ({availableMapels.length})</option>
            {availableMapels.map(m => (
              <option key={m.id} value={m.id}>{m.namaMapel}</option>
            ))}
          </select>

          {/* Add Column Button */}
          <button
            onClick={() => setHarianColCount(prev => prev + 1)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
            title="Tambah kolom Tugas Harian (T6, T7, dst.)"
          >
            <Plus className="w-3.5 h-3.5" /> Kolom Tugas ({harianColCount})
          </button>

          {/* Ekspor Nilai Button */}
          <button
            onClick={exportMatrixExcel}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" /> Ekspor Nilai
          </button>

          {/* Impor Nilai Button */}
          <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all">
            <Download className="w-4 h-4" /> Impor Nilai
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportNilaiExcel}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {saveSuccess}
        </div>
      )}

      {/* Spreadsheet Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 border-r border-slate-200 dark:border-slate-700 min-w-[180px]">
                  Nama Siswa
                </th>
                <th className="px-4 py-3 border-r border-slate-200 dark:border-slate-700 min-w-[150px] text-left">
                  Mata Pelajaran
                </th>

                {/* Kolom 3: Sub-kolom Nilai Harian (T1, T2, T3, T4, T5...) */}
                {Array.from({ length: harianColCount }).map((_, idx) => (
                  <th
                    key={idx}
                    className="px-2 py-3 text-center border-r border-slate-200 dark:border-slate-700 min-w-[60px] bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300"
                  >
                    T{idx + 1}
                  </th>
                ))}

                {/* Kolom 4: Nilai Kuis / Tes */}
                <th className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-700 min-w-[85px] bg-purple-50/60 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300">
                  Kuis/Tes
                </th>

                {/* Kolom 5: Rata-Rata Nilai */}
                <th className="px-4 py-3 text-center min-w-[100px] bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-black">
                  Rata-Rata
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5 + harianColCount} className="text-center py-10 text-slate-400">
                    Tidak ada data siswa ditemukan untuk kelas {activeClassFilter}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((siswa) => {
                  return filteredMapels.map((mapel, mapelIdx) => {
                    const rowAvg = calculateRowAverage(siswa.id, mapel.id);

                    return (
                      <tr
                        key={`${siswa.id}-${mapel.id}`}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Kolom 1: Nama Siswa (Merged RowSpan across all Mapels) */}
                        {mapelIdx === 0 && (
                          <td
                            rowSpan={filteredMapels.length}
                            className="px-4 py-3 font-bold border-r border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 align-top shadow-xs"
                          >
                            <div className="flex flex-col sticky top-12">
                              <span className="text-xs font-black text-slate-900 dark:text-white leading-tight">{siswa.namaSiswa}</span>
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                                NISN: {siswa.nisn || '-'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                Kelas: {siswa.kelas}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Kolom 2: Mata Pelajaran */}
                        <td className="px-4 py-2.5 font-semibold border-r border-slate-200 dark:border-slate-800">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {mapel.namaMapel}
                          </span>
                        </td>

                        {/* Kolom 3: Nilai Harian (T1, T2, T3, T4, T5, ...) */}
                        {Array.from({ length: harianColCount }).map((_, colIdx) => {
                          const penName = `T${colIdx + 1}`;
                          const currentVal = getNilaiValue(siswa.id, mapel.id, penName, colIdx);

                          return (
                            <td
                              key={colIdx}
                              className="px-1 py-1.5 border-r border-slate-200 dark:border-slate-800 text-center"
                            >
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={currentVal}
                                onChange={(e) =>
                                  handleScoreChange(siswa.id, mapel.id, 'harian', penName, e.target.value, colIdx)
                                }
                                placeholder="-"
                                className="w-12 text-center bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg py-1 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                          );
                        })}

                        {/* Kolom 4: Kuis / Tes */}
                        <td className="px-1 py-1.5 border-r border-slate-200 dark:border-slate-800 text-center bg-purple-50/20 dark:bg-purple-950/10">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={getNilaiValue(siswa.id, mapel.id, 'Kuis/STS', 99)}
                            onChange={(e) =>
                              handleScoreChange(siswa.id, mapel.id, 'sts', 'Kuis/STS', e.target.value, 99)
                            }
                            placeholder="-"
                            className="w-14 text-center bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg py-1 font-mono text-xs font-bold text-purple-600 dark:text-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </td>

                        {/* Kolom 5: Rata-Rata Nilai */}
                        <td className="px-4 py-2.5 text-center bg-emerald-50/40 dark:bg-emerald-950/20 font-mono font-black text-sm">
                          <span
                            className={
                              rowAvg >= 75
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : rowAvg > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }
                          >
                            {rowAvg > 0 ? rowAvg : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
