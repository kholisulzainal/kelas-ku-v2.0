import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Eye,
  FileText,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  Download,
  Book,
  Maximize2,
  CheckCircle2,
  GraduationCap,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { db } from '../services/db';
import { BukuDigital, UserRole } from '../types';

// Helper to format Google Drive links or direct image URLs into direct browser-renderable image URLs
export const formatCoverImageUrl = (url?: string): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();

  // If it's a Google Drive URL (file/d/FILE_ID or id=FILE_ID)
  if (trimmed.includes('drive.google.com')) {
    let fileId = '';
    const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFileD && matchFileD[1]) {
      fileId = matchFileD[1];
    } else {
      const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchId && matchId[1]) {
        fileId = matchId[1];
      }
    }

    if (fileId) {
      // Direct high-performance Google CDN thumbnail endpoint for Drive images
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  return trimmed;
};

// Component to handle cover image rendering with automatic fallback
function BookCoverImage({ coverUrl, title }: { coverUrl?: string; title: string }) {
  const [hasError, setHasError] = useState(false);
  const formattedUrl = formatCoverImageUrl(coverUrl);

  if (!formattedUrl || hasError) {
    return (
      <div className="text-center p-4">
        <BookOpen className="w-12 h-12 text-indigo-400 mx-auto mb-2 opacity-80" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Buku Siswa
        </span>
      </div>
    );
  }

  return (
    <img
      src={formattedUrl}
      alt={title}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
    />
  );
}

interface BukuDigitalViewProps {
  currentRole: UserRole;
  currentUserId?: string;
  studentKelas?: string;
}

export function BukuDigitalView({ currentRole, currentUserId, studentKelas }: BukuDigitalViewProps) {
  const isManageMode = currentRole === 'operator' || currentRole === 'guru';

  const [books, setBooks] = useState<BukuDigital[]>(() => db.bukuDigital.getAll());
  const [mapels] = useState(() => db.mataPelajaran.getAll());
  const [siswas] = useState(() => db.siswa.getAll());

  // Detect current student's class if not passed
  const currentStudent = siswas.find(s => s.id === currentUserId);
  const activeStudentClass = studentKelas || currentStudent?.kelas || 'Kelas 1';

  // Extract distinct classes from operator data or default 1-6
  const operatorClasses = Array.from(new Set([
    ...siswas.map(s => s.kelas).filter(Boolean),
    'Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'
  ])).sort();

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<'semua' | 'buku_siswa' | 'buku_guru' | 'buku_non_teks' | 'lkpd'>('semua');
  const [selectedKelas, setSelectedKelas] = useState<string>(
    isManageMode ? 'Semua' : activeStudentClass
  );
  const [selectedMapel, setSelectedMapel] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reader Modal State
  const [readingBook, setReadingBook] = useState<BukuDigital | null>(null);

  // Manage Modal State (Add/Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);

  // Form States
  const [formJudul, setFormJudul] = useState('');
  const [formKelas, setFormKelas] = useState('Kelas 1');
  const [formKategoriBuku, setFormKategoriBuku] = useState<'buku_siswa' | 'buku_guru' | 'buku_non_teks' | 'lkpd'>('buku_siswa');
  const [formMapelNama, setFormMapelNama] = useState('Bahasa Indonesia');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formPenulis, setFormPenulis] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');

  // Re-fetch books on event or mount
  const refreshBooks = () => {
    setBooks(db.bukuDigital.getAll());
  };

  useEffect(() => {
    const handleUpdate = () => refreshBooks();
    window.addEventListener('supabase-data-updated', handleUpdate);
    return () => window.removeEventListener('supabase-data-updated', handleUpdate);
  }, []);

  const handleOpenAdd = () => {
    setEditingBookId(null);
    setFormJudul('');
    setFormKelas('Kelas 1');
    setFormKategoriBuku('buku_siswa');
    setFormMapelNama(mapels[0]?.namaMapel || 'Bahasa Indonesia');
    setFormFileUrl('');
    setFormCoverUrl('');
    setFormPenulis('Kementerian Pendidikan & Kebudayaan');
    setFormDeskripsi('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (book: BukuDigital) => {
    setEditingBookId(book.id);
    setFormJudul(book.judul);
    setFormKelas(book.kelas);
    setFormKategoriBuku(book.kategoriBuku || 'buku_siswa');
    setFormMapelNama(book.mapelNama);
    setFormFileUrl(book.fileUrl);
    setFormCoverUrl(book.coverUrl || '');
    setFormPenulis(book.penulis || '');
    setFormDeskripsi(book.deskripsi || '');
    setIsFormOpen(true);
  };

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formJudul.trim() || !formFileUrl.trim()) {
      alert('Judul buku dan link URL file PDF wajib diisi!');
      return;
    }

    const newBook: BukuDigital = {
      id: editingBookId || `book-${Date.now()}`,
      judul: formJudul,
      kelas: formKelas,
      kategoriBuku: formKategoriBuku,
      mapelNama: formMapelNama,
      fileUrl: formFileUrl,
      coverUrl: formatCoverImageUrl(formCoverUrl),
      penulis: formPenulis,
      deskripsi: formDeskripsi,
      uploadedBy: currentRole,
      createdAt: new Date().toISOString()
    };

    db.bukuDigital.upsert(newBook);
    refreshBooks();
    setIsFormOpen(false);
  };

  const handleDeleteBook = (id: string) => {
    if (currentRole !== 'operator') {
      alert('Hanya Operator yang memiliki akses untuk menghapus buku digital!');
      return;
    }
    if (confirm('Apakah Anda yakin ingin menghapus buku digital ini?')) {
      db.bukuDigital.delete(id);
      refreshBooks();
    }
  };

  // Filter books with strict role-based access
  const filteredBooks = books.filter(b => {
    const bookCategory = b.kategoriBuku || 'buku_siswa';

    // Privacy boundary: Buku Guru can ONLY be viewed by Guru & Operator
    if (!isManageMode && bookCategory === 'buku_guru') {
      return false;
    }

    // Category filter tab
    if (selectedCategory !== 'semua' && bookCategory !== selectedCategory) {
      return false;
    }

    const matchKelas = selectedKelas === 'Semua' || b.kelas === 'Semua Kelas' || b.kelas === selectedKelas;
    const matchMapel = selectedMapel === 'Semua' || b.mapelNama.toLowerCase() === selectedMapel.toLowerCase();
    const matchSearch = !searchQuery.trim() ||
      b.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.mapelNama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.penulis && b.penulis.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchKelas && matchMapel && matchSearch;
  });

  // Convert Google Drive view URL or direct PDF URLs to embeddable viewer URLs
  const getEmbeddablePdfUrl = (url: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('drive.google.com')) {
      if (trimmed.includes('/view')) {
        return trimmed.replace('/view', '/preview');
      }
      return trimmed;
    }
    if (trimmed.toLowerCase().endsWith('.pdf') || trimmed.includes('buku.kemdikbud.go.id') || trimmed.includes('pdf')) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`;
    }
    return trimmed;
  };

  // Badge renderer for book categories
  const renderCategoryBadge = (kategori?: string) => {
    const kat = kategori || 'buku_siswa';
    if (kat === 'buku_guru') {
      return (
        <span className="bg-purple-600/90 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 shadow-sm">
          <UserCheck className="w-3 h-3" /> Buku Pegangan Guru
        </span>
      );
    }
    if (kat === 'buku_non_teks') {
      return (
        <span className="bg-emerald-600/90 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 shadow-sm">
          <BookOpen className="w-3 h-3" /> Buku Bacaan
        </span>
      );
    }
    if (kat === 'lkpd') {
      return (
        <span className="bg-amber-600/90 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 shadow-sm">
          <FileText className="w-3 h-3" /> LKPD
        </span>
      );
    }
    return (
      <span className="bg-blue-600/90 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 shadow-sm">
        <GraduationCap className="w-3 h-3" /> Buku Siswa
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-blue-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
            <BookOpen className="w-8 h-8 text-blue-300" />
          </div>
          <div>
            <h2 className="text-xl font-black">Buku Digital, Modul Belajar &amp; LKPD</h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Koleksi Buku Teks Siswa, Buku Bacaan, LKPD dan Buku Pegangan Guru.
            </p>
          </div>
        </div>

        {isManageMode && (
          <button
            onClick={handleOpenAdd}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-5 py-3 rounded-2xl flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <Plus className="w-4 h-4" /> Tambah Buku Digital Baru
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-2xl">
        <button
          onClick={() => setSelectedCategory('semua')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            selectedCategory === 'semua'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Semua Kategori Buku
        </button>
        <button
          onClick={() => setSelectedCategory('buku_siswa')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedCategory === 'buku_siswa'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" /> Buku Siswa
        </button>
        <button
          onClick={() => setSelectedCategory('buku_non_teks')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedCategory === 'buku_non_teks'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Buku Bacaan
        </button>
        <button
          onClick={() => setSelectedCategory('lkpd')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedCategory === 'lkpd'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> LKPD
        </button>
        {isManageMode && (
          <button
            onClick={() => setSelectedCategory('buku_guru')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedCategory === 'buku_guru'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Buku Pegangan Guru
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-m3-border dark:border-slate-800 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Class Filter Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <GraduationCap className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-bold text-slate-600 dark:text-slate-300">Pilih Kelas:</span>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="bg-transparent font-extrabold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer"
            >
              <option value="Semua">Semua Kelas</option>
              {operatorClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <Book className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-bold text-slate-600 dark:text-slate-300">Mata Pelajaran:</span>
            <select
              value={selectedMapel}
              onChange={(e) => setSelectedMapel(e.target.value)}
              className="bg-transparent font-extrabold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
            >
              <option value="Semua">Semua Mapel</option>
              {mapels.map(m => (
                <option key={m.id} value={m.namaMapel}>{m.namaMapel}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul / materi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-m3-border dark:border-slate-800 space-y-3">
          <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 text-blue-500 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Buku Digital Belum Tersedia</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isManageMode
              ? 'Belum ada buku digital yang diunggah untuk kriteria ini. Klik tombol "+ Tambah Buku Digital Baru" di atas untuk menambahkan buku.'
              : 'Belum ada buku digital untuk kelas atau mata pelajaran ini. Silakan pilih kelas atau mapel lain.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-m3-border dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Book Cover Image Container */}
                <div className="relative h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                  <BookCoverImage coverUrl={book.coverUrl} title={book.judul} />

                  <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                    {renderCategoryBadge(book.kategoriBuku)}
                  </div>

                  <span className="absolute bottom-3 left-3 bg-slate-900/80 text-amber-300 font-bold text-[10px] px-2.5 py-0.5 rounded-md backdrop-blur-md">
                    {book.kelas} &bull; {book.mapelNama}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-2">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white line-clamp-2 leading-snug">
                    {book.judul}
                  </h4>

                  {book.penulis && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Penulis: {book.penulis}
                    </p>
                  )}

                  {book.deskripsi && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {book.deskripsi}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                <button
                  onClick={() => setReadingBook(book)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" /> Baca Buku (PDF)
                </button>

                {isManageMode && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(book)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-amber-500 hover:bg-amber-100 rounded-xl cursor-pointer"
                      title="Edit Buku"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {currentRole === 'operator' && (
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="p-2 bg-slate-100 dark:bg-slate-800 text-red-500 hover:bg-red-100 rounded-xl cursor-pointer"
                        title="Hapus Buku"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WEB VIEW PDF READER MODAL */}
      {readingBook && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">{readingBook.judul}</h3>
                  <p className="text-[11px] text-blue-200">{readingBook.mapelNama} &bull; {readingBook.kelas}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={readingBook.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center gap-1 font-bold"
                  title="Buka di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Tab Baru</span>
                </a>
                <button
                  onClick={() => setReadingBook(null)}
                  className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Web View / PDF Frame */}
            <div className="flex-1 bg-slate-950 relative">
              <iframe
                src={getEmbeddablePdfUrl(readingBook.fileUrl)}
                className="w-full h-full border-0"
                title={readingBook.judul}
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}

      {/* MANAGE MODAL (ADD / EDIT) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 border border-m3-border dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                {editingBookId ? 'Edit Buku Digital' : 'Tambah Buku Digital Baru'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori Buku Digital *
                </label>
                <select
                  value={formKategoriBuku}
                  onChange={(e) => setFormKategoriBuku(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="buku_siswa">📘 Buku Siswa</option>
                  <option value="buku_non_teks">📖 Buku Bacaan</option>
                  <option value="lkpd">📝 LKPD</option>
                  <option value="buku_guru">🔒 Buku Pegangan Guru</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Buku Pegangan Guru bersifat privat dan hanya dapat dibuka oleh akun Guru dan Operator.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Buku Digital *
                </label>
                <input
                  type="text"
                  required
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  placeholder="Contoh: Buku Siswa Bahasa Indonesia Kelas 4 Kurikulum Merdeka"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kelas Sasaran
                  </label>
                  <select
                    value={formKelas}
                    onChange={(e) => setFormKelas(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    {operatorClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    value={formMapelNama}
                    onChange={(e) => setFormMapelNama(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  >
                    {mapels.length > 0 ? (
                      mapels.map(m => (
                        <option key={m.id} value={m.namaMapel}>{m.namaMapel}</option>
                      ))
                    ) : (
                      <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Link File PDF / Google Drive Embed URL *
                </label>
                <input
                  type="url"
                  required
                  value={formFileUrl}
                  onChange={(e) => setFormFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view atau https://domain.com/buku.pdf"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Gunakan link Google Drive publik atau link URL file PDF langsung.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Link Cover Gambar Buku (Opsional)
                </label>
                <input
                  type="url"
                  value={formCoverUrl}
                  onChange={(e) => setFormCoverUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view atau https://domain.com/cover.jpg"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 <strong>Google Drive &amp; URL Direct:</strong> Link halaman Google Drive (seperti <code>/file/d/.../view</code>) dikonversi otomatis agar tampil. Pastikan akses file Google Drive diset ke <em>"Siapa saja yang memiliki link" (Akses Publik)</em>.
                </p>

                {formCoverUrl.trim() && (
                  <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <div className="w-12 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={formatCoverImageUrl(formCoverUrl)}
                        alt="Pratinjau Cover"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-bold block text-slate-800 dark:text-slate-200">Pratinjau Cover:</span>
                      {formatCoverImageUrl(formCoverUrl).includes('lh3.googleusercontent.com') ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓ Tautan Google Drive terdeteksi &amp; dikonversi otomatis
                        </span>
                      ) : (
                        <span>Link gambar siap digunakan</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Penulis / Penerbit
                </label>
                <input
                  type="text"
                  value={formPenulis}
                  onChange={(e) => setFormPenulis(e.target.value)}
                  placeholder="Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi / Ringkasan Buku
                </label>
                <textarea
                  rows={2}
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  placeholder="Ringkasan materi bab atau informasi buku..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  Simpan Buku Digital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
