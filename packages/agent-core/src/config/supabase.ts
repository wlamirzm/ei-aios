// ==============================================================================
// SUPABASE CLIENT FACTORY (Service Role & Admin Operations)
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { env } from './env.js';

// Polyfill native WebSocket for Node environments without native globalThis.WebSocket
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseClient;
}

export const supabase = getSupabase();
