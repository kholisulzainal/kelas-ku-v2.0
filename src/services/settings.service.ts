import { getSupabaseClient, syncRowToSupabase } from './supabase';

export interface AppSettings {
  id: string;
  theme: string;
  primaryColor?: string;
  secondaryColor?: string;
  websiteTitle?: string;
  footerText?: string;
  vision?: string;
  mission?: string;
  welcomeMessage?: string;
}

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('application_settings').select('*').limit(1).maybeSingle();
        if (!error && data) {
          const settings: AppSettings = {
            id: data.id || 'app-settings',
            theme: data.theme || 'light',
            primaryColor: data.primary_color || '#6366f1',
            secondaryColor: data.secondary_color || '#a855f7',
            websiteTitle: data.website_title || 'Sistem Informasi Sekolah',
            footerText: data.footer_text || 'SD NEGERI KITA',
            vision: data.vision || '',
            mission: data.mission || '',
            welcomeMessage: data.welcome_message || ''
          };
          localStorage.setItem('app_settings', JSON.stringify(settings));
          return settings;
        }
      } catch (err) {
        console.warn('[Settings Service] Error fetching app settings:', err);
      }
    }
    const raw = localStorage.getItem('app_settings');
    return raw ? JSON.parse(raw) : {
      id: 'app-settings',
      theme: 'light',
      primaryColor: '#6366f1',
      secondaryColor: '#a855f7',
      websiteTitle: 'Sistem Informasi Sekolah',
      footerText: 'SD NEGERI KITA'
    };
  },

  async updateSettings(settings: AppSettings): Promise<{ success: boolean; error?: string }> {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    const res = await syncRowToSupabase('application_settings', settings, true);
    return { success: res.success, error: res.error };
  }
};
