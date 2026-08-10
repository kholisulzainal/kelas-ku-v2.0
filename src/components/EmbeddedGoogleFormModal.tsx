import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, FileText, ExternalLink } from 'lucide-react';

interface EmbeddedGoogleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleFormUrl: string;
  taskTitle: string;
  subjectName?: string;
  assignmentId: string;
  studentId: string;
  onConfirmFinish?: () => void;
  isSubmitting?: boolean;
}

export const EmbeddedGoogleFormModal: React.FC<EmbeddedGoogleFormModalProps> = ({
  isOpen,
  onClose,
  googleFormUrl,
  taskTitle,
  subjectName,
  onConfirmFinish,
  isSubmitting = false
}) => {
  if (!isOpen) return null;

  // Format Google Form URL for seamless embedding
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    let formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `https://${formatted}`;
    }
    if (!formatted.includes('embedded=true')) {
      formatted += formatted.includes('?') ? '&embedded=true' : '?embedded=true';
    }
    return formatted;
  };

  const embedUrl = getEmbedUrl(googleFormUrl);

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header Bar */}
          <div className="px-5 py-3 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border-b border-slate-700 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
                    Lembar Tugas Siswa
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                  {taskTitle} &bull; <span className="text-slate-300 font-semibold">{subjectName || 'Mata Pelajaran'}</span>
                </h3>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {googleFormUrl && (
                <a
                  href={googleFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl transition-all border border-slate-700"
                  title="Buka di Tab Baru"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Tab Baru
                </a>
              )}

              {onConfirmFinish && (
                <button
                  type="button"
                  onClick={onConfirmFinish}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 px-4 py-2 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? 'Memproses...' : 'Tandai Selesai'}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 border border-slate-700 ml-1"
                title="Tutup Modal"
                aria-label="Tutup Modal"
              >
                <X className="w-5 h-5 pointer-events-none" />
              </button>
            </div>
          </div>

          {/* Embedded Iframe */}
          <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={`Google Form - ${taskTitle}`}
                className="w-full h-full border-0 rounded-b-3xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-500">
                <p className="text-sm font-semibold">Tautan Google Form belum tersedia.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
