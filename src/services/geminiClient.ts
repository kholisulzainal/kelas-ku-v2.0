// =========================================================================
// GEMINI CLIENT HELPER & API KEY MANAGER
// =========================================================================

export const GEMINI_STORAGE_KEY = 'custom_gemini_api_key';

export const getStoredGeminiApiKey = (): string => {
  try {
    const saved = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {
    // Ignore local storage read errors
  }
  return '';
};

export const setStoredGeminiApiKey = (key: string): void => {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(GEMINI_STORAGE_KEY);
    } else {
      localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
    }
    window.dispatchEvent(new CustomEvent('gemini-config-updated'));
  } catch (e) {
    // Ignore local storage write errors
  }
};

export const removeStoredGeminiApiKey = (): void => {
  try {
    localStorage.removeItem(GEMINI_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('gemini-config-updated'));
  } catch (e) {
    // Ignore
  }
};

export interface AiTutorResponse {
  success: boolean;
  reply?: string;
  error?: string;
  timestamp?: string;
}

const SYSTEM_INSTRUCTION_DEFAULT = `Anda adalah "AI Tutor Guru", pakar pedagogi pendidikan, ahli Kurikulum Merdeka, dan kawan diskusi cerdas bagi para guru di Indonesia.

Misi dan Gaya Komunikasi Anda:
1. Menjawab dalam Bahasa Indonesia yang santun, profesional, penuh empati, dan solutif.
2. Membantu guru dalam menyusun Modul Ajar, Alur Tujuan Pembelajaran (ATP), Capaian Pembelajaran (CP), Asesmen Diagnostik/Formatif/Sumatif, serta Pembelajaran Berdiferensiasi.
3. Memberikan contoh konkret yang aplikatif di kelas nyata di Indonesia.
4. Gunakan format Markdown rapi (tabel, poin-poin, bolding) agar nyaman dibaca oleh pendidik.`;

/**
 * Direct call to Google Gemini REST API from the browser when an API Key is available.
 * Tries multiple official models in sequence to prevent single-point failures and 503 high-demand errors.
 */
async function callGeminiDirectRest(
  apiKey: string,
  prompt: string,
  history: Array<{ role: string; text: string }> = []
): Promise<AiTutorResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      success: false,
      error: 'Google Gemini API Key belum diisi. Silakan masukkan API Key di Pengaturan Aplikasi (Operator).'
    };
  }

  // Model cascade: prioritize fast, highly available models to avoid 503 high-demand spikes
  const models = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.5-pro'
  ];

  // Format conversation history for Gemini REST API
  const contents = [
    ...history.map(m => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }]
    })),
    {
      role: 'user',
      parts: [{ text: prompt }]
    }
  ];

  let lastErrMessage = '';
  let hadHighDemand = false;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      
      const requestBody: any = {
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      };

      // Include system instruction
      requestBody.systemInstruction = {
        parts: [{ text: SYSTEM_INSTRUCTION_DEFAULT }]
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (text) {
          return {
            success: true,
            reply: text,
            timestamp: new Date().toISOString()
          };
        }
      } else {
        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;

        // If the key itself is explicitly invalid or forbidden, return immediate warning
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          if (errMsg.toLowerCase().includes('api key') || errMsg.toLowerCase().includes('key not valid') || errMsg.toLowerCase().includes('permission_denied')) {
            return {
              success: false,
              error: `API Key Google Gemini tidak valid atau izin ditolak. Silakan buat API Key baru gratis di https://aistudio.google.com/app/apikey dan simpan di Pengaturan Aplikasi.`
            };
          }
        }

        // If 503 (High demand) or 429 (Rate limit), mark flag and attempt the next model immediately
        if (res.status === 503 || errMsg.toLowerCase().includes('high demand') || res.status === 429) {
          hadHighDemand = true;
          console.warn(`[Gemini Direct API] Model ${model} is busy (503/429), switching to next model...`);
          continue;
        }

        lastErrMessage = errMsg;
        console.warn(`[Gemini Direct API] Model ${model} failed:`, errMsg);
      }
    } catch (e: any) {
      lastErrMessage = e?.message || 'Kesalahan jaringan';
      console.warn(`[Gemini Direct API] Network error on model ${model}:`, e);
    }
  }

  if (hadHighDemand) {
    return {
      success: false,
      error: `Server Google AI sedang mengalami antrean trafik tinggi (High Demand). Silakan tunggu sekitar 5 detik lalu coba kirim ulang pertanyaan Anda.`
    };
  }

  return {
    success: false,
    error: `Koneksi Google Gemini API gagal: ${lastErrMessage || 'Semua model tidak merespons'}. Pastikan API Key valid.`
  };
}

export const callAiTutor = async (payload: {
  prompt: string;
  history?: Array<{ role: string; text: string }>;
  customApiKey?: string;
}): Promise<AiTutorResponse> => {
  const localKey = getStoredGeminiApiKey();
  const effectiveKey = (payload.customApiKey || localKey || '').trim();

  // 1. If an API Key is available in the browser (via Operator Settings), call direct Google Gemini REST
  if (effectiveKey) {
    return await callGeminiDirectRest(effectiveKey, payload.prompt, payload.history || []);
  }

  // 2. If no API Key stored locally, try backend server route (/api/ai/tutor)
  try {
    const res = await fetch('/api/ai/tutor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: payload.prompt,
        history: payload.history || []
      })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        error: `Kunci API Google Gemini belum dikonfigurasi. Silakan buka menu Pengaturan Aplikasi (Operator) > tab "Gemini AI Configuration", lalu masukkan Google Gemini API Key Anda.`
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: `Kunci API Google Gemini belum dikonfigurasi di Pengaturan Aplikasi. Silakan masukkan Google Gemini API Key Anda melalui menu Pengaturan Aplikasi (Operator).`
    };
  }
};

export const testGeminiApiKey = async (apiKey?: string): Promise<{ success: boolean; message: string }> => {
  const cleanKey = (apiKey || getStoredGeminiApiKey() || '').trim();

  if (cleanKey) {
    try {
      const directRes = await callGeminiDirectRest(cleanKey, 'Jawab dalam 1 kata pendek: Siap', []);
      if (directRes.success && directRes.reply) {
        return { 
          success: true, 
          message: 'Koneksi ke Google Gemini AI berhasil terverifikasi dan aktif!' 
        };
      }
      return { 
        success: false, 
        message: directRes.error || 'Gagal memverifikasi API Key.' 
      };
    } catch (err: any) {
      return { 
        success: false, 
        message: `Gagal menguji API Key: ${err?.message || 'Kesalahan jaringan.'}` 
      };
    }
  }

  // If testing backend key
  try {
    const res = await fetch('/api/ai/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Jawab dalam 1 kata: Siap',
        history: []
      })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        message: 'Kunci API belum diisi di Pengaturan Aplikasi maupun Environment Variables Vercel. Silakan masukkan API Key pada input di atas.'
      };
    }

    const data = await res.json();
    if (data.success) {
      return { success: true, message: 'Koneksi Gemini AI Server berhasil terverifikasi!' };
    }
    return { success: false, message: data.error || 'Gagal terhubung ke server Gemini AI.' };
  } catch (err: any) {
    return { 
      success: false, 
      message: 'Kunci API belum dimasukkan di browser. Silakan masukkan API Key pada input di atas.' 
    };
  }
};
