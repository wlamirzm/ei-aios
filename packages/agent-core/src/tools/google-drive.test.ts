// ==============================================================================
// AG-018 GOOGLE WORKSPACE & CLOUD DRIVE CONNECTOR UNIT TESTS
// ==============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  getDriveStatus,
  searchDriveFiles,
  uploadDriveReport,
  getDriveOAuthAuthorizeUrl,
  DEFAULT_OAUTH_CLIENT_ID
} from './google-drive.js';

describe('Google Workspace & Cloud Drive Tool (AG-018)', () => {
  test('Retorna status com cliente OAuth 2.0 configurado por padrão', async () => {
    const status = await getDriveStatus();
    assert.strictEqual(typeof status.configured, 'boolean');
    assert.strictEqual(status.configured, true);
    assert.ok(status.clientId);
  });

  test('getDriveOAuthAuthorizeUrl gera URL de consentimento Google com o Client ID configurado', async () => {
    const res = await getDriveOAuthAuthorizeUrl();
    assert.strictEqual(res.clientId, DEFAULT_OAUTH_CLIENT_ID);
    assert.match(res.authUrl, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    assert.ok(res.authUrl.includes(encodeURIComponent(DEFAULT_OAUTH_CLIENT_ID)));
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
