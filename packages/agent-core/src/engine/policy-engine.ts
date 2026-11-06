// ==============================================================================
// POLICY ENGINE: GOVERNANCE, RISK GATES & FINANCIAL CIRCUIT BREAKER
// ==============================================================================

import { ActionRiskLevel } from '@ei-aios/shared';
import { supabase } from '../config/supabase.js';
import { getAgentDefinition } from '../agents/registry.js';

export interface PolicyCheckResult {
  allowed: boolean;
  requiresHumanApproval: boolean;
  approvalReason?: string;
  rejectionReason?: string;
  riskLevel: ActionRiskLevel;
}

export class PolicyEngine {
  /**
   * Avalia permissão de execução e travas de segurança antes de rodar o agente.
   */
  async evaluatePreExecution(agentId: string, riskLevel: ActionRiskLevel): Promise<PolicyCheckResult> {
    const agentDef = await getAgentDefinition(agentId);

    // 1. Verificação de Orçamento Diário (Circuit Breaker FinOps)
    const today = new Date().toISOString().split('T')[0];
    const { data: runs, error } = await supabase
      .from('agent_runs')
      .select('cost_estimate')
      .eq('agent_id', agentId)
      .gte('created_at', `${today}T00:00:00.000Z`);

    if (!error && runs) {
      const dailySpendUsd = runs.reduce((sum, r) => sum + Number(r.cost_estimate || 0), 0);
      if (dailySpendUsd >= agentDef.dailyBudgetUsd) {
        return {
          allowed: false,
          requiresHumanApproval: true,
          riskLevel,
          rejectionReason: `Circuit Breaker FinOps acionado: Agente ${agentId} atingiu o teto diário de US$ ${agentDef.dailyBudgetUsd.toFixed(2)} (Gasto hoje: US$ ${dailySpendUsd.toFixed(2)}).`
        };
      }
    }

    // 2. Classificação de Risco
    if (riskLevel === ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED) {
      return {
        allowed: true,
        requiresHumanApproval: true,
        riskLevel,
        approvalReason: 'Tarefa de Nível 2 (Impacto Externo, Recomendação Contratual ou Compromisso Financeiro).'
      };
    }

    return {
      allowed: true,
      requiresHumanApproval: false,
      riskLevel
    };
  }

  /**
   * Avalia o resultado pós-execução e auditoria do QA antes de finalizar a tarefa.
   */
  evaluatePostExecution(
    taskRiskLevel: ActionRiskLevel,
    qaRequiresApproval: boolean,
    assignedAgentId: string
  ): { requiresApproval: boolean; approvalReason?: string } {
    if (taskRiskLevel === ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED) {
      return {
        requiresApproval: true,
        approvalReason: `Aprovação mandatória Nível 2 exigida para entrega gerada por ${assignedAgentId}.`
      };
    }

    if (qaRequiresApproval) {
      return {
        requiresApproval: true,
        approvalReason: `Auditoria QA (AG-008) solicitou validação humana explícita antes do prosseguimento.`
      };
    }

    return {
      requiresApproval: false
    };
  }
}

export const policyEngine = new PolicyEngine();

