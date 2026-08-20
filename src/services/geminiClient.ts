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

export const callAiTutor = async (payload: {
  prompt: string;
  history?: Array<{ role: string; text: string }>;
  customApiKey?: string;
}): Promise<AiTutorResponse> => {
  const localKey = getStoredGeminiApiKey();
  const effectiveKey = (payload.customApiKey || localKey || '').trim();

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

  try {
    const res = await callAiTutor({
      prompt: 'Jawab dalam 1 kalimat pendek: Halo!',
      history: [],
      customApiKey: apiKey.trim()
    });

    if (res.success && res.reply) {
      return { success: true, message: 'Koneksi ke Gemini AI berhasil terverifikasi!' };
    } else {
      return { success: false, message: res.error || 'Gagal memverifikasi API Key.' };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal terhubung ke server.' };
  }
};
