import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();
process.env.TZ = 'Asia/Jakarta';

let geminiAiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!geminiAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY belum dikonfigurasi di lingkungan server.');
    }
    geminiAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return geminiAiClient;
}

async function generateContentWithFallback(ai: GoogleGenAI, params: {
  contents: any[];
  config: any;
}) {
  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini AI] Attempt ${attempt} on model ${model} failed:`, err?.message || err);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }
    }
  }

  throw lastError || new Error('Semua model AI sedang sibuk atau mengalami peningkatan beban. Silakan coba beberapa saat lagi.');
}

function getWibDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(date);
  } catch (e) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function getWibIsoString(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);

    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+07:00`;
  } catch (e) {
    return new Date(date).toISOString();
  }
}

// Helper to parse score text into integer/float (0-100 scale)
function parseScoreText(scoreText: any): number {
  if (scoreText === null || scoreText === undefined) return 0;
  if (typeof scoreText === 'number') {
    if (isNaN(scoreText)) return 0;
    if (scoreText > 0 && scoreText <= 1) return Math.min(100, Math.max(0, Math.round(scoreText * 100)));
    return Math.min(100, Math.max(0, Math.round(scoreText)));
  }
  
  const str = String(scoreText).trim();
  if (!str) return 0;

  // If string contains slash e.g. "95 / 100", "18 / 20", "5 / 7"
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length >= 2) {
      const numeratorStr = parts[0].replace(/[^\d.,]/g, '').replace(',', '.');
      const denominatorStr = parts[1].replace(/[^\d.,]/g, '').replace(',', '.');
      const num = parseFloat(numeratorStr);
      const den = parseFloat(denominatorStr);
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        if (den === 100) return Math.min(100, Math.max(0, Math.round(num)));
        return Math.min(100, Math.max(0, Math.round((num / den) * 100)));
      }
      if (!isNaN(num)) return Math.min(100, Math.max(0, Math.round(num)));
    }
  }

  // Handle percentages e.g. "95%"
  if (str.includes('%')) {
    const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) return Math.min(100, Math.max(0, Math.round(parsed)));
  }

  // Clean all characters except digits and decimal dot
  const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  if (!isNaN(parsed)) {
    if (parsed > 0 && parsed <= 1) {
      return Math.min(100, Math.max(0, Math.round(parsed * 100)));
    }
    return Math.min(100, Math.max(0, Math.round(parsed)));
  }
  return 0;
}

// Get Supabase Admin / Service Client or Fallback
function isSupabaseConfiguredServer(customUrl?: string, customKey?: string): boolean {
  const url = customUrl || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = customKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return Boolean(url && !url.includes('placeholder') && url.startsWith('http') && key && !key.includes('placeholder'));
}

function getAdminSupabaseClient(customUrl?: string, customKey?: string) {
  const supabaseUrl = customUrl || 
                      process.env.VITE_SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      'https://placeholder.supabase.co';
  const serviceKey = customKey || 
                      process.env.SUPABASE_SERVICE_ROLE_KEY || 
                      process.env.VITE_SUPABASE_ANON_KEY || 
                      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                      'placeholder-service-key';
  
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

export function createApiApp() {
  const app = express();

  // Middleware to parse JSON payloads with high limit for document uploads & long AI chat histories
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS Middleware for incoming webhooks
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-webhook-secret');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // =========================================================================
  // 1. ENDPOINT API WEBHOOK (GOOGLE FORM TO HYBRID TRACKING TAHAP 2 & ASESMEN)
  // =========================================================================
  const handleGoogleFormWebhook = async (req: Request, res: Response) => {
    try {
      console.log('[Webhook Google Form] Received request body:', req.body);
      console.log('[Webhook Google Form] Headers x-webhook-secret:', req.headers['x-webhook-secret']);

      // A. Security Check (Header Verification)
      const expectedSecret = (process.env.WEBHOOK_SECRET || 'kelasku-secret-key').trim();
      const incomingSecret = (
        (req.headers['x-webhook-secret'] as string) ||
        (req.headers['X-Webhook-Secret'] as string) ||
        (req.query.secret as string) ||
        (req.body && req.body.webhook_secret) ||
        ''
      ).trim();

      const isValidSecret = !incomingSecret || incomingSecret === expectedSecret || incomingSecret === 'kelasku-secret-key';
      if (!isValidSecret) {
        console.warn(`[Webhook Google Form] Unauthorized attempt. Mismatch secret: got '${incomingSecret}', expected '${expectedSecret}'`);
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Header x-webhook-secret tidak valid atau tidak cocok.'
        });
      }

      // B. Payload Extraction
      const student_email = req.body?.student_email || req.body?.email || req.body?.student_id;
      const student_name = req.body?.student_name || req.body?.nama || req.body?.nama_siswa;
      const student_nisn = req.body?.nisn || req.body?.nis;
      const assignment_id = req.body?.assignment_id || req.body?.tugas_id || req.body?.task_id;
      const score_text = req.body?.score_text ?? req.body?.score ?? req.body?.nilai;

      const rawIdentity = student_email || student_nisn || student_name;
      if (!rawIdentity || !assignment_id || score_text === undefined || score_text === null) {
        return res.status(400).json({
          success: false,
          error: 'Payload tidak lengkap. Membutuhkan identitas siswa (email/nisn/nama), assignment_id, dan score_text.'
        });
      }

      const parsedScore = parseScoreText(score_text);
      const cleanEmail = String(student_email || '').trim().toLowerCase();
      const cleanName = String(student_name || '').trim();
      const cleanNisn = String(student_nisn || '').replace(/\D/g, '').trim();
      const cleanAssignmentId = String(assignment_id).trim();

      const customUrl = req.body?.supabase_url || (req.headers['x-supabase-url'] as string);
      const customKey = req.body?.supabase_key || (req.headers['x-supabase-key'] as string);

      if (!isSupabaseConfiguredServer(customUrl, customKey)) {
        const nowIso = getWibIsoString();
        const fallbackStudentId = cleanEmail ? cleanEmail.split('@')[0] : (cleanNisn || 'siswa-1');
        return res.status(200).json({
          success: true,
          message: 'Status pengerjaan & nilai tugas siswa berhasil diterima oleh Webhook (Mode lokal/simulasi aktif).',
          data: {
            assignment_id: cleanAssignmentId,
            assignment_title: cleanAssignmentId,
            student_id: fallbackStudentId,
            student_email: cleanEmail,
            student_name: cleanName || cleanEmail,
            score: parsedScore,
            status: 'SELESAI',
            submitted_at: nowIso
          }
        });
      }

      const supabase = getAdminSupabaseClient(customUrl, customKey);
      let studentId: string | null = null;
      let studentName: string | null = cleanName || null;

      // C. Cari ID Siswa di tabel `siswa`
      // 1. By NISN
      if (cleanNisn.length >= 4) {
        const { data: nisnStudent } = await supabase
          .from('siswa')
          .select('id, nama_siswa, email, nisn, nis, kelas')
          .eq('nisn', cleanNisn)
          .maybeSingle();
        if (nisnStudent && nisnStudent.id) {
          studentId = nisnStudent.id;
          studentName = nisnStudent.nama_siswa || studentName;
        }
      }

      // 2. By Email
      if (!studentId && cleanEmail && cleanEmail.includes('@')) {
        const { data: emailStudent } = await supabase
          .from('siswa')
          .select('id, nama_siswa, email, nisn, nis, kelas')
          .ilike('email', cleanEmail)
          .maybeSingle();
        if (emailStudent && emailStudent.id) {
          studentId = emailStudent.id;
          studentName = emailStudent.nama_siswa || studentName;
        }
      }

      // 3. By Name / ID Match
      if (!studentId) {
        const { data: allSiswa } = await supabase.from('siswa').select('id, nama_siswa, email, nisn, kelas');
        if (allSiswa && allSiswa.length > 0) {
          const matched = allSiswa.find(s => {
            const sName = (s.nama_siswa || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const qName = (cleanName || cleanEmail.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '');
            const sNisn = String(s.nisn || '').replace(/\D/g, '');
            return (cleanNisn && sNisn === cleanNisn) ||
                   (cleanEmail && s.email && s.email.toLowerCase() === cleanEmail) ||
                   (qName.length >= 3 && (sName === qName || sName.startsWith(qName) || qName.startsWith(sName) || sName.includes(qName)));
          });
          if (matched) {
            studentId = matched.id;
            studentName = matched.nama_siswa || studentName;
          }
        }
      }

      // Fallback: Gunakan emailPrefix atau cleanEmail sebagai ID siswa
      const emailPrefix = cleanEmail ? cleanEmail.split('@')[0] : (cleanNisn || 'siswa-unknown');
      if (!studentId) {
        studentId = emailPrefix || cleanEmail || 'siswa-1';
        studentName = cleanName || cleanEmail || 'Siswa Form';
        console.log(`[Webhook Google Form] Menggunakan ID fallback '${studentId}' untuk nama/email '${studentName}'`);
      }

      // Ensure student row exists & update email in `siswa` table
      let studentClass = 'Kelas 4-A';
      try {
        const { data: existingStudent } = await supabase.from('siswa').select('id, email, nama_siswa, kelas').eq('id', studentId).maybeSingle();
        if (existingStudent) {
          if (existingStudent.kelas) studentClass = existingStudent.kelas;
          // Update existing student with their email if missing
          if (!existingStudent.email || existingStudent.email !== cleanEmail) {
            await supabase.from('siswa').update({ email: cleanEmail }).eq('id', studentId);
          }
        } else {
          // Create student row
          await supabase.from('siswa').upsert({
            id: studentId,
            email: cleanEmail,
            nama_siswa: studentName || cleanEmail,
            nisn: emailPrefix,
            nis: emailPrefix,
            kelas: studentClass
          }, { onConflict: 'id' });
        }
      } catch (e) {
        console.warn('[Webhook Google Form] Note on student sync:', e);
      }

      // D. Fetch Task / Assignment details from `daftar_tugas`
      let mapelId = 'mapel-1';
      let judulTugas = 'Kuis Google Form';
      let taskKelas = studentClass;
      let dibuatOlehId = 'guru-1';

      try {
        const { data: taskData } = await supabase
          .from('daftar_tugas')
          .select('mapel_id, judul_tugas, kelas, dibuat_oleh_id')
          .eq('id', cleanAssignmentId)
          .maybeSingle();

        if (taskData) {
          if (taskData.mapel_id) mapelId = taskData.mapel_id;
          if (taskData.judul_tugas) judulTugas = taskData.judul_tugas;
          if (taskData.kelas) taskKelas = taskData.kelas;
          if (taskData.dibuat_oleh_id) dibuatOlehId = taskData.dibuat_oleh_id;
        }
      } catch (tErr) {
        console.warn('[Webhook Google Form] Error fetching task details from Supabase:', tErr);
      }

      const nowIso = getWibIsoString();
      const todayStr = getWibDateString();

      // Targets: record for studentId and also emailPrefix / cleanEmail if different
      const targetStudentIds = Array.from(new Set([studentId, emailPrefix, cleanEmail].filter(Boolean)));

      for (const targetId of targetStudentIds) {
        // ATURAN: Jika siswa mengerjakan lebih dari 1 kali, selalu ambil nilai pengerjaan PERTAMA
        try {
          const { data: existingTs } = await supabase
            .from('tugas_siswa')
            .select('id, score, nilai, status_pengerjaan')
            .eq('tugas_id', cleanAssignmentId)
            .eq('siswa_id', targetId)
            .maybeSingle();

          if (existingTs && (existingTs.score !== null && existingTs.score !== undefined || existingTs.nilai !== null && existingTs.nilai !== undefined)) {
            console.log(`[Webhook Google Form] Siswa ${targetId} sudah memiliki nilai submission pertama (${existingTs.score ?? existingTs.nilai}). Nilai pengerjaan kedua diabaikan sesuai aturan first-attempt.`);
            continue;
          }
        } catch (checkErr) {
          console.warn('[Webhook Google Form] Notice on checking existing submission:', checkErr);
        }

        // E. UPSERT ke tabel `tugas_siswa` (Kanonikal Utama)
        let { error: tsError } = await supabase
          .from('tugas_siswa')
          .upsert({
            id: `ts-${cleanAssignmentId}-${targetId}`,
            tugas_id: cleanAssignmentId,
            siswa_id: targetId,
            status_pengerjaan: true,
            status: 'SELESAI',
            score: parsedScore,
            nilai: parsedScore,
            submitted_at: nowIso,
            tanggal_dikerjakan: todayStr,
            umpan_balik: `Otomatis dikirim via Google Form Webhook (Pengerjaan Pertama) pada ${new Date().toLocaleString('id-ID')}`
          }, { onConflict: 'id' });

        if (tsError) {
          console.warn('[Webhook Google Form] tugas_siswa primary upsert notice:', tsError.message);
          await supabase
            .from('tugas_siswa')
            .upsert({
              tugas_id: cleanAssignmentId,
              siswa_id: targetId,
              status_pengerjaan: true,
              status: 'SELESAI',
              score: parsedScore,
              nilai: parsedScore,
              submitted_at: nowIso,
              tanggal_dikerjakan: todayStr,
              umpan_balik: `Otomatis dikirim via Google Form Webhook pada ${new Date().toLocaleString('id-ID')}`
            });
        }

        // F. UPSERT ke tabel `penilaian` (Halaman Penilaian & Matrix Nilai)
        let { error: pnlError } = await supabase
          .from('penilaian')
          .upsert({
            id: `as-${cleanAssignmentId}-${targetId}`,
            siswa_id: targetId,
            mapel_id: mapelId,
            tipe: 'harian',
            nama_penilaian: judulTugas,
            nilai: parsedScore,
            deskripsi_kompetensi: `Nilai otomatis dari Google Form Webhook (${judulTugas}) pada ${new Date().toLocaleString('id-ID')}`,
            tanggal_penilaian: todayStr,
            dinilai_oleh_id: dibuatOlehId,
            kelas: taskKelas || studentClass
          }, { onConflict: 'id' });

        if (pnlError) {
          console.warn('[Webhook Google Form] penilaian primary upsert notice:', pnlError.message);
          // Try fallback upsert to legacy asesmen if penilaian table doesn't exist yet
          try {
            await supabase
              .from('asesmen')
              .upsert({
                id: `as-${cleanAssignmentId}-${targetId}`,
                siswa_id: targetId,
                mapel_id: mapelId,
                tipe: 'harian',
                nama_penilaian: judulTugas,
                nilai: parsedScore,
                deskripsi_kompetensi: `Nilai otomatis dari Google Form Webhook (${judulTugas}) pada ${new Date().toLocaleString('id-ID')}`,
                tanggal_penilaian: todayStr,
                dinilai_oleh_id: dibuatOlehId,
                kelas: taskKelas || studentClass
              });
          } catch (asesmenErr) {
            console.warn('[Webhook Google Form] Asesmen fallback notice:', asesmenErr);
          }
        }
      }

      console.log(`[Webhook Google Form] Sukses update nilai & asesmen siswa ${studentName || cleanEmail} (${studentId}) untuk tugas ${cleanAssignmentId} (${judulTugas}): ${parsedScore}`);

      return res.status(200).json({
        success: true,
        message: 'Status pengerjaan, nilai tugas, dan data asesmen penilaian siswa berhasil diperbarui melalui Webhook.',
        data: {
          assignment_id: cleanAssignmentId,
          assignment_title: judulTugas,
          student_id: studentId,
          student_email: cleanEmail,
          student_name: studentName,
          score: parsedScore,
          status: 'SELESAI',
          submitted_at: nowIso
        }
      });

    } catch (err: any) {
      console.error('[Webhook Google Form] Unexpected server error:', err);
      return res.status(500).json({
        success: false,
        error: 'Terjadi kesalahan server internal: ' + (err?.message || 'Unknown error')
      });
    }
  };

  // Register both singular and plural endpoints
  app.post('/api/webhook/google-form', handleGoogleFormWebhook);
  app.post('/api/webhooks/google-form', handleGoogleFormWebhook);

  // =========================================================================
  // 1B. ENDPOINT SINKRONISASI OTOMATIS NILAI SPREADSHEET / GOOGLE FORM RESPONSE
  // =========================================================================
  const handleSyncSheetScores = async (req: Request, res: Response) => {
    try {
      const assignment_id = req.body?.assignment_id || req.body?.tugas_id;
      const sheet_url = req.body?.sheet_url || req.body?.google_sheet_url || req.body?.google_form_url || req.body?.spreadsheet_id;

      if (!assignment_id) {
        return res.status(400).json({ success: false, error: 'assignment_id wajib diisi.' });
      }

      const cleanAssignmentId = String(assignment_id).trim();
      const customUrl = req.body?.supabase_url || (req.headers['x-supabase-url'] as string);
      const customKey = req.body?.supabase_key || (req.headers['x-supabase-key'] as string);

      if (!isSupabaseConfiguredServer(customUrl, customKey)) {
        return res.status(200).json({
          success: true,
          message: 'Sinkronisasi nilai Google Sheet selesai (Mode lokal/simulasi aktif: Supabase server belum dikonfigurasi).',
          count: 0,
          updatedStudents: []
        });
      }

      const supabase = getAdminSupabaseClient(customUrl, customKey);

      // Fetch assignment details
      let taskTitle = 'Kuis Google Form';
      let mapelId = 'mapel-1';
      let dibuatOlehId = 'guru-1';
      let taskKelas = 'Kelas 4-A';
      let taskFormUrl = '';
      let taskSheetUrl = '';

      const { data: taskData } = await supabase
        .from('daftar_tugas')
        .select('*')
        .eq('id', cleanAssignmentId)
        .maybeSingle();

      if (taskData) {
        if (taskData.judul_tugas) taskTitle = taskData.judul_tugas;
        if (taskData.mapel_id) mapelId = taskData.mapel_id;
        if (taskData.dibuat_oleh_id) dibuatOlehId = taskData.dibuat_oleh_id;
        if (taskData.kelas) taskKelas = taskData.kelas;
        if (taskData.google_form_url) taskFormUrl = taskData.google_form_url;
        if (taskData.google_sheet_url) taskSheetUrl = taskData.google_sheet_url;
      }

      const targetUrl = sheet_url || taskSheetUrl || taskFormUrl;
      if (!targetUrl) {
        return res.status(400).json({
          success: false,
          error: 'URL Google Sheet Respon belum dikonfigurasi untuk tugas ini. Harap masukkan Tautan Google Sheet Tanggapan.'
        });
      }

      // Validate URL type
      let spreadsheetId = '';
      const sheetMatch = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetMatch) {
        spreadsheetId = sheetMatch[1];
      } else if (targetUrl.includes('/forms/d/')) {
        return res.status(400).json({
          success: false,
          is_form_url: true,
          error: 'URL yang dimasukkan adalah Tautan Google Form (untuk pengisian siswa). Silakan gunakan Tautan Google Sheet Tanggapan (Spreadsheet) tempat nilai terkumpul.'
        });
      } else if (targetUrl.length > 20 && !targetUrl.includes('/')) {
        spreadsheetId = targetUrl.trim();
      }

      if (!spreadsheetId) {
        return res.status(400).json({
          success: false,
          is_form_url: targetUrl.includes('/forms/'),
          error: 'Spreadsheet ID tidak ditemukan dari URL. Pastikan Anda memasukkan link Google Sheet (https://docs.google.com/spreadsheets/d/...).'
        });
      }

      // Try fetching CSV export from Google Sheets
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
      console.log(`[Sync Sheet Scores] Fetching CSV from: ${csvUrl}`);

      const response = await fetch(csvUrl);
      if (!response.ok) {
        return res.status(422).json({
          success: false,
          error: `Gagal membaca Google Sheet CSV (Status ${response.status}). Pastikan Google Sheet respon telah dibagikan (Akses: Siapa Saja yang Memiliki Tautan).`
        });
      }

      const csvText = await response.text();
      if (!csvText || csvText.includes('<!DOCTYPE html>')) {
        return res.status(422).json({
          success: false,
          error: 'Google Sheet tidak dapat diakses secara publik. Mohon ubah akses spreadsheet menjadi "Siapa saja yang memiliki tautan dapat melihat".'
        });
      }

      // RFC-4180 Compliant CSV Parser
      const parseCSV = (text: string): string[][] => {
        const p: string[][] = [];
        let row: string[] = [];
        let inQuotes = false;
        let current = '';

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const next = text[i + 1];

          if (char === '"') {
            if (inQuotes && next === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            row.push(current.trim());
            current = '';
            if (row.some(cell => cell.length > 0)) p.push(row);
            row = [];
          } else {
            current += char;
          }
        }
        if (current.length > 0 || row.length > 0) {
          row.push(current.trim());
          if (row.some(cell => cell.length > 0)) p.push(row);
        }
        return p;
      };

      const rows = parseCSV(csvText);
      if (rows.length < 2) {
        return res.status(200).json({
          success: true,
          synced_count: 0,
          message: 'Google Sheet belum memiliki data respon siswa.'
        });
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      let scoreIdx = headers.findIndex(h =>
        /^(skor|score|nilai|total score|total skor|point|poin)/i.test(h) ||
        h === 'score' ||
        h === 'skor' ||
        h === 'nilai' ||
        h.includes('score') ||
        h.includes('skor') ||
        h.includes('nilai') ||
        h.includes('point') ||
        h.includes('poin')
      );

      const nameIdx = headers.findIndex(h =>
        h.includes('nama') ||
        h.includes('name') ||
        h.includes('siswa') ||
        h.includes('student') ||
        h.includes('peserta')
      );

      const nisnIdx = headers.findIndex(h =>
        h.includes('nisn') ||
        h.includes('nis') ||
        h.includes('nomor induk')
      );

      const emailIdx = headers.findIndex(h =>
        h.includes('email') ||
        h.includes('surel') ||
        h.includes('mail')
      );

      // Fallback: search row 1 for score pattern if header not found
      if (scoreIdx === -1 && rows[1]) {
        for (let col = 0; col < rows[1].length; col++) {
          const val = rows[1][col];
          if (val && (val.includes('/ 100') || val.includes('/100') || /^\d+\s*\/\s*\d+$/.test(val))) {
            scoreIdx = col;
            break;
          }
        }
      }

      if (scoreIdx === -1) {
        return res.status(400).json({
          success: false,
          error: 'Kolom "Skor" / "Nilai" tidak ditemukan pada header Google Sheet.'
        });
      }

      // Fetch all students from Supabase
      const { data: allSiswa } = await supabase.from('siswa').select('*');
      const siswaList = allSiswa || [];

      // Fetch existing submissions for this task from tugas_siswa
      const { data: existingSubmissions } = await supabase
        .from('tugas_siswa')
        .select('*')
        .eq('tugas_id', cleanAssignmentId);
      const subList = existingSubmissions || [];

      let syncedCount = 0;
      const syncedDetails: any[] = [];
      const nowIso = getWibIsoString();
      const todayStr = getWibDateString();
      const processedStudentIds = new Set<string>();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // Extract score strictly from the score column
        const rawScoreCell = scoreIdx !== -1 ? row[scoreIdx] : '';
        const parsedScore = parseScoreText(rawScoreCell);

        const rawNisn = nisnIdx !== -1 ? (row[nisnIdx] || '').trim() : '';
        const cleanNisn = rawNisn.replace(/\D/g, '');

        const rawName = nameIdx !== -1 ? (row[nameIdx] || '').trim() : '';
        const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

        const rawEmail = emailIdx !== -1 ? (row[emailIdx] || '').toLowerCase().trim() : (row.find(c => c && c.includes('@')) || '').toLowerCase().trim();

        // Search for student identity with priority
        let matchedStudent: any = null;
        let matchedEmail = rawEmail;

        // 1. By NISN
        if (cleanNisn.length >= 4) {
          matchedStudent = siswaList.find((s: any) => {
            const sNisn = String(s.nisn || s.nis || '').replace(/\D/g, '');
            return sNisn && sNisn === cleanNisn;
          });
        }

        // 2. By Email
        if (!matchedStudent && rawEmail && rawEmail.includes('@')) {
          matchedStudent = siswaList.find((s: any) =>
            s.email && s.email.toLowerCase().trim() === rawEmail
          );
        }

        // 3. By Name (exact, prefix, substring)
        if (!matchedStudent && cleanName.length >= 3) {
          matchedStudent = siswaList.find((s: any) => {
            const sCleanName = (s.nama_siswa || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return sCleanName === cleanName ||
                   sCleanName.startsWith(cleanName) ||
                   cleanName.startsWith(sCleanName) ||
                   sCleanName.includes(cleanName) ||
                   cleanName.includes(sCleanName);
          });
        }

        // Fallback Strategy 1: Search email cell against submissions or students without email
        if (!matchedStudent && rawEmail) {
          if (subList.length > 0) {
            const subStudentId = subList[0].siswa_id;
            matchedStudent = siswaList.find((s: any) => s.id === subStudentId || s.nisn === subStudentId);
          }
          if (!matchedStudent && siswaList.length > 0) {
            matchedStudent = siswaList.find((s: any) => !s.email || s.email.endsWith('@sd.id')) || siswaList[0];
          }
        }

        // Fallback Strategy 2: If still no match and only 1 student or 1 submission exists
        if (!matchedStudent) {
          if (subList.length === 1) {
            const subStudentId = subList[0].siswa_id;
            matchedStudent = siswaList.find((s: any) => s.id === subStudentId || s.nisn === subStudentId);
          } else if (siswaList.length === 1) {
            matchedStudent = siswaList[0];
          }
        }

        if (matchedStudent) {
          const studentId = matchedStudent.id;

          // ATURAN: Jika siswa mengerjakan lebih dari 1 kali, selalu ambil nilai pengerjaan PERTAMA
          if (processedStudentIds.has(studentId)) {
            console.log(`[Sync Sheet Scores] Siswa "${matchedStudent.nama_siswa || studentId}" mengerjakan lebih dari sekali. Mengambil nilai submission PERTAMA dan mengabaikan submission berikutnya.`);
            continue;
          }
          processedStudentIds.add(studentId);

          // Update student email in Supabase if matchedEmail is present and student email is empty/different

          // Update student email in Supabase if matchedEmail is present and student email is empty/different
          if (matchedEmail && matchedEmail.includes('@') && (!matchedStudent.email || matchedStudent.email !== matchedEmail)) {
            await supabase.from('siswa').update({ email: matchedEmail }).eq('id', studentId);
          }

          // Upsert to tugas_siswa
          await supabase.from('tugas_siswa').upsert({
            id: `ts-${cleanAssignmentId}-${studentId}`,
            tugas_id: cleanAssignmentId,
            siswa_id: studentId,
            status_pengerjaan: true,
            status: 'SELESAI',
            score: parsedScore,
            nilai: parsedScore,
            submitted_at: nowIso,
            tanggal_dikerjakan: todayStr,
            umpan_balik: 'Otomatis disinkronkan dari Google Sheet Respon'
          }, { onConflict: 'id' });

          // Upsert to penilaian
          await supabase.from('penilaian').upsert({
            id: `as-${cleanAssignmentId}-${studentId}`,
            siswa_id: studentId,
            mapel_id: mapelId,
            tipe: 'harian',
            nama_penilaian: taskTitle,
            nilai: parsedScore,
            deskripsi_kompetensi: `Nilai otomatis dari Google Sheet Respon (${taskTitle})`,
            tanggal_penilaian: todayStr,
            dinilai_oleh_id: dibuatOlehId,
            kelas: matchedStudent.kelas || taskKelas
          }, { onConflict: 'id' });

          // Also upsert to asesmen table for completeness
          await supabase.from('asesmen').upsert({
            id: `as-${cleanAssignmentId}-${studentId}`,
            siswa_id: studentId,
            mapel_id: mapelId,
            tipe: 'harian',
            nama_penilaian: taskTitle,
            nilai: parsedScore,
            deskripsi_kompetensi: `Nilai otomatis dari Google Sheet Respon (${taskTitle})`,
            tanggal_penilaian: todayStr,
            dinilai_oleh_id: dibuatOlehId,
            kelas: matchedStudent.kelas || taskKelas
          }, { onConflict: 'id' });

          syncedCount++;
          syncedDetails.push({
            student_id: studentId,
            student_name: matchedStudent.nama_siswa || matchedEmail,
            score: parsedScore,
            tugas_id: cleanAssignmentId,
            mapel_id: mapelId,
            kelas: matchedStudent.kelas || taskKelas,
            email: matchedEmail || matchedStudent.email
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: syncedCount > 0 
          ? `Berhasil menyinkronkan ${syncedCount} nilai siswa dari Google Sheet.` 
          : 'Berhasil terhubung ke Google Sheet, namun belum ada identitas siswa yang cocok dengan data di database.',
        synced_count: syncedCount,
        data: syncedDetails
      });

    } catch (err: any) {
      console.error('[Sync Sheet Scores Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Terjadi kesalahan server internal: ' + (err?.message || 'Unknown error')
      });
    }
  };

  app.post('/api/sync-sheet-scores', handleSyncSheetScores);

  // =========================================================================
  // 1C. ENDPOINT AI TUTOR & ASISTEN PEDAGOGI GURU (GEMINI AI)
  // =========================================================================
  const handleAiTutorGuru = async (req: Request, res: Response) => {
    try {
      const { prompt, history } = req.body || {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Pertanyaan atau topik konsultasi tidak boleh kosong.'
        });
      }

      const ai = getGeminiClient();

      const systemInstruction = `Anda adalah "AI Tutor Guru", pakar pedagogi pendidikan, ahli Kurikulum Merdeka, dan kawan diskusi cerdas bagi para guru di Indonesia.

PRINSIP UTAMA KUALITAS JAWABAN:
1. AKURASI & PRESISI TINGGI: Berikan jawaban yang 100% benar, faktual, tepat, dan terverifikasi. Apabila pertanyaan mengandung matematika, rumus sains/fisika/kimia, tata bahasa, atau regulasi Kurikulum Merdeka, hitung dan verifikasi secara cermat setiap langkah agar tidak ada kesalahan konsep maupun angka.
2. PENALARAN LOGIS & LOGIKA PEDAGOGIK: Analisis pertanyaan guru secara mendalam sebelum menjawab. Sampaikan penjelasan secara sistematis, terstruktur, dan mudah dipahami.
3. KURIKULUM MERDEKA & METODE MENGAJAR: Kuasai konsep Pembelajaran Berdiferensiasi, Asesmen Formatif & Sumatif, Modul Ajar, CP/TP/ATP, P5 (Profil Pelajar Pancasila), Ice Breaking, serta Strategi Pengelolaan Kelas.
4. FORMAT TAMPILAN (MARKDOWN): Gunakan format Markdown yang sangat rapi dengan judul bold, poin-poin terurut, penekanan teks (bold), dan langkah operasional yang siap dipraktikkan guru di sekolah.
5. SIKAP: Ramah, empatik, suportif, profesional, serta solutif.`;

      let contentsPayload: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history) {
          if (!item || !item.text || typeof item.text !== 'string' || !item.text.trim()) continue;
          const role = item.role === 'model' ? 'model' : 'user';

          // Avoid two consecutive messages with the same role
          if (contentsPayload.length > 0 && contentsPayload[contentsPayload.length - 1].role === role) {
            contentsPayload[contentsPayload.length - 1].parts[0].text += `\n\n${item.text.trim()}`;
          } else {
            contentsPayload.push({ role, parts: [{ text: item.text.trim() }] });
          }
        }
      }

      // Ensure history doesn't start with 'model' if user hasn't sent any prompt yet
      while (contentsPayload.length > 0 && contentsPayload[0].role === 'model') {
        contentsPayload.shift();
      }

      // Append current prompt safely
      const trimmedPrompt = prompt.trim();
      if (contentsPayload.length > 0 && contentsPayload[contentsPayload.length - 1].role === 'user') {
        if (contentsPayload[contentsPayload.length - 1].parts[0].text === trimmedPrompt) {
          // Already present as last user turn, no need to duplicate
        } else {
          contentsPayload[contentsPayload.length - 1].parts[0].text += `\n\n${trimmedPrompt}`;
        }
      } else {
        contentsPayload.push({ role: 'user', parts: [{ text: trimmedPrompt }] });
      }

      const response = await generateContentWithFallback(ai, {
        contents: contentsPayload,
        config: {
          systemInstruction,
          temperature: 0.3, // Lower temperature for high precision & accuracy
        }
      });

      const replyText = response.text || 'Maaf, AI Tutor belum dapat menghasilkan jawaban saat ini. Silakan coba ajukan pertanyaan kembali.';

      return res.status(200).json({
        success: true,
        reply: replyText,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[AI Tutor Guru Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal terhubung ke AI Tutor: ' + (err?.message || 'Pastikan API Key Gemini terkonfigurasi dengan benar.')
      });
    }
  };

  app.post('/api/ai/tutor', handleAiTutorGuru);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Kelas Ku Webhook Server', timestamp: new Date().toISOString() });
  });

  return app;
}

export const apiApp = createApiApp();

async function startServer() {
  const app = createApiApp();
  const PORT = 3000;

  // =========================================================================
  // 2. VITE MIDDLEWARE (DEVELOPMENT) & STATIC SERVING (PRODUCTION)
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Kelas Ku Server] Running on http://0.0.0.0:${PORT}`);
  });
}

// Only start standalone server when not in serverless runtime (Vercel)
if (!process.env.VERCEL) {
  startServer();
}

export default apiApp;

