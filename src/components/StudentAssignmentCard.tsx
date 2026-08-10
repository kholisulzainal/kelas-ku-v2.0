import React, { useState, useEffect } from 'react';
import { Play, RotateCw, CheckCircle2, Clock, Award, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import { DaftarTugas, AssignmentStatus } from '../types';
import { db } from '../services/db';
import { tugasService } from '../services/tugas.service';
import { syncGoogleFormScoresFromSheet } from '../services/googleServices';
import { EmbeddedGoogleFormModal } from './EmbeddedGoogleFormModal';

interface StudentAssignmentCardProps {
  task: DaftarTugas;
  studentId: string;
  mapelName?: string;
  onStatusUpdated?: () => void;
}

export const StudentAssignmentCard: React.FC<StudentAssignmentCardProps> = ({
  task,
  studentId,
  mapelName,
  onStatusUpdated
}) => {
  const [status, setStatus] = useState<AssignmentStatus>('BELUM_DIKERJAKAN');
  const [score, setScore] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 1. Fetch State Pengerjaan Siswa from student_assignments / local DB
  const fetchStatus = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setIsLoading(true);
    }
    try {
      const res = await tugasService.getStatusTugasSiswa(task.id, studentId);
      setStatus(prev => (prev === 'SELESAI' || res.status === 'SELESAI') ? 'SELESAI' : res.status);

      let resolvedScore = res.score ?? null;
      if (resolvedScore == null) {
        const studentObj = db.siswa.getAll().find(s => s.id === studentId);
        const candidateIds = Array.from(new Set([
          studentId,
          studentObj?.email?.toLowerCase(),
          studentObj?.nisn
        ].filter(Boolean) as string[]));

        const matchPnl = db.penilaian.getAll().find(
          p => candidateIds.includes(p.siswaId) && (p.id === `as-${task.id}-${studentId}` || p.id === `as-auto-${task.id}-${studentId}` || p.id.includes(task.id))
        );
        if (matchPnl && matchPnl.nilai != null) {
          resolvedScore = matchPnl.nilai;
        }
      }

      setScore(resolvedScore);
      setStartedAt(res.startedAt ?? null);
      setSubmittedAt(res.submittedAt ?? null);
    } catch (err) {
      console.warn('Error fetching student assignment status:', err);
    } finally {
      if (showLoadingSpinner) {
        setIsLoading(false);
      }
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (task.id) {
      await syncGoogleFormScoresFromSheet(task.id, task.googleSheetUrl || task.googleFormUrl).catch(() => {});
    }
    await fetchStatus(false);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  useEffect(() => {
    if (task.id && studentId) {
      fetchStatus(true);
    }
  }, [task.id, studentId]);

  // Automatic polling when waiting for webhook score
  useEffect(() => {
    if (status === 'SELESAI' && score == null) {
      const interval = setInterval(() => {
        fetchStatus(false);
      }, 8000);

      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 40000); // Poll for up to 40s

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [status, score, task.id, studentId]);

  // Listen for window focus & custom sync events
  useEffect(() => {
    const handleSync = () => fetchStatus(false);
    window.addEventListener('focus', handleSync);
    window.addEventListener('supabase-data-updated', handleSync);
    window.addEventListener('penilaians-updated', handleSync);
    window.addEventListener('asesmens-updated', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('supabase-data-updated', handleSync);
      window.removeEventListener('penilaians-updated', handleSync);
      window.removeEventListener('asesmens-updated', handleSync);
    };
  }, [task.id, studentId]);

  // Handle Click for BELUM_DIKERJAKAN
  const handleStartTask = async () => {
    try {
      setIsSubmitting(true);
      // Immediately open modal & set local state for instant UI response
      setStatus('SEDANG_MENGERJAKAN');
      const nowIso = new Date().toISOString();
      setStartedAt(nowIso);
      setIsModalOpen(true);

      // Save / Insert record with status 'SEDANG_MENGERJAKAN' asynchronously
      await tugasService.mulaiTugas(task.id, studentId);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error('Failed to start assignment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Click for SEDANG_MENGERJAKAN
  const handleContinueTask = () => {
    // Directly open Google Form modal (no new record creation)
    setIsModalOpen(true);
  };

  // Handle Confirmation of Task Completion from Modal or Card
  const handleConfirmCompletion = async () => {
    try {
      setIsSubmitting(true);
      // Immediately set UI status to SELESAI & close modal for zero delay
      const nowIso = new Date().toISOString();
      setStatus('SELESAI');
      setSubmittedAt(nowIso);
      setIsModalOpen(false);

      if (task.id) {
        syncGoogleFormScoresFromSheet(task.id, task.googleSheetUrl || task.googleFormUrl).catch(() => {});
      }

      const updated = await tugasService.selesaiTugas(task.id, studentId);
      if (updated.score != null || updated.nilai != null) {
        setScore(updated.score ?? updated.nilai ?? null);
      }
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error('Failed to finish assignment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCompleted = status === 'SELESAI';
  const isInProgress = status === 'SEDANG_MENGERJAKAN';

  return (
    <div
      className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between transition-all ${
        isCompleted
          ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30'
          : isInProgress
          ? 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-300 dark:border-amber-800/40'
          : 'bg-white dark:bg-slate-900 border-m3-border dark:border-slate-800/80 hover:border-m3-purple/40'
      }`}
    >
      <div>
        {/* Top Badges */}
        <div className="flex justify-between items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-m3-purple-light text-m3-purple-dark dark:bg-m3-purple/20 dark:text-m3-purple-light">
            {mapelName || 'Mata Pelajaran'}
          </span>

          {/* Dinamis Status Badge */}
          {isCompleted ? (
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Tugas Sudah Selesai
            </span>
          ) : isInProgress ? (
            <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs font-extrabold bg-amber-100 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-300 dark:border-amber-800/60 shadow-xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Sedang Dikerjakan
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              <AlertCircle className="w-3 h-3 text-slate-500" />
              Belum Dikerjakan
            </span>
          )}
        </div>

        {/* Task Title & Description */}
        <h4 className="text-base font-extrabold text-m3-text dark:text-white mt-3.5 leading-snug">
          {task.judulTugas}
        </h4>
        <p className="text-xs text-m3-sec-text mt-1.5 line-clamp-2">
          {task.deskripsi || 'Tidak ada deskripsi tambahan.'}
        </p>

        {/* Task Details Box */}
        <div className="mt-4 bg-slate-50/80 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
          {/* Deadline */}
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1 text-m3-sec-text">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Tenggat Waktu:
            </span>
            <strong className="text-slate-800 dark:text-slate-200 font-semibold">
              {task.tenggatWaktu ? (
                new Date(task.tenggatWaktu).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              ) : 'Tidak ada tenggat'}
            </strong>
          </div>

          {/* Timestamp Info for SEDANG_MENGERJAKAN */}
          {isInProgress && startedAt && (
            <div className="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-700/60 pt-2 text-amber-700 dark:text-amber-300">
              <span>Mulai Dikerjakan:</span>
              <strong className="font-mono text-[11px]">
                {new Date(startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </strong>
            </div>
          )}

          {/* Score & Badge for SELESAI */}
          {isCompleted && (
            <div className="border-t border-emerald-200 dark:border-emerald-900/50 pt-2 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1 font-semibold">
                  <Award className="w-3.5 h-3.5 text-amber-500" /> Skor / Nilai Siswa:
                </span>
                <div className="flex items-center gap-2">
                  <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold font-mono text-sm">
                    {score != null ? `${score} / 100` : 'Menunggu Webhook Nilai'}
                  </strong>
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    title="Cek & Refresh Sinkronisasi Webhook"
                    className="p-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 cursor-pointer transition-all"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {score == null && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                  *Tugas telah ditandai selesai. Nilai akan otomatis terupdate setelah kuis diisi & Webhook Google Form terhubung. Klik tombol refresh di atas untuk memeriksa nilai terbaru.
                </p>
              )}
              {submittedAt && (
                <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Waktu Dikirim:</span>
                  <span>{new Date(submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Action Buttons Section */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
        {/* Condition 'SELESAI': Hide Google Form button, show completion badge */}
        {isCompleted ? (
          <div className="bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 p-3 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <span className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Tugas Telah Dikirim &amp; Selesai
            </span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full">
              Terkunci (Selesai)
            </span>
          </div>
        ) : isInProgress ? (
          /* Condition 'SEDANG_MENGERJAKAN': Button "Lanjutkan Mengerjakan" */
          <div className="space-y-2">
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 mb-1">
              <span>⚡ Status: Anda sedang mengerjakan tugas ini</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                id={`continue_task_${task.id}`}
                onClick={handleContinueTask}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold py-2.5 rounded-2xl shadow-sm cursor-pointer transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95"
              >
                <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
                Lanjutkan Mengerjakan
              </button>
              <button
                type="button"
                id={`confirm_finish_${task.id}`}
                onClick={handleConfirmCompletion}
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold py-2.5 rounded-2xl shadow-sm cursor-pointer transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tandai Selesai
              </button>
            </div>
          </div>
        ) : (
          /* Condition 'BELUM_DIKERJAKAN': Button "Kerjakan Tugas" */
          <button
            type="button"
            id={`start_task_${task.id}`}
            onClick={handleStartTask}
            disabled={isSubmitting || isLoading}
            className="w-full bg-m3-purple hover:bg-m3-purple-dark text-white text-xs font-extrabold py-2.5 rounded-2xl shadow-sm cursor-pointer transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isSubmitting ? 'Membuka Form...' : 'Kerjakan Tugas'}
          </button>
        )}
      </div>

      {/* Embedded Google Form Modal */}
      <EmbeddedGoogleFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        googleFormUrl={task.googleFormUrl}
        taskTitle={task.judulTugas}
        subjectName={mapelName}
        assignmentId={task.id}
        studentId={studentId}
        onConfirmFinish={handleConfirmCompletion}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
