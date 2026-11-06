// ==============================================================================
// ARTIFACT WRITER: DELIVERABLE GENERATOR & SUPABASE PERSISTENCE
// ==============================================================================

import { ArtifactType } from '@ei-aios/shared';
import { supabase } from '../config/supabase.js';

export interface CreateArtifactParams {
  taskId: string;
  clientId?: string | null;
  artifactType: ArtifactType | string;
  title: string;
  summary?: string;
  contentMarkdown: string;
  structuredData?: Record<string, any>;
  version?: string;
  metadata?: Record<string, any>;
}

export async function createAndSaveArtifact(params: CreateArtifactParams): Promise<{ id: string }> {
  try {
    const { data, error } = await supabase
      .from('artifacts')
      .insert({
        task_id: params.taskId,
        client_id: params.clientId || null,
        artifact_type: params.artifactType,
        title: params.title,
        summary: params.summary || null,
        content_markdown: params.contentMarkdown,
        structured_data: params.structuredData || {},
        version: params.version || '1.0',
        metadata: params.metadata || {}
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ArtifactWriter] Supabase insert error:', error);
      return { id: 'mock-artifact-' + Date.now() };
    }

    return { id: data.id };
  } catch (err) {
    console.error('[ArtifactWriter] Exception creating artifact:', err);
    return { id: 'mock-artifact-' + Date.now() };
  }
}

/**
 * Formata um laudo de diagnóstico energético profissional em Markdown.
 */
export function formatEnergyDiagnosisMarkdown(audit: any, clientName: string = 'Cliente'): string {
  return `# RELATÓRIO EXECUTIVO DE AUDITORIA E INTELIGÊNCIA ENERGÉTICA
**Cliente:** ${clientName} | **Unidade:** ${audit.consumer_unit_code} | **Referência:** ${audit.billing_period}
**Data da Auditoria:** ${new Date().toLocaleDateString('pt-BR')} | **Motor de Cálculo:** EI-AIOS Deterministic v1.0

---

## 1. RESUMO EXECUTIVO DO DIAGNÓSTICO
* **Economia Mensal Identificada:** R$ ${audit.total_monthly_potential_savings_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Economia Anual Projetada:** R$ ${audit.total_annual_potential_savings_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Classificação de Fator de Carga:** ${audit.load_factor_analysis.rating.toUpperCase()} (${(audit.load_factor_analysis.load_factor * 100).toFixed(1)}%)

---

## 2. ANÁLISE DE DEMANDA CONTRATADA E REGULAÇÃO ANEEL
* **Demanda Contratada Atual:** ${audit.demand_analysis.contracted_kw} kW
* **Demanda Máxima Registrada:** ${audit.demand_analysis.measured_kw} kW
* **Tolerância Regulatória (5%):** ${audit.demand_analysis.regulatory_tolerance_kw} kW
* **Status de Ultrapassagem:** ${audit.demand_analysis.has_overage ? `⚠️ SIM (${audit.demand_analysis.overage_kw} kW ultrapassados)` : '✅ Conforme (Dentro da tolerância)'}
* **Multa de Ultrapassagem Apurada:** R$ ${audit.demand_analysis.overage_penalty_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Ociosidade Contratual:** ${audit.demand_analysis.has_idle_demand ? `⚠️ ${audit.demand_analysis.idle_demand_kw} kW ociosos (R$ ${audit.demand_analysis.monthly_idle_waste_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês desperdiçados)` : 'Nenhuma ociosidade identificada.'}
* **Demanda Contratada Otimizada Recomendada:** ${audit.demand_analysis.recommended_contracted_demand_kw} kW

---

## 3. COMPARAÇÃO DE ENQUADRAMENTO HOROSSAZONAL
* **Modalidade Vigente:** ${audit.modality_comparison.current_modality}
* **Custo Anual Projetado na Tarifa Verde:** R$ ${audit.modality_comparison.verde_annual_cost_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Custo Anual Projetado na Tarifa Azul:** R$ ${audit.modality_comparison.azul_annual_cost_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Modalidade Recomendada:** ${audit.modality_comparison.recommended_modality}
* **Economia em Migração:** R$ ${audit.modality_comparison.annual_savings_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ano
* **Fundamentação Técnica:** ${audit.modality_comparison.recommendation_rationale}

---

## 4. ENERGIA REATIVA EXCEDENTE (FATOR DE POTÊNCIA)
* **Multa Mensal por Reativo Excedente:** R$ ${audit.reactive_analysis.monthly_fine_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Custo Evitável Anual:** R$ ${audit.reactive_analysis.annual_avoidable_cost_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Necessidade de Banco de Capacitores:** ${audit.reactive_analysis.requires_capacitor_bank ? 'SIM (Recomendado)' : 'NÃO NECESSÁRIO'}
* **Payback Estimado da Correção:** ${audit.reactive_analysis.payback_estimate_months} meses

---
> **Aviso de Responsabilidade e Governança:**
> Este documento foi processado pela plataforma EI-AIOS com validação determinística conforme a Resolução Normativa ANEEL nº 1.000/2021.
`;
}

