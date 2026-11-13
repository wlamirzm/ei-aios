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
  TASK_TIMEOUT_MS: z.coerce.number().default(300000), // 5 minutos default
  
  LLM_PRIMARY_PROVIDER: z.enum(['bedrock', 'gemini']).default('bedrock'),
  LLM_FALLBACK_ENABLED: z.coerce.boolean().default(true),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  CLAUDE_DEFAULT_FAST_MODEL: z.string().default('claude-haiku-5-5'),
  CLAUDE_DEFAULT_REASONING_MODEL: z.string().default('claude-sonnet-5-5'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_DEFAULT_FAST_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_DEFAULT_REASONING_MODEL: z.string().default('gemini-3.8-flash'),
  
  SUPABASE_URL: z.string().url().default('http://localhost:54321'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('mock-service-role-key'),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('ei-artifacts'),
  
  EMAIL_SECRET_KEY: z.string().optional(),
  EMAIL_AUTO_SYNC_MINUTES: z.coerce.number().default(15),
  ADMIN_API_TOKEN: z.string().default('ei-aios-founder-sovereign-v1'),
  FOUNDER_EMAIL: z.string().default('fundador@energyintelligence.com.br'),
  FOUNDER_PASSWORD: z.string().default('EI-AIOS-2026!'),
  
  N8N_WEBHOOK_URL: z.string().url().default('http://localhost:5678/webhook'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional()
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
