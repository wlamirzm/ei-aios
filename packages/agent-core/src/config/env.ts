// ==============================================================================
// ENVIRONMENT CONFIGURATION: AGENT-CORE
// ==============================================================================

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DOMAIN: z.string().default('energyintel.local'),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  
  GEMINI_API_KEY: z.string().optional().default('mock-key-for-dev'),
  GEMINI_DEFAULT_FAST_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_DEFAULT_REASONING_MODEL: z.string().default('gemini-3.8-flash'),
  
  SUPABASE_URL: z.string().url().default('http://localhost:54321'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('mock-service-role-key'),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('ei-artifacts'),
  
  N8N_WEBHOOK_URL: z.string().url().default('http://localhost:5678/webhook')
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

