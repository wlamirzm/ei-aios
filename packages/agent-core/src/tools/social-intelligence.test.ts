// ==============================================================================
// SOCIAL INTELLIGENCE UNIT TESTS (AG-006)
// ==============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SocialIntelligenceEngine } from './social-intelligence.js';

describe('Social Intelligence & Omnichannel Community Engine (AG-006)', () => {
  test('listenSectorTrends retorna sinais regulatórios relevantes e suporta filtro por palavra-chave', () => {
    const allSignals = SocialIntelligenceEngine.listenSectorTrends();
    assert.ok(allSignals.length >= 3);
    assert.ok(allSignals[0]!.headline);
    assert.ok(allSignals[0]!.actionableAngleForEnergyIntelligence);

    const filteredSignals = SocialIntelligenceEngine.listenSectorTrends('bandeiras');
    assert.ok(filteredSignals.length >= 1);
    assert.match(filteredSignals[0]!.headline, /Bandeiras/i);
  });

  test('craftLinkedInPost gera postagem corporativa com hook, body, hashtags e governança Nível 2', () => {
    const post = SocialIntelligenceEngine.craftLinkedInPost({
      topic: 'Otimização de Custos de Energia',
      targetAudience: 'CFOs e Diretores Industriais',
      caseStudySavingsBrl: 180000,
      format: 'standard'
    });

    assert.strictEqual(post.network, 'linkedin');
    assert.match(post.bodyText, /180\.000,00/);
    assert.match(post.bodyText, /ANEEL/);
    assert.ok(post.suggestedHashtags.includes('#EficienciaEnergetica'));
    assert.strictEqual(post.requiresFounderApproval, true);
    assert.strictEqual(post.complianceChecked, true);
  });

  test('craftLinkedInPost gera carrossel estruturado de 5 slides quando format=carousel', () => {
    const post = SocialIntelligenceEngine.craftLinkedInPost({
      topic: 'Desperdício na Conta de Energia',
      caseStudySavingsBrl: 125000,
      format: 'carousel'
    });

    assert.ok(post.carouselSlides);
    assert.strictEqual(post.carouselSlides!.length, 5);
    assert.strictEqual(post.carouselSlides![0]!.slideNumber, 1);
    assert.match(post.carouselSlides![3]!.keyMetric!, /125\.000/);
  });

  test('analyzeCommentAndDraftReply classifica lead quente e gera resposta consultiva', () => {
    const result = SocialIntelligenceEngine.analyzeCommentAndDraftReply({
      commentText: 'Gostei muito da explicação! Como funciona para a minha empresa solicitar uma proposta?'
    });

    assert.strictEqual(result.sentiment, 'LEAD_INTENT');
    assert.strictEqual(result.isLeadOpportunity, true);
    assert.ok(result.leadIntentScore >= 90);
    assert.match(result.draftedConsultativeReply, /pré-diagnóstico sem compromisso/);
    assert.strictEqual(result.requiresFounderApproval, true);
  });

  test('analyzeCommentAndDraftReply trata dúvidas técnicas com embasamento ANEEL', () => {
    const result = SocialIntelligenceEngine.analyzeCommentAndDraftReply({
      commentText: 'Qual artigo da ANEEL trata da tolerância de ultrapassagem de demanda no Grupo A?'
    });

    assert.strictEqual(result.sentiment, 'TECHNICAL_QUESTION');
    assert.strictEqual(result.isLeadOpportunity, true);
    assert.match(result.draftedConsultativeReply, /1\.000\/2021/);
  });

  test('analyzeCommentAndDraftReply responde a céticos com autoridade de Success Fee', () => {
    const result = SocialIntelligenceEngine.analyzeCommentAndDraftReply({
      commentText: 'Duvido que consigam economizar isso tudo, parece só mais uma propaganda.'
    });

    assert.strictEqual(result.sentiment, 'SKEPTICAL');
    assert.match(result.draftedConsultativeReply, /Success Fee/);
  });
});
