// ==============================================================================
// TEST SUITE — WEB INTELLIGENCE, PROSPECTING & COMPETITIVE ENGINE (AG-002 & AG-007)
// Unit tests for search providers, scrape engine, ICP scorer, and executors wiring
// ==============================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AgentId, PriorityLevel, ActionRiskLevel, TaskStatus, TaskModel } from '@ei-aios/shared';
import {
  MockWebSearchProvider,
  LiveWebSearchProvider,
  isValidCnpj,
  formatCnpj,
  sanitizeHtmlToText,
  extractEmails,
  extractPhones,
  extractCnpjs,
  extractSocialLinks,
  extractDecisionMakers,
  scrapePage,
  calculateIcpFitScore,
  runMarketIntelligenceAudit,
  runProspectIntelligenceDossier
} from './web-intelligence.js';
import { DEFAULT_AGENT_REGISTRY } from '../agents/registry.js';
import { executeAgentTask } from '../agents/executors.js';
import { llmService } from '../config/llm.js';

describe('Web Intelligence — Search Providers & Fallback (BKL-WEB-001)', () => {
  it('MockWebSearchProvider: encontra resultados conhecidos para competidores e termos elétricos', async () => {
    const provider = new MockWebSearchProvider();
    const clarkeResults = await provider.search('Clarke Energia Mercado Livre');
    assert.ok(clarkeResults.length > 0, 'Deve retornar ao menos 1 resultado para Clarke');
    assert.match(clarkeResults[0]!.title, /Clarke Energia/i);
    assert.equal(clarkeResults[0]!.domain, 'clarke.com.br');

    const aneelResults = await provider.search('ANEEL Resolução Normativa 1000');
    assert.ok(aneelResults.length > 0, 'Deve retornar resultado de normas ANEEL');
    assert.match(aneelResults[0]!.title, /ANEEL/i);
  });

  it('MockWebSearchProvider: gera fallback sintético determinístico para consultas sem match', async () => {
    const provider = new MockWebSearchProvider();
    const results = await provider.search('TermoInexistenteXYZ123');
    assert.equal(results.length, 1);
    assert.ok(results[0]!.title.includes('TermoInexistenteXYZ123'));
    assert.ok(results[0]!.url.startsWith('https://'));
  });

  it('LiveWebSearchProvider: fallback seguro para mock quando endpoint não configurado ou em falha', async () => {
    const liveProvider = new LiveWebSearchProvider('https://httpstat.us/500');
    const results = await liveProvider.search('Comerc Energia');
    assert.ok(results.length > 0, 'Deve retornar fallback gracefully');
    assert.match(results[0]!.title, /Comerc/i);
  });
});

describe('Web Intelligence — Scrape & Data Extraction Engine (BKL-WEB-002)', () => {
  it('isValidCnpj: valida dígitos verificadores oficiais e rejeita CNPJs inválidos ou repetidos', () => {
    // Válidos
    assert.equal(isValidCnpj('11.222.333/0001-81'), true);
    assert.equal(isValidCnpj('00.000.000/0001-91'), true);
    assert.equal(isValidCnpj('11222333000181'), true);

    // Inválidos
    assert.equal(isValidCnpj('11.222.333/0001-99'), false);
    assert.equal(isValidCnpj('00.000.000/0000-00'), false);
    assert.equal(isValidCnpj('11.111.111/1111-11'), false);
    assert.equal(isValidCnpj('12345'), false);

    assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81');
  });

  it('sanitizeHtmlToText: remove tags de estilo, script, svg, navegação e decodifica entidades', () => {
    const html = `
      <html>
        <head>
          <title>Rede Varejista Teste</title>
          <script>console.log("malicious");</script>
          <style>body { color: red; }</style>
        </head>
        <body>
          <nav><a href="#">Menu</a></nav>
          <h1>Supermercado Pão &amp; Mel &lt;A4&gt;</h1>
          <p>Consumidor atendido pela CEMIG em média tensão.</p>
          <!-- Comentário interno -->
        </body>
      </html>
    `;
    const cleaned = sanitizeHtmlToText(html);
    assert.ok(!cleaned.includes('console.log'));
    assert.ok(!cleaned.includes('color: red'));
    assert.ok(!cleaned.includes('<script>'));
    assert.ok(!cleaned.includes('<!--'));
    assert.ok(cleaned.includes('Supermercado Pão & Mel <A4>'));
    assert.ok(cleaned.includes('atendido pela CEMIG'));
  });

  it('extractEmails, extractPhones e extractCnpjs: extraem dados de contato corporativo e higienizam', () => {
    const sampleText = `
      Entre em contato com nossa diretoria comercial:
      E-mail: contato@supermercadosalvorada.com.br e financeiro@empresa.com.br.
      Ignorar: logo@empresa.com.br/icon.png e fake@example.com
      Telefones: (31) 3244-5500 e WhatsApp (31) 98765-4321
      CNPJ Matriz: 11.222.333/0001-81 e filial com erro 11.222.333/0001-00.
    `;

    const emails = extractEmails(sampleText);
    assert.ok(emails.includes('contato@supermercadosalvorada.com.br'));
    assert.ok(emails.includes('financeiro@empresa.com.br'));
    assert.ok(!emails.some(e => e.includes('.png')));
    assert.ok(!emails.some(e => e.includes('example.com')));

    const phones = extractPhones(sampleText);
    assert.ok(phones.some(p => p.includes('(31) 3244-5500')));
    assert.ok(phones.some(p => p.includes('(31) 98765-4321')));

    const cnpjs = extractCnpjs(sampleText);
    assert.equal(cnpjs.length, 1);
    assert.equal(cnpjs[0], '11.222.333/0001-81');
  });

  it('extractSocialLinks e extractDecisionMakers: identifica decisores e perfis sociais', () => {
    const html = `
      <div>
        <p>Carlos Silva - Diretor de Operações</p>
        <p>Mariana Souza — Gerente de Facilities</p>
        <a href="https://linkedin.com/company/supermercado-alvorada">LinkedIn</a>
        <a href="https://instagram.com/superalvorada">Instagram</a>
      </div>
    `;

    const socials = extractSocialLinks(html);
    assert.ok(socials.some(s => s.includes('linkedin.com/company/supermercado-alvorada')));
    assert.ok(socials.some(s => s.includes('instagram.com/superalvorada')));

    const text = sanitizeHtmlToText(html);
    const decisionMakers = extractDecisionMakers(text);
    assert.ok(decisionMakers.some(dm => dm.role === 'Diretor de Operações'));
    assert.ok(decisionMakers.some(dm => dm.role === 'Gerente de Facilities'));
  });

  it('scrapePage: processa mock HTML completo e estrutura ScrapedPageData', async () => {
    const mockHtml = `
      <html>
        <head>
          <title>Frigorífico Vale do Sol - Indústria de Alimentos</title>
          <meta name="description" content="Especialistas em processamento de carnes com 4 plantas industriais." />
        </head>
        <body>
          <h1>Frigorífico Vale do Sol</h1>
          <p>Atendimento: contato@valedosol.ind.br | Tel: (19) 3812-4000</p>
          <p>CNPJ: 11.222.333/0001-81</p>
          <p>Diretoria: Roberto Mendes - Gerente Industrial</p>
        </body>
      </html>
    `;

    const page = await scrapePage('https://valedosol.ind.br', { mockHtml });
    assert.equal(page.title, 'Frigorífico Vale do Sol - Indústria de Alimentos');
    assert.ok(page.metaDescription?.includes('processamento de carnes'));
    assert.ok(page.extractedEmails.includes('contato@valedosol.ind.br'));
    assert.ok(page.extractedPhones.some(p => p.includes('(19) 3812-4000')));
    assert.ok(page.extractedCnpjs.includes('11.222.333/0001-81'));
  });
});

describe('Web Intelligence — Deterministic ICP Fit Scorer (BKL-WEB-003)', () => {
  it('Score 100 (TIER_1): Setor eletrointensivo + Grupo A4 + Multiunidade (>=2) + Concessionária alvo (CEMIG)', () => {
    const result = calculateIcpFitScore({
      sector: 'Supermercado e Varejo de Alimentos',
      targetSubgroup: 'A4',
      contractedDemandKw: 150,
      estimatedUnitsCount: 5,
      distributor: 'CEMIG'
    });

    assert.equal(result.icpFitScore, 100);
    assert.equal(result.qualificationGrade, 'TIER_1');
    assert.equal(result.scoreBreakdown.electroIntensiveSectorScore, 30);
    assert.equal(result.scoreBreakdown.subgroupAndDemandScore, 25);
    assert.equal(result.scoreBreakdown.multiUnitPresenceScore, 25);
    assert.equal(result.scoreBreakdown.distributorAlignmentScore, 20);
    assert.match(result.recommendedOutreachAngle, /Mercado Livre de Energia \(ACL\)/i);
  });

  it('Score 75 (TIER_2): Hospital + A4 + Concessionária alvo (CPFL) + Unidade única', () => {
    const result = calculateIcpFitScore({
      sector: 'Hospital e Serviços Médicos',
      targetSubgroup: 'A4',
      contractedDemandKw: 350,
      estimatedUnitsCount: 1,
      distributor: 'CPFL Paulista'
    });

    assert.equal(result.icpFitScore, 75);
    assert.equal(result.qualificationGrade, 'TIER_2');
    assert.equal(result.scoreBreakdown.multiUnitPresenceScore, 0);
    assert.match(result.recommendedOutreachAngle, /Adequação de Demanda/i);
  });

  it('Score 50 (TIER_3): Rede de consultórios + Multiunidade + A4 em distribuidora secundária', () => {
    const result = calculateIcpFitScore({
      sector: 'Consultoria e Escritórios de Advocacia',
      targetSubgroup: 'A4',
      estimatedUnitsCount: 3,
      distributor: 'Distribuidora Regional Rural X'
    });

    assert.equal(result.icpFitScore, 50);
    assert.equal(result.qualificationGrade, 'TIER_3');
    assert.equal(result.scoreBreakdown.electroIntensiveSectorScore, 0);
    assert.equal(result.scoreBreakdown.distributorAlignmentScore, 0);
  });

  it('Score < 40 (DISQUALIFIED): Comércio pequeno Grupo B sem alta tensão e unidade única', () => {
    const result = calculateIcpFitScore({
      sector: 'Papelaria de Bairro',
      targetSubgroup: 'B_OPTANTE',
      contractedDemandKw: 10,
      estimatedUnitsCount: 1,
      distributor: 'Local'
    });

    assert.ok(result.icpFitScore < 40);
    assert.equal(result.qualificationGrade, 'DISQUALIFIED');
    assert.match(result.recommendedOutreachAngle, /baixa aderência/i);
  });
});

describe('Web Intelligence — Orchestrators & Dossiers (BKL-WEB-004)', () => {
  it('runMarketIntelligenceAudit: gera dossiê de inteligência e benchmarking de concorrentes para AG-002', async () => {
    const dossier = await runMarketIntelligenceAudit({
      query: 'Mercado Livre de Energia PMEs Grupo A4',
      sector: 'Supermercados e Frigoríficos',
      competitors: ['Clarke Energia', 'Comerc Energia']
    });

    assert.equal(dossier.topic, 'Mercado Livre de Energia PMEs Grupo A4');
    assert.ok(dossier.topSources.length > 0);
    assert.ok(dossier.competitors.length >= 2);
    assert.ok(dossier.competitors.some(c => c.competitorName === 'Clarke Energia'));
    assert.ok(dossier.competitors.some(c => c.competitorName === 'Comerc Energia'));
    assert.ok(dossier.sectoralTrends.some(t => t.includes('Portaria 50/2022')));
    assert.ok(dossier.regulatorySignals.some(s => s.includes('Resolução Normativa ANEEL nº 1.000/2021')));
    assert.ok(dossier.strategicRecommendations.some(r => r.includes('Success Fee')));
  });

  it('runProspectIntelligenceDossier: gera perfil de prospect enriquecido com ICP score e pain points para AG-007', async () => {
    const mockHtml = `
      <html>
        <head><title>Supermercados Alvorada Ltda</title></head>
        <body>
          <p>Rede com 8 filiais no sul de Minas atendidas pela CEMIG.</p>
          <p>Contato: compras@alvorada.com.br | Tel: (35) 3421-1234</p>
          <p>CNPJ: 11.222.333/0001-81</p>
          <p>Marcos Santos - Diretor de Operações</p>
        </body>
      </html>
    `;

    const prospect = await runProspectIntelligenceDossier({
      companyName: 'Supermercados Alvorada Ltda',
      domain: 'alvorada.com.br',
      sector: 'Supermercado e Varejo',
      distributor: 'CEMIG',
      estimatedUnitsCount: 8,
      targetSubgroup: 'A4',
      mockHtml
    });

    assert.equal(prospect.companyName, 'Supermercados Alvorada Ltda');
    assert.equal(prospect.cnpj, '11.222.333/0001-81');
    assert.equal(prospect.targetSubgroup, 'A4');
    assert.equal(prospect.estimatedUnitsCount, 8);
    assert.equal(prospect.qualificationGrade, 'TIER_1');
    assert.equal(prospect.icpFitScore, 100);
    assert.ok(prospect.energyPainPoints.some(p => p.includes('ultrapassagem de demanda')));
    assert.ok(prospect.decisionMakers.some(dm => dm.role === 'Diretor de Operações'));
  });
});

function makeTask(overrides: Partial<TaskModel> = {}): TaskModel {
  return {
    id: 'task-test-' + Math.random().toString(36).substring(2, 9),
    task_code: 'TSK-TEST-001',
    created_by: 'system',
    assigned_agent_id: AgentId.AG_002,
    objective: 'Test task',
    task_type: 'market_intelligence',
    priority: PriorityLevel.P1,
    status: TaskStatus.PENDING,
    risk_level: ActionRiskLevel.LEVEL_0_AUTO,
    dependencies: [],
    retry_count: 0,
    max_retries: 3,
    input_payload: {},
    expected_output: {},
    requires_approval: false,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

describe('Web Intelligence — Agent Registry & Executors Integration (BKL-WEB-005)', () => {
  let originalLlm: any;

  before(() => {
    originalLlm = llmService.generateStructuredContent;
    llmService.generateStructuredContent = (async () => ({
      runId: 'mock-test-run',
      data: {
        deliverable_title: 'Dossiê Estratégico e Comercial de Teste',
        executive_summary_markdown: '## 1. Sumário Executivo\nAnálise de inteligência validada.',
        recommended_actions: ['Iniciar contato comercial'],
        assumptions: ['Dados validados'],
        limitations: ['Sem restrições']
      },
      rawText: '{}',
      inputTokens: 100,
      outputTokens: 50,
      executionTimeMs: 15,
      costEstimateUsd: 0.0001,
      modelUsed: 'mock-model',
      providerUsed: 'mock'
    } as any)) as any;
  });

  after(() => {
    llmService.generateStructuredContent = originalLlm;
  });

  it('DEFAULT_AGENT_REGISTRY: AG-002 e AG-007 possuem ferramentas de inteligência web registradas', () => {
    const ag002 = DEFAULT_AGENT_REGISTRY[AgentId.AG_002];
    assert.ok(ag002.tools.includes('web_search'), 'AG-002 deve incluir web_search');
    assert.ok(ag002.tools.includes('competitor_benchmarker'), 'AG-002 deve incluir competitor_benchmarker');

    const ag007 = DEFAULT_AGENT_REGISTRY[AgentId.AG_007];
    assert.ok(ag007.tools.includes('web_prospector'), 'AG-007 deve incluir web_prospector');
    assert.ok(ag007.tools.includes('domain_enricher'), 'AG-007 deve incluir domain_enricher');
    assert.ok(ag007.tools.includes('icp_scorer'), 'AG-007 deve incluir icp_scorer');
  });

  it('executeAgentTask: AG-002 injeta deterministic_market_intelligence no deterministicContext', async () => {
    const task = makeTask({
      id: 'task-test-ag002-web',
      task_code: 'TSK-MKT-001',
      task_type: 'market_intelligence',
      assigned_agent_id: AgentId.AG_002,
      objective: 'Realizar benchmarking competitivo de fornecedores no Mercado Livre Grupo A4',
      input_payload: {
        market_query: 'Mercado Livre A4',
        sector: 'Supermercados',
        competitors: ['Clarke Energia', 'Comerc Energia']
      }
    });

    const result = await executeAgentTask(task);
    assert.ok(result.deterministicData?.deterministic_market_intelligence, 'Deve conter deterministic_market_intelligence');
    const intel = result.deterministicData.deterministic_market_intelligence;
    assert.ok(intel.competitors.length >= 2);
    assert.ok(intel.topSources.length > 0);
  });

  it('executeAgentTask: AG-007 injeta deterministic_prospect_intelligence no deterministicContext', async () => {
    const task = makeTask({
      id: 'task-test-ag007-web',
      task_code: 'TSK-SLS-001',
      task_type: 'prospect_qualification',
      assigned_agent_id: AgentId.AG_007,
      objective: 'Qualificar e enriquecer prospect industrial para proposta comercial',
      input_payload: {
        company_name: 'Frigorífico Sul Mineiro',
        domain: 'frigorificosulmineiro.com.br',
        sector: 'Frigorífico e Carnes',
        distributor: 'CEMIG',
        estimated_units_count: 3,
        target_subgroup: 'A4'
      }
    });

    const result = await executeAgentTask(task);
    assert.ok(result.deterministicData?.deterministic_prospect_intelligence, 'Deve conter deterministic_prospect_intelligence');
    const prospect = result.deterministicData.deterministic_prospect_intelligence;
    assert.equal(prospect.companyName, 'Frigorífico Sul Mineiro');
    assert.equal(prospect.qualificationGrade, 'TIER_1');
    assert.equal(prospect.icpFitScore, 100);
  });
});
