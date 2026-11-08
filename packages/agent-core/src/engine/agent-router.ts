// ==============================================================================
// AGENT ROUTER: DETERMINISTIC SELECTION, PERMISSION & AVAILABILITY VALIDATOR
// Sprint 1 - BKL-005
// ==============================================================================

import { ActionRiskLevel, AgentId } from '@ei-aios/shared';
import { AgentDefinition, DEFAULT_AGENT_REGISTRY, getAgentDefinition } from '../agents/registry.js';

export interface RouteValidationInput {
  requestedAgentId: string;
  taskType?: string;
  objective: string;
  requiredPermission?: keyof AgentDefinition['permissions'];
  overrideDefinition?: AgentDefinition;
}

export interface RouteValidationResult {
  allowed: boolean;
  effectiveAgentId: AgentId;
  requiresHumanApproval: boolean;
  riskLevel: ActionRiskLevel;
  escalatedToOrchestrator: boolean;
  reason: string;
}

export class AgentRouter {
  /**
   * Valida deterministicamente se um agente existe, está ativo (enabled) e possui
   * as permissões necessárias antes de delegar uma tarefa (AG-001 ou AG-012).
   */
  async validateAndRouteAgent(input: RouteValidationInput): Promise<RouteValidationResult> {
    const validIds = new Set<string>(Object.values(AgentId));
    const normalizedId = (input.requestedAgentId || '').trim().toUpperCase();

    // 1. Verifica se o ID do agente é válido no catálogo oficial (AG-001 a AG-012)
    if (!validIds.has(normalizedId)) {
      return {
        allowed: false,
        effectiveAgentId: AgentId.AG_001,
        requiresHumanApproval: true,
        riskLevel: ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED,
        escalatedToOrchestrator: true,
        reason: `Agente '${input.requestedAgentId}' não existe no Agent Registry oficial. Escalonado ao AG-001.`
      };
    }

    const agentDef = input.overrideDefinition || (await getAgentDefinition(normalizedId as AgentId));

    // 2. Verifica se o agente está habilitado (enabled === true)
    if (!agentDef.enabled) {
      return {
        allowed: false,
        effectiveAgentId: AgentId.AG_001,
        requiresHumanApproval: true,
        riskLevel: ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED,
        escalatedToOrchestrator: true,
        reason: `Agente ${agentDef.id} (${agentDef.name}) encontra-se desabilitado (enabled=false). Tarefa escalonada ao AG-001.`
      };
    }

    // 3. Verifica permissão explícita se exigida pela operação
    if (input.requiredPermission && !agentDef.permissions[input.requiredPermission]) {
      return {
        allowed: false,
        effectiveAgentId: AgentId.AG_001,
        requiresHumanApproval: true,
        riskLevel: ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED,
        escalatedToOrchestrator: true,
        reason: `Agente ${agentDef.id} não possui a permissão obrigatória '${input.requiredPermission}'. Escalonado ao AG-001 e sujeito a aprovação Nível 2.`
      };
    }

    // 4. Verifica se o tipo de tarefa ou objetivo exige aprovação Nível 2 segundo as políticas do agente
    const lowerObj = `${input.taskType || ''} ${input.objective}`.toLowerCase();
    const triggersLevel2 =
      agentDef.approvalRequiredActions.some((act) => lowerObj.includes(act.toLowerCase())) ||
      lowerObj.includes('proposta') ||
      lowerObj.includes('deploy') ||
      lowerObj.includes('contrato') ||
      lowerObj.includes('pagamento') ||
      lowerObj.includes('envio externo') ||
      agentDef.id === AgentId.AG_007;

    return {
      allowed: true,
      effectiveAgentId: agentDef.id,
      requiresHumanApproval: triggersLevel2,
      riskLevel: triggersLevel2
        ? ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED
        : ActionRiskLevel.LEVEL_0_AUTO,
      escalatedToOrchestrator: false,
      reason: `Agente ${agentDef.id} validado com sucesso no AgentRegistry.`
    };
  }

  /**
   * Retorna o catálogo formatado de todos os agentes ativos para injeção no prompt do AG-001.
   */
  getActiveCatalogPromptSummary(): string {
    return Object.values(DEFAULT_AGENT_REGISTRY)
      .filter((a) => a.id !== AgentId.AG_001 && a.enabled)
      .map((a) => `- "${a.id}": ${a.name} (${a.agentType}) — Ferramentas: [${a.tools.join(', ')}]`)
      .join('\n   ');
  }
}

export const agentRouter = new AgentRouter();
