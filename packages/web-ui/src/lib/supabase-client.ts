import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if ((supabase as any).rest && !supabaseUrl.includes('/rest/v1')) {
  (supabase as any).rest.url = supabaseUrl.replace(/\/+$/, '');
}

