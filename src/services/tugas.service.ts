import { db } from './db';
import { getSupabaseClient, syncRowToSupabase, deleteRowFromSupabase } from './supabase';
import { syncGoogleFormScoresFromSheet } from './googleServices';
import { DaftarTugas, TugasSiswa, AssignmentStatus } from '../types';
import { getWibDateString, getWibIsoString } from '../utils/dateUtils';

export const tugasService = {
  async getDaftarTugas(): Promise<DaftarTugas[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('daftar_tugas').select('*');
        if (!error && data) {
          const items: DaftarTugas[] = data.map(t => ({
            id: t.id,
            mapelId: t.mapel_id,
            judulTugas: t.judul_tugas,
            deskripsi: t.deskripsi || '',
            googleFormUrl: t.google_form_url || '',
            tanggalDiberikan: t.tanggal_diberikan,
            tenggatWaktu: t.tenggat_waktu || '',
            dibuatOlehId: t.dibuat_oleh_id || '',
            kelas: t.kelas || ''
          }));
          db.daftarTugas.save(items);
          return items;
        }
      } catch (err) {
        console.warn('[Tugas Service] Error fetching tasks from Supabase:', err);
      }
    }
    return db.daftarTugas.getAll();
  },

  async getTasks(): Promise<DaftarTugas[]> {
    return this.getDaftarTugas();
  },

  async upsertDaftarTugas(task: DaftarTugas): Promise<{ success: boolean; error?: string }> {
    db.daftarTugas.upsert(task);
    const res = await syncRowToSupabase('daftar_tugas', task, true);
    return { success: res.success, error: res.error };
  },

  async upsertTask(task: DaftarTugas): Promise<{ success: boolean; error?: string }> {
    return this.upsertDaftarTugas(task);
  },

  async deleteDaftarTugas(id: string): Promise<{ success: boolean; error?: string }> {
    db.daftarTugas.delete(id);
    const res = await deleteRowFromSupabase('daftar_tugas', id);
    return { success: res.success, error: res.error };
  },

  async deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
    return this.deleteDaftarTugas(id);
  },

  async getTugasSiswa(): Promise<TugasSiswa[]> {
    const client = getSupabaseClient();
    const localList = db.tugasSiswa.getAll();

    if (client) {
      try {
        const { data, error } = await client.from('tugas_siswa').select('*');
        if (!error && data) {
          const remoteItems: TugasSiswa[] = data.map(ts => ({
            id: ts.id,
            tugasId: ts.tugas_id,
            siswaId: ts.siswa_id,
            statusPengerjaan: Boolean(ts.status_pengerjaan),
            status: (ts.status as AssignmentStatus) || (ts.status_pengerjaan ? 'SELESAI' : 'BELUM_DIKERJAKAN'),
            startedAt: ts.started_at || null,
            submittedAt: ts.submitted_at || null,
            tanggalDikerjakan: ts.tanggal_dikerjakan || '',
            nilai: ts.nilai ?? undefined,
            score: ts.score ?? ts.nilai ?? null,
            umpanBalik: ts.umpan_balik || ''
          }));

          const allStudents = db.siswa.getAll();
          const getCandidateIds = (sid: string): string[] => {
            const s = allStudents.find(x => x.id === sid);
            return Array.from(new Set([
              sid,
              s?.email?.toLowerCase(),
              s?.nisn
            ].filter(Boolean) as string[]));
          };

          const mergedMap = new Map<string, TugasSiswa>();

          // First populate local list
          localList.forEach(loc => {
            const cIds = getCandidateIds(loc.siswaId);
            const key = `${loc.tugasId}-${cIds[0] || loc.siswaId}`;
            mergedMap.set(key, loc);
          });

          // Merge remote items
          remoteItems.forEach(rem => {
            const cIds = getCandidateIds(rem.siswaId);
            const key = `${rem.tugasId}-${cIds[0] || rem.siswaId}`;
            const existingLoc = mergedMap.get(key);

            if (existingLoc) {
              const locIsFinished = existingLoc.status === 'SELESAI' || existingLoc.statusPengerjaan === true;
              const remIsFinished = rem.status === 'SELESAI' || rem.statusPengerjaan === true;
              const isDone = locIsFinished || remIsFinished;

              mergedMap.set(key, {
                ...rem,
                ...existingLoc,
                status: isDone ? 'SELESAI' : (existingLoc.status || rem.status),
                statusPengerjaan: isDone,
                score: rem.score ?? existingLoc.score ?? rem.nilai ?? existingLoc.nilai ?? null,
                nilai: rem.nilai ?? existingLoc.nilai ?? rem.score ?? existingLoc.score ?? undefined,
                submittedAt: existingLoc.submittedAt || rem.submittedAt || (isDone ? new Date().toISOString() : null)
              });
            } else {
              mergedMap.set(key, rem);
            }
          });

          const finalMerged = Array.from(mergedMap.values());
          db.tugasSiswa.save(finalMerged);
          return finalMerged;
        }
      } catch (err) {
        console.warn('[Tugas Service] Error fetching submissions from Supabase:', err);
      }
    }
    return db.tugasSiswa.getAll();
  },

  async getSubmissions(): Promise<TugasSiswa[]> {
    return this.getTugasSiswa();
  },

  async getStatusTugasSiswa(tugasId: string, siswaId: string): Promise<{
    status: AssignmentStatus;
    score?: number | null;
    startedAt?: string | null;
    submittedAt?: string | null;
    submission?: TugasSiswa;
  }> {
    const client = getSupabaseClient();

    // Find student details to get candidate IDs
    const currentSiswa = db.siswa.getAll().find(s => s.id === siswaId);
    const studentNisn = currentSiswa?.nisn?.trim();
    const studentEmail = currentSiswa?.email?.trim().toLowerCase();

    const targetIds = Array.from(
      new Set([siswaId, studentNisn, studentEmail].filter(Boolean) as string[])
    );

    // Check existing local DB state
    const allLocal = db.tugasSiswa.getAll();
    const matchingLocals = allLocal.filter(s => s.tugasId === tugasId && targetIds.includes(s.siswaId));
    const localDone = matchingLocals.find(s => s.status === 'SELESAI' || s.statusPengerjaan === true);
    const existingLocal = localDone || matchingLocals[0];

    const localScore = localDone?.score ?? localDone?.nilai ?? null;
    if (localDone && localScore != null) {
      return {
        status: 'SELESAI',
        score: localScore,
        startedAt: localDone.startedAt || null,
        submittedAt: localDone.submittedAt || null,
        submission: localDone
      };
    }

    // Check local penilaian table if score in tugasSiswa is null
    const localPnlMatch = db.penilaian.getAll().find(
      p => targetIds.includes(p.siswaId) && (p.id.includes(tugasId) || p.namaPenilaian?.includes(tugasId))
    );
    if (localPnlMatch && localPnlMatch.nilai != null) {
      const foundScore = Number(localPnlMatch.nilai);
      if (localDone) {
        localDone.score = foundScore;
        localDone.nilai = foundScore;
        db.tugasSiswa.upsert(localDone);
      }
      return {
        status: 'SELESAI',
        score: foundScore,
        startedAt: localDone?.startedAt || null,
        submittedAt: localDone?.submittedAt || null,
        submission: localDone || undefined
      };
    }

    if (client) {
      try {
        let tsRow: any = null;
        let parsedScore: number | null = null;

        // Query 1: Fetch from tugas_siswa
        const { data: tsData } = await client
          .from('tugas_siswa')
          .select('*')
          .eq('tugas_id', tugasId)
          .in('siswa_id', targetIds)
          .order('submitted_at', { ascending: false });

        if (tsData && tsData.length > 0) {
          const finishedRow = tsData.find((r: any) => r.status === 'SELESAI' || Boolean(r.status_pengerjaan));
          tsRow = finishedRow || tsData[0];

          if (tsRow.score != null && !isNaN(Number(tsRow.score))) parsedScore = Number(tsRow.score);
          else if (tsRow.nilai != null && !isNaN(Number(tsRow.nilai))) parsedScore = Number(tsRow.nilai);
        }

        // Query 2: Search in penilaian table
        if (parsedScore == null) {
          const { data: pnlData } = await client
            .from('penilaian')
            .select('*')
            .in('siswa_id', targetIds)
            .order('created_at', { ascending: false });

          if (pnlData && pnlData.length > 0) {
            const matchPnl = pnlData.find((p: any) => 
              targetIds.includes(p.siswa_id) && (p.id.includes(tugasId) || p.nama_penilaian?.includes(tugasId))
            );
            if (matchPnl && matchPnl.nilai != null && !isNaN(Number(matchPnl.nilai))) {
              parsedScore = Number(matchPnl.nilai);
            }
          }
        }

        if (tsRow || parsedScore != null) {
          const isDone = parsedScore != null || Boolean(tsRow?.status_pengerjaan) || tsRow?.status === 'SELESAI';
          const isStarted = Boolean(tsRow?.started_at) || Boolean(existingLocal?.startedAt);

          const statusVal: AssignmentStatus = isDone
            ? 'SELESAI'
            : (isStarted ? 'SEDANG_MENGERJAKAN' : 'BELUM_DIKERJAKAN');

          const finalScore = parsedScore ?? existingLocal?.score ?? existingLocal?.nilai ?? null;

          const localSub: TugasSiswa = {
            id: tsRow?.id || existingLocal?.id || `ts-${tugasId}-${siswaId}`,
            tugasId: tugasId,
            siswaId: siswaId,
            statusPengerjaan: isDone,
            status: statusVal,
            startedAt: tsRow?.started_at || existingLocal?.startedAt || null,
            submittedAt: tsRow?.submitted_at || existingLocal?.submittedAt || (isDone ? new Date().toISOString() : null),
            tanggalDikerjakan: tsRow?.tanggal_dikerjakan || existingLocal?.tanggalDikerjakan || '',
            nilai: finalScore != null ? finalScore : undefined,
            score: finalScore,
            umpanBalik: tsRow?.umpan_balik || existingLocal?.umpanBalik || ''
          };

          db.tugasSiswa.upsert(localSub);

          if (finalScore != null) {
            const task = db.daftarTugas.getAll().find(t => t.id === tugasId);
            const student = db.siswa.getAll().find(s => s.id === siswaId);
            db.penilaian.upsert({
              id: `as-${tugasId}-${siswaId}`,
              siswaId: siswaId,
              mapelId: task?.mapelId || 'mapel-1',
              tipe: 'harian',
              namaPenilaian: task?.judulTugas || 'Kuis Google Form',
              nilai: finalScore,
              deskripsiKompetensi: `Nilai kuis Google Form disinkronkan dari server`,
              tanggalPenilaian: tsRow?.tanggal_dikerjakan || new Date().toISOString().split('T')[0],
              dinilaiOlehId: task?.dibuatOlehId || 'guru-1',
              kelas: student?.kelas || task?.kelas || 'Kelas 4-A'
            });
            window.dispatchEvent(new Event('penilaians-updated'));
            window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));
          }

          return {
            status: statusVal,
            score: finalScore,
            startedAt: localSub.startedAt,
            submittedAt: localSub.submittedAt,
            submission: localSub
          };
        }
      } catch (err) {
        console.warn('[Tugas Service] tugas_siswa check notice:', err);
      }
    }

    if (existingLocal) {
      const status: AssignmentStatus = existingLocal.status || (existingLocal.statusPengerjaan ? 'SELESAI' : (existingLocal.startedAt ? 'SEDANG_MENGERJAKAN' : 'BELUM_DIKERJAKAN'));
      return {
        status,
        score: existingLocal.score ?? existingLocal.nilai ?? null,
        startedAt: existingLocal.startedAt || null,
        submittedAt: existingLocal.submittedAt || null,
        submission: existingLocal
      };
    }

    return { status: 'BELUM_DIKERJAKAN' };
  },

  async getStudentAssignmentStatus(assignmentId: string, studentId: string) {
    return this.getStatusTugasSiswa(assignmentId, studentId);
  },

  async mulaiTugas(tugasId: string, siswaId: string): Promise<TugasSiswa> {
    const nowIso = getWibIsoString();
    
    const existing = db.tugasSiswa.getAll().find(s => s.tugasId === tugasId && s.siswaId === siswaId);
    const sub: TugasSiswa = {
      id: existing?.id || `ts-${tugasId}-${siswaId}`,
      tugasId: tugasId,
      siswaId: siswaId,
      statusPengerjaan: false,
      status: 'SEDANG_MENGERJAKAN',
      startedAt: existing?.startedAt || nowIso
    };

    db.tugasSiswa.upsert(sub);
    syncRowToSupabase('tugas_siswa', sub, true).catch(e => console.warn(e));

    return sub;
  },

  async startAssignment(assignmentId: string, studentId: string): Promise<TugasSiswa> {
    return this.mulaiTugas(assignmentId, studentId);
  },

  async selesaiTugas(tugasId: string, siswaId: string, customScore?: number, umpanBalik?: string): Promise<TugasSiswa> {
    const currentSiswa = db.siswa.getAll().find(s => s.id === siswaId);
    const studentEmail = currentSiswa?.email?.trim().toLowerCase();
    const studentNisn = currentSiswa?.nisn?.trim();

    const targetIds = Array.from(
      new Set([siswaId, studentEmail, studentNisn].filter(Boolean) as string[])
    );

    // 1. SAVE LOCALLY IMMEDIATELY & CLEAN UP DUPLICATES
    db.tugasSiswa.submitTask(tugasId, siswaId, customScore);

    const submissions = db.tugasSiswa.getAll();
    const sub = submissions.find(s => s.tugasId === tugasId && targetIds.includes(s.siswaId)) || {
      id: `ts-${tugasId}-${siswaId}`,
      tugasId: tugasId,
      siswaId: siswaId,
      statusPengerjaan: true,
      status: 'SELESAI' as AssignmentStatus,
      submittedAt: getWibIsoString(),
      tanggalDikerjakan: getWibDateString(),
      score: customScore ?? null,
      nilai: customScore ?? undefined
    };

    if (umpanBalik) {
      sub.umpanBalik = umpanBalik;
      db.tugasSiswa.upsert(sub);
    }

    let resolvedScore: number | null = sub.score ?? sub.nilai ?? null;

    if (resolvedScore != null) {
      const task = db.daftarTugas.getAll().find(t => t.id === tugasId);
      const student = db.siswa.getAll().find(s => s.id === siswaId);

      const pnlItem = {
        id: `as-${tugasId}-${siswaId}`,
        siswaId: siswaId,
        mapelId: task?.mapelId || 'mapel-1',
        tipe: 'harian' as const,
        namaPenilaian: task?.judulTugas || 'Tugas Google Form',
        nilai: resolvedScore,
        deskripsiKompetensi: `Nilai dari pengerjaan tugas ${task?.judulTugas || ''}`,
        tanggalPenilaian: sub.tanggalDikerjakan || new Date().toISOString().split('T')[0],
        dinilaiOlehId: task?.dibuatOlehId || 'guru-1',
        kelas: student?.kelas || task?.kelas || 'Kelas 4-A'
      };

      db.penilaian.upsert(pnlItem);
      syncRowToSupabase('penilaian', pnlItem, true).catch(err => console.warn(err));
    }

    window.dispatchEvent(new Event('penilaians-updated'));
    window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'tugas_siswa' } }));

    // 2. RUN SUPABASE SYNC AND BACKGROUND SCORE FETCHING ASYNCHRONOUSLY WITHOUT BLOCKING THE UI
    (async () => {
      try {
        const client = getSupabaseClient();
        if (!client) return;

        // Sync main submission row to Supabase
        await syncRowToSupabase('tugas_siswa', sub, true).catch(err => console.warn(err));

        // Update all candidate student rows in Supabase to SELESAI
        for (const candId of targetIds) {
          try {
            await client
              .from('tugas_siswa')
              .update({
                status: 'SELESAI',
                status_pengerjaan: true,
                submitted_at: sub.submittedAt || new Date().toISOString(),
                score: sub.score,
                nilai: sub.nilai
              })
              .eq('tugas_id', tugasId)
              .eq('siswa_id', candId);
          } catch (e) {}
        }

        // If score was null, do a quick check in Supabase for webhook score
        if (resolvedScore == null) {
          try {
            const { data: tsData } = await client
              .from('tugas_siswa')
              .select('*')
              .eq('tugas_id', tugasId)
              .in('siswa_id', targetIds)
              .order('submitted_at', { ascending: false });

            if (tsData && tsData.length > 0) {
              const matchRow = tsData.find((r: any) => targetIds.includes(r.siswa_id) || r.id === `ts-${tugasId}-${siswaId}`);
              if (matchRow) {
                const sc = matchRow.score ?? matchRow.nilai ?? null;
                if (sc != null && !isNaN(Number(sc))) {
                  resolvedScore = Number(sc);
                  sub.score = resolvedScore;
                  sub.nilai = resolvedScore;
                  sub.umpanBalik = 'Tugas diselesaikan melalui Google Form (Nilai tersinkron otomatis).';
                  db.tugasSiswa.upsert(sub);
                }
              }
            }
          } catch (e) {}
        }

        // Background Poller if score is still null
        if (sub.score == null) {
          let attempts = 0;
          const pollTimer = setInterval(async () => {
            attempts++;
            try {
              const fresh = await tugasService.getStatusTugasSiswa(tugasId, siswaId);
              if (fresh.score != null) {
                clearInterval(pollTimer);
                window.dispatchEvent(new Event('penilaians-updated'));
                window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'tugas_siswa' } }));
              }
            } catch (e) {}
            if (attempts >= 4) {
              clearInterval(pollTimer);
            }
          }, 4000);
        }
      } catch (err) {
        console.warn('[selesaiTugas async bg sync notice]:', err);
      }
    })();

    return sub;
  },

  async finishAssignment(assignmentId: string, studentId: string, customScore?: number, umpanBalik?: string): Promise<TugasSiswa> {
    return this.selesaiTugas(assignmentId, studentId, customScore, umpanBalik);
  },

  async upsertTugasSiswa(sub: TugasSiswa): Promise<{ success: boolean; error?: string }> {
    db.tugasSiswa.upsert(sub);

    const scoreVal = sub.score ?? sub.nilai;
    if (scoreVal != null) {
      const task = db.daftarTugas.getAll().find(t => t.id === sub.tugasId);
      const student = db.siswa.getAll().find(s => s.id === sub.siswaId);
      const pnlItem = {
        id: `as-${sub.tugasId}-${sub.siswaId}`,
        siswaId: sub.siswaId,
        mapelId: task?.mapelId || 'mapel-1',
        tipe: 'harian' as const,
        namaPenilaian: task?.judulTugas || 'Tugas Google Form',
        nilai: scoreVal,
        deskripsiKompetensi: `Nilai dari pengerjaan tugas ${task?.judulTugas || ''}`,
        tanggalPenilaian: sub.tanggalDikerjakan || new Date().toISOString().split('T')[0],
        dinilaiOlehId: task?.dibuatOlehId || 'guru-1',
        kelas: student?.kelas || task?.kelas || 'Kelas 4-A'
      };
      db.penilaian.upsert(pnlItem);
      syncRowToSupabase('penilaian', pnlItem, true).catch(err => console.warn(err));
      window.dispatchEvent(new Event('penilaians-updated'));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));
    }

    const res = await syncRowToSupabase('tugas_siswa', sub, true);
    return { success: res.success, error: res.error };
  },

  async upsertSubmission(sub: TugasSiswa) {
    return this.upsertTugasSiswa(sub);
  }
};
