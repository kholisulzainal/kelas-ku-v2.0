import { createClient } from '@supabase/supabase-js';

const rawUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || 
               ((import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL as string) || 
               (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.NEXT_PUBLIC_SUPABASE_URL)) || '';
let supabaseUrl = rawUrl.trim();
if (!supabaseUrl) {
  supabaseUrl = 'https://placeholder.supabase.co';
} else if (!/^https?:\/\//i.test(supabaseUrl)) {
  supabaseUrl = `https://${supabaseUrl}`;
}

const supabaseAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || 
                        ((import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) || 
                        ((import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) || 
                        (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) || 
                        'placeholder';

let client;
try {
  new URL(supabaseUrl);
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} catch (err) {
  console.warn('[Supabase] Initializing placeholder client due to invalid configuration:', err);
  client = createClient('https://placeholder.supabase.co', 'placeholder', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = client;
