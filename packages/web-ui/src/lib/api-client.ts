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

export async function fetchFinOpsMetrics() {
  const res = await fetch(`${getBaseUrl()}/api/v1/metrics/finops`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao buscar métricas de FinOps');
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force_cycle: true })
  });
  if (!res.ok) throw new Error('Falha ao forçar ciclo do Worker');
  return res.json();
}

export async function createObjective(objective: string, priority = 'P1', clientId?: string, workflowCode?: string) {
  const res = await fetch(`${getBaseUrl()}/api/v1/objectives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    body: formData
  });
  if (!res.ok) throw new Error('Falha no upload da fatura');
  return res.json();
}

export async function chatWithAgent(agentId: string, message: string, history?: Array<{ role: 'user' | 'model'; text: string }>) {
  const res = await fetch(`${getBaseUrl()}/api/v1/agents/${agentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });
  if (!res.ok) throw new Error('Falha ao conversar com o agente');
  return res.json();
}

export async function cleanDatabase() {
  const res = await fetch(`${getBaseUrl()}/api/v1/system/clean-database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
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
  const res = await fetch(`${getBaseUrl()}/api/v1/approvals`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao listar aprovações');
  return res.json();
}

export async function fetchArtifacts() {
  const res = await fetch(`${getBaseUrl()}/api/v1/artifacts`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao listar artefatos');
  return res.json();
}
