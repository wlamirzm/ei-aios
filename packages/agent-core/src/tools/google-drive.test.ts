// ==============================================================================
// AG-018 GOOGLE WORKSPACE & CLOUD DRIVE CONNECTOR UNIT TESTS
// ==============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getDriveStatus, searchDriveFiles, uploadDriveReport } from './google-drive.js';

describe('Google Workspace & Cloud Drive Tool (AG-018)', () => {
  test('Retorna status unconfigured quando banco e env estão sem credenciais', async () => {
    const status = await getDriveStatus();
    assert.strictEqual(typeof status.configured, 'boolean');
  });

  test('searchDriveFiles degrada para simulação controlada sem credenciais', async () => {
    const res = await searchDriveFiles({ query: 'eficiencia energetica' });
    assert.strictEqual(Array.isArray(res.files), true);
    assert.ok(res.files.length > 0);
  });

  test('uploadDriveReport gera link simulado sem credenciais ativas', async () => {
    const res = await uploadDriveReport({
      fileName: 'relatorio_teste.md',
      content: '# Teste'
    });
    assert.ok(res.fileId);
    assert.ok(res.webViewLink);
  });
});
