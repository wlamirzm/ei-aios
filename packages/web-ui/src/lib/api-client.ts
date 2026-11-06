const BASE_URL = process.env.NEXT_PUBLIC_AGENT_CORE_URL || 'http://localhost:4000';

export async function fetchFinOpsMetrics() {
  const res = await fetch(`${BASE_URL}/api/v1/metrics/finops`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao buscar métricas de FinOps');
  return res.json();
}

export async function fetchWorkerStatus() {
  const res = await fetch(`${BASE_URL}/api/v1/worker/status`, { cache: 'no-store' });
  if (!res.ok) return { isRunning: false, isProcessingCycle: false, pollIntervalMs: 5000 };
  return res.json();
}

export async function triggerWorkerCycle() {
  const res = await fetch(`${BASE_URL}/api/v1/worker/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force_cycle: true })
  });
  if (!res.ok) throw new Error('Falha ao forçar ciclo do Worker');
  return res.json();
}

export async function createObjective(objective: string, priority = 'P1', clientId?: string, workflowCode?: string) {
  const res = await fetch(`${BASE_URL}/api/v1/objectives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objective, priority, client_id: clientId, workflow_code: workflowCode })
  });
  if (!res.ok) throw new Error('Falha ao registrar objetivo');
  return res.json();
}

export async function decideApproval(approvalId: string, decision: 'approved' | 'rejected', comments?: string) {
  const res = await fetch(`${BASE_URL}/api/v1/approvals/${approvalId}/decide`, {
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

  const res = await fetch(`${BASE_URL}/api/v1/energy/upload-bill`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Falha no upload da fatura');
  return res.json();
}

