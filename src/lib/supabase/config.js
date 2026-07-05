import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Production'da placeholder ile sessizce ayağa kalkma — erken ve net hata ver.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase env dəyişənləri təyin edilməyib');
  }
  console.warn('Supabase environment variables are missing. Please configure them in .env');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
