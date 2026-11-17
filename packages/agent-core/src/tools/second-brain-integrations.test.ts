import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeSensitiveContent,
  chunkDocumentText,
  generatePreMeetingDossier,
  generateLinkedInDraft
} from './second-brain-integrations.js';

describe('Segundo Cérebro — Bootstrap, Agenda & LinkedIn Engine (Fase 3)', () => {
  it('sanitizeSensitiveContent mascara CPF e segredos preservando dados energéticos (kW/ANEEL)', () => {
    const raw =
      'Cliente João da Silva, CPF: 123.456.789-00, senha: supersecret123. UC 987654 com demanda contratada de 450 kW e economia ANEEL REN 1.000/2021.';

    const sanitized = sanitizeSensitiveContent(raw);

    assert.ok(!sanitized.includes('123.456.789-00'), 'CPF deve ser mascarado');
    assert.ok(!sanitized.includes('supersecret123'), 'Senha deve ser mascarada');
    assert.match(sanitized, /\[CPF_REDACTED\]/);
    assert.match(sanitized, /\[SECRET_REDACTED\]/);
    assert.match(sanitized, /450 kW/);
    assert.match(sanitized, /ANEEL REN 1\.000\/2021/);
  });

  it('chunkDocumentText gera chunks sobrepostos com checksum SHA-256 determinístico', () => {
    const longText = 'Eficiência energética industrial no Mercado Livre. '.repeat(20); // ~980 chars
    const chunksA = chunkDocumentText(longText, 300, 50);
    const chunksB = chunkDocumentText(longText, 300, 50);

    assert.ok(chunksA.length >= 3);
    assert.equal(chunksA[0]?.checksum.length, 64);
    assert.equal(chunksA[0]?.checksum, chunksB[0]?.checksum);
  });

  it('generatePreMeetingDossier gera roteiro estratégico com heurísticas do fundador', async () => {
    const result = await generatePreMeetingDossier({
      title: 'Alinhamento Tarifário Grupo A4',
      companyName: 'Metalúrgica Alfa',
      participantEmail: 'diretor@alfa.com.br',
      startTime: '2026-11-18T14:00:00-03:00'
    });

    assert.match(result.dossierMarkdown, /DOSSIÊ PRÉ-REUNIÃO/);
    assert.match(result.dossierMarkdown, /Metalúrgica Alfa/);
    assert.match(result.dossierMarkdown, /Success Fee/);
    assert.equal(typeof result.precedentsFound, 'number');
  });

  it('generateLinkedInDraft gera post consultivo exigindo aprovação explícita (HITL)', async () => {
    const result = await generateLinkedInDraft({
      topic: 'Redução de multa de ultrapassagem de demanda em indústrias',
      targetAudience: 'CFOs Industriais'
    });

    assert.equal(result.requiresExplicitApproval, true);
    assert.match(result.draftText, /REN ANEEL 1\.000\/2021/);
    assert.ok(result.approvalProbability >= 0 && result.approvalProbability <= 1);
  });
});
