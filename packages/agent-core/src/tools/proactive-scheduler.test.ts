import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWithinQuietHours,
  canDispatchTelegramPush,
  proactiveScheduler
} from './proactive-scheduler.js';

describe('Segundo Cérebro — Proactive Scheduler & Anti-Spam (Fase 2)', () => {
  it('isWithinQuietHours identifica corretamente janelas de silêncio noturnas em BRT', () => {
    const night = new Date('2026-11-17T22:30:00-03:00');
    const dawn = new Date('2026-11-17T03:15:00-03:00');
    const morning = new Date('2026-11-17T10:00:00-03:00');

    assert.equal(isWithinQuietHours(night, '21:00', '07:30'), true);
    assert.equal(isWithinQuietHours(dawn, '21:00', '07:30'), true);
    assert.equal(isWithinQuietHours(morning, '21:00', '07:30'), false);
  });

  it('canDispatchTelegramPush bloqueia P1/P2 em quiet hours e no teto diário, mas libera emergências P0', () => {
    assert.equal(
      canDispatchTelegramPush({ priority: 'P1', dailyPushCount: 0, maxDailyPushes: 5, isQuietHours: true }),
      false
    );
    assert.equal(
      canDispatchTelegramPush({ priority: 'P2', dailyPushCount: 5, maxDailyPushes: 5, isQuietHours: false }),
      false
    );
    assert.equal(
      canDispatchTelegramPush({ priority: 'P1', dailyPushCount: 2, maxDailyPushes: 5, isQuietHours: false }),
      true
    );
    assert.equal(
      canDispatchTelegramPush({ priority: 'P0', dailyPushCount: 10, maxDailyPushes: 5, isQuietHours: true }),
      true
    );
  });

  it('generateMorningBriefing retorna resumo executivo estruturado mesmo offline', async () => {
    const result = await proactiveScheduler.generateMorningBriefing({ sendTelegram: false });

    assert.match(result.briefingText, /BRIEFING MATINAL/);
    assert.match(result.briefingText, /Pulso Operacional/);
    assert.equal(typeof result.pendingTasksCount, 'number');
    assert.equal(result.sentToTelegram, false);
  });
});
