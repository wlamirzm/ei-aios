// ==============================================================================
// SRE METRICS COLLECTOR UNIT TESTS (AG-017)
// ==============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SreMetricsCollector } from './sre-metrics-collector.js';

describe('SRE & Cloud Infrastructure Observability Engine (AG-017)', () => {
  test('collectTelemetrySnapshot coleta métricas de host, memória, banco e score com sucesso', async () => {
    const snapshot = await SreMetricsCollector.collectTelemetrySnapshot();

    assert.ok(snapshot.timestamp);
    assert.ok(snapshot.host.hostname);
    assert.ok(snapshot.host.totalMemoryMb > 0);
    assert.ok(snapshot.host.memoryUsagePercent >= 0 && snapshot.host.memoryUsagePercent <= 100);
    assert.ok(snapshot.healthScore >= 0 && snapshot.healthScore <= 100);
    assert.ok(['OPTIMAL', 'WARNING', 'CRITICAL'].includes(snapshot.overallVerdict));
    assert.strictEqual(typeof snapshot.worker.pendingTasksCount, 'number');
  });

  test('runAutomatedRca gera relatório estruturado de incidente e recomendações de mitigação', async () => {
    const rca = await SreMetricsCollector.runAutomatedRca({
      component: 'DatabasePool',
      errorMessage: 'Connection timeout after 5000ms',
      severity: 'P1_HIGH'
    });

    assert.ok(rca.incidentId.startsWith('INC-'));
    assert.strictEqual(rca.severity, 'P1_HIGH');
    assert.strictEqual(rca.component, 'DatabasePool');
    assert.match(rca.rootCauseAnalysis, /Connection timeout/);
    assert.ok(rca.immediateMitigationSteps.length >= 2);
    assert.ok(rca.preventionRecommendations.length >= 2);
  });
});

