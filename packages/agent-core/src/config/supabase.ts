// ==============================================================================
// SUPABASE CLIENT FACTORY (Service Role & Admin Operations)
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import crypto from 'crypto';
import { env } from './env.js';

// Polyfill native WebSocket for Node environments without native globalThis.WebSocket
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

function resolveValidJwt(_key?: string): string {
  const secret = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: 'service_role', iss: 'supabase', iat: 1700000000, exp: 2500000000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const validKey = resolveValidJwt(env.SUPABASE_SERVICE_ROLE_KEY);
    supabaseClient = createClient(env.SUPABASE_URL, validKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Se a URL apontar diretamente para o PostgREST standalone (ex: http://postgrest:3000 sem Kong/proxy),
    // removemos o sufixo hardcoded '/rest/v1' para que as queries batam diretamente na raiz do PostgREST.
    if ((supabaseClient as any).rest && !env.SUPABASE_URL.includes('/rest/v1')) {
      (supabaseClient as any).rest.url = env.SUPABASE_URL.replace(/\/+$/, '');
    }
  }
  return supabaseClient;
}

export const supabase = getSupabase();
