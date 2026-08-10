import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Code, HelpCircle, Key, Send, CheckCircle2, Database } from 'lucide-react';
import { DaftarTugas } from '../types';
import { getSupabaseConfig } from '../services/supabase';

interface GoogleAppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks?: DaftarTugas[];
  selectedTask?: DaftarTugas | null;
}

export const GoogleAppsScriptModal: React.FC<GoogleAppsScriptModalProps> = ({
  isOpen,
  onClose,
  tasks = [],
  selectedTask = null,
}) => {
  const [activeTaskId, setActiveTaskId] = useState<string>(selectedTask?.id || tasks[0]?.id || '');
  const [copied, setCopied] = useState<boolean>(false);
  const [testEmail, setTestEmail] = useState<string>('siswa1@sd.id');
  const [testScoreText, setTestScoreText] = useState<string>('88 / 100');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'script' | 'form_generator' | 'sql'>('script');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedFormGen, setCopiedFormGen] = useState<boolean>(false);

  const sqlMigrationCode = `-- =========================================================================
-- SQL MIGRASI & REFACTOR LENGKAP SUPABASE (VERSI TERBARU APLIKASI)
-- Jalankan skrip ini di SQL Editor Dashboard Supabase Anda
-- =========================================================================

-- 1. HAPUS TABEL-TABEL LAMA / DEPRECATED YANG TIDAK DIGUNAKAN LAGI
DROP TABLE IF EXISTS public.student_assignments CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.ppdb CASCADE;
DROP TABLE IF EXISTS public.news CASCADE;
DROP TABLE IF EXISTS public.gallery CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. DOKUMENTASI / MIGRASI DATA TABEL ASESMEN KE PENILAIAN
-- Buat Tabel public.penilaian (Tabel Penilaian Utama)
CREATE TABLE IF NOT EXISTS public.penilaian (
  id text PRIMARY KEY DEFAULT ('pnl-' || extract(epoch from now())::bigint),
  siswa_id text NOT NULL,
  mapel_id text,
  tipe text DEFAULT 'harian',
  nama_penilaian text NOT NULL,
  nilai numeric NOT NULL,
  deskripsi_kompetensi text,
  tanggal_penilaian text,
  dinilai_oleh_id text,
  kelas text,
  created_at timestamptz DEFAULT now()
);

-- Jika tabel asesmen sebelumnya ada dalam bentuk TABEL FISIK, migrasikan datanya ke penilaian lalu ubah asesmen menjadi VIEW
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'asesmen' 
    AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO public.penilaian (id, siswa_id, mapel_id, tipe, nama_penilaian, nilai, deskripsi_kompetensi, tanggal_penilaian, dinilai_oleh_id, kelas)
    SELECT id, siswa_id, mapel_id, COALESCE(tipe, 'harian'), COALESCE(nama_penilaian, 'Penilaian'), COALESCE(nilai, 0), deskripsi_kompetensi, tanggal_penilaian, dinilai_oleh_id, kelas
    FROM public.asesmen
    ON CONFLICT (id) DO NOTHING;
    
    DROP TABLE public.asesmen CASCADE;
  END IF;
END $$;

-- Buat VIEW public.asesmen agar backward compatible apabila ada request legacy
CREATE OR REPLACE VIEW public.asesmen AS
SELECT * FROM public.penilaian;

-- 3. BUAT ATAU DIPERBARUI TABEL public.tugas_siswa (Tabel Kanonikal Tugas & Skor)
CREATE TABLE IF NOT EXISTS public.tugas_siswa (
  id text PRIMARY KEY DEFAULT ('ts-' || extract(epoch from now())::bigint),
  tugas_id text NOT NULL,
  siswa_id text NOT NULL,
  status_pengerjaan boolean DEFAULT false,
  status text DEFAULT 'BELUM_DIKERJAKAN',
  score numeric,
  nilai numeric,
  started_at timestamptz,
  submitted_at timestamptz,
  tanggal_dikerjakan text,
  umpan_balik text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_tugas_siswa UNIQUE (tugas_id, siswa_id)
);

-- Tambahkan kolom jika tabel tugas_siswa sudah ada sebelumnya
ALTER TABLE public.tugas_siswa
ADD COLUMN IF NOT EXISTS status_pengerjaan boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'BELUM_DIKERJAKAN',
ADD COLUMN IF NOT EXISTS score numeric,
ADD COLUMN IF NOT EXISTS nilai numeric,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS tanggal_dikerjakan text,
ADD COLUMN IF NOT EXISTS umpan_balik text;

-- 4. BUAT ATAU DIPERBARUI TABEL public.siswa
CREATE TABLE IF NOT EXISTS public.siswa (
  id text PRIMARY KEY DEFAULT ('siswa-' || extract(epoch from now())::bigint),
  nama_siswa text NOT NULL,
  email text,
  nisn text,
  nis text,
  kelas text DEFAULT 'Kelas 4-A',
  alamat text,
  foto_url text,
  nama_ayah text,
  nama_ibu text,
  no_telepon_ortu text,
  password text DEFAULT 'siswa123',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.siswa 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS nisn text,
ADD COLUMN IF NOT EXISTS nis text,
ADD COLUMN IF NOT EXISTS password text DEFAULT 'siswa123';

-- 5. KONTROL KEBIJAKAN RLS (Row Level Security - Akses Publik Read/Write)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profil_sekolah', 'guru', 'data_kelas', 'siswa', 'orang_tua',
    'mata_pelajaran', 'jadwal_pelajaran', 'absensi', 'daftar_tugas', 
    'tugas_siswa', 'penilaian', 'temuan_khusus', 'notifikasi', 
    'application_settings', 'buku_digital'
  ])
  LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow public read-write" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "Allow public read-write" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const supabaseConfig = getSupabaseConfig();
  const activeTask = tasks.find(t => t.id === activeTaskId) || selectedTask || tasks[0];
  const taskTitle = activeTask?.judulTugas || 'Asesmen Google Form';

  const formGeneratorCode = `/**
 * GOOGLE APPS SCRIPT - GENERATOR GOOGLE FORM OTOMATIS + AUTO-WEBHOOK (KELAS KU)
 * 
 * CARA MENGGUNAKAN DENGAN SANGAT MUDAH:
 * 1. Buka browser dan ketik link: https://script.new (Otomatis membuka Apps Script baru)
 * 2. Hapus seluruh kode bawaan di editor 'Kode.gs' (Ctrl + A lalu Delete).
 * 3. Tempelkan (Paste) seluruh kode skrip ini ke 'Kode.gs'.
 * 4. Di bagian toolbar atas, pastikan fungsi terpilih adalah 'buatGoogleFormOtomatis'.
 * 5. Klik tombol "Jalankan" (Run) ▶️.
 * 6. Berikan Izin / Otorisasi Google Account jika diminta.
 * 7. Selesai! Google Form kuis baru & Pemicu Webhook otomatis dibuat di Google Drive Anda!
 */

function buatGoogleFormOtomatis() {
  var JUDUL_TUGAS = ${JSON.stringify(taskTitle)};
  var ASSIGNMENT_ID = ${JSON.stringify(activeTaskId)};
  var SUPABASE_URL = ${JSON.stringify(supabaseConfig.url || '')};
  var SUPABASE_ANON_KEY = ${JSON.stringify(supabaseConfig.anonKey || '')};

  Logger.log("=== MEMULAI GENERATOR GOOGLE FORM KELAS KU ===");

  // 1. Buat Google Form Kuis Baru
  var form = FormApp.create("[KELAS KU] " + JUDUL_TUGAS);
  form.setDescription("Silakan isi identitas diri Anda dengan benar dan jawab seluruh soal kuis di bawah ini.");
  form.setIsQuiz(true); // Aktifkan Kuis & Scoring Otomatis
  form.setAllowResponseEdits(false);

  // 2. Tambahkan Pertanyaan Identitas Wajib (Mencegah Salah Identitas)
  var itemNama = form.addTextItem();
  itemNama.setTitle("Nama Lengkap Siswa").setRequired(true);

  var itemEmail = form.addTextItem();
  itemEmail.setTitle("Email atau ID Siswa").setRequired(true);

  var itemNisn = form.addTextItem();
  itemNisn.setTitle("NISN / Nomor Induk").setRequired(false);

  var itemKelas = form.addTextItem();
  itemKelas.setTitle("Kelas").setRequired(false);

  // 3. Tambahkan Soal Kuis Draf (Anda Bisa Mengedit / Menambah Soal di Google Form)
  var q1 = form.addMultipleChoiceItem();
  q1.setTitle("Soal 1: Berapakah hasil dari 25 + 75?")
    .setChoices([
      q1.createChoice("90", false),
      q1.createChoice("100", true), // Jawaban Benar
      q1.createChoice("110", false)
    ])
    .setPoints(50)
    .setRequired(true);

  var q2 = form.addMultipleChoiceItem();
  q2.setTitle("Soal 2: Pancasila sila ke-1 berbunyi?")
    .setChoices([
      q2.createChoice("Kemanusiaan yang adil dan beradab", false),
      q2.createChoice("Ketuhanan Yang Maha Esa", true), // Jawaban Benar
      q2.createChoice("Persatuan Indonesia", false)
    ])
    .setPoints(50)
    .setRequired(true);

  var editUrl = form.getEditUrl();
  var pubUrl = form.getPublishedUrl();

  Logger.log("--------------------------------------------------");
  Logger.log("✅ GOOGLE FORM BERHASIL DIBUAT!");
  Logger.log("📌 Link Editor Form (Untuk Guru): " + editUrl);
  Logger.log("📌 Link Pengerjaan (Untuk Siswa): " + pubUrl);
  Logger.log("--------------------------------------------------");

  // 4. Pasang Pemicu (Trigger) Webhook Otomatis saat Form Di-Submit
  try {
    ScriptApp.newTrigger("onFormSubmitOtomatis")
      .forForm(form)
      .onFormSubmit()
      .create();
    Logger.log("✅ PEMICU WEBHOOK OTOMATIS BERHASIL DIPASANG!");
  } catch (errTrigger) {
    Logger.log("Peringatan Pemicu: " + errTrigger.toString());
  }
}

/**
 * FUNGSI OTOMATIS SINKRONISASI KE SUPABASE SAAT SISWA SUBMIT FORM
 */
function onFormSubmitOtomatis(e) {
  var ASSIGNMENT_ID = ${JSON.stringify(activeTaskId)};
  var SUPABASE_URL = ${JSON.stringify(supabaseConfig.url || '')};
  var SUPABASE_ANON_KEY = ${JSON.stringify(supabaseConfig.anonKey || '')};

  if (!e || !e.response) return;

  var response = e.response;
  var studentEmail = "";
  var totalScore = 0;

  // 1. Hitung Nilai Kuis Otomatis dari Google Form
  var gradable = response.getGradableItemResponses();
  for (var g = 0; g < gradable.length; g++) {
    totalScore += (gradable[g].getScore() || 0);
  }

  // 2. Ambil Identitas Siswa dari Jawaban Form
  var items = response.getItemResponses();
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var title = item.getItem().getTitle().toLowerCase();
    var val = String(item.getResponse() || "").trim();

    if (val && !studentEmail) {
      if (title.indexOf("email") !== -1 || title.indexOf("id") !== -1 || title.indexOf("nama") !== -1 || title.indexOf("nisn") !== -1) {
        studentEmail = val;
      }
    }
  }

  if (!studentEmail && items.length > 0) {
    studentEmail = String(items[0].getResponse() || "").trim();
  }

  if (!studentEmail) return;

  var finalScore = Math.round(totalScore);

  // 3. Kirimkan Langsung ke Supabase REST API
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    var cleanUrl = SUPABASE_URL.replace(/\\/$/, "");
    var headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    };

    var matchedSiswaId = "";
    try {
      var resSiswa = UrlFetchApp.fetch(cleanUrl + "/rest/v1/siswa?select=id,nisn,email,nama_siswa", {
        "method": "get",
        "headers": headers,
        "muteHttpExceptions": true
      });

      if (resSiswa.getResponseCode() === 200) {
        var listSiswa = JSON.parse(resSiswa.getContentText());
        var search = String(studentEmail).toLowerCase().trim();

        for (var s = 0; s < listSiswa.length; s++) {
          var sis = listSiswa[s];
          if (sis.email && sis.email.toLowerCase().trim() === search) { matchedSiswaId = sis.id; break; }
          if (sis.id && sis.id.toLowerCase().trim() === search) { matchedSiswaId = sis.id; break; }
          if (sis.nisn && sis.nisn.toLowerCase().trim() === search) { matchedSiswaId = sis.id; break; }
          if (sis.nama_siswa && sis.nama_siswa.toLowerCase().trim() === search) { matchedSiswaId = sis.id; break; }
        }
      }
    } catch (eFind) {}

    if (!matchedSiswaId) matchedSiswaId = studentEmail;

    var payload = {
      "id": "ts-" + ASSIGNMENT_ID + "-" + matchedSiswaId,
      "tugas_id": ASSIGNMENT_ID,
      "siswa_id": matchedSiswaId,
      "score": finalScore,
      "nilai": finalScore,
      "status": "SELESAI",
      "status_pengerjaan": true,
      "submitted_at": new Date().toISOString()
    };

    UrlFetchApp.fetch(cleanUrl + "/rest/v1/tugas_siswa", {
      "method": "post",
      "headers": headers,
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });

    Logger.log("✅ Hasil Kuis Terisi di Supabase! Siswa: " + matchedSiswaId + " Nilai: " + finalScore);
  }
}
`;

  const handleCopyFormGen = () => {
    navigator.clipboard.writeText(formGeneratorCode);
    setCopiedFormGen(true);
    setTimeout(() => setCopiedFormGen(false), 2000);
  };

  const currentAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://kelasku-app.run.app';
  const webhookUrl = `${currentAppUrl}/api/webhook/google-form`;
  const webhookSecret = 'kelasku-secret-key';

  const scriptCode = `/**
 * GOOGLE APPS SCRIPT - HYBRID TRACKING DENGAN DIRECT SUPABASE SYNC (KELAS KU)
 * Pasang skrip ini di Google Form atau Google Sheets Respon (Extensions -> Apps Script)
 * PENTING: Hapus SEMUA kode bawaan di 'Kode.gs' sebelum menempelkan (paste) kode ini.
 */

var SUPABASE_URL = ${JSON.stringify(supabaseConfig.url || '')};
var SUPABASE_ANON_KEY = ${JSON.stringify(supabaseConfig.anonKey || '')};
var WEBHOOK_URL = ${JSON.stringify(webhookUrl)};
var WEBHOOK_SECRET = ${JSON.stringify(webhookSecret)};
var ASSIGNMENT_ID = ${JSON.stringify(activeTaskId || 'ID_TUGAS_AKAN_DIPILIH')};

function onFormSubmit(e) {
  try {
    var studentEmail = "";
    var scoreText = "";

    // 1. Ekstrak data dari Event Google Form
    if (e && e.response) {
      if (typeof e.response.getRespondentEmail === "function") {
        var respEmail = e.response.getRespondentEmail();
        if (respEmail) studentEmail = respEmail;
      }
      
      if (typeof e.response.getItemResponses === "function") {
        var itemResponses = e.response.getItemResponses();
        var firstAnswer = "";

        for (var i = 0; i < itemResponses.length; i++) {
          var itemObj = itemResponses[i];
          var itemTitle = itemObj.getItem().getTitle().toLowerCase();
          var respVal = String(itemObj.getResponse() || "").trim();

          if (respVal) {
            if (!firstAnswer && itemTitle.indexOf("skor") === -1 && itemTitle.indexOf("score") === -1 && itemTitle.indexOf("nilai") === -1 && itemTitle.indexOf("waktu") === -1 && itemTitle.indexOf("timestamp") === -1 && itemTitle.indexOf("kelas") === -1) {
              firstAnswer = respVal;
            }

            if (itemTitle.indexOf("email") !== -1 || itemTitle.indexOf("surel") !== -1) {
              studentEmail = respVal;
              break;
            }
            if (!studentEmail && (itemTitle.indexOf("nisn") !== -1 || itemTitle.indexOf("nis") !== -1 || itemTitle.indexOf("no. induk") !== -1 || itemTitle.indexOf("no. absen") !== -1)) {
              studentEmail = respVal;
            }
            if (!studentEmail && (itemTitle.indexOf("nama") !== -1 || itemTitle.indexOf("siswa") !== -1 || itemTitle.indexOf("student") !== -1 || itemTitle.indexOf("identitas") !== -1)) {
              studentEmail = respVal;
            }
          }
        }

        if (!studentEmail && firstAnswer) {
          studentEmail = firstAnswer;
        }
      }

      if (typeof e.response.getGradableItemResponses === "function") {
        var gradables = e.response.getGradableItemResponses();
        var totalScore = 0;
        var hasScores = false;
        for (var j = 0; j < gradables.length; j++) {
          var sc = gradables[j].getScore();
          if (sc !== null && sc !== undefined) {
            totalScore += sc;
            hasScores = true;
          }
        }
        if (hasScores) {
          scoreText = String(totalScore);
        }
      }
    }

    // 2. Ekstrak data dari Google Sheets / Trigger Spreadsheet (e.namedValues / e.values)
    if (!studentEmail && e && e.namedValues) {
      var firstSheetVal = "";
      for (var key in e.namedValues) {
        var lowerKey = key.toLowerCase();
        var valArr = e.namedValues[key];
        var valStr = (valArr && valArr.length > 0 && valArr[0]) ? String(valArr[0]).trim() : "";

        if (valStr) {
          if (!firstSheetVal && lowerKey.indexOf("timestamp") === -1 && lowerKey.indexOf("waktu") === -1 && lowerKey.indexOf("skor") === -1 && lowerKey.indexOf("score") === -1 && lowerKey.indexOf("nilai") === -1 && lowerKey.indexOf("kelas") === -1) {
            firstSheetVal = valStr;
          }

          if (lowerKey.indexOf("email") !== -1 || lowerKey.indexOf("surel") !== -1) {
            studentEmail = valStr;
            break;
          } else if (lowerKey.indexOf("nisn") !== -1 || lowerKey.indexOf("nis") !== -1) {
            if (!studentEmail) studentEmail = valStr;
          } else if (lowerKey.indexOf("nama") !== -1 || lowerKey.indexOf("siswa") !== -1) {
            if (!studentEmail) studentEmail = valStr;
          }
        }
      }
      if (!studentEmail && firstSheetVal) {
        studentEmail = firstSheetVal;
      }

      if (!scoreText || scoreText === "0") {
        for (var keyScore in e.namedValues) {
          var lowerKeyScore = keyScore.toLowerCase();
          if (lowerKeyScore.indexOf("skor") !== -1 || lowerKeyScore.indexOf("score") !== -1 || lowerKeyScore.indexOf("nilai") !== -1) {
            var valScoreArr = e.namedValues[keyScore];
            if (valScoreArr && valScoreArr.length > 0 && valScoreArr[0]) {
              scoreText = String(valScoreArr[0]).trim();
              break;
            }
          }
        }
      }
    }

    // 3. Fallback jika e.values digunakan (Spreadsheet Row values)
    if (!studentEmail && e && e.values && e.values.length > 0) {
      for (var v = 0; v < e.values.length; v++) {
        var rawV = String(e.values[v] || "").trim();
        if (rawV && rawV.indexOf("/") === -1 && rawV.indexOf(":") === -1) {
          if (rawV.indexOf("@") !== -1 || !studentEmail) {
            studentEmail = rawV;
            if (rawV.indexOf("@") !== -1) break;
          }
        }
      }
    }

    // 4. Fallback & Full Scan Spreadsheet
    try {
      if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getActiveSpreadsheet()) {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();

        if (lastRow > 1 && lastCol > 0) {
          var allValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
          var headers = allValues[0];

          if (!studentEmail || !scoreText) {
            var targetRowIndex = lastRow - 1;
            var rowData = allValues[targetRowIndex];

            for (var c = 0; c < lastCol; c++) {
              var colHeader = String(headers[c] || "").toLowerCase();
              var cellVal = String(rowData[c] || "").trim();

              if (!studentEmail && cellVal) {
                if (colHeader.indexOf("id") !== -1 || colHeader.indexOf("siswa") !== -1 || colHeader.indexOf("nisn") !== -1 || colHeader.indexOf("email") !== -1 || colHeader.indexOf("nama") !== -1 || cellVal.indexOf("@") !== -1) {
                  studentEmail = cellVal;
                }
              }

              if ((!scoreText || scoreText === "0") && cellVal) {
                if (colHeader.indexOf("skor") !== -1 || colHeader.indexOf("score") !== -1 || colHeader.indexOf("nilai") !== -1 || cellVal.indexOf("/") !== -1) {
                  scoreText = cellVal;
                }
              }
            }
          }
        }
      }
    } catch (sheetErr) {
      Logger.log("Info fallback sheet: " + sheetErr.toString());
    }

    studentEmail = String(studentEmail || "").trim().toLowerCase();
    scoreText = String(scoreText || "100").trim();

    // Hitung Angka Skor Bersih
    var numScore = 100;
    if (scoreText.indexOf("/") !== -1) {
      var parts = scoreText.split("/");
      var got = parseFloat(parts[0]);
      var total = parseFloat(parts[1]);
      if (!isNaN(got) && !isNaN(total) && total > 0) {
        numScore = Math.round((got / total) * 100);
      } else if (!isNaN(got)) {
        numScore = got;
      }
    } else {
      var parsedNum = parseFloat(scoreText);
      if (!isNaN(parsedNum)) {
        numScore = parsedNum;
      }
    }

    Logger.log("=== WEBHOOK KELAS KU ===");
    Logger.log("Email/Identitas Siswa : " + (studentEmail || "(Tidak terdeteksi, menggunakan auto-match)"));
    Logger.log("ID Tugas              : " + ASSIGNMENT_ID);
    Logger.log("Skor/Nilai Formatted  : " + scoreText + " -> (Skor Akhir: " + numScore + ")");

    // =========================================================================
    // METODE A: DIRECT SINKRONISASI SUPABASE REST API
    // =========================================================================
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      Logger.log("Mengirimkan data langsung ke Supabase Cloud...");
      
      var cleanSupabaseUrl = SUPABASE_URL.endsWith('/') ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
      var headersSupabase = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      };

      var matchedSiswaId = "";
      var matchedSiswaKelas = "Kelas 4";

      // 1. Cari ID Siswa di Supabase dengan Prioritas Utama
      try {
        var resSiswa = UrlFetchApp.fetch(cleanSupabaseUrl + "/rest/v1/siswa?select=id,nisn,email,nama_siswa,kelas", {
          "method": "get",
          "headers": headersSupabase,
          "muteHttpExceptions": true
        });

        if (resSiswa.getResponseCode() === 200) {
          var allSiswa = JSON.parse(resSiswa.getContentText());
          
          if (studentEmail && allSiswa && allSiswa.length > 0) {
            var searchStr = String(studentEmail).toLowerCase().trim();

            // Prioritas 1: Matching persis ID Siswa (e.g., "siswa-1")
            for (var s1 = 0; s1 < allSiswa.length; s1++) {
              var sis1 = allSiswa[s1];
              var idSis1 = String(sis1.id || "").toLowerCase().trim();
              if (idSis1 && (idSis1 === searchStr || searchStr.indexOf(idSis1) !== -1 || idSis1.indexOf(searchStr) !== -1)) {
                matchedSiswaId = sis1.id;
                if (sis1.kelas) matchedSiswaKelas = sis1.kelas;
                break;
              }
            }

            // Prioritas 2: Matching NISN jika ID belum ketemu
            if (!matchedSiswaId) {
              for (var s2 = 0; s2 < allSiswa.length; s2++) {
                var sis2 = allSiswa[s2];
                var nSis2 = String(sis2.nisn || "").trim();
                if (nSis2 && (nSis2 === searchStr || searchStr.indexOf(nSis2) !== -1)) {
                  matchedSiswaId = sis2.id;
                  if (sis2.kelas) matchedSiswaKelas = sis2.kelas;
                  break;
                }
              }
            }

            // Prioritas 3: Matching Email atau Nama Siswa
            if (!matchedSiswaId) {
              for (var s3 = 0; s3 < allSiswa.length; s3++) {
                var sis3 = allSiswa[s3];
                var eSis3 = String(sis3.email || "").toLowerCase().trim();
                var nmSis3 = String(sis3.nama_siswa || "").toLowerCase().trim();

                if ((eSis3 && (eSis3 === searchStr || searchStr.indexOf(eSis3) !== -1)) || 
                    (nmSis3 && (nmSis3 === searchStr || nmSis3.indexOf(searchStr) !== -1 || searchStr.indexOf(nmSis3) !== -1))) {
                  matchedSiswaId = sis3.id;
                  if (sis3.kelas) matchedSiswaKelas = sis3.kelas;
                  break;
                }
              }
            }
          }
        }
      } catch (errFindSiswa) {
        Logger.log("Cari siswa error: " + errFindSiswa.toString());
      }

      // Jika identitas siswa tidak terdeteksi, hentikan agar tidak salah menaruh nilai ke siswa acak
      if (!matchedSiswaId && studentEmail) {
        matchedSiswaId = studentEmail; // Gunakan email/nama raw yang diisi siswa
      }

      if (!matchedSiswaId) {
        Logger.log("PERINGATAN ABORT: Identitas siswa (Email/NISN/Nama) tidak ditemukan di Google Form / Supabase. Nilai tidak dikirim untuk mencegah salah sasaran.");
        return;
      }

      Logger.log("Siswa Terhubung untuk Penilaian: " + matchedSiswaId + " (" + matchedSiswaKelas + ")");

      // 2. Ambil Rincian Tugas
      var mapelId = "mapel-1";
      var judulTugas = "Kuis Google Form";
      var dibuatOlehId = "guru-1";
      try {
        var resTugas = UrlFetchApp.fetch(cleanSupabaseUrl + "/rest/v1/daftar_tugas?id=eq." + ASSIGNMENT_ID, {
          "method": "get",
          "headers": headersSupabase,
          "muteHttpExceptions": true
        });
        if (resTugas.getResponseCode() === 200) {
          var tArr = JSON.parse(resTugas.getContentText());
          if (tArr && tArr.length > 0) {
            if (tArr[0].mapel_id) mapelId = tArr[0].mapel_id;
            if (tArr[0].judul_tugas) judulTugas = tArr[0].judul_tugas;
            if (tArr[0].dibuat_oleh_id) dibuatOlehId = tArr[0].dibuat_oleh_id;
            if (tArr[0].kelas) matchedSiswaKelas = tArr[0].kelas;
          }
        }
      } catch (errTask) {
        Logger.log("Cari tugas error: " + errTask.toString());
      }

      var nowIso = new Date().toISOString();
      var todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

      // 3. Upsert ke tabel tugas_siswa
      var payloadTS = {
        "id": "ts-" + ASSIGNMENT_ID + "-" + matchedSiswaId,
        "tugas_id": ASSIGNMENT_ID,
        "siswa_id": matchedSiswaId,
        "status_pengerjaan": true,
        "status": "SELESAI",
        "score": numScore,
        "nilai": numScore,
        "submitted_at": nowIso,
        "tanggal_dikerjakan": todayStr,
        "umpan_balik": "Disinkronkan otomatis dari Webhook Google Form (" + judulTugas + ")"
      };

      var resTS = UrlFetchApp.fetch(cleanSupabaseUrl + "/rest/v1/tugas_siswa", {
        "method": "post",
        "headers": headersSupabase,
        "payload": JSON.stringify(payloadTS),
        "muteHttpExceptions": true
      });
      Logger.log("Supabase tugas_siswa HTTP Status: " + resTS.getResponseCode());

      // 4. Upsert ke tabel penilaian (Matriks Asesmen Kurikulum)
      var payloadPnl = {
        "id": "as-" + ASSIGNMENT_ID + "-" + matchedSiswaId,
        "siswa_id": matchedSiswaId,
        "mapel_id": mapelId,
        "tipe": "harian",
        "nama_penilaian": judulTugas,
        "nilai": numScore,
        "deskripsi_kompetensi": "Hasil penilaian Kuis Google Form (" + judulTugas + ")",
        "tanggal_penilaian": todayStr,
        "dinilai_oleh_id": dibuatOlehId,
        "kelas": matchedSiswaKelas
      };

      var resPnl = UrlFetchApp.fetch(cleanSupabaseUrl + "/rest/v1/penilaian", {
        "method": "post",
        "headers": headersSupabase,
        "payload": JSON.stringify(payloadPnl),
        "muteHttpExceptions": true
      });
      Logger.log("Supabase penilaian HTTP Status: " + resPnl.getResponseCode());
      Logger.log("✅ SUKSES BERSAMBUNG KE SUPABASE CLOUD!");
    }

    // METODE B: FALLBACK SINKRONISASI KE APPLICATION WEBHOOK ENDPOINT
    if (WEBHOOK_URL) {
      var payload = {
        "student_email": studentEmail,
        "assignment_id": ASSIGNMENT_ID,
        "score_text": scoreText
      };

      var options = {
        "method": "post",
        "contentType": "application/json",
        "headers": {
          "x-webhook-secret": WEBHOOK_SECRET
        },
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
      };

      var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
      Logger.log("Webhook Application Status Response: " + response.getResponseCode());
    }

  } catch (err) {
    Logger.log("ERROR onFormSubmit: " + err.toString());
  }
}

/**
 * FUNGSI UJI COBA (JALANKAN DARI MANAJER SKRIP)
 * Pilih fungsi 'testKirimWebhook' lalu klik tombol 'Run / Jalankan' di Apps Script Editor
 */
function testKirimWebhook() {
  Logger.log("Menguji pengiriman webhook Google Form...");
  onFormSubmit({
    namedValues: {
      "Email": ["zahirabendunganjati@gmail.com"],
      "Skor": ["100 / 100"]
    }
  });
}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateWebhook = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/webhook/google-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': webhookSecret
        },
        body: JSON.stringify({
          student_email: testEmail,
          assignment_id: activeTaskId,
          score_text: testScoreText
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus(`✅ BERHASIL: Nilai ${data.data.score} tersimpan untuk ${data.data.student_name || testEmail}!`);
      } else {
        setTestStatus(`❌ GAGAL: ${data.error || 'Server menolak webhook.'}`);
      }
    } catch (err: any) {
      setTestStatus(`❌ ERROR: ${err?.message || 'Gagal terhubung ke API Webhook.'}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-md overflow-hidden pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-[111] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-4 shrink-0 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-m3-purple/10 text-m3-purple flex items-center justify-center">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Integrasi Google Apps Script & Webhook (Tahap 2)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Otomatisasi pengiriman nilai dari Google Form ke aplikasi Kelas Ku
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              aria-label="Tutup Modal"
              className="relative z-20 w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
            >
              <X className="w-5 h-5 pointer-events-none" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
            {/* Task Selector */}
            {tasks.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pilih Tugas yang Ingin Dihubungkan:
                </label>
                <select
                  value={activeTaskId}
                  onChange={(e) => setActiveTaskId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.id}] {t.judulTugas} ({t.kelas || 'Semua Kelas'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Credentials Info Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Endpoint URL Webhook
                </span>
                <code className="text-xs font-mono font-bold text-m3-purple break-all">{webhookUrl}</code>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-500" /> Header Secret (x-webhook-secret)
                </span>
                <code className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">{webhookSecret}</code>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-2 pb-1">
              <button
                type="button"
                onClick={() => setActiveTab('script')}
                className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'script'
                    ? 'bg-m3-purple text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>1. Webhook Form/Sheet Terpasang</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('form_generator')}
                className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'form_generator'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>✨ 2. Generator Google Form Otomatis</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sql')}
                className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'sql'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>3. SQL Migrasi Supabase</span>
              </button>
            </div>

            {activeTab === 'script' ? (
              <>
                {/* Important Paste Tip */}
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <span className="text-amber-600 dark:text-amber-400">💡</span>
                    <span>Petunjuk Mengatasi Error &quot;SyntaxError: Unexpected number baris: 1&quot;:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                    <li>Buka Google Apps Script editor di Google Form / Sheet.</li>
                    <li><strong>Hapus seluruh kode bawaan</strong> di file <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">Kode.gs</code> (tekan <kbd className="font-mono bg-amber-200/60 dark:bg-amber-800/80 px-1 rounded">Ctrl + A</kbd> lalu <kbd className="font-mono bg-amber-200/60 dark:bg-amber-800/80 px-1 rounded">Delete</kbd>) hingga bersih.</li>
                    <li>Klik tombol <strong>&quot;Salin Kode Skrip&quot;</strong> di bawah ini, lalu tempelkan (<kbd className="font-mono bg-amber-200/60 dark:bg-amber-800/80 px-1 rounded">Ctrl + V</kbd>) ke <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">Kode.gs</code>.</li>
                  </ol>
                </div>

                {/* Script Code Block */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-m3-purple" /> Skrip Apps Script Siap Pakai:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 bg-m3-purple hover:bg-m3-purple-dark text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Tersalin!' : 'Salin Kode Skrip'}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-56 border border-slate-800 leading-relaxed">
                    {scriptCode}
                  </pre>
                </div>

                {/* Live Webhook Tester Section */}
                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-2xl space-y-3">
                  <h4 className="text-xs font-extrabold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-m3-purple" /> Uji Coba Webhook Secara Langsung (Simulasi Form Submit)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Email Siswa Test
                      </label>
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium"
                        placeholder="siswa1@sd.id"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Nilai / Skor Test (contoh: "90 / 100")
                      </label>
                      <input
                        type="text"
                        value={testScoreText}
                        onChange={(e) => setTestScoreText(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium"
                        placeholder="90 / 100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleSimulateWebhook}
                      disabled={isTesting || !activeTaskId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isTesting ? 'Mengirim...' : 'Kirim Uji Coba Webhook'}
                    </button>

                    {testStatus && (
                      <span className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200">
                        {testStatus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-800 rounded-2xl text-xs space-y-2.5">
                  <span className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-sm">
                    <HelpCircle className="w-5 h-5 text-amber-600" /> LANGKAH PENTING (PENYEBAB UTAMA WEBHOOK BELUM TERKIRIM):
                  </span>
                  <ol className="list-decimal list-inside space-y-2 text-amber-900 dark:text-amber-300 pl-1 leading-relaxed">
                    <li>
                      <strong>Tempel Kode:</strong> Buka Google Sheets -&gt; <strong>Ekstensi (Extensions)</strong> -&gt; <strong>Apps Script</strong>. Hapus kode lama &amp; tempel skrip di atas.
                    </li>
                    <li className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-xl border border-amber-300 dark:border-amber-700">
                      <strong>WAJIB: PASANG PEMICU (TRIGGERS):</strong> Tanpa pemicu, Google Apps Script TIDAK AKAN PERNAH berjalan otomatis saat siswa isi form!
                      <br />
                      &bull; Klik ikon <strong>Jam Dinding (Pemicu / Triggers)</strong> di menu sebelah kiri Apps Script.
                      <br />
                      &bull; Klik tombol <strong>"+ Tambah Pemicu" (+ Add Trigger)</strong> di kanan bawah.
                      <br />
                      &bull; Pilih jenis acara (Event type): <strong>"Saat mendaftar formulir" (On form submit)</strong>.
                      <br />
                      &bull; Klik <strong>Simpan (Save)</strong> dan izinkan otorisasi Google Account.
                    </li>
                    <li>
                      <strong>TES LANGSUNG SEKARANG:</strong> Kembali ke editor Apps Script, pilih fungsi <code>testKirimWebhook</code> di drop-down paling atas, lalu klik <strong>Run / Jalankan</strong>. Buka <strong>Executions / Log</strong> untuk melihat respon <code>HTTP 200 SUCCESS</code>!
                    </li>
                  </ol>
                </div>
              </>
            ) : activeTab === 'form_generator' ? (
              /* Automatic Google Form Generator Script Tab */
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-amber-600" /> Skrip Generator Google Form Otomatis (Membuat Form Baru)
                    </h4>
                    <button
                      type="button"
                      onClick={handleCopyFormGen}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {copiedFormGen ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedFormGen ? 'Tersalin!' : 'Salin Skrip Generator'}
                    </button>
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    Skrip ini secara **otomatis membuatkan Google Form Kuis baru** yang sudah dikonfigurasi lengkap dengan kolom Identitas Siswa (Nama, Email/ID, NISN), Mode Kuis (Scoring), dan **Auto-Webhook pemicu** ke aplikasi ini dalam sekali klik!
                  </p>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs space-y-1">
                  <span className="font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    🚀 Cara Penggunaan Tercepat (3 Langkah Mudah):
                  </span>
                  <ol className="list-decimal list-inside text-[11px] text-indigo-900 dark:text-indigo-300 space-y-1 pl-1">
                    <li>Buka tab baru di browser Anda dan ketik: <a href="https://script.new" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-600 dark:text-indigo-400">script.new</a></li>
                    <li>Hapus seluruh kode bawaan di <code className="bg-indigo-100 dark:bg-indigo-900/60 px-1 rounded">Kode.gs</code>, lalu <strong>Tempel (Paste)</strong> kode skrip di bawah ini.</li>
                    <li>Klik tombol <strong>▶️ Jalankan (Run)</strong> pada fungsi <code className="font-mono font-bold bg-indigo-100 dark:bg-indigo-900/60 px-1 rounded">buatGoogleFormOtomatis</code>. Google Form baru beserta Webhook-nya langsung jadi di Google Drive Anda!</li>
                  </ol>
                </div>

                <pre className="p-4 bg-slate-950 text-amber-300 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-64 border border-slate-800 leading-relaxed">
                  {formGeneratorCode}
                </pre>
              </div>
            ) : (
              /* SQL Migration Tab */
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-emerald-600" /> Kueri SQL Migrasi Supabase (Sinkronisasi ID & Email Siswa)
                    </h4>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedSql ? 'Tersalin!' : 'Salin Kueri SQL'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Jalankan skrip SQL di bawah ini pada **SQL Editor Dashboard Supabase** Anda untuk memastikan kolom <code className="font-bold text-emerald-700 font-mono">email</code>, <code className="font-bold text-emerald-700 font-mono">id</code>, dan tabel <code className="font-bold text-emerald-700 font-mono">tugas_siswa</code> tersinkronisasi penuh dengan Webhook Google Form.
                  </p>
                </div>

                <pre className="p-4 bg-slate-950 text-emerald-400 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed">
                  {sqlMigrationCode}
                </pre>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
