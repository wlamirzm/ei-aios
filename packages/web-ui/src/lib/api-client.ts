function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_AGENT_CORE_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }
    const rootDomain = host.replace(/^app\./, '');
    return `${window.location.protocol}//api.${rootDomain}`;
  }

  return envUrl || 'https://api.eiaios.atendezen.com.br';
}

function getAuthHeaders(includeJsonContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_API_TOKEN || 'ei-aios-founder-sovereign-v1';
  headers['X-EI-Admin-Token'] = adminToken;

  if (typeof window !== 'undefined') {
    const storedJwt = window.localStorage.getItem('eiaios_founder_token');
    if (storedJwt) {
      headers['Authorization'] = `Bearer ${storedJwt}`;
    }
  }
  return headers;
}

export async function loginFounder(email: string, password: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Credenciais inválidas');
  }
  if (typeof window !== 'undefined' && data?.token) {
    window.localStorage.setItem('eiaios_founder_token', data.token);
  }
  return data;
}

export async function fetchFinOpsMetrics() {
  const res = await fetch(`${getBaseUrl()}/api/v1/metrics/finops`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao buscar métricas de FinOps');
  return res.json();
}

export async function fetchDashboardOverview(competence?: string, tenantId?: string) {
  const query = new URLSearchParams();
  if (competence) query.set('competence', competence);
  if (tenantId) query.set('tenant_id', tenantId);
  const qStr = query.toString();
  const url = `${getBaseUrl()}/api/v1/finops/dashboard/overview${qStr ? `?${qStr}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders(false), cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao buscar visão executiva do dashboard');
  return res.json();
}

export async function fetchCostUsageData(params?: {
  agentId?: string;
  modelName?: string;
  clientId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.agentId) query.set('agent_id', params.agentId);
  if (params?.modelName) query.set('model_name', params.modelName);
  if (params?.clientId) query.set('client_id', params.clientId);
  if (params?.category) query.set('category', params.category);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qStr = query.toString();
  const url = `${getBaseUrl()}/api/v1/finops/dashboard/cost-usage${qStr ? `?${qStr}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders(false), cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao buscar detalhamento de custos e uso');
  return res.json();
}

export async function fetchWorkerStatus() {
  const res = await fetch(`${getBaseUrl()}/api/v1/worker/status`, { cache: 'no-store' });
  if (!res.ok) return { isRunning: false, isProcessingCycle: false, pollIntervalMs: 5000 };
  return res.json();
}

export async function triggerWorkerCycle() {
  const res = await fetch(`${getBaseUrl()}/api/v1/worker/trigger`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ force_cycle: true })
  });
  if (!res.ok) throw new Error('Falha ao forçar ciclo do Worker');
  return res.json();
}

export async function createObjective(objective: string, priority = 'P1', clientId?: string, workflowCode?: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/objectives`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ objective, priority, client_id: clientId, workflow_code: workflowCode })
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || errBody?.message || 'Falha ao registrar objetivo');
  }
  return res.json();
}

export async function decideApproval(approvalId: string, decision: 'approved' | 'rejected', comments?: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ decision, comments })
  });
  if (!res.ok) throw new Error('Falha ao registrar decisão de aprovação');
  return res.json();
}

export async function uploadEnergyBill(consumerUnitId: string, file: File) {
  const formData = new FormData();
  formData.append('consumer_unit_id', consumerUnitId);
  formData.append('file', file);

  const res = await fetch(`${getBaseUrl()}/api/v1/energy/upload-bill`, {
    method: 'POST',
    headers: getAuthHeaders(false),
    body: formData
  });
  if (!res.ok) throw new Error('Falha no upload da fatura');
  return res.json();
}

export async function chatWithAgent(agentId: string, message: string, history?: Array<{ role: 'user' | 'model'; text: string }>) {
  const res = await fetch(`${getBaseUrl()}/api/v1/agents/${agentId}/chat`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ message, history })
  });
  if (!res.ok) throw new Error('Falha ao conversar com o agente');
  return res.json();
}

export async function updateAgentConfig(
  agentId: string,
  payload: {
    system_prompt?: string;
    enabled?: boolean;
    model?: string;
    temperature?: number;
    daily_budget_usd?: number;
  }
) {
  const res = await fetch(`${getBaseUrl()}/api/v1/agents/${agentId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Falha ao salvar configuração do agente no PostgreSQL');
  return data;
}

export async function cleanDatabase() {
  const res = await fetch(`${getBaseUrl()}/api/v1/system/clean-database`, {
    method: 'POST',
    headers: getAuthHeaders(true)
  });
  if (!res.ok) throw new Error('Falha ao limpar base de dados');
  return res.json();
}

export async function fetchAgents() {
  const res = await fetch(`${getBaseUrl()}/api/v1/agents`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao listar agentes');
  return res.json();
}

export async function fetchTasks() {
  const res = await fetch(`${getBaseUrl()}/api/v1/tasks`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao listar tarefas');
  return res.json();
}

export async function fetchApprovals() {
  const res = await fetch(`${getBaseUrl()}/api/v1/approvals`, {
    cache: 'no-store',
    headers: getAuthHeaders(false)
  });
  if (!res.ok) throw new Error('Falha ao listar aprovações');
  return res.json();
}

export async function fetchArtifacts() {
  const res = await fetch(`${getBaseUrl()}/api/v1/artifacts`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao listar artefatos');
  return res.json();
}

export async function fetchLlmStatus() {
  const res = await fetch(`${getBaseUrl()}/api/v1/system/llm-status`, {
    cache: 'no-store',
    headers: getAuthHeaders(false)
  });
  if (!res.ok) return { configured: false, mode: 'deterministic_specialist_engine' };
  return res.json();
}

export async function setLlmApiKey(apiKey: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/system/llm-key`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ apiKey })
  });
  if (!res.ok) throw new Error('Falha ao atualizar chave Gemini API');
  return res.json();
}

export async function fetchEmailAccounts() {
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/accounts`, {
    cache: 'no-store',
    headers: getAuthHeaders(false)
  });
  if (!res.ok) throw new Error('Falha ao listar contas de e-mail');
  return res.json();
}

export async function createEmailAccount(payload: {
  account_label: string;
  email_address: string;
  password: string;
  imap_host?: string;
  imap_port?: number;
  smtp_host?: string;
  smtp_port?: number;
  operation_mode: 'monitor_only' | 'read_summarize' | 'assisted_action' | 'auto_action';
}) {
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/accounts`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'Falha ao cadastrar conta de e-mail');
  }
  return res.json();
}

export async function updateEmailAccount(
  id: string,
  payload: Partial<{
    operation_mode: 'monitor_only' | 'read_summarize' | 'assisted_action' | 'auto_action';
    enabled: boolean;
    account_label: string;
  }>
) {
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/accounts/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Falha ao atualizar modo da conta de e-mail');
  return res.json();
}

export async function deleteEmailAccount(id: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/accounts/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(false)
  });
  if (!res.ok) throw new Error('Falha ao excluir conta de e-mail');
  return res.json();
}

export async function syncEmailAccount(id: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/accounts/${id}/sync`, {
    method: 'POST',
    headers: getAuthHeaders(true)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Falha ao sincronizar IMAP HostGator');
  return data;
}

export async function simulateIncomingEmail(
  id: string,
  scenario: 'bill' | 'regulatory' | 'prompt_injection' | 'p0_critical' = 'bill'
) {
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/accounts/${id}/simulate`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ scenario })
  });
  if (!res.ok) throw new Error('Falha ao simular e-mail');
  return res.json();
}

export async function fetchEmailMessages(accountId?: string) {
  const q = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/messages${q}`, {
    cache: 'no-store',
    headers: getAuthHeaders(false)
  });
  if (!res.ok) throw new Error('Falha ao listar mensagens de e-mail');
  return res.json();
}

export async function executeEmailNextStep(messageId: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/emails/messages/${messageId}/execute-next-step`, {
    method: 'POST',
    headers: getAuthHeaders(true)
  });
  if (!res.ok) throw new Error('Falha ao disparar próximo passo');
  return res.json();
}
