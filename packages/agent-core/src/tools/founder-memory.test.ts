import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTextDiff,
  generateFingerprint,
  founderMemory
} from './founder-memory.js';

describe('Segundo Cérebro — Memória Episódica & Motor RAG (Fase 1)', () => {
  it('computeTextDiff calcula deltas de caracteres, tokens e similaridade semântica', () => {
    const original = 'Olá Roberto, segue proposta com 20% de economia garantida no horário de ponta.';
    const modified = 'Olá Roberto, analisei o histórico e identifiquei 20% de redução tarifária na Cemig. Podemos falar na quinta?';

    const diff = computeTextDiff(original, modified);

    assert.ok(diff.similarityRatio > 0.1 && diff.similarityRatio < 1.0);
    assert.notEqual(diff.charCountDelta, 0);
    assert.ok(diff.changesDetected.length > 0);
  });

  it('generateFingerprint gera hash SHA-256 determinístico para deduplicação', () => {
    const textA = 'AG-007:crm_followup:Cerâmica São Lucas:{"distributor":"CEMIG"}';
    const textB = 'AG-007:crm_followup:Cerâmica São Lucas:{"distributor":"CEMIG"}';
    const textC = 'AG-007:crm_followup:Outro Prospect:{"distributor":"CEMIG"}';

    const hashA = generateFingerprint(textA);
    const hashB = generateFingerprint(textB);
    const hashC = generateFingerprint(textC);

    assert.equal(hashA, hashB);
    assert.notEqual(hashA, hashC);
    assert.equal(hashA.length, 64);
  });

  it('getActivePersona retorna a persona executiva padrão do fundador quando banco está offline', async () => {
    const persona = await founderMemory.getActivePersona();

    assert.equal(persona.slug, 'default-founder');
    assert.equal(persona.preferred_tone, 'analytical_executive');
    assert.equal(persona.decision_weights.vector_similarity_weight, 0.45);
    assert.equal(persona.decision_weights.business_rules_weight, 0.35);
    assert.equal(persona.decision_weights.temporal_freshness_weight, 0.20);
    assert.ok(persona.business_heuristics.prohibited_claim_keywords?.includes('sem risco'));
  });

  it('calculateApprovalProbability projeta probabilidade positiva para proposta alinhada', async () => {
    const result = await founderMemory.calculateApprovalProbability({
      title: 'Follow-up Consultivo Grupo A4',
      proposalText: 'Prezado Diretor, segue análise técnica demonstrando redução de custos na ponta com migração para ACL.',
      category: 'crm_followup',
      agentId: 'AG-007',
      metadata: {
        distributor: 'CEMIG',
        successFeePercent: 25.0
      }
    });

    assert.ok(result.approvalProbability >= 0.70, `Probabilidade esperada >= 0.70, obteve ${result.approvalProbability}`);
    assert.equal(result.scoreBreakdown.guardrailsViolated.length, 0);
    assert.ok(result.confidenceScore >= 0.60);
  });

  it('calculateApprovalProbability zera probabilidade (0.0) se violar guardrail de palavras proibidas', async () => {
    const result = await founderMemory.calculateApprovalProbability({
      title: 'Oferta Comercial Agressiva',
      proposalText: 'Assine agora para obter economia garantida 100% sem risco de qualquer espécie na sua conta.',
      category: 'crm_followup',
      agentId: 'AG-007',
      metadata: {
        distributor: 'CEMIG'
      }
    });

    assert.equal(result.approvalProbability, 0.0);
    assert.ok(result.scoreBreakdown.guardrailsViolated.length > 0);
    assert.match(result.scoreBreakdown.guardrailsViolated[0] || '', /sem risco|economia garantida/i);
  });

  it('calculateApprovalProbability penaliza proposta financeira com taxa de sucesso abaixo do mínimo', async () => {
    const resultLowFee = await founderMemory.calculateApprovalProbability({
      title: 'Proposta com Fee Baixo',
      proposalText: 'Proposta comercial de auditoria de faturas.',
      category: 'crm_followup',
      agentId: 'AG-007',
      metadata: {
        successFeePercent: 10.0 // Mínimo é 20%
      }
    });

    const resultGoodFee = await founderMemory.calculateApprovalProbability({
      title: 'Proposta com Fee Saudável',
      proposalText: 'Proposta comercial de auditoria de faturas.',
      category: 'crm_followup',
      agentId: 'AG-007',
      metadata: {
        successFeePercent: 25.0
      }
    });

    assert.ok(
      resultGoodFee.scoreBreakdown.businessRulesMatch > resultLowFee.scoreBreakdown.businessRulesMatch,
      'Fee saudável deve ter pontuação de negócio superior a fee defasado'
    );
  });
});
