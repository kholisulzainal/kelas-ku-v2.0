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
2. Membantu guru dalam menyusun Modul Ajar, Alur Tujuan Pembelajaran (ATP), Capaian Pembelajaran (CP), Asesmen Diagnostik/Formatif/Sumatif, serta Diferensiasi Pembelajaran.
3. Memberikan contoh konkret yang aplikatif di kelas nyata di Indonesia.
4. Gunakan format Markdown rapi (tabel, bullet points, bolding) agar nyaman dibaca oleh pendidik.`;

/**
 * Direct call to Google Gemini REST API from the browser when an API Key is available
 */
async function callGeminiDirectRest(
  apiKey: string,
  prompt: string,
  history: Array<{ role: string; text: string }> = []
): Promise<AiTutorResponse> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'];

  // Format contents for Gemini REST API
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

  let lastErr = '';

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION_DEFAULT }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        })
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
        lastErr = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        console.warn(`[Gemini Direct API] Model ${model} returned error:`, lastErr);
      }
    } catch (e: any) {
      lastErr = e?.message || 'Gagal terhubung ke Google AI API';
      console.warn(`[Gemini Direct API] Model ${model} network error:`, e);
    }
  }

  return {
    success: false,
    error: `Koneksi Google Gemini API gagal (${lastErr || 'Model tidak merespons'}). Pastikan API Key valid.`
  };
}

export const callAiTutor = async (payload: {
  prompt: string;
  history?: Array<{ role: string; text: string }>;
  customApiKey?: string;
}): Promise<AiTutorResponse> => {
  const localKey = getStoredGeminiApiKey();
  const effectiveKey = (payload.customApiKey || localKey || '').trim();

  // If we have an API Key configured locally by the operator, call Gemini API directly
  if (effectiveKey) {
    const directRes = await callGeminiDirectRest(effectiveKey, payload.prompt, payload.history || []);
    if (directRes.success) {
      return directRes;
    }
    // If direct failed because of an error other than invalid key, we can still attempt backend route
    console.warn('[Gemini Client] Direct REST call failed, attempting backend fallback...', directRes.error);
  }

  // Fallback to server backend endpoint (/api/ai/tutor)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (effectiveKey) {
    headers['x-gemini-api-key'] = effectiveKey;
  }

  try {
    const res = await fetch('/api/ai/tutor', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: payload.prompt,
        history: payload.history || [],
        customApiKey: effectiveKey || undefined
      })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const textResponse = await res.text();
      return {
        success: false,
        error: `Server mengembalikan respons non-JSON (${res.status}). Silakan pastikan GEMINI_API_KEY telah dipasang di Pengaturan Aplikasi (Operator) atau Environment Variables Vercel.`
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: `Gagal terhubung ke server AI: ${err?.message || 'Periksa koneksi internet Anda.'}`
    };
  }
};

export const testGeminiApiKey = async (apiKey: string): Promise<{ success: boolean; message: string }> => {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'API Key tidak boleh kosong.' };
  }

  const cleanKey = apiKey.trim();

  // Test direct REST call
  try {
    const directRes = await callGeminiDirectRest(cleanKey, 'Jawab dalam 1 kalimat pendek bahasa Indonesia: Halo, koneksi berhasil!', []);
    if (directRes.success && directRes.reply) {
      return { success: true, message: 'Koneksi ke Google Gemini AI berhasil terverifikasi!' };
    }
    return { success: false, message: directRes.error || 'Gagal memverifikasi API Key.' };
  } catch (err: any) {
    return { success: false, message: `Gagal menguji API Key: ${err?.message || 'Kesalahan jaringan.'}` };
  }
};
