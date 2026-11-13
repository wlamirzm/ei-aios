// ==============================================================================
// WEB INTELLIGENCE & MARKET PROSPECTING ENGINE (AG-002 & AG-007)
// Autonomous research, competitor benchmarking, domain enrichment and ICP scoring
// ==============================================================================

import {
  WebSearchResult,
  ScrapedPageData,
  ScrapedPageDataSchema,
  DecisionMaker,
  TargetSubgroup,
  QualificationGrade,
  ProspectProfile,
  ProspectProfileSchema,
  CompetitorProfile,
  MarketIntelligenceDossier,
  MarketIntelligenceDossierSchema
} from '@ei-aios/shared';

// ------------------------------------------------------------------------------
// 1. WEB SEARCH PROVIDER ABSTRACTION & FIXTURES
// ------------------------------------------------------------------------------

export interface IWebSearchProvider {
  search(query: string, limit?: number): Promise<WebSearchResult[]>;
}

export const KNOWN_ENERGY_COMPETITORS: CompetitorProfile[] = [
  {
    competitorName: 'Clarke Energia',
    serviceOfferings: [
      'Migração Mercado Livre PMEs',
      'Gestão energética digital em tempo real',
      'Telemetria IoT sem investimento inicial',
      'Representação na CCEE via varejista'
    ],
    targetAudience: 'PMEs do Grupo A4 com faturas entre R$ 10.000 e R$ 60.000/mês',
    pricingModel: 'Success fee sobre economia apurada ou mensalidade SaaS',
    strengths: [
      'Plataforma web/app intuitiva',
      'Onboarding simplificado para PMEs',
      'Forte captação de clientes em hubs de inovação'
    ],
    vulnerabilities: [
      'Pouco foco em engenharia física de demanda e banco de capacitores',
      'Fidelização longa associada a contratos de comercializadora parceira'
    ],
    sourceUrls: ['https://clarke.com.br', 'https://clarke.com.br/mercado-livre']
  },
  {
    competitorName: 'Comerc Energia',
    serviceOfferings: [
      'Gestão de grandes consumidores ACL',
      'Autoprodução de energia renovável',
      'Comercialização varejista em escala',
      'Certificados de sustentabilidade (I-REC)'
    ],
    targetAudience: 'Grandes indústrias, redes nacionais de varejo e Grupo A2/A3',
    pricingModel: 'Taxa fixa de gestão mensal + margem de comercialização (spread kWh)',
    strengths: [
      'Líder consolidada do Mercado Livre no Brasil',
      'Portfólio robusto de parques eólicos e solares próprios',
      'Mesa de trading de alta liquidez'
    ],
    vulnerabilities: [
      'Atendimento pouco personalizado para PMEs individuais',
      'Processos contratuais complexos e burocráticos'
    ],
    sourceUrls: ['https://comerc.com.br']
  },
  {
    competitorName: 'Órigo Energia',
    serviceOfferings: [
      'Geração Distribuída (GD) compartilhada em fazendas solares',
      'Assinatura de créditos de energia solar sem investimento',
      'Desconto garantido na fatura da distribuidora local'
    ],
    targetAudience: 'Comércio de pequeno e médio porte (Grupo B e A4 optante) e residências',
    pricingModel: 'Desconto percentual garantido de 10% a 20% sobre a tarifa de energia',
    strengths: [
      'Zero custo de infraestrutura para o cliente',
      'Ampla base de fazendas solares instaladas (CEMIG, CPFL, Enel)',
      'Aderência imediata sem necessidade de adequação de cabine'
    ],
    vulnerabilities: [
      'Não otimiza demanda contratada nem multas de reativos',
      'Não viabiliza migração para o Mercado Livre (ACL)',
      'Dependência das regras transitórias da Lei 14.300/2022'
    ],
    sourceUrls: ['https://origoenergia.com.br']
  },
  {
    competitorName: 'Raízen Power',
    serviceOfferings: [
      'Comercialização de energia renovável no ACL',
      'Geração distribuída compartilhada',
      'Mobilidade elétrica (recarga rápida Shell Recharge)',
      'Certificados I-REC de energia 100% limpa'
    ],
    targetAudience: 'Médias e grandes empresas, indústrias e frotas corporativas',
    pricingModel: 'Contratos bilaterais PPA, margem de trading e assinaturas de GD',
    strengths: [
      'Marca forte e capacidade de investimento (Joint venture Shell / Cosan)',
      'Escala global e infraestrutura de biomassa e solar'
    ],
    vulnerabilities: [
      'Menor flexibilidade para demandas customizadas de pequenas redes locais',
      'Comunicação corporativa distante da rotina de operação fabril'
    ],
    sourceUrls: ['https://raizenpower.com.br']
  },
  {
    competitorName: '2W Ecobank',
    serviceOfferings: [
      'Comercialização varejista no Mercado Livre',
      'Conta digital verde com cashback de sustentabilidade',
      'Telemetria e consultoria de eficiência energética'
    ],
    targetAudience: 'PMEs do Grupo A4, pequenos comércios e redes regionais',
    pricingModel: 'Preço fixo de energia no ACL com produtos bancários vinculados',
    strengths: [
      'Abordagem comercial agressiva focada no pequeno empresário',
      'Rede de consultores externos e parceiros locais'
    ],
    vulnerabilities: [
      'Exposição a riscos de liquidez de mercado',
      'Qualidade do suporte técnico variável dependendo do consultor credenciado'
    ],
    sourceUrls: ['https://2wecobank.com.br']
  }
];

export const STATIC_SEARCH_DATABASE: WebSearchResult[] = [
  {
    title: 'Clarke Energia — Economia de até 30% na conta de luz para empresas',
    url: 'https://clarke.com.br',
    snippet: 'A Clarke cuida de toda a migração para o Mercado Livre de energia para médias empresas do Grupo A4. Plataforma digital com telemetria 24/7 sem investimento inicial.',
    domain: 'clarke.com.br',
    publishedDate: '2024-03-01'
  },
  {
    title: 'Comerc Energia — Soluções integradas em gestão energética e descarbonização',
    url: 'https://comerc.com.br',
    snippet: 'Líder em gestão de energia no Mercado Livre brasileiro. Gestão de portfólio, migração, comercialização de energia e autoprodução para grandes indústrias e redes.',
    domain: 'comerc.com.br',
    publishedDate: '2024-02-15'
  },
  {
    title: 'Órigo Energia — Energia Solar por Assinatura sem Obras',
    url: 'https://origoenergia.com.br',
    snippet: 'Assine créditos de fazendas solares Órigo e reduza custos da sua empresa sem precisar instalar placas no telhado. Desconto garantido na fatura CEMIG, CPFL e Enel.',
    domain: 'origoenergia.com.br',
    publishedDate: '2024-04-10'
  },
  {
    title: 'Raízen Power — Energia renovável sob medida para o seu negócio',
    url: 'https://raizenpower.com.br',
    snippet: 'Soluções em comercialização de energia no ACL, geração distribuída e descarbonização com certificados de energia limpa para empresas.',
    domain: 'raizenpower.com.br',
    publishedDate: '2024-01-20'
  },
  {
    title: '2W Ecobank — Mercado Livre de Energia e Sustentabilidade para PMEs',
    url: 'https://2wecobank.com.br',
    snippet: 'Migre sua empresa para o Mercado Livre de Energia com a 2W Ecobank. Previsibilidade orçamentária e sustentabilidade para consumidores em alta tensão.',
    domain: '2wecobank.com.br',
    publishedDate: '2024-03-12'
  },
  {
    title: 'ANEEL — Abertura do Mercado Livre de Energia para o Grupo A (Portaria 50/2022)',
    url: 'https://www.aneel.gov.br/noticias-mercado-livre-a4',
    snippet: 'Desde janeiro de 2024, todos os consumidores atendidos em alta tensão (Grupo A, incluindo A4) podem escolher livremente o seu fornecedor de energia elétrica.',
    domain: 'aneel.gov.br',
    publishedDate: '2024-01-05'
  },
  {
    title: 'ANEEL — Resolução Normativa nº 1.000/2021: Regras do Setor de Distribuição',
    url: 'https://www.aneel.gov.br/resolucao-normativa-1000',
    snippet: 'Estabelece as regras de prestação do serviço público de distribuição, critérios de faturamento de demanda, ultrapassagem e energia reativa excedente.',
    domain: 'aneel.gov.br',
    publishedDate: '2023-12-01'
  },
  {
    title: 'Supermercados Alvorada Ltda — Rede Varejista Minas Gerais',
    url: 'https://supermercadosalvorada.com.br',
    snippet: 'Rede de supermercados com 12 lojas no sul de Minas Gerais atendidas pela CEMIG em média tensão Grupo A4. Contato: compras@supermercadosalvorada.com.br, Telefone: (35) 3421-8899.',
    domain: 'supermercadosalvorada.com.br',
    publishedDate: '2024-02-18'
  },
  {
    title: 'Hospital Santa Rita S/A — Excelência Médica e Infraestrutura Hospitalar',
    url: 'https://hospitalsantarita.com.br',
    snippet: 'Complexo hospitalar de alta complexidade com centro cirúrgico e UTI. Consumo contínuo em média tensão Grupo A4 com geradores de backup e demanda contratada de 450 kW.',
    domain: 'hospitalsantarita.com.br',
    publishedDate: '2024-01-10'
  }
];

export class MockWebSearchProvider implements IWebSearchProvider {
  constructor(private customFixtures: WebSearchResult[] = STATIC_SEARCH_DATABASE) {}

  async search(query: string, limit: number = 5): Promise<WebSearchResult[]> {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);

    if (tokens.length === 0) {
      return this.customFixtures.slice(0, limit);
    }

    const scored = this.customFixtures.map(item => {
      const text = `${item.title} ${item.snippet} ${item.domain}`.toLowerCase();
      let matchCount = 0;
      for (const token of tokens) {
        if (text.includes(token)) {
          matchCount += 1;
        }
      }
      return { item, matchCount };
    });

    const matches = scored
      .filter(s => s.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .map(s => s.item);

    if (matches.length > 0) {
      return matches.slice(0, limit);
    }

    // Retorna fallback sintético determinístico com base na query para nunca quebrar
    const safeDomain = tokens[0]?.replace(/[^a-z0-9]/g, '') || 'pesquisa';
    return [
      {
        title: `Informações de Mercado e Energia: ${query}`,
        url: `https://${safeDomain}-inteligencia.com.br/panorama`,
        snippet: `Análise setorial e panorama de contratação de energia elétrica para o termo: "${query}". Demanda em alta tensão e regulamentação ANEEL.`,
        domain: `${safeDomain}-inteligencia.com.br`,
        publishedDate: new Date().toISOString().split('T')[0]
      }
    ];
  }
}

export class LiveWebSearchProvider implements IWebSearchProvider {
  private fallbackProvider: MockWebSearchProvider;

  constructor(
    private endpointUrl?: string,
    private apiKey?: string,
    fallbackFixtures?: WebSearchResult[]
  ) {
    this.fallbackProvider = new MockWebSearchProvider(fallbackFixtures);
  }

  async search(query: string, limit: number = 5): Promise<WebSearchResult[]> {
    const effectiveEndpoint = this.endpointUrl || process.env.WEB_SEARCH_API_URL;
    const effectiveKey = this.apiKey || process.env.WEB_SEARCH_API_KEY;

    if (!effectiveEndpoint) {
      return this.fallbackProvider.search(query, limit);
    }

    try {
      const url = new URL(effectiveEndpoint);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(limit));

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'EnergyIntelligence-SearchBot/1.0'
      };
      if (effectiveKey) {
        headers['Authorization'] = `Bearer ${effectiveKey}`;
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        console.warn(`[WebSearchProvider] Live search returned HTTP ${response.status}, using mock fallback`);
        return this.fallbackProvider.search(query, limit);
      }

      const rawJson = (await response.json()) as any;
      const rawResults = Array.isArray(rawJson) ? rawJson : rawJson?.results || rawJson?.organic || [];

      const parsed: WebSearchResult[] = rawResults.slice(0, limit).map((r: any) => ({
        title: String(r.title || query),
        url: String(r.url || r.link || 'https://google.com'),
        snippet: String(r.snippet || r.description || ''),
        domain: String(r.domain || new URL(r.url || 'https://google.com').hostname),
        publishedDate: r.publishedDate || r.date || undefined
      }));

      return parsed.length > 0 ? parsed : this.fallbackProvider.search(query, limit);
    } catch (err: any) {
      console.warn(`[WebSearchProvider] Live search error (${err.message}), falling back to mock provider`);
      return this.fallbackProvider.search(query, limit);
    }
  }
}

// ------------------------------------------------------------------------------
// 2. SCRAPE & HTML SANITIZATION ENGINE
// ------------------------------------------------------------------------------

export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (slice: string, weights: number[]) => {
    const sum = slice
      .split('')
      .reduce((acc, digit, idx) => acc + Number(digit) * (weights[idx] ?? 0), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), w1);
  const d2 = calcDigit(digits.slice(0, 13), w2);

  const check1 = Number(digits.charAt(12));
  const check2 = Number(digits.charAt(13));

  return d1 === check1 && d2 === check2;
}

export function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function sanitizeHtmlToText(html: string): string {
  let text = html;
  // Remove script, style, svg, noscript, nav, header, footer
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  // Replace common block tags with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Normalize multiple whitespace and newlines
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n+/g, '\n\n');
  return text.trim();
}

export function extractEmails(text: string): string[] {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = text.match(emailRegex) || [];
  const set = new Set<string>();

  const forbiddenExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js'];
  const forbiddenDomains = ['w3.org', 'schema.org', 'example.com', 'domain.com', 'sentry.io'];

  for (const match of matches) {
    const lower = match.toLowerCase();
    const hasForbiddenExt = forbiddenExtensions.some(ext => lower.endsWith(ext));
    const hasForbiddenDomain = forbiddenDomains.some(d => lower.includes(d));
    if (!hasForbiddenExt && !hasForbiddenDomain) {
      set.add(lower);
    }
  }

  return Array.from(set);
}

export function extractPhones(text: string): string[] {
  // Padrão brasileiro de telefones: (XX) 9XXXX-XXXX, (XX) XXXX-XXXX, ou sem pontuação
  const phoneRegex = /(?:\+?55\s*)?(?:\(?([1-9][0-9])\)?\s*)(?:(9[0-9]{4})|([2-8][0-9]{3}))[-.\s]?([0-9]{4})/g;
  const set = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = phoneRegex.exec(text)) !== null) {
    const ddd = match[1] || '';
    const prefix = match[2] || match[3] || '';
    const suffix = match[4] || '';
    if (ddd && prefix && suffix) {
      const formatted = `(${ddd}) ${prefix}-${suffix}`;
      set.add(formatted);
    }
  }

  return Array.from(set);
}

export function extractCnpjs(text: string): string[] {
  const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
  const rawMatches = text.match(cnpjRegex) || [];
  const set = new Set<string>();

  for (const raw of rawMatches) {
    if (isValidCnpj(raw)) {
      set.add(formatCnpj(raw));
    }
  }

  return Array.from(set);
}

export function extractSocialLinks(htmlOrText: string): string[] {
  const socialRegex = /https?:\/\/(?:www\.)?(linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+|instagram\.com\/[a-zA-Z0-9_.-]+|facebook\.com\/[a-zA-Z0-9_.-]+|twitter\.com\/[a-zA-Z0-9_]+|x\.com\/[a-zA-Z0-9_]+)/gi;
  const matches = htmlOrText.match(socialRegex) || [];
  return Array.from(new Set(matches.map(m => m.toLowerCase())));
}

export function extractDecisionMakers(text: string): DecisionMaker[] {
  const results: DecisionMaker[] = [];
  const roles = [
    'Diretor de Operações',
    'Diretora de Operações',
    'Gerente de Facilities',
    'Gerente de Manutenção',
    'Gerente Industrial',
    'Diretor Financeiro',
    'Diretora Financeira',
    'CFO',
    'COO',
    'CEO',
    'Head de Energia',
    'Coordenador de Manutenção',
    'Sócio-Administrador',
    'Sócio-Diretor'
  ];

  for (const role of roles) {
    // Regex procurando "Nome Completo - Cargo" ou "Cargo: Nome" ou apenas menção de cargo
    const pattern = new RegExp(`(?:([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+){1,3})\\s*[-—–|,]\\s*)?(${role})(?:\\s*[-—–|,]\\s*([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+){1,3}))?`, 'i');
    const match = pattern.exec(text);
    if (match) {
      const name = match[1] || match[3] || undefined;
      results.push({
        role,
        name: name?.trim()
      });
    }
  }

  // Deduplica por role
  const seen = new Set<string>();
  return results.filter(dm => {
    if (seen.has(dm.role)) return false;
    seen.add(dm.role);
    return true;
  });
}

export async function scrapePage(
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number; mockHtml?: string }
): Promise<ScrapedPageData> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const maxBytes = options?.maxBytes ?? 512 * 1024; // 512 KB

  let rawHtml = options?.mockHtml;

  if (!rawHtml) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 EnergyIntelligenceBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      rawHtml = text.length > maxBytes ? text.slice(0, maxBytes) : text;
    } catch (err: any) {
      // Fallback gracioso em caso de erro de rede ou timeout
      return {
        url,
        title: `Erro ao obter página: ${url}`,
        textContent: `Não foi possível carregar a página em ${url}. Motivo: ${err.message}`,
        extractedEmails: [],
        extractedPhones: [],
        extractedCnpjs: [],
        socialLinks: []
      };
    }
  }

  // Extrai título
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(rawHtml);
  const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : 'Sem título';

  // Extrai meta description
  const metaMatch = /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i.exec(rawHtml)
    || /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i.exec(rawHtml);
  const metaDescription = metaMatch && metaMatch[1] ? metaMatch[1].trim() : undefined;

  const textContent = sanitizeHtmlToText(rawHtml);
  const extractedEmails = extractEmails(rawHtml + ' ' + textContent);
  const extractedPhones = extractPhones(rawHtml + ' ' + textContent);
  const extractedCnpjs = extractCnpjs(rawHtml + ' ' + textContent);
  const socialLinks = extractSocialLinks(rawHtml);

  return ScrapedPageDataSchema.parse({
    url,
    title,
    textContent,
    metaDescription,
    extractedEmails,
    extractedPhones,
    extractedCnpjs,
    socialLinks
  });
}

// ------------------------------------------------------------------------------
// 3. DETERMINISTIC ICP FIT SCORER (AG-007 & AG-002)
// ------------------------------------------------------------------------------

export interface IcpScoringInput {
  sector: string;
  targetSubgroup?: TargetSubgroup | string;
  contractedDemandKw?: number;
  estimatedUnitsCount?: number;
  distributor?: string;
  rawText?: string;
}

export interface IcpScoringResult {
  icpFitScore: number;
  qualificationGrade: QualificationGrade;
  scoreBreakdown: {
    electroIntensiveSectorScore: number;
    subgroupAndDemandScore: number;
    multiUnitPresenceScore: number;
    distributorAlignmentScore: number;
  };
  recommendedOutreachAngle: string;
}

const ELECTRO_INTENSIVE_KEYWORDS = [
  'supermercado',
  'frigorifico',
  'frigorífico',
  'industria',
  'indústria',
  'hospital',
  'shopping',
  'hotel',
  'panificacao',
  'panificação',
  'padaria',
  'distribuidora de alimentos',
  'centro de distribuicao',
  'centro de distribuição',
  'atacado',
  'atacadista',
  'quimica',
  'química',
  'textil',
  'têxtil',
  'laticinio',
  'laticínio',
  'mineracao',
  'mineração',
  'metalurgica',
  'metalúrgica'
];

const TARGET_DISTRIBUTORS = [
  'cemig',
  'cpfl',
  'enel',
  'light',
  'neoenergia',
  'copel',
  'equatorial',
  'energisa',
  'edp',
  'ceb'
];

export function calculateIcpFitScore(input: IcpScoringInput): IcpScoringResult {
  const sectorText = `${input.sector} ${input.rawText || ''}`.toLowerCase();
  const distributorText = `${input.distributor || ''}`.toLowerCase();
  const combinedText = `${sectorText} ${distributorText}`.toLowerCase();

  // 1. Setor eletrointensivo (+30 pontos)
  let electroIntensiveSectorScore = 0;
  const isElectroIntensive = ELECTRO_INTENSIVE_KEYWORDS.some(kw => sectorText.includes(kw));
  if (isElectroIntensive) {
    electroIntensiveSectorScore = 30;
  }

  // 2. Grupo Tarifário A4 / Demanda Contratada (+25 pontos)
  let subgroupAndDemandScore = 0;
  const highTensionSubgroups = ['A4', 'A3', 'A3a'];
  const hasSubgroupA = input.targetSubgroup && highTensionSubgroups.includes(input.targetSubgroup.toUpperCase());
  const hasHighDemand = (input.contractedDemandKw ?? 0) >= 30;
  const mentionsHighTension = combinedText.includes('alta tensão')
    || combinedText.includes('média tensão')
    || combinedText.includes('grupo a')
    || combinedText.includes('demanda contratada')
    || combinedText.includes('a4')
    || combinedText.includes('a3a');

  if (hasSubgroupA || hasHighDemand || mentionsHighTension) {
    subgroupAndDemandScore = 25;
  }

  // 3. Presença Multiunidade (+25 pontos)
  let multiUnitPresenceScore = 0;
  const unitCount = input.estimatedUnitsCount ?? 1;
  const mentionsMultiUnit = combinedText.includes('filiais')
    || combinedText.includes('lojas')
    || combinedText.includes('unidades')
    || combinedText.includes('rede de')
    || combinedText.includes('postos');

  if (unitCount >= 2 || mentionsMultiUnit) {
    multiUnitPresenceScore = 25;
  }

  // 4. Concessionária-alvo de alta densidade tarifária (+20 pontos)
  let distributorAlignmentScore = 0;
  const matchesDistributor = TARGET_DISTRIBUTORS.some(d => combinedText.includes(d));
  if (matchesDistributor) {
    distributorAlignmentScore = 20;
  }

  const totalScore = electroIntensiveSectorScore
    + subgroupAndDemandScore
    + multiUnitPresenceScore
    + distributorAlignmentScore;

  let qualificationGrade: QualificationGrade = 'DISQUALIFIED';
  if (totalScore >= 80) {
    qualificationGrade = 'TIER_1';
  } else if (totalScore >= 60) {
    qualificationGrade = 'TIER_2';
  } else if (totalScore >= 40) {
    qualificationGrade = 'TIER_3';
  }

  // Definição da abordagem comercial ideal
  let recommendedOutreachAngle = 'Diagnóstico preliminar de eficiência tarifária e redução de custos na conta de energia.';
  if (qualificationGrade === 'TIER_1') {
    recommendedOutreachAngle = 'Abordagem executiva: Migração completa para o Mercado Livre de Energia (ACL), gestão de ponta a ponta sem aporte e eliminação imediata de multas de reativo e ultrapassagem em rede multiunidades.';
  } else if (qualificationGrade === 'TIER_2') {
    recommendedOutreachAngle = 'Adequação de Demanda Contratada e enquadramento Horossazonal Verde/Azul com garantia de auditoria e compensação via GD ou Mercado Livre varejista.';
  } else if (qualificationGrade === 'TIER_3') {
    recommendedOutreachAngle = 'Auditoria preventiva de fatura de energia para detecção de cobranças indevidas de ICMS/PIS/COFINS e créditos de GD compartilhada.';
  } else {
    recommendedOutreachAngle = 'Perfil de baixa aderência ao Grupo A4/ACL. Manter em régua passiva ou direcionar para geração distribuída no Grupo B.';
  }

  return {
    icpFitScore: totalScore,
    qualificationGrade,
    scoreBreakdown: {
      electroIntensiveSectorScore,
      subgroupAndDemandScore,
      multiUnitPresenceScore,
      distributorAlignmentScore
    },
    recommendedOutreachAngle
  };
}

// ------------------------------------------------------------------------------
// 4. HIGH-LEVEL ORCHESTRATORS
// ------------------------------------------------------------------------------

export async function runMarketIntelligenceAudit(options: {
  query: string;
  sector?: string;
  competitors?: string[];
  provider?: IWebSearchProvider;
}): Promise<MarketIntelligenceDossier> {
  const provider = options.provider || new MockWebSearchProvider();
  const searchResults = await provider.search(`${options.query} ${options.sector || 'energia eletrica mercado livre'}`);

  const activeCompetitors = options.competitors && options.competitors.length > 0
    ? KNOWN_ENERGY_COMPETITORS.filter(c =>
        options.competitors!.some(name => c.competitorName.toLowerCase().includes(name.toLowerCase()))
      )
    : KNOWN_ENERGY_COMPETITORS;

  const dossier: MarketIntelligenceDossier = {
    topic: options.query,
    timestamp: new Date().toISOString(),
    topSources: searchResults,
    competitors: activeCompetitors.length > 0 ? activeCompetitors : KNOWN_ENERGY_COMPETITORS.slice(0, 3),
    sectoralTrends: [
      'Abertura total da alta tensão para o Mercado Livre (Portaria 50/2022) estimula migração massiva de PMEs no Grupo A4.',
      'Crescimento acelerado do modelo Varejista na CCEE eliminando burocracia de adesão para consumidores com carga inferior a 500 kW.',
      'Aumento da rigidez na cobrança de reativos e multas de ultrapassagem pelas distribuidoras locais (ex: CEMIG, CPFL, Enel).',
      'Pressão regulatória com transição da Lei 14.300/2022 tornando a gestão integrada (M&V + ACL) superior à GD pura.'
    ],
    regulatorySignals: [
      'Resolução Normativa ANEEL nº 1.000/2021: Procedimentos de faturamento, ultrapassagem e adequação de demanda contratada.',
      'Fator de potência de referência 0,92 com cobrança compulsória de energia reativa excedente horária (FER/FIDER).',
      'Tarifa de ultrapassagem calculada com multiplicador 2x sobre a tarifa de demanda homologada da concessionária.'
    ],
    strategicRecommendations: [
      'Posicionar o EI-AIOS com foco cirúrgico em clientes do Grupo A4 com 2+ unidades consumidoras e faturas a partir de R$ 12.000.',
      'Diferenciar-se de concorrentes puramente comerciais (Clarke/2W) através da auditoria de engenharia física e eliminação de multas de reativo.',
      'Adotar remuneração alinhada por Success Fee (20% da economia aferida e verificada M&V) para acelerar assinatura de LOIs sem risco.',
      'Automatizar a geração de diagnósticos técnicos e dossiês de concorrência antes do contato do agente comercial AG-007.'
    ]
  };

  return MarketIntelligenceDossierSchema.parse(dossier);
}

export async function runProspectIntelligenceDossier(options: {
  companyName: string;
  domain?: string;
  rawText?: string;
  sector?: string;
  distributor?: string;
  estimatedUnitsCount?: number;
  targetSubgroup?: TargetSubgroup;
  provider?: IWebSearchProvider;
  mockHtml?: string;
}): Promise<ProspectProfile> {
  const provider = options.provider || new MockWebSearchProvider();
  let scraped: ScrapedPageData | null = null;

  if (options.domain) {
    const url = options.domain.startsWith('http') ? options.domain : `https://${options.domain}`;
    scraped = await scrapePage(url, { mockHtml: options.mockHtml });
  } else {
    const searchRes = await provider.search(`${options.companyName} energia grupo a`);
    if (searchRes.length > 0 && searchRes[0]?.domain) {
      scraped = await scrapePage(`https://${searchRes[0].domain}`, { mockHtml: options.mockHtml });
    }
  }

  const effectiveSector = options.sector || 'Comércio e Serviços Multiunidade';
  const effectiveDistributor = options.distributor || 'CEMIG';
  const effectiveSubgroup = options.targetSubgroup || 'A4';
  const combinedRawText = `${options.rawText || ''} ${scraped?.textContent || ''}`;

  const icpResult = calculateIcpFitScore({
    sector: effectiveSector,
    targetSubgroup: effectiveSubgroup,
    estimatedUnitsCount: options.estimatedUnitsCount ?? 3,
    distributor: effectiveDistributor,
    rawText: combinedRawText
  });

  const decisionMakers = scraped ? extractDecisionMakers(scraped.textContent) : [];
  if (decisionMakers.length === 0) {
    decisionMakers.push(
      { role: 'Gerente de Manutenção / Facilities', name: 'Gestor Responsável' },
      { role: 'Diretor Financeiro (CFO)', name: 'Decisor Orçamentário' }
    );
  }

  const extractedCnpjs = scraped?.extractedCnpjs || extractCnpjs(combinedRawText);
  const primaryCnpj = extractedCnpjs[0] || undefined;

  const painPoints: string[] = [
    'Risco de ultrapassagem de demanda contratada em horários de pico operacional',
    'Excesso de cobrança de reativos por falta de compensação de banco de capacitores',
    'Falta de visibilidade consolidada de indicadores de consumo entre filiais da rede',
    'Oportunidade latente de redução de custos de energia via migração ao Mercado Livre (ACL)'
  ];

  const profile: ProspectProfile = {
    companyName: options.companyName,
    tradeName: scraped?.title && scraped.title !== 'Sem título' ? scraped.title.slice(0, 50) : options.companyName,
    domain: options.domain || 'prospect.com.br',
    cnpj: primaryCnpj,
    sector: effectiveSector,
    targetSubgroup: effectiveSubgroup,
    estimatedUnitsCount: options.estimatedUnitsCount ?? 3,
    energyPainPoints: painPoints,
    decisionMakers,
    icpFitScore: icpResult.icpFitScore,
    qualificationGrade: icpResult.qualificationGrade,
    recommendedOutreachAngle: icpResult.recommendedOutreachAngle
  };

  return ProspectProfileSchema.parse(profile);
}
