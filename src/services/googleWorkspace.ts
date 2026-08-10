// Google Workspace Integration Service
// Provides real API bindings for Google Drive, Sheets, Forms, Gmail, and Docs

import { db } from './db';
import { getAccessToken } from './googleAuth';
import { DaftarTugas } from '../types';

export interface WorkspaceFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface FormQuestion {
  id: string;
  title: string;
  type: string;
}

export interface FormResponseItem {
  responseId: string;
  respondentEmail?: string;
  submittedAt: string;
  answers: Record<string, string>; // Maps Question ID to selected answer
}

/**
 * Format a MIME message for Gmail sending (compatible with Base64URL encoding)
 */
function buildMimeEmail(to: string, subject: string, bodyHtml: string): string {
  // Use UTF-8 safe base64 encoding
  const utf8B64 = (str: string) => {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  };

  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${utf8B64(subject)}?=`,
    '',
    bodyHtml
  ];

  const mime = messageParts.join('\r\n');
  return btoa(mime)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ==========================================
// 1. GOOGLE DRIVE API FUNCTIONS
// ==========================================

/**
 * List files from user's Google Drive matching specific search terms or MIME types
 */
export async function listDriveFiles(token: string, mimeType?: string): Promise<WorkspaceFile[]> {
  let url = 'https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType)';
  if (mimeType) {
    url += `&q=${encodeURIComponent(`mimeType = '${mimeType}' and trashed = false`)}`;
  } else {
    url += `&q=${encodeURIComponent('trashed = false')}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal mengambil daftar file Drive: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Create a new folder in Google Drive
 */
export async function createDriveFolder(token: string, folderName: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal membuat folder di Drive: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Upload a document or spreadsheet to Google Drive inside a specific folder
 */
export async function uploadFileToDrive(
  token: string,
  fileName: string,
  mimeType: string,
  content: string,
  folderId?: string
): Promise<string> {
  const metadata: any = {
    name: fileName,
    mimeType: mimeType
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  // Multi-part upload request
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Accept': 'application/json'
    },
    body: multipartBody
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal mengunggah file ke Drive: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}


// ==========================================
// 2. GOOGLE SHEETS API FUNCTIONS
// ==========================================

/**
 * Create a brand-new Spreadsheet in Google Sheets
 */
export async function createSpreadsheet(token: string, title: string): Promise<string> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal membuat spreadsheet baru: ${response.statusText}`);
  }

  const data = await response.json();
  return data.spreadsheetId;
}

/**
 * Read ranges/values from an active Google Sheet
 */
export async function getSpreadsheetValues(
  token: string,
  spreadsheetId: string,
  range: string
): Promise<any[][]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal membaca data spreadsheet: ${response.statusText}`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Append row data into a specific Google Sheet spreadsheet range
 */
export async function appendSpreadsheetValues(
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<boolean> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal menambahkan baris spreadsheet: ${response.statusText}`);
  }

  return true;
}

/**
 * Write/Over-write a clean grid values into a Spreadsheet
 */
export async function writeSpreadsheetValues(
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<boolean> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal menulis data spreadsheet: ${response.statusText}`);
  }

  return true;
}


// ==========================================
// 3. GOOGLE FORMS API FUNCTIONS
// ==========================================

/**
 * Retrieve metadata and questions inside a specific Google Form
 */
export async function getGoogleForm(
  token: string,
  formId: string
): Promise<{ title: string; questions: FormQuestion[] }> {
  const response = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal mengambil info Google Form: ${response.statusText}`);
  }

  const data = await response.json();
  const questions: FormQuestion[] = [];

  if (data.items) {
    for (const item of data.items) {
      if (item.questionItem) {
        const q = item.questionItem.question;
        questions.push({
          id: q.questionId,
          title: item.title || '',
          type: q.choiceQuestion ? 'CHOICE' : q.textQuestion ? 'TEXT' : 'OTHER'
        });
      }
    }
  }

  return {
    title: data.info?.title || 'Google Form Tanpa Judul',
    questions: questions
  };
}

/**
 * Fetch submitted student responses to evaluate or automatically record grades
 */
export async function getGoogleFormResponses(token: string, formId: string): Promise<FormResponseItem[]> {
  const response = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal mengambil respons formulir: ${response.statusText}`);
  }

  const data = await response.json();
  const responses: FormResponseItem[] = [];

  if (data.responses) {
    for (const r of data.responses) {
      const answers: Record<string, string> = {};
      if (r.answers) {
        for (const [qId, ansObj] of Object.entries(r.answers)) {
          const textAnswers = (ansObj as any).textAnswers?.answers;
          if (textAnswers && textAnswers.length > 0) {
            answers[qId] = textAnswers[0].value || '';
          }
        }
      }

      responses.push({
        responseId: r.responseId,
        respondentEmail: r.respondentEmail,
        submittedAt: r.lastSubmittedTime,
        answers: answers
      });
    }
  }

  return responses;
}


// ==========================================
// 4. GMAIL API FUNCTIONS
// ==========================================

/**
 * Send an email using Gmail API on behalf of the logged-in user (e.g. Wali Kelas sending reports to parents)
 */
export async function sendGmailMessage(
  token: string,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<boolean> {
  const rawMessage = buildMimeEmail(to, subject, bodyHtml);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      raw: rawMessage
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal mengirim email: ${response.statusText}`);
  }

  return true;
}


// ==========================================
// 5. GOOGLE DOCS API FUNCTIONS
// ==========================================

/**
 * Create a new Document in Google Docs
 */
export async function createGoogleDoc(token: string, title: string): Promise<string> {
  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      title: title
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal membuat dokumen Google Docs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.documentId;
}

/**
 * Appends formatted lines/paragraphs to a Google Doc
 */
export async function appendDocText(token: string, documentId: string, text: string): Promise<boolean> {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            endOfSegmentLocation: {},
            text: text
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal menambahkan teks ke dokumen Docs: ${response.statusText}`);
  }

  return true;
}

/**
 * Sends automated email alerts to students and parents via the Gmail API when a new assignment is posted.
 */
export async function sendNewAssignmentEmailAlerts(
  assignment: DaftarTugas,
  mapelName: string
): Promise<{ success: boolean; sentCount: number; errors?: string[] }> {
  const token = await getAccessToken();
  if (!token) {
    console.warn('Google Workspace tidak terhubung. Email otomatis diabaikan.');
    return { success: false, sentCount: 0, errors: ['Google Workspace tidak terhubung. Silakan login ke akun Google Anda di panel atas.'] };
  }

  const targetClass = assignment.kelas || 'Kelas 4';
  const students = db.siswa.getAll().filter(s => s.kelas === targetClass);

  if (students.length === 0) {
    return { success: true, sentCount: 0 };
  }

  let sentCount = 0;
  const errors: string[] = [];

  const schoolProfile = db.profilSekolah.get();
  
  let formattedTenggat = assignment.tenggatWaktu;
  try {
    const rawTenggat = new Date(assignment.tenggatWaktu);
    if (!isNaN(rawTenggat.getTime())) {
      formattedTenggat = rawTenggat.toLocaleString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';
    }
  } catch (err) {
    console.error(err);
  }

  for (const student of students) {
    // 1. Determine Emails
    const cleanName = student.namaSiswa.toLowerCase().replace(/\s+/g, '');
    let studentEmail = `${cleanName}@siswa.belajar.id`;
    let parentEmail = `ortu.${cleanName}@belajar.id`;

    // If noTeleponOrtu contains a valid email, use it as primary parent email
    if (student.noTeleponOrtu && student.noTeleponOrtu.includes('@')) {
      parentEmail = student.noTeleponOrtu.trim();
    }

    const emailSubject = `[Penugasan Baru] ${mapelName} - ${assignment.judulTugas} (${targetClass})`;

    // 2. HTML template for Student
    const studentBodyHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: #4f46e5; padding: 30px; text-align: center; color: white;">
          <span style="background: rgba(255,255,255,0.2); font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 4px 10px; border-radius: 12px; letter-spacing: 0.1em; display: inline-block; margin-bottom: 12px;">Penugasan Baru</span>
          <h2 style="margin: 0; font-size: 22px; font-weight: 800;">Hai ${student.namaSiswa}!</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Ada tugas baru yang siap untuk mengasah pemahamanmu.</p>
        </div>
        
        <div style="padding: 30px; color: #1e293b; line-height: 1.6;">
          <p style="margin-top: 0; font-size: 15px;">Wali kelasmu telah merilis penugasan baru di platform Kurikulum Merdeka:</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #64748b; width: 35%;">Mata Pelajaran</td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: bold;">: ${mapelName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Judul Tugas</td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: bold;">: ${assignment.judulTugas}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Tenggat Waktu</td>
                <td style="padding: 6px 0; color: #ef4444; font-weight: bold;">: ${formattedTenggat}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #4f46e5; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Instruksi Pengerjaan:</h3>
          <p style="font-size: 14px; background: #faf5ff; border-left: 4px solid #c084fc; padding: 12px 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
            ${assignment.deskripsi || 'Silakan kerjakan tugas sesuai arahan yang telah disampaikan di kelas.'}
          </p>

          ${assignment.googleFormUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${assignment.googleFormUrl}" style="background: #4f46e5; color: white; text-decoration: none; padding: 12px 30px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
              Buka Google Form Tugas &nbsp;➔
            </a>
          </div>
          ` : ''}

          <div style="margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            <p style="margin: 0;">Laporan ini dikirim secara otomatis oleh <b>${schoolProfile.namaSekolah}</b>.</p>
            <p style="margin: 4px 0 0 0;">Tetap semangat belajar dan raih cita-citamu!</p>
          </div>
        </div>
      </div>
    `;

    // 3. HTML template for Parent
    const parentBodyHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: #059669; padding: 30px; text-align: center; color: white;">
          <span style="background: rgba(255,255,255,0.2); font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 4px 10px; border-radius: 12px; letter-spacing: 0.1em; display: inline-block; margin-bottom: 12px;">Pemberitahuan Orang Tua</span>
          <h2 style="margin: 0; font-size: 22px; font-weight: 800;">Yth. Bapak/Ibu Wali Murid</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Pendampingan belajar putra-putri Anda adalah kunci sukses masa depan mereka.</p>
        </div>
        
        <div style="padding: 30px; color: #1e293b; line-height: 1.6;">
          <p style="margin-top: 0; font-size: 15px;">Kami menginfokan bahwa ananda <b>${student.namaSiswa}</b> baru saja menerima tugas mandiri baru:</p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #047857; width: 35%;">Mata Pelajaran</td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: bold;">: ${mapelName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #047857;">Judul Tugas</td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: bold;">: ${assignment.judulTugas}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #047857;">Tenggat Waktu</td>
                <td style="padding: 6px 0; color: #ef4444; font-weight: bold;">: ${formattedTenggat}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #059669; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Saran Pendampingan:</h3>
          <ul style="font-size: 13.5px; margin: 0; padding-left: 20px; color: #475569;">
            <li style="margin-bottom: 8px;">Pastikan ananda meluangkan waktu khusus untuk mengerjakan tugas ini sebelum batas tenggat.</li>
            <li style="margin-bottom: 8px;">Bantu ciptakan lingkungan belajar yang tenang dan bebas dari gangguan gawai/televisi selama pengerjaan.</li>
            <li>Jika tugas berbasis Google Form, bantulah ananda membuka tautan pengerjaan resmi yang terlampir.</li>
          </ul>

          ${assignment.googleFormUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${assignment.googleFormUrl}" style="background: #059669; color: white; text-decoration: none; padding: 12px 30px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
              Pantau Tautan Tugas &nbsp;➔
            </a>
          </div>
          ` : ''}

          <div style="margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            <p style="margin: 0;">Surel pemberitahuan ini dikirim resmi dari <b>${schoolProfile.namaSekolah}</b>.</p>
            <p style="margin: 4px 0 0 0;">Terima kasih atas kerja sama dan dukungan tiada henti dari Bapak/Ibu sekalian.</p>
          </div>
        </div>
      </div>
    `;

    // 4. Dispatch Email Alerts via Gmail API
    try {
      // Send to student
      await sendGmailMessage(token, studentEmail, emailSubject, studentBodyHtml);
      // Send to parent
      await sendGmailMessage(token, parentEmail, emailSubject, parentBodyHtml);

      // Create local notifications logs in db
      db.notifikasi.add({
        penerimaRole: 'siswa',
        penerimaUserId: student.id,
        judul: `Tugas Baru: ${assignment.judulTugas}`,
        pesan: `Tugas ${mapelName} baru telah dirilis dengan batas tenggat ${formattedTenggat}. Surel pemberitahuan resmi telah terkirim ke email siswa: ${studentEmail}.`
      });

      db.notifikasi.add({
        penerimaRole: 'orang_tua',
        penerimaUserId: `parent-${student.id}`,
        judul: `Tugas Baru Ananda: ${assignment.judulTugas}`,
        pesan: `Pemberitahuan tugas baru untuk ananda ${student.namaSiswa} telah dikirim ke inbox email Bapak/Ibu: ${parentEmail}. Harap bantu dampingi proses belajarnya!`
      });

      sentCount++;
    } catch (e: any) {
      console.error(`Gagal mengirim surel ke ${student.namaSiswa}:`, e);
      errors.push(`${student.namaSiswa}: ${e?.message || e}`);
    }
  }

  // Dispatch a global event to refresh any notification list
  window.dispatchEvent(new Event('notifikasi-updated'));

  return {
    success: errors.length === 0,
    sentCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

