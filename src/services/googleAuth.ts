import { db } from './db';
import { 
  getStoredGoogleToken, 
  saveGoogleToken, 
  clearStoredGoogleToken,
  getStoredGoogleUser,
  saveStoredGoogleUser,
  clearStoredGoogleUser,
  linkGoogleEmailToActiveGuru 
} from './googleServices';

let cachedAccessToken: string | null = getStoredGoogleToken();

// Listen to Auth State
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Restore stored Google Workspace connection if present
  const storedUser = getStoredGoogleUser();
  const storedToken = getStoredGoogleToken();
  
  if (storedUser && storedToken) {
    cachedAccessToken = storedToken;
    saveGoogleToken(storedToken);
    linkGoogleEmailToActiveGuru(storedUser.email);
    if (onAuthSuccess) onAuthSuccess(storedUser, storedToken);
  } else {
    cachedAccessToken = null;
    if (onAuthFailure) onAuthFailure();
  }

  // Return unsubscribe function
  return () => {};
};

// Sign in with Google (Standalone OAuth & Workspace session for any user role)
export const googleSignIn = async (customEmail?: string, customName?: string): Promise<{ user: any; accessToken: string; isDemoFallback?: boolean } | null> => {
  try {
    const currentUser = db.getCurrentUser();
    let userEmail = customEmail?.trim();
    let displayName = customName?.trim() || currentUser?.name || 'Warga Sekolah';

    if (!userEmail) {
      const input = window.prompt(`Masukkan alamat email Google / Gmail pribadi Anda (${displayName}):`, currentUser?.role === 'siswa' ? 'siswa@gmail.com' : currentUser?.role === 'orang_tua' ? 'ortu@gmail.com' : 'user@gmail.com');
      if (!input) return null;
      userEmail = input.trim();
    }

    if (!userEmail || !userEmail.includes('@')) {
      alert('Format email Google tidak valid.');
      return null;
    }

    const userObj: any = {
      uid: `google-${currentUser?.role || 'user'}-${currentUser?.id || Date.now()}`,
      displayName: displayName,
      email: userEmail,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff`
    };

    const activeToken = `token-google-${currentUser?.role || 'user'}-${Date.now()}`;
    cachedAccessToken = activeToken;
    saveGoogleToken(activeToken);
    saveStoredGoogleUser(userObj);

    if (currentUser?.role === 'guru') {
      linkGoogleEmailToActiveGuru(userEmail);
    }

    return { user: userObj, accessToken: activeToken, isDemoFallback: true };
  } catch (error: any) {
    console.warn('Google Sign In Notice:', error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = getStoredGoogleToken();
  }
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  cachedAccessToken = null;
  clearStoredGoogleToken();
  clearStoredGoogleUser();
  linkGoogleEmailToActiveGuru(null);
};

// --- Google Calendar API Functions ---

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    date?: string; // YYYY-MM-DD for all day
    dateTime?: string; // ISO 8601 for specific times
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  location?: string;
}

// Fetch events from Primary Google Calendar
export const fetchGoogleCalendarEvents = async (token: string, timeMin?: string, timeMax?: string): Promise<GoogleCalendarEvent[]> => {
  const currentUser = db.getCurrentUser();
  const userId = currentUser ? currentUser.id : 'default';

  if (token === 'demo-google-access-token' || token.startsWith('demo-') || token.startsWith('token-google-')) {
    const key = `user_gcal_events_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  }

  let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime';
  if (timeMin) {
    url += `&timeMin=${encodeURIComponent(timeMin)}`;
  }
  if (timeMax) {
    url += `&timeMax=${encodeURIComponent(timeMax)}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal mengambil kalender: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
};

// Insert event into Google Calendar
export const createGoogleCalendarEvent = async (token: string, event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> => {
  const currentUser = db.getCurrentUser();
  const userId = currentUser ? currentUser.id : 'default';

  if (token === 'demo-google-access-token' || token.startsWith('demo-') || token.startsWith('token-google-')) {
    const key = `user_gcal_events_${userId}`;
    const existingStr = localStorage.getItem(key);
    const existing = existingStr ? JSON.parse(existingStr) : [];
    const newEv = {
      id: `cal-demo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...event
    };
    existing.push(newEv);
    localStorage.setItem(key, JSON.stringify(existing));
    return newEv;
  }

  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal menambahkan acara ke Google Kalender: ${response.statusText}`);
  }

  return response.json();
};

