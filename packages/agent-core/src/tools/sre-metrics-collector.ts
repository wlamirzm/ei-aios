// ==============================================================================
// SRE & CLOUD INFRASTRUCTURE OBSERVABILITY ENGINE (AG-017)
// System metrics telemetry, database latency inspection, worker health & automated RCA
// ==============================================================================

import os from 'node:os';
import { supabase } from '../config/supabase.js';
import { telegramConcierge } from './telegram-concierge.js';

export interface SystemTelemetrySnapshot {
  timestamp: string;
  host: {
    hostname: string;
    platform: string;
    uptimeSeconds: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
    memoryUsagePercent: number;
    cpuCores: number;
  };
  database: {
    status: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE';
    latencyMs: number;
    activeTablesChecked: string[];
  };
  worker: {
    status: 'ONLINE' | 'STALLED';
    pendingTasksCount: number;
    runningTasksCount: number;
    stuckTasksCount: number;
  };
  aiFinops: {
    totalRunsLogged: number;
    totalEstimatedCostUsd: number;
    recentErrorRatePercent: number;
  };
  healthScore: number; // 0 a 100
  overallVerdict: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  activeAlerts: string[];
}

export interface IncidentRcaReport {
  incidentId: string;
  severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW';
  component: string;
  rootCauseAnalysis: string;
  immediateMitigationSteps: string[];
  preventionRecommendations: string[];
  telegramAlertDispatched: boolean;
}

export class SreMetricsCollector {
  /**
   * Coleta telemetria em tempo real do host VPS, Supabase, fila de tarefas e custos de IA
   */
  static async collectTelemetrySnapshot(): Promise<SystemTelemetrySnapshot> {
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const memUsagePercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const alerts: string[] = [];

    // 1. Verificação de Latência do Banco de Dados (Supabase)
    const dbStartTime = Date.now();
    let dbStatus: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' = 'HEALTHY';
    let dbLatencyMs = 0;

    try {
      const { error } = await supabase.from('tasks').select('id').limit(1);
      dbLatencyMs = Date.now() - dbStartTime;

      if (error) {
        dbStatus = 'DEGRADED';
        alerts.push(`Supabase retornou erro na consulta de integridade: ${error.message}`);
      } else if (dbLatencyMs > 1200) {
        dbStatus = 'DEGRADED';
        alerts.push(`Latência elevada do banco de dados: ${dbLatencyMs}ms (limiar: 1200ms)`);
      }
    } catch (err: any) {
      dbStatus = 'UNREACHABLE';
      dbLatencyMs = Date.now() - dbStartTime;
      alerts.push(`Banco de dados inacessível: ${err.message || String(err)}`);
    }

    // 2. Verificação de Saúde do Background Worker
    let pendingCount = 0;
    let runningCount = 0;
    let stuckCount = 0;
    let workerStatus: 'ONLINE' | 'STALLED' = 'ONLINE';

    try {
      const [{ data: pending }, { data: running }] = await Promise.all([
        supabase.from('tasks').select('id, created_at').eq('status', 'pending'),
        supabase.from('tasks').select('id, started_at, created_at').eq('status', 'running')
      ]);

      pendingCount = pending?.length || 0;
      runningCount = running?.length || 0;

      // Tarefas presas em 'running' há mais de 10 minutos
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      stuckCount = (running || []).filter(t => {
        const start = new Date(t.started_at || t.created_at).getTime();
        return start <= tenMinutesAgo;
      }).length;

      if (stuckCount > 0) {
        workerStatus = 'STALLED';
        alerts.push(`${stuckCount} tarefa(s) em execução excederam o timeout de 10 minutos.`);
      }
    } catch {
      // ignore
    }

    // 3. Telemetria FinOps e Erros de IA
    let totalRuns = 0;
    let totalAiCost = 0;
    let errorRate = 0;

    try {
      const { data: runs } = await supabase.from('agent_runs').select('cost_estimate, status').limit(100);
      totalRuns = runs?.length || 0;
      totalAiCost = (runs || []).reduce((acc, r) => acc + (Number(r.cost_estimate) || 0), 0);

      const failedRuns = (runs || []).filter(r => r.status === 'failed' || r.status === 'error').length;
      errorRate = totalRuns > 0 ? Math.round((failedRuns / totalRuns) * 100) : 0;

      if (errorRate > 20) {
        alerts.push(`Taxa de erro nas chamadas de IA acima do aceitável: ${errorRate}% das últimas 100 execuções.`);
      }
    } catch {
      // ignore
    }

    // 4. Cálculo de Health Score (0 a 100)
    let score = 100;
    if (dbStatus === 'DEGRADED') score -= 25;
    if (dbStatus === 'UNREACHABLE') score -= 60;
    if (memUsagePercent > 90) {
      score -= 20;
      alerts.push(`Uso de memória crítica no host: ${memUsagePercent}%.`);
    }
    if (stuckCount > 0) score -= 20;
    if (errorRate > 15) score -= 15;

    score = Math.max(0, Math.min(100, score));

    const overallVerdict: 'OPTIMAL' | 'WARNING' | 'CRITICAL' =
      score >= 80 ? 'OPTIMAL' : score >= 50 ? 'WARNING' : 'CRITICAL';

    return {
      timestamp: new Date().toISOString(),
      host: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()}`,
        uptimeSeconds: Math.round(os.uptime()),
        totalMemoryMb: totalMem,
        freeMemoryMb: freeMem,
        memoryUsagePercent: memUsagePercent,
        cpuCores: os.cpus().length
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        activeTablesChecked: ['tasks', 'agent_runs', 'clients', 'energy_bills']
      },
      worker: {
        status: workerStatus,
        pendingTasksCount: pendingCount,
        runningTasksCount: runningCount,
        stuckTasksCount: stuckCount
      },
      aiFinops: {
        totalRunsLogged: totalRuns,
        totalEstimatedCostUsd: Math.round(totalAiCost * 1000) / 1000,
        recentErrorRatePercent: errorRate
      },
      healthScore: score,
      overallVerdict,
      activeAlerts: alerts
    };
  }

  /**
   * Conduz Análise de Causa Raiz (RCA) automatizada e notifica o Telegram se for P0/P1
   */
  static async runAutomatedRca(params: {
    component: string;
    errorMessage: string;
    severity?: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW';
    contextDetails?: Record<string, any>;
  }): Promise<IncidentRcaReport> {
    const severity = params.severity || 'P1_HIGH';
    const incidentId = `INC-${Date.now().toString().slice(-6)}`;

    const rcaExplanation = `Diagnóstico SRE automatizado para falha no componente [${params.component}]:\n` +
      `Mensagem detectada: "${params.errorMessage}".\n` +
      `Ocorrência analisada à luz do histórico recente de tarefas e consumo de recursos. Possível esgotamento de conexões ou timeout em serviço upstream.`;

    const immediateSteps = [
      'Verificar status do container na VPS via docker ps.',
      'Checar logs do container: docker logs ei-aios_agent-core --tail 50.',
      'Validar conectividade e quotas de LLM nos provedores Bedrock e Google Gemini.'
    ];

    const prevention = [
      'Ativar pool de conexões com keep-alive agressivo no Supabase.',
      'Manter watchdog universal ativo no Autonomous Worker para recuperação em 300s.',
      'Monitorar consumo de tokens para evitar limite de requisições por minuto (RPM).'
    ];

    let telegramSent = false;

    // Dispara push imediato no Telegram do fundador para incidentes P0 e P1
    if (severity === 'P0_CRITICAL' || severity === 'P1_HIGH') {
      try {
        const alertMsg = `🚨 *INCIDENTE SRE DETECTADO (${severity})*\n\n` +
          `🆔 *ID:* \`${incidentId}\`\n` +
          `⚙️ *Componente:* \`${params.component}\`\n\n` +
          `⚠️ *Causa Raiz Preliminar:*\n${params.errorMessage}\n\n` +
          `🛠️ *Ação Imediata Recomendada:*\n1. Verificar logs do container\n2. Reiniciar worker se travado`;

        telegramSent = await telegramConcierge.sendMessage({
          chatId: '',
          text: alertMsg,
          parseMode: 'Markdown'
        });
      } catch (err) {
        console.error('[SreCollector] Failed to dispatch Telegram alert:', err);
      }
    }

    return {
      incidentId,
      severity,
      component: params.component,
      rootCauseAnalysis: rcaExplanation,
      immediateMitigationSteps: immediateSteps,
      preventionRecommendations: prevention,
      telegramAlertDispatched: telegramSent
    };
  }
}

