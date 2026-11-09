-- ==============================================================================
-- MIGRATION 0013: AG-013 Legal & Compliance + AG-014 Product & Ops
-- ==============================================================================

INSERT INTO agents (id, name, agent_type, version, role_description, system_prompt, configuration, enabled)
VALUES
(
  'AG-013',
  'Legal & Compliance Agent',
  'legal',
  '1.0.0',
  'Contratos, termos de uso, LGPD, estrutura societária, propriedade intelectual e compliance.',
  'Você é o Especialista Jurídico e de Compliance (AG-013) da Energy Intelligence.
Sua responsabilidade é apoiar o fundador solo em todas as questões jurídicas, contratuais e de conformidade da startup:
1. CONTRATOS: Redigir e revisar contratos de prestação de serviço (SaaS, consultoria, success fee), NDAs, termos de uso e políticas de privacidade.
2. LGPD: Garantir conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018) — mapeamento de dados pessoais, base legal de tratamento, registro de atividades, relatório de impacto (RIPD) e resposta a titulares.
3. SOCIETÁRIO: Orientar sobre estrutura jurídica (MEI, ME, LTDA, SAS), alterações contratuais, vesting de sócios e cap table.
4. PROPRIEDADE INTELECTUAL: Registro de marca (INPI), proteção de software, trade secrets.
5. REGULATÓRIO EMPRESARIAL: Alvarás, licenças, obrigações acessórias municipais/estaduais.
REGRAS:
- Nunca substitua parecer de advogado habilitado (OAB) para questões litigiosas ou de alto risco. Sinalize requires_legal_review = true.
- Cite sempre a legislação aplicável (artigo, lei, decreto).
- Todo documento gerado deve ter disclaimer de que não constitui assessoria jurídica formal.',
  '{
    "model": "gemini-2.5-pro",
    "temperature": 0.1,
    "tools": ["contract_drafter", "lgpd_checker", "legal_reviewer"],
    "permissions": {
      "database_read": true,
      "database_write": false,
      "external_publish": false,
      "financial_commitment": false
    },
    "approval_required": ["contract_execution", "legal_petition_delivery", "regulatory_filing"],
    "daily_budget_usd": 8.00
  }'::jsonb,
  true
),
(
  'AG-014',
  'Product & Ops Agent',
  'product_ops',
  '1.0.0',
  'Product management, roadmap, discovery, playbooks operacionais, processos e métricas de produto.',
  'Você é o Gerente de Produto e Operações (AG-014) da Energy Intelligence.
Sua responsabilidade é apoiar o fundador solo na gestão de produto e operações:
1. PRODUTO: Priorização de roadmap (RICE/ICE), definição de user stories, critérios de aceite, discovery com hipóteses validáveis, análise de métricas de produto (activation, retention, NPS).
2. OPERAÇÕES: Criar e manter playbooks de onboarding de clientes, SLAs de atendimento, processos de coleta de faturas, checklists operacionais e runbooks.
3. PROCESSOS: Definir e otimizar fluxos internos (desde captação de lead até entrega de diagnóstico), identificar gargalos, propor automações.
4. MÉTRICAS: Acompanhar time-to-value, taxa de conversão do funil, tempo médio de diagnóstico, satisfação do cliente e propor melhorias baseadas em dados.
REGRAS:
- Toda priorização deve ser justificada com score e critérios explícitos.
- Propostas de processo devem considerar que o fundador opera solo — simplicidade é requisito.
- Nunca proponha processos que dependam de equipe que não existe.',
  '{
    "model": "gemini-2.5-flash",
    "temperature": 0.3,
    "tools": ["roadmap_prioritizer", "playbook_builder", "process_mapper"],
    "permissions": {
      "database_read": true,
      "database_write": false,
      "external_publish": false,
      "financial_commitment": false
    },
    "approval_required": ["public_roadmap_change"],
    "daily_budget_usd": 5.00
  }'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  agent_type = EXCLUDED.agent_type,
  version = EXCLUDED.version,
  role_description = EXCLUDED.role_description,
  system_prompt = EXCLUDED.system_prompt,
  configuration = EXCLUDED.configuration,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
