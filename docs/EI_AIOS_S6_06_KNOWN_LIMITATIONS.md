# EI-AIOS — LIMITAÇÕES CONHECIDAS & RISCOS MAPEADOS S6-06
## Registro de Limitações, Riscos e Pontos de Atenção para a Release v1.6

**Projeto:** Energy Intelligence AIOS (EI-AIOS)  
**Sprint:** 6 — FinOps Ledger Engine & Sovereign Financial Architecture  
**Atividade:** S6-06 (E2E Financial Reconciliation Testing & Handover)  
**Data:** 08/11/2026  
**Status de Risco:** CONTROLADO (Sem impeditivos críticos de segurança ou integridade)

---

## 1. LIMITAÇÕES TÉCNICAS E CONTÁBEIS CONHECIDAS

### 1.1 Execuções de IA Históricas Sem Contexto (Legacy Runs)
- **Descrição:** Registros de `agent_runs` criados antes da implantação da atividade S6-01 (Release v1.5 para trás) não possuem os campos `client_id`, `consumer_unit_id` e `execution_id`.
- **Comportamento Atual:** O `FinopsLedgerEngine` classifica automaticamente esses registros na categoria `unattributed_legacy` com confiabilidade `estimated` ou `incomplete`.
- **Impacto:** Esses custos históricos não são atribuídos a nenhum cliente específico e constam no dashboard como custos órfãos/da plataforma.
- **Ação Futura:** Criar rotina de migração/backfill baseada na correlação do `task_id` com a tabela `tasks` para resgatar o `client_id` das execuções antigas.

### 1.2 Cotação Câmbio USD/BRL Estática vs. Feed em Tempo Real
- **Descrição:** A taxa de conversão cambial atual do sistema adota um valor base configurável (default: R$ 5,80 por US$ 1,00).
- **Comportamento Atual:** Cada entrada de ledger grava o `cost_usd` e converte para `cost_brl` com base na taxa vigente no momento da reconciliação.
- **Impacto:** Flutuações diárias da moeda americana não são atualizadas dinamicamente via API do Banco Central (PTAX).
- **Ação Futura:** Integrar serviço de consulta à PTAX diária do Banco Central do Brasil na Sprint 7 ou posterior.

### 1.3 Clientes Sem Contrato Formal no Banco de Dados
- **Descrição:** Quando uma tarefa é processada para um cliente que ainda não possui registro na tabela `client_contracts`, o sistema não presume valores.
- **Comportamento Atual:** O faturamento e MRR retornam `null` e a confiabilidade é rebaixada para `incomplete`.
- **Impacto:** O operador vê um alerta destacado no dashboard finops até que o contrato seja cadastrado pelo AG-002 ou pelo operador comercial (AG-007).
- **Ação Recomendada:** Manter o comportamento estrito atual (garante integridade auditável).

---

## 2. MATRIZ DE RISCOS PARA A RELEASE V1.6 (S6-07)

| Risco Técnico / Operacional | Probabilidade | Impacto | Contramedida de Mitigação |
| :--- | :---: | :---: | :--- |
| **Falha na aplicação das Migrations 0008 a 0011 em Produção** | Baixa | Alto | Executar script idempotente consolidado com blocos transacionais (`BEGIN...COMMIT`) e verificar integridade pré e pós-aplicação. |
| **Downtime do Docker Swarm durante a atualização de containers** | Muito Baixa | Médio | Atualização progressiva via `docker service update --image ...` com rollback automático em caso de healthcheck não responsivo. |
| **Inconsistência de Schema em chamadas de API antigas** | Baixa | Baixo | Rotas `/api/v1/metrics/finops` mantiveram retrocompatibilidade de campos enquanto as novas rotas segregadas foram introduzidas. |

---

## 3. RECOMENDAÇÃO FINAL PARA ENCERRAMENTO DA SPRINT 6

- **Recomendação Técnica:** **CONDITIONAL GO** para publicação da Release v1.6.
- **Condição Obrigatória:** Aguardar autorização expressa do Founder e aprovação do script consolidado de migração da atividade **S6-07** antes de qualquer intervenção no ambiente de produção (VPS Hostinger).
