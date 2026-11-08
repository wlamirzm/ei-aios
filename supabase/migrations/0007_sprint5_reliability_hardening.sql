-- ==============================================================================
-- SPRINT 5 MIGRATION: RELIABILITY, ORCHESTRATION & CONCURRENCY HARDENING
-- ==============================================================================

SET search_path = public;

-- 1. Suporte idempotente ao status 'synthesizing' no ENUM task_status
DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'synthesizing';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Índice para otimização de busca de tarefas ativas por lease e watchdog
CREATE INDEX IF NOT EXISTS idx_tasks_status_task_type ON tasks(status, task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at);
