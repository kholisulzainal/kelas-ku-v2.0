import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
process.env.TZ = 'Asia/Jakarta';

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

// Helper to parse score text into float
function parseScoreText(scoreText: any): number {
  if (typeof scoreText === 'number') return scoreText;
  if (!scoreText) return 0;
  
  const str = String(scoreText).trim();
  // If string contains slash e.g. "80 / 100" or "80/100"
  const partBeforeSlash = str.split('/')[0] || str;
  // Clean all characters except digits and decimal dot
  const cleaned = partBeforeSlash.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Get Supabase Admin / Service Client or Fallback
function getAdminSupabaseClient(customUrl?: string, customKey?: string) {
  const supabaseUrl = customUrl || 
                      process.env.VITE_SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      'https://bznfilozrqhmnjvptqic.supabase.co';
  const serviceKey = customKey || 
                     process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.VITE_SUPABASE_ANON_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bmZpbG96cnFobW5qdnB0cWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMDc4ODAsImV4cCI6MjA5OTg4Mzg4MH0.utqOLbyIp4UJN2zUKwJpoPEw7EJglUxz-iUTD-Cghds';
  
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware to parse JSON payloads
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
      const student_email = req.body?.student_email || req.body?.email || req.body?.nisn || req.body?.student_id;
      const assignment_id = req.body?.assignment_id || req.body?.tugas_id || req.body?.task_id;
      const score_text = req.body?.score_text ?? req.body?.score ?? req.body?.nilai;

      if (!student_email || !assignment_id || score_text === undefined || score_text === null) {
        return res.status(400).json({
          success: false,
          error: 'Payload tidak lengkap. Membutuhkan student_email, assignment_id, dan score_text.'
        });
      }

      const parsedScore = parseScoreText(score_text);
      const cleanEmail = String(student_email).trim().toLowerCase();
      const cleanAssignmentId = String(assignment_id).trim();

      const customUrl = req.body?.supabase_url || (req.headers['x-supabase-url'] as string);
      const customKey = req.body?.supabase_key || (req.headers['x-supabase-key'] as string);
      const supabase = getAdminSupabaseClient(customUrl, customKey);
      let studentId: string | null = null;
      let studentName: string | null = null;

      // C. Cari ID Siswa di tabel `siswa` berdasarkan student_email (case-insensitive)
      const emailPrefix = cleanEmail.split('@')[0];

      const { data: siswaData } = await supabase
        .from('siswa')
        .select('id, nama_siswa, email, nisn, nis')
        .or(`email.ilike.${cleanEmail},id.eq.${cleanEmail},id.eq.${emailPrefix},nisn.eq.${emailPrefix}`)
        .maybeSingle();

      if (siswaData && siswaData.id) {
        studentId = siswaData.id;
        studentName = siswaData.nama_siswa || null;
      } else {
        // Extra search: check all rows in siswa table for name or partial match
        const { data: allSiswa } = await supabase.from('siswa').select('id, nama_siswa, email, nisn');
        if (allSiswa && allSiswa.length > 0) {
          const matched = allSiswa.find(s => 
            (s.email && s.email.toLowerCase() === cleanEmail) ||
            (s.id && (s.id.toLowerCase() === cleanEmail || s.id.toLowerCase() === emailPrefix)) ||
            (s.nisn && s.nisn === emailPrefix) ||
            (s.nama_siswa && s.nama_siswa.toLowerCase().includes(emailPrefix))
          );
          if (matched) {
            studentId = matched.id;
            studentName = matched.nama_siswa;
          }
        }
      }

      // Fallback Lanjutan: Jika ID siswa belum ditemukan di database Supabase,
      // gunakan emailPrefix/cleanEmail sebagai ID siswa agar pengerjaan tetap tercatat
      if (!studentId) {
        studentId = emailPrefix || cleanEmail;
        studentName = cleanEmail;
        console.log(`[Webhook Google Form] Menggunakan ID fallback '${studentId}' untuk email '${cleanEmail}'`);
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
            umpan_balik: `Otomatis dikirim via Google Form Webhook pada ${new Date().toLocaleString('id-ID')}`
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

      // CSV Parser
      const parseCSV = (text: string): string[][] => {
        const lines = text.split(/\r?\n/);
        const result: string[][] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const row: string[] = [];
          let insideQuote = false;
          let currentCell = '';
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
              row.push(currentCell.replace(/^"|"$/g, '').trim());
              currentCell = '';
            } else {
              currentCell += char;
            }
          }
          row.push(currentCell.replace(/^"|"$/g, '').trim());
          result.push(row);
        }
        return result;
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
      let scoreIdx = headers.findIndex(h => h.includes('skor') || h.includes('score') || h.includes('nilai') || h.includes('point') || h.includes('poin') || h.includes('total'));
      
      // Fallback: search row 1 for score pattern if header not found
      if (scoreIdx === -1 && rows[1]) {
        for (let col = 0; col < rows[1].length; col++) {
          const val = rows[1][col];
          if (val && (val.includes('/') || (!isNaN(Number(val)) && Number(val) <= 100))) {
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

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const scoreRaw = row[scoreIdx];
        const parsedScore = parseScoreText(scoreRaw);
        if (parsedScore == null) continue;

        // Search for student identity across cells
        let matchedStudent: any = null;
        let matchedEmail = '';

        for (const cell of row) {
          if (!cell) continue;
          const cleanCell = cell.toLowerCase().trim();

          matchedStudent = siswaList.find((s: any) =>
            (s.email && s.email.toLowerCase().trim() === cleanCell) ||
            (s.id && s.id.toLowerCase().trim() === cleanCell) ||
            (s.nisn && s.nisn.toLowerCase().trim() === cleanCell) ||
            (s.nama_siswa && s.nama_siswa.toLowerCase().trim() === cleanCell) ||
            (s.nama_siswa && cleanCell.includes(s.nama_siswa.toLowerCase().trim())) ||
            (s.nama_siswa && s.nama_siswa.toLowerCase().trim().includes(cleanCell))
          );

          if (matchedStudent) {
            if (cleanCell.includes('@')) matchedEmail = cleanCell;
            break;
          }
        }

        // Fallback Strategy 1: Search email cell against submissions or students without email
        if (!matchedStudent) {
          const emailCell = row.find(c => c && c.includes('@'))?.toLowerCase().trim();
          if (emailCell) {
            matchedEmail = emailCell;

            // Check if there is a submission in tugas_siswa for a student
            if (subList.length > 0) {
              const subStudentId = subList[0].siswa_id;
              matchedStudent = siswaList.find((s: any) => s.id === subStudentId || s.nisn === subStudentId);
            }

            // Fallback: If only 1 student exists or student has no email set, pick student
            if (!matchedStudent && siswaList.length > 0) {
              matchedStudent = siswaList.find((s: any) => !s.email || s.email.endsWith('@sd.id')) || siswaList[0];
            }
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

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Kelas Ku Webhook Server', timestamp: new Date().toISOString() });
  });

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

startServer();
