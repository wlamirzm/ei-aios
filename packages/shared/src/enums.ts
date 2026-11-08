// ==============================================================================
// SHARED ENUMS: ENERGY INTELLIGENCE AIOS (EI-AIOS)
// ==============================================================================

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  SYNTHESIZING = 'synthesizing',
  WAITING_INPUT = 'waiting_input',
  REVIEW = 'review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum PriorityLevel {
  P0 = 'P0', // Urgente / Bloqueante
  P1 = 'P1', // Alta Prioridade (Padrão)
  P2 = 'P2', // Média
  P3 = 'P3'  // Baixa / Background
}

export enum ActionRiskLevel {
  LEVEL_0_AUTO = 'LEVEL_0_AUTO',                         // Execução autônoma permitida
  LEVEL_1_SUPERVISED = 'LEVEL_1_SUPERVISED',             // Autônomo com notificação / log auditável
  LEVEL_2_APPROVAL_REQUIRED = 'LEVEL_2_APPROVAL_REQUIRED' // Bloqueante: Requer aprovação explícita do fundador
}

export enum AgentId {
  AG_001 = 'AG-001', // CEO / AI Orchestrator
  AG_002 = 'AG-002', // Business Strategy Agent
  AG_003 = 'AG-003', // Energy Specialist Agent
  AG_004 = 'AG-004', // AI & Data Engineering Agent
  AG_005 = 'AG-005', // Software Development Agent
  AG_006 = 'AG-006', // Marketing & Growth Agent
  AG_007 = 'AG-007', // Sales Agent
  AG_008 = 'AG-008', // Quality & Risk Agent (Auditor QA)
  AG_009 = 'AG-009', // Regulatory & Tariff Intelligence Agent
  AG_010 = 'AG-010', // Customer Onboarding & M&V Agent
  AG_011 = 'AG-011', // Startup CFO & Unit Economics Agent
  AG_012 = 'AG-012'  // Email & Next-Step Intelligence Agent (HostGator cPanel IMAP/SMTP)
}

export enum WorkflowCode {
  WF_001 = 'WF-001', // Planejamento Estratégico e Técnico de Projeto
  WF_002 = 'WF-002', // Desenvolvimento Assistido de Funcionalidade
  WF_003 = 'WF-003', // Diagnóstico Energético Automatizado (Core Product)
  WF_004 = 'WF-004', // Máquina de Campanha Comercial e Geração de Demanda
  WF_005 = 'WF-005', // Discovery de Clientes & Geração de Carta de Intenção (Fase 0)
  WF_006 = 'WF-006', // Ingestão Zero-Touch de Faturas (n8n Webhook)
  WF_007 = 'WF-007', // Dossiê de Contestação e Restituição Tarifária (REN 1.000/2021)
  WF_008 = 'WF-008'  // Fechamento Mensal de Economia Verificada (M&V e Cobrança)
}

export enum TariffGroup {
  A2 = 'A2',
  A3 = 'A3',
  A3a = 'A3a',
  A4 = 'A4',
  B1 = 'B1',
  B2 = 'B2',
  B3 = 'B3'
}

export enum TariffModality {
  HOROSSAZONAL_VERDE = 'HOROSSAZONAL_VERDE',
  HOROSSAZONAL_AZUL = 'HOROSSAZONAL_AZUL',
  CONVENCIONAL = 'CONVENCIONAL',
  BRANCA = 'BRANCA'
}

export enum TariffFlag {
  VERDE = 'VERDE',
  AMARELA = 'AMARELA',
  VERMELHA_P1 = 'VERMELHA_P1',
  VERMELHA_P2 = 'VERMELHA_P2',
  ESCASSEZ_HIDRICA = 'ESCASSEZ_HIDRICA'
}

export enum ArtifactType {
  ENERGY_DIAGNOSIS = 'energy_diagnosis',
  CONTEST_DOSSIER = 'contest_dossier',
  MV_REPORT = 'mv_report',
  COMMERCIAL_PROPOSAL = 'commercial_proposal',
  SWOT = 'swot',
  STRATEGIC_PLAN = 'strategic_plan',
  CODE_SPEC = 'code_spec'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum ApprovalType {
  CONTRACT_RECOMMENDATION = 'contract_recommendation',
  EXTERNAL_DELIVERY = 'external_delivery',
  DEPLOY = 'deploy',
  FINANCIAL_DECISION = 'financial_decision',
  OFFICIAL_TECHNICAL_REPORT = 'official_technical_report',
  LEGAL_PETITION_DELIVERY = 'legal_petition_delivery'
}

export enum ClientStage {
  LEAD = 'lead',
  PILOT_LOI = 'pilot_loi',
  ACTIVE_SAAS = 'active_saas',
  CHURNED = 'churned'
}

