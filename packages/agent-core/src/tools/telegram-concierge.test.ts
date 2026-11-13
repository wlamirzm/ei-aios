// ==============================================================================
// TELEGRAM CONCIERGE & HITL GATEWAY UNIT TESTS
// ==============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { TelegramConciergeService } from './telegram-concierge.js';

describe('Telegram Concierge & HITL Gateway (AG-016)', () => {
  test('Instanciação e verificação de configuração de token e chat id', () => {
    const service = new TelegramConciergeService();
    // Em ambiente de teste sem .env configurado, deve retornar false com segurança
    assert.strictEqual(typeof service.isConfigured(), 'boolean');
  });

  test('handleIncomingTextMessage rejeita remetentes não autorizados quando adminChatId está definido', async () => {
    const service = new TelegramConciergeService();
    (service as any).adminChatId = '123456789';

    const response = await service.handleIncomingTextMessage('999999999', 'Listar tarefas');
    assert.match(response, /Acesso restrito/);
  });

  test('handleIncomingTextMessage processa comando /status para o fundador autorizado', async () => {
    const service = new TelegramConciergeService();
    (service as any).adminChatId = '123456789';

    const response = await service.handleIncomingTextMessage('123456789', '/status');
    assert.match(response, /STATUS DO SISTEMA EI-AIOS/);
    assert.match(response, /Autonomous Worker/);
  });

  test('handleIncomingTextMessage processa comando /kpis para o fundador autorizado', async () => {
    const service = new TelegramConciergeService();
    (service as any).adminChatId = '123456789';

    const response = await service.handleIncomingTextMessage('123456789', '/kpis');
    assert.match(response, /FINOPS & METRICAS EXECUTIVAS/);
  });

  test('handleCallbackQuery bloqueia ações de remetentes não autorizados', async () => {
    const service = new TelegramConciergeService();
    (service as any).adminChatId = '123456789';

    const callbackQuery = {
      id: 'cb-1',
      from: { id: 888888, first_name: 'Intruso' },
      data: 'approve:task-123'
    };

    const response = await service.handleCallbackQuery(callbackQuery);
    assert.match(response, /Não autorizado/);
  });
});

