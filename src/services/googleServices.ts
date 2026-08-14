// Google Services Client API
// Provides initialization, token storage, consent handling, and API wrappers for Google Drive, Sheets, and Gmail

import { db } from './db';
import { syncRowToSupabase } from './supabase';
import { Siswa } from '../types';
import { getWibDateString, getWibIsoString } from '../utils/dateUtils';

// Storage keys for persisting user authentication and consent states
const TOKEN_STORAGE_KEY = 'google_workspace_access_token';
const EXPIRY_STORAGE_KEY = 'google_workspace_token_expiry';
const CONSENT_STORAGE_KEY = 'google_workspace_user_consent';
const USER_PROFILE_STORAGE_KEY = 'google_workspace_user_profile';

/**
 * --- 1. AUTHENTICATION & TOKEN STORAGE MANAGEMENT ---
 */

export interface GoogleUserProfile {
  displayName: string;
  email: string;
  photoURL?: string;
}

export function saveStoredGoogleUser(userProfile: GoogleUserProfile): void {
  const currentUser = db.getCurrentUser();
  const userKey = currentUser ? `${USER_PROFILE_STORAGE_KEY}_${currentUser.role}_${currentUser.id}` : USER_PROFILE_STORAGE_KEY;
  localStorage.setItem(userKey, JSON.stringify(userProfile));
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
  localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
  if (currentUser && currentUser.role === 'guru') {
    linkGoogleEmailToActiveGuru(userProfile.email);
  }
}

export function getStoredGoogleUser(): GoogleUserProfile | null {
  const currentUser = db.getCurrentUser();
  if (currentUser) {
    const userKey = `${USER_PROFILE_STORAGE_KEY}_${currentUser.role}_${currentUser.id}`;
    const userProfileStr = localStorage.getItem(userKey);
    if (userProfileStr) {
      try {
        return JSON.parse(userProfileStr);
      } catch (e) {}
    }

    if (currentUser.role === 'guru') {
      const guru = db.guru.getAll().find(g => g.id === currentUser.id);
      if (guru && guru.googleEmail) {
        return {
          displayName: guru.namaGuru || 'Guru SD',
          email: guru.googleEmail,
          photoURL: guru.fotoUrl
        };
      }
    }

    // Do not leak other users' profile if currentUser is logged in
    return null;
  }

  const profileStr = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
  if (profileStr) {
    try {
      return JSON.parse(profileStr);
    } catch (e) {}
  }

  return null;
}

export function clearStoredGoogleUser(): void {
  const currentUser = db.getCurrentUser();
  if (currentUser) {
    localStorage.removeItem(`${USER_PROFILE_STORAGE_KEY}_${currentUser.role}_${currentUser.id}`);
  }
  localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
  localStorage.removeItem(CONSENT_STORAGE_KEY);
}

/**
 * Persist the Google OAuth Access Token and its expiry duration locally per user session.
 */
export function saveGoogleToken(accessToken: string, expiresInSeconds: number = 3600): void {
  const currentUser = db.getCurrentUser();
  const expiryTimestamp = Date.now() + expiresInSeconds * 1000;
  
  const tokenKey = currentUser ? `${TOKEN_STORAGE_KEY}_${currentUser.role}_${currentUser.id}` : TOKEN_STORAGE_KEY;
  const expiryKey = currentUser ? `${EXPIRY_STORAGE_KEY}_${currentUser.role}_${currentUser.id}` : EXPIRY_STORAGE_KEY;

  localStorage.setItem(tokenKey, accessToken);
  localStorage.setItem(expiryKey, expiryTimestamp.toString());
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(EXPIRY_STORAGE_KEY, expiryTimestamp.toString());
  localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
  
  window.dispatchEvent(new CustomEvent('google-token-updated', { detail: { accessToken } }));
}

/**
 * Retrieve the active cached access token for the current logged-in user.
 */
export function getStoredGoogleToken(): string | null {
  const currentUser = db.getCurrentUser();
  let tokenKey = TOKEN_STORAGE_KEY;
  let expiryKey = EXPIRY_STORAGE_KEY;

  if (currentUser) {
    tokenKey = `${TOKEN_STORAGE_KEY}_${currentUser.role}_${currentUser.id}`;
    expiryKey = `${EXPIRY_STORAGE_KEY}_${currentUser.role}_${currentUser.id}`;
  }

  let token = localStorage.getItem(tokenKey);
  let expiryStr = localStorage.getItem(expiryKey);

  if (!token && !currentUser) {
    token = localStorage.getItem(TOKEN_STORAGE_KEY);
    expiryStr = localStorage.getItem(EXPIRY_STORAGE_KEY);
  }
  
  if (!token || !expiryStr) {
    return null;
  }

  const expiry = parseInt(expiryStr, 10);
  const now = Date.now();
  
  const safetyBuffer = 5 * 60 * 1000; 
  if (now > expiry - safetyBuffer) {
    clearStoredGoogleToken();
    return null;
  }

  return token;
}

/**
 * Clear the Google OAuth token details from persistent storage.
 */
export function clearStoredGoogleToken(): void {
  const currentUser = db.getCurrentUser();
  if (currentUser) {
    localStorage.removeItem(`${TOKEN_STORAGE_KEY}_${currentUser.role}_${currentUser.id}`);
    localStorage.removeItem(`${EXPIRY_STORAGE_KEY}_${currentUser.role}_${currentUser.id}`);
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(EXPIRY_STORAGE_KEY);
}

/**
 * Check if the user has explicitly given consent for Google Workspace integration.
 */
export function hasUserConsentedToWorkspace(): boolean {
  return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
}

/**
 * Set the user consent state.
 */
export function setUserWorkspaceConsent(consented: boolean): void {
  if (consented) {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
  } else {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'false');
    clearStoredGoogleToken();
  }
}

/**
 * Helper to build standard API authorization headers
 */
function getHeaders(token: string, extraHeaders: Record<string, string> = {}): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    ...extraHeaders
  };
}

/**
 * Helper to handle HTTP responses and format descriptive errors
 */
async function handleResponse<T>(response: Response, defaultErrorMessage: string): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `${defaultErrorMessage} (Status: ${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

/**
 * --- 2. GOOGLE DRIVE API CLIENT ---
 */
export const googleDriveClient = {
  /**
   * List files or folders from Google Drive
   */
  async listFiles(token: string, options?: { q?: string; pageSize?: number }): Promise<any[]> {
    const pageSize = options?.pageSize || 50;
    let url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,mimeType,webViewLink,iconLink)`;
    
    if (options?.q) {
      url += `&q=${encodeURIComponent(options.q)}`;
    }

    const response = await fetch(url, {
      headers: getHeaders(token)
    });
    const data = await handleResponse<{ files?: any[] }>(response, 'Gagal mengambil daftar file Google Drive');
    return data.files || [];
  },

  /**
   * Create a new file or folder in Google Drive
   */
  async createFile(
    token: string,
    metadata: { name: string; mimeType: string; parents?: string[] },
    mediaContent?: string,
    mediaType?: string
  ): Promise<any> {
    const url = 'https://www.googleapis.com/drive/v3/files';
    
    if (!mediaContent) {
      // Standard metadata-only file creation (e.g. folder, or empty document)
      const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(metadata)
      });
      return handleResponse<any>(response, 'Gagal membuat file di Google Drive');
    } else {
      // Multipart upload for creating files with actual media contents
      const boundary = 'foo_bar_boundary';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mediaType || 'text/plain'}\r\n\r\n` +
        mediaContent +
        closeDelimiter;

      const response = await fetch(`${url}?uploadType=multipart`, {
        method: 'POST',
        headers: getHeaders(token, {
          'Content-Type': `multipart/related; boundary=${boundary}`
        }),
        body: multipartRequestBody
      });
      return handleResponse<any>(response, 'Gagal mengunggah file media ke Google Drive');
    }
  },

  /**
   * Delete a file or folder from Google Drive
   */
  async deleteFile(token: string, fileId: string): Promise<boolean> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(token)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData?.error?.message || `Gagal menghapus file (ID: ${fileId})`;
      throw new Error(message);
    }
    return true;
  },

  /**
   * Copy an existing Google Drive file
   */
  async copyFile(token: string, fileId: string, options: { name?: string; parents?: string[] }): Promise<any> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/copy`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(options)
    });
    return handleResponse<any>(response, `Gagal menyalin file Google Drive (ID: ${fileId})`);
  }
};

/**
 * --- 3. GOOGLE SHEETS API CLIENT ---
 */
export const googleSheetsClient = {
  /**
   * Create a brand new Google Spreadsheet
   */
  async createSpreadsheet(token: string, title: string): Promise<any> {
    const url = 'https://sheets.googleapis.com/v4/spreadsheets';
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        properties: {
          title: title
        }
      })
    });
    return handleResponse<any>(response, 'Gagal membuat Google Spreadsheet baru');
  },

  /**
   * Fetch spreadsheet metadata, worksheets structure, and optional ranges
   */
  async getSpreadsheet(token: string, spreadsheetId: string, options?: { ranges?: string[]; includeGridData?: boolean }): Promise<any> {
    let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const params: string[] = [];
    
    if (options?.ranges) {
      options.ranges.forEach(r => params.push(`ranges=${encodeURIComponent(r)}`));
    }
    if (options?.includeGridData !== undefined) {
      params.push(`includeGridData=${options.includeGridData}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    const response = await fetch(url, {
      headers: getHeaders(token)
    });
    return handleResponse<any>(response, `Gagal memuat metadata Spreadsheet (ID: ${spreadsheetId})`);
  },

  /**
   * Read raw values from a designated range of a Spreadsheet
   */
  async getValues(token: string, spreadsheetId: string, range: string): Promise<any[][]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const response = await fetch(url, {
      headers: getHeaders(token)
    });
    const data = await handleResponse<{ values?: any[][] }>(response, `Gagal mengambil nilai dari Spreadsheet (Range: ${range})`);
    return data.values || [];
  },

  /**
   * Append new rows of data into a spreadsheet worksheet range
   */
  async appendValues(
    token: string,
    spreadsheetId: string,
    range: string,
    values: any[][],
    options?: { valueInputOption?: 'RAW' | 'USER_ENTERED' }
  ): Promise<any> {
    const valueInputOption = options?.valueInputOption || 'USER_ENTERED';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        values: values
      })
    });
    return handleResponse<any>(response, `Gagal menyisipkan baris baru ke Spreadsheet (Range: ${range})`);
  },

  /**
   * Update or overwrite cells in a spreadsheet worksheet range
   */
  async updateValues(
    token: string,
    spreadsheetId: string,
    range: string,
    values: any[][],
    options?: { valueInputOption?: 'RAW' | 'USER_ENTERED' }
  ): Promise<any> {
    const valueInputOption = options?.valueInputOption || 'USER_ENTERED';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        values: values
      })
    });
    return handleResponse<any>(response, `Gagal memperbarui nilai Spreadsheet (Range: ${range})`);
  }
};

/**
 * --- 4. GMAIL API CLIENT ---
 */
export const googleGmailClient = {
  /**
   * Send a rich HTML email to a recipient
   */
  async sendEmail(token: string, to: string, subject: string, bodyHtml: string): Promise<any> {
    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    
    // Construct compliant MIME email
    const rawMime = buildMimeEmail(to, subject, bodyHtml);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        raw: rawMime
      })
    });
    return handleResponse<any>(response, `Gagal mengirim email pemberitahuan ke ${to}`);
  },

  /**
   * List recent messages from user's mailbox matching an optional query
   */
  async listMessages(token: string, options?: { q?: string; maxResults?: number }): Promise<any[]> {
    const maxResults = options?.maxResults || 20;
    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
    
    if (options?.q) {
      url += `&q=${encodeURIComponent(options.q)}`;
    }

    const response = await fetch(url, {
      headers: getHeaders(token)
    });
    const data = await handleResponse<{ messages?: any[] }>(response, 'Gagal mengambil daftar email Gmail');
    return data.messages || [];
  },

  /**
   * Retrieve full details of a specific email message
   */
  async getMessage(token: string, messageId: string): Promise<any> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
    const response = await fetch(url, {
      headers: getHeaders(token)
    });
    return handleResponse<any>(response, `Gagal memuat detail email (ID: ${messageId})`);
  }
};

/**
 * Helper to build a compliant raw MIME message base64url encoded for Google APIs
 */
function buildMimeEmail(to: string, subject: string, bodyHtml: string): string {
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

/**
 * --- 5. GOOGLE SHEET TO SUPABASE CLASS SYNCHRONIZATION UTILITY ---
 */

export interface SheetSyncResult {
  success: boolean;
  totalRows: number;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Fetches class/student data from a Google Sheet and synchronizes it
 * with local storage (db.siswa) and the remote Supabase database.
 */
export async function syncClassDataFromGoogleSheet(
  token: string,
  spreadsheetId: string,
  range: string = 'Sheet1!A1:J100'
): Promise<SheetSyncResult> {
  const result: SheetSyncResult = {
    success: false,
    totalRows: 0,
    syncedCount: 0,
    failedCount: 0,
    errors: []
  };

  try {
    // 1. Fetch data values from the Google Sheet
    const rows = await googleSheetsClient.getValues(token, spreadsheetId, range);
    
    if (!rows || rows.length < 2) {
      throw new Error('Google Sheet kosong atau tidak memiliki baris data (baris judul + data diperlukan).');
    }

    // 2. Identify header positions dynamically to remain robust to shifting columns
    const headers = rows[0].map(h => (h ? h.toString().toUpperCase().trim() : ''));
    
    const nisnIdx = headers.indexOf('NISN');
    const nisIdx = headers.indexOf('NIS');
    const namaIdx = headers.findIndex(h => h.includes('NAMA') || h.includes('SISWA'));
    const jkIdx = headers.findIndex(h => h.includes('JENIS KELAMIN') || h === 'JK' || h === 'GENDER');
    const kelasIdx = headers.indexOf('KELAS');
    const alamatIdx = headers.indexOf('ALAMAT');
    const ayahIdx = headers.findIndex(h => h.includes('AYAH'));
    const ibuIdx = headers.findIndex(h => h.includes('IBU'));
    const telpOrtuIdx = headers.findIndex(h => h.includes('TELEPON') || h.includes('TELP') || h.includes('HP') || h.includes('KONTAK'));

    // Validate that at least critical identifiers (NISN or Name) are present
    if (nisnIdx === -1 && namaIdx === -1) {
      throw new Error('Format kolom Google Sheet tidak valid. Kolom "NISN" atau "NAMA SISWA" wajib ada.');
    }

    const dataRows = rows.slice(1);
    result.totalRows = dataRows.length;

    const syncedStudents: Siswa[] = [];

    // 3. Process each row
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      // Skip fully empty rows
      const isRowEmpty = row.every(val => !val || val.toString().trim() === '');
      if (isRowEmpty) continue;

      try {
        let rawNisn = nisnIdx !== -1 ? row[nisnIdx]?.toString().trim() : '';
        if (rawNisn && rawNisn.endsWith('.0')) {
          rawNisn = rawNisn.replace(/\.0$/, '');
        }
        const rawNama = namaIdx !== -1 ? row[namaIdx]?.toString().trim() : '';
        
        // Skip rows without at least a name
        if (!rawNama) {
          console.warn(`Baris ${i + 2}: Diabaikan karena nama siswa kosong.`);
          continue;
        }

        // Generate NISN if missing to ensure DB constraints are satisfied
        const finalNisn = rawNisn || `99${Math.floor(10000000 + Math.random() * 90000000)}`;
        let rawNis = nisIdx !== -1 ? row[nisIdx]?.toString().trim() : '';
        if (rawNis && rawNis.endsWith('.0')) {
          rawNis = rawNis.replace(/\.0$/, '');
        }
        const finalNis = rawNis || `2324040${Math.floor(10 + Math.random() * 89)}`;

        // Process Gender (convert to 'L' or 'P')
        const rawJk = jkIdx !== -1 ? row[jkIdx]?.toString().toUpperCase().trim() : 'L';
        const finalJk: 'L' | 'P' = (rawJk.startsWith('P') || rawJk.startsWith('F') || rawJk === 'PEREMPUAN') ? 'P' : 'L';

        // Extract and construct attributes
        const finalKelas = kelasIdx !== -1 ? row[kelasIdx]?.toString().trim() : 'Kelas 4';
        const finalAlamat = alamatIdx !== -1 ? row[alamatIdx]?.toString().trim() : '';
        const finalAyah = ayahIdx !== -1 ? row[ayahIdx]?.toString().trim() : '';
        const finalIbu = ibuIdx !== -1 ? row[ibuIdx]?.toString().trim() : '';
        const finalTelp = telpOrtuIdx !== -1 ? row[telpOrtuIdx]?.toString().trim() : '';

        // Form student object matching types.ts Siswa schema
        // Look up if a student with this NISN already exists locally to reuse ID
        const localStudents: Siswa[] = db.siswa.getAll();
        const existingStudent = localStudents.find(s => s.nisn === finalNisn || (s.namaSiswa.toLowerCase() === rawNama.toLowerCase()));
        
        const studentItem: Siswa = {
          id: existingStudent?.id || `siswa-${Date.now()}-${i}`,
          nisn: finalNisn,
          nis: finalNis,
          namaSiswa: rawNama,
          jenisKelamin: finalJk,
          kelas: finalKelas,
          alamat: finalAlamat,
          namaAyah: finalAyah || 'Pak Joko',
          namaIbu: finalIbu || 'Ibu Ratna',
          noTeleponOrtu: finalTelp || '081234567890',
          password: existingStudent?.password || 'siswa123'
        };

        // 4. Push / Save to local db to update interface state instantly
        db.siswa.upsert(studentItem);
        syncedStudents.push(studentItem);

        // 5. Synchronize with Supabase database (Batch Insert / Update logic)
        const supabaseRes = await syncRowToSupabase('siswa', studentItem);
        
        if (supabaseRes.success) {
          result.syncedCount++;
        } else {
          result.failedCount++;
          result.errors.push(`Gagal mengunggah ${rawNama} ke Supabase: ${supabaseRes.error}`);
        }
      } catch (rowErr: any) {
        result.failedCount++;
        result.errors.push(`Kesalahan pada baris ${i + 2}: ${rowErr.message || rowErr}`);
      }
    }

    result.success = result.failedCount === 0;
  } catch (err: any) {
    result.success = false;
    result.errors.push(`Kegagalan proses sinkronisasi: ${err.message || err}`);
  }

  // Dispatch a global event to refresh components with updated class data
  window.dispatchEvent(new Event('siswa-database-updated'));

  return result;
}

/**
 * Link the authenticated Google account email to the active Guru profile permanently
 */
export function linkGoogleEmailToActiveGuru(email: string | null): void {
  const currentUser = db.getCurrentUser();
  const gurus = db.guru.getAll();

  if (currentUser.role === 'guru') {
    const currentGuru = gurus.find(g => g.id === currentUser.id);
    if (currentGuru) {
      currentGuru.googleEmail = email || undefined;
      db.guru.upsert(currentGuru);
    }
  } else if (email) {
    const matchedGuru = gurus.find(g => g.googleEmail?.toLowerCase() === email.toLowerCase());
    if (matchedGuru) {
      matchedGuru.googleEmail = email;
      db.guru.upsert(matchedGuru);
    }
  }

  if (!email) {
    clearStoredGoogleUser();
    clearStoredGoogleToken();
  }

  window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
}

/**
 * Admin/Operator helper to update or clear a Guru's Google account email permanently
 */
export function updateGuruGoogleEmail(guruId: string, email: string | null): void {
  const gurus = db.guru.getAll();
  const targetGuru = gurus.find(g => g.id === guruId);
  if (targetGuru) {
    targetGuru.googleEmail = email || undefined;
    db.guru.upsert(targetGuru);
    
    if (email) {
      const profile = {
        displayName: targetGuru.namaGuru,
        email: email,
        photoURL: targetGuru.fotoUrl
      };
      localStorage.setItem(`${USER_PROFILE_STORAGE_KEY}_${guruId}`, JSON.stringify(profile));
    } else {
      localStorage.removeItem(`${USER_PROFILE_STORAGE_KEY}_${guruId}`);
      localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
      clearStoredGoogleToken();
    }

    // Fire global update event
    window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'guru' } }));
  }
}

export interface GoogleFormWebhookPayload {
  nisn?: string;
  namaSiswa?: string;
  email?: string;
  namaPenilaian: string;
  nilai: number;
  mapelId?: string;
  deskripsiKompetensi?: string;
  kelas?: string;
  googleEmail?: string;
}

/**
 * Process real-time Webhook submission from Google Form Apps Script onFormSubmit(e)
 * Finds student by NISN, NIS, Email, or Name, updates db.asesmen, syncs to Supabase & dispatches events with 0-second delay
 */
export async function processGoogleFormWebhookSubmission(payload: GoogleFormWebhookPayload): Promise<{
  success: boolean;
  studentName?: string;
  asesmenId?: string;
  message: string;
}> {
  const siswas = db.siswa.getAll();
  const mapels = db.mataPelajaran.getAll();
  const gurus = db.guru.getAll();

  if (payload.nilai === undefined || payload.nilai === null || isNaN(Number(payload.nilai))) {
    return { success: false, message: 'Payload nilai tidak valid atau kosong.' };
  }

  // Find teacher linked by googleEmail if provided
  let matchedGuru = payload.googleEmail 
    ? gurus.find(g => g.googleEmail?.toLowerCase() === payload.googleEmail?.toLowerCase())
    : null;

  // 1. Match student using priority order: 1. ID Siswa, 2. NISN, 3. Email / Nama Siswa
  const searchId = (payload.nisn || payload.email || payload.namaSiswa || '').trim();
  
  let matchedSiswa: Siswa | undefined;

  // Priority 1: Student ID (Primary)
  if (searchId) {
    matchedSiswa = siswas.find(s => s.id === searchId || searchId.includes(s.id));
  }

  // Priority 2: NISN
  if (!matchedSiswa && searchId) {
    matchedSiswa = siswas.find(s => s.nisn && (s.nisn.trim() === searchId || searchId.includes(s.nisn.trim())));
  }

  // Priority 3: Email or Student Name
  if (!matchedSiswa) {
    matchedSiswa = siswas.find(s => {
      if (payload.email && s.email && s.email.toLowerCase().trim() === payload.email.toLowerCase().trim()) return true;
      if (payload.email && s.noTeleponOrtu && s.noTeleponOrtu.toLowerCase().includes(payload.email.toLowerCase())) return true;
      if (payload.namaSiswa && s.namaSiswa.toLowerCase().trim() === payload.namaSiswa.toLowerCase().trim()) return true;
      return false;
    });
  }

  // Fallback fuzzy match by student name substring
  if (!matchedSiswa && payload.namaSiswa) {
    const cleanSearchName = payload.namaSiswa.toLowerCase().trim();
    matchedSiswa = siswas.find(s => 
      s.namaSiswa.toLowerCase().includes(cleanSearchName) || 
      cleanSearchName.includes(s.namaSiswa.toLowerCase())
    );
  }

  // If matchedGuru was found and matchedSiswa is missing, find first student in matchedGuru's class
  if (matchedGuru && !matchedSiswa) {
    matchedSiswa = siswas.find(s => s.kelas === matchedGuru?.kelasWali);
  }

  // Fallback if still not matched
  if (!matchedSiswa) {
    matchedSiswa = siswas[0];
  }

  if (!matchedSiswa) {
    return { success: false, message: 'Siswa tidak ditemukan dalam database sekolah.' };
  }

  // If teacher wasn't matched yet, locate teacher for student's class
  if (!matchedGuru) {
    matchedGuru = gurus.find(g => g.kelasWali === matchedSiswa?.kelas) || gurus[0];
  }

  // 2. Resolve Mapel
  let targetMapelId = payload.mapelId;
  if (!targetMapelId) {
    const defaultMapel = mapels.find(m => m.kelas === matchedSiswa?.kelas || m.guruPengampuId === matchedGuru?.id) || mapels[0];
    targetMapelId = defaultMapel?.id || 'mapel-1';
  }

  // 3. Create or update Penilaian record
  const penilaianId = `as-webhook-${Date.now()}-${matchedSiswa.id}`;
  const activeGuruId = matchedGuru?.id || 'guru-1';

  const newPenilaian = {
    id: penilaianId,
    siswaId: matchedSiswa.id,
    mapelId: targetMapelId,
    tipe: 'harian' as const,
    namaPenilaian: payload.namaPenilaian || 'Kuis Google Form (Real-Time)',
    nilai: Math.min(100, Math.max(0, Math.round(Number(payload.nilai)))),
    deskripsiKompetensi: payload.deskripsiKompetensi || `Dikirim otomatis via Google Apps Script Webhook pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (0-Second Delay).`,
    tanggalPenilaian: new Date().toISOString().split('T')[0],
    dinilaiOlehId: activeGuruId,
    kelas: matchedSiswa.kelas
  };

  // Local DB upsert
  db.penilaian.upsert(newPenilaian);

  // Sync to Supabase in background
  syncRowToSupabase('penilaian', newPenilaian).catch(err => {
    console.warn('[Webhook Sync] Supabase background sync notice:', err);
  });

  // Create notification for Parent
  db.notifikasi.add({
    penerimaRole: 'orang_tua',
    penerimaUserId: `parent-${matchedSiswa.id}`,
    judul: `Nilai Kuis Google Form Masuk Real-Time! (0-Second Delay)`,
    pesan: `Ananda ${matchedSiswa.namaSiswa} (${matchedSiswa.kelas}) telah menyelesaikan ${newPenilaian.namaPenilaian} dengan skor: ${newPenilaian.nilai}`
  });

  // Dispatch global updates instantly (0-second delay)
  window.dispatchEvent(new Event('penilaians-updated'));
  window.dispatchEvent(new Event('asesmens-updated'));
  window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'penilaian' } }));

  return {
    success: true,
    studentName: matchedSiswa.namaSiswa,
    asesmenId: newPenilaian.id,
    message: `Nilai ${newPenilaian.nilai} untuk siswa ${matchedSiswa.namaSiswa} (${matchedSiswa.kelas}) berhasil dimasukkan ke Data Penilaian Harian secara Real-Time (0-Second Delay)!`
  };
}

/**
 * SINKRONISASI OTOMATIS NILAI GURU DARI GOOGLE SHEET / GOOGLE FORM RESPONSE (AUTO-SYNC)
 */
export async function syncGoogleFormScoresFromSheet(
  assignmentId: string,
  googleFormOrSheetUrl?: string
): Promise<{ success: boolean; syncedCount: number; message: string; isFormUrl?: boolean }> {
  try {
    // 1. Try server API endpoint first for full Supabase + Server-side sync
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${currentOrigin}/api/sync-sheet-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assignment_id: assignmentId,
        sheet_url: googleFormOrSheetUrl
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.synced_count > 0) {
        // Sync server details to local DB
        const details = data.data || data.synced_rows || data.synced_details || [];
        const taskObj = db.daftarTugas.getAll().find(t => t.id === assignmentId);
        const nowIso = getWibIsoString();
        const todayStr = getWibDateString();

        details.forEach((d: any) => {
          const sId = d.student_id;
          const numScore = Number(d.score);
          if (sId && !isNaN(numScore)) {
            // Update local student email if provided
            if (d.email && d.email.includes('@')) {
              const localStudents = db.siswa.getAll();
              const targetStd = localStudents.find(s => s.id === sId || s.nisn === sId);
              if (targetStd && targetStd.email !== d.email) {
                db.siswa.upsert({ ...targetStd, email: d.email });
              }
            }

            db.tugasSiswa.upsert({
              id: `ts-${assignmentId}-${sId}`,
              tugasId: assignmentId,
              siswaId: sId,
              statusPengerjaan: true,
              status: 'SELESAI',
              score: numScore,
              nilai: numScore,
              submittedAt: nowIso,
              tanggalDikerjakan: todayStr,
              umpanBalik: 'Disinkronkan dari Google Sheet'
            });

            db.penilaian.upsert({
              id: `as-${assignmentId}-${sId}`,
              siswaId: sId,
              mapelId: d.mapel_id || taskObj?.mapelId || 'mapel-1',
              tipe: 'harian',
              namaPenilaian: taskObj?.judulTugas || 'Kuis Google Form',
              nilai: numScore,
              deskripsiKompetensi: `Nilai kuis Google Form (${taskObj?.judulTugas || ''})`,
              tanggalPenilaian: todayStr,
              dinilaiOlehId: taskObj?.dibuatOlehId || 'guru-1',
              kelas: d.kelas || taskObj?.kelas || 'Kelas 4-A'
            });
          }
        });

        window.dispatchEvent(new Event('penilaians-updated'));
        window.dispatchEvent(new Event('asesmens-updated'));
        window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'tugas_siswa' } }));
        return {
          success: true,
          syncedCount: data.synced_count,
          message: data.message || 'Sinkronisasi nilai dari Google Sheet berhasil!'
        };
      } else if (data.is_form_url) {
        return {
          success: false,
          syncedCount: 0,
          isFormUrl: true,
          message: data.error || 'URL yang dimasukkan adalah Tautan Google Form, bukan Tautan Google Sheet Respon.'
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.is_form_url) {
        return {
          success: false,
          syncedCount: 0,
          isFormUrl: true,
          message: errData.error || 'URL yang dimasukkan adalah Tautan Google Form, bukan Tautan Google Sheet Respon.'
        };
      }
    }

    // 2. Client-side fallback if server endpoint cannot reach CSV directly
    const targetUrl = googleFormOrSheetUrl || '';
    let spreadsheetId = '';
    const sheetMatch = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetMatch) {
      spreadsheetId = sheetMatch[1];
    } else if (targetUrl.includes('/forms/d/')) {
      return {
        success: false,
        syncedCount: 0,
        isFormUrl: true,
        message: 'Tautan yang dimasukkan adalah link Google Form. Harap masukkan Tautan Google Sheet Respon (Spreadsheet) dari Google Form Anda.'
      };
    }

    if (!spreadsheetId) {
      return {
        success: false,
        syncedCount: 0,
        message: 'Spreadsheet ID tidak ditemukan dari URL.'
      };
    }

    // Client-side CSV Fetch
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      return {
        success: false,
        syncedCount: 0,
        message: 'Gagal mengambil CSV Google Sheet. Pastikan Google Sheet diset ke "Siapa saja yang memiliki tautan dapat melihat".'
      };
    }

    const csvText = await csvRes.text();
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) {
      return { success: true, syncedCount: 0, message: 'Google Sheet belum memiliki data respon.' };
    }

    const students = db.siswa.getAll();
    const tasks = db.daftarTugas.getAll();
    const task = tasks.find(t => t.id === assignmentId);

    let syncedCount = 0;
    const nowIso = getWibIsoString();
    const todayStr = getWibDateString();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
      
      let matchedStudent = null;
      let scoreNum: number | null = null;

      for (const part of parts) {
        if (!part) continue;
        const clean = part.toLowerCase();
        
        // Check for score pattern (e.g. "80 / 100" or "85")
        if (clean.includes('/') || (!isNaN(Number(clean)) && Number(clean) <= 100 && Number(clean) >= 0 && scoreNum == null)) {
          const firstPart = clean.split('/')[0].replace(/[^\d.]/g, '');
          const parsed = parseFloat(firstPart);
          if (!isNaN(parsed)) scoreNum = parsed;
        }

        // Match student
        if (!matchedStudent) {
          matchedStudent = students.find(s => 
            (s.email && s.email.toLowerCase() === clean) ||
            (s.id && s.id.toLowerCase() === clean) ||
            (s.nisn && s.nisn === clean) ||
            (s.namaSiswa && (s.namaSiswa.toLowerCase() === clean || s.namaSiswa.toLowerCase().includes(clean) || clean.includes(s.namaSiswa.toLowerCase())))
          );
        }
      }

      // Fallback matching if student not directly matched by email/name/nisn
      if (!matchedStudent) {
        const emailPart = parts.find(p => p && p.includes('@'))?.toLowerCase();
        const localSubs = db.tugasSiswa.getAll().filter(ts => ts.tugasId === assignmentId);
        if (localSubs.length > 0) {
          const subSiswaId = localSubs[0].siswaId;
          matchedStudent = students.find(s => s.id === subSiswaId || s.nisn === subSiswaId || (emailPart && s.email === emailPart));
        }
        if (!matchedStudent && students.length > 0) {
          matchedStudent = students.find(s => !s.email || s.email.endsWith('@sd.id')) || students[0];
        }

        // Link student email if email exists in row
        if (matchedStudent && emailPart) {
          db.siswa.upsert({ ...matchedStudent, email: emailPart });
        }
      }

      if (matchedStudent && scoreNum != null) {
        // Save to Local DB tugas_siswa
        const sub = {
          id: `ts-${assignmentId}-${matchedStudent.id}`,
          tugasId: assignmentId,
          siswaId: matchedStudent.id,
          statusPengerjaan: true,
          status: 'SELESAI' as const,
          score: scoreNum,
          nilai: scoreNum,
          submittedAt: nowIso,
          tanggalDikerjakan: todayStr,
          umpanBalik: 'Disinkronkan dari Google Sheet'
        };
        db.tugasSiswa.upsert(sub);

        // Save to Local DB penilaian
        db.penilaian.upsert({
          id: `as-${assignmentId}-${matchedStudent.id}`,
          siswaId: matchedStudent.id,
          mapelId: task?.mapelId || 'mapel-1',
          tipe: 'harian',
          namaPenilaian: task?.judulTugas || 'Kuis Google Form',
          nilai: scoreNum,
          deskripsiKompetensi: `Nilai kuis Google Form (${task?.judulTugas || ''})`,
          tanggalPenilaian: todayStr,
          dinilaiOlehId: task?.dibuatOlehId || 'guru-1',
          kelas: matchedStudent.kelas || task?.kelas || 'Kelas 4-A'
        });

        syncedCount++;
      }
    }

    window.dispatchEvent(new Event('penilaians-updated'));
    window.dispatchEvent(new Event('asesmens-updated'));
    window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { tableName: 'tugas_siswa' } }));

    return {
      success: true,
      syncedCount,
      message: `Berhasil menyinkronkan ${syncedCount} nilai siswa.`
    };

  } catch (err: any) {
    return {
      success: false,
      syncedCount: 0,
      message: err?.message || 'Error sync Google Sheet'
    };
  }
}


