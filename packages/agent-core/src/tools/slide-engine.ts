// ==============================================================================
// SLIDE ENGINE: EXECUTIVE PRESENTATION & PITCH DECK BUILDER (AG-015)
// ==============================================================================

export interface SlideContent {
  title: string;
  subtitle?: string;
  kpiHighlight?: {
    value: string;
    label: string;
    trend?: string;
  };
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  footerCallout?: string;
  badge?: string;
}

export interface DeckMetadata {
  title: string;
  subtitle: string;
  clientOrProject: string;
  authorAgent?: string;
  theme?: 'corporate_dark' | 'executive_light' | 'investor_clean';
  slides: SlideContent[];
}

export class SlideEngine {
  /**
   * Converte uma estrutura de apresentação em Marp Markdown profissional
   */
  static generateMarpMarkdown(deck: DeckMetadata): string {
    const theme = deck.theme || 'corporate_dark';
    const author = deck.authorAgent || 'AG-015 (Executive Presentation Agent)';
    const dateStr = new Date().toLocaleDateString('pt-BR');

    let marp = `---
marp: true
theme: uncover
size: 16:9
paginate: true
header: '⚡ ENERGY INTELLIGENCE • ${deck.title.toUpperCase()}'
footer: 'EI-AIOS • Confidencial & Corporativo • ${dateStr}'
style: |
  section {
    background: ${theme === 'executive_light' ? '#ffffff' : '#090d16'};
    color: ${theme === 'executive_light' ? '#0f172a' : '#f8fafc'};
    font-family: 'Inter', system-ui, sans-serif;
    padding: 40px;
    font-size: 20px;
  }
  h1 {
    color: ${theme === 'executive_light' ? '#0284c7' : '#38bdf8'};
    font-size: 38px;
    font-weight: 800;
    margin-bottom: 8px;
  }
  h2 {
    color: ${theme === 'executive_light' ? '#059669' : '#34d399'};
    font-size: 26px;
    font-weight: 700;
  }
  .highlight-box {
    background: ${theme === 'executive_light' ? '#f1f5f9' : '#1e293b'};
    border: 1px solid ${theme === 'executive_light' ? '#cbd5e1' : '#334155'};
    border-radius: 12px;
    padding: 16px;
    margin-top: 15px;
  }
  .kpi-number {
    font-size: 44px;
    font-weight: 900;
    color: #10b981;
    font-family: monospace;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
    margin-top: 15px;
  }
  th {
    background: ${theme === 'executive_light' ? '#e2e8f0' : '#1e293b'};
    padding: 8px;
    text-align: left;
    border-bottom: 2px solid #64748b;
  }
  td {
    padding: 8px;
    border-bottom: 1px solid #334155;
  }
---

<!-- slide -->
<!-- _class: lead -->
# ⚡ ${deck.title}
### ${deck.subtitle}

**Empresa / Alvo:** ${deck.clientOrProject}
**Apresentação Executiva:** ${author}
**Data:** ${dateStr}

---
`;

    for (let i = 0; i < deck.slides.length; i++) {
      const slide = deck.slides[i]!;
      marp += `\n<!-- slide -->\n`;

      if (slide.badge) {
        marp += `<span style="font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 6px; background: rgba(56, 189, 248, 0.15); border: 1px solid #0284c7; color: #38bdf8;">${slide.badge.toUpperCase()}</span>\n\n`;
      }

      marp += `## ${slide.title}\n`;
      if (slide.subtitle) {
        marp += `*${slide.subtitle}*\n\n`;
      }

      if (slide.kpiHighlight) {
        marp += `<div class="highlight-box">\n`;
        marp += `  <div class="kpi-number">${slide.kpiHighlight.value}</div>\n`;
        marp += `  <div style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">${slide.kpiHighlight.label}</div>\n`;
        if (slide.kpiHighlight.trend) {
          marp += `  <div style="font-size: 13px; color: #34d399; margin-top: 4px;">📈 ${slide.kpiHighlight.trend}</div>\n`;
        }
        marp += `</div>\n\n`;
      }

      if (slide.bullets && slide.bullets.length > 0) {
        slide.bullets.forEach(b => {
          marp += `- ${b}\n`;
        });
        marp += `\n`;
      }

      if (slide.table && slide.table.headers.length > 0) {
        marp += `| ${slide.table.headers.join(' | ')} |\n`;
        marp += `| ${slide.table.headers.map(() => '---').join(' | ')} |\n`;
        slide.table.rows.forEach(r => {
          marp += `| ${r.join(' | ')} |\n`;
        });
        marp += `\n`;
      }

      if (slide.footerCallout) {
        marp += `> **Destaque:** ${slide.footerCallout}\n`;
      }

      if (i < deck.slides.length - 1) {
        marp += `\n---\n`;
      }
    }

    return marp;
  }

  /**
   * Constrói automaticamente um Pitch Deck Comercial (C-Level & Vendas) a partir de um diagnóstico energético
   */
  static buildSalesPitchDeck(params: {
    clientName: string;
    annualSavingsBrl: number;
    monthlySavingsBrl: number;
    recommendedModality: string;
    powerFineBrl?: number;
    overageBrl?: number;
    successFeePercent?: number;
  }): DeckMetadata {
    return {
      title: 'Plano Executivo de Otimização Tarifária & Economia',
      subtitle: `Estratégia sob medida para redução imediata de custos em energia elétrica`,
      clientOrProject: params.clientName,
      authorAgent: 'AG-015 (Executive Presentation Agent)',
      slides: [
        {
          badge: 'Cenário & Desafio',
          title: '1. O Cenário de Custos Energéticos no Brasil',
          subtitle: 'A conta de energia é o 2º ou 3º maior centro de custo operacional corporativo',
          bullets: [
            'Aumento constante de tarifas reguladas pelas concessionárias de distribuição.',
            'Cobranças invisíveis e frequentes: Multas de ultrapassagem de demanda e energia reativa excedente (baixo fator de potência).',
            'Complexidade da regulação ANEEL (REN 1.000/2021) dificulta auditoria interna manual.'
          ],
          footerCallout: 'Diagnóstico contínuo é indispensável para proteger a margem operacional.'
        },
        {
          badge: 'Diagnóstico Numérico',
          title: '2. Economia Total Apurada para a sua Operação',
          subtitle: 'Baseada na análise matemática determinística das faturas reais',
          kpiHighlight: {
            value: `R$ ${params.annualSavingsBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            label: 'Potencial de Economia Anual Identificado',
            trend: `R$ ${params.monthlySavingsBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês de redução líquida`
          },
          bullets: [
            `Migração recomendada para o enquadramento: **${params.recommendedModality}**.`,
            params.overageBrl ? `Eliminação de multas de ultrapassagem de demanda: R$ ${params.overageBrl.toLocaleString('pt-BR')}/mês.` : 'Demanda contratada calibrada sem riscos de ultrapassagem.',
            params.powerFineBrl ? `Eliminação de desperdício com reativo (UFER): R$ ${params.powerFineBrl.toLocaleString('pt-BR')}/mês.` : 'Fator de potência em conformidade com o limite de 0,92.'
          ]
        },
        {
          badge: 'Plano de Ação',
          title: '3. Alavancas Práticas de Execução',
          subtitle: 'Cronograma objetivo de implementação com risco zero',
          table: {
            headers: ['Alavanca Técnica', 'Prazo de Implantação', 'Impacto Financeiro'],
            rows: [
              ['Readequação de Demanda Contratada', '15 a 30 dias junto à distribuidora', 'Redução imediata na próxima fatura'],
              ['Otimização Horossazonal (Verde/Azul)', 'Ciclo de faturamento seguinte', 'Menor custo por kWh consumido'],
              ['Gestão e Auditoria Automatizada', 'Contínuo (mês a mês)', 'Garantia contra cobranças indevidas']
            ]
          },
          footerCallout: 'Toda alteração é formalizada em conformidade com os artigos da REN ANEEL 1.000/2021.'
        },
        {
          badge: 'Modelo Comercial',
          title: '4. Modelo Success Fee (Risco Zero)',
          subtitle: 'A Energy Intelligence só recebe quando você efetivamente economiza',
          bullets: [
            `**Success Fee:** ${params.successFeePercent || 20}% exclusivamente sobre a economia real e comprovada na fatura.`,
            '**Medição & Verificação (M&V):** Relatório mensal transparente comparando linha de base com fatura realizada (Protocolo IPMVP).',
            '**Sem Custo de Implantação:** Setup zero para empresas qualificadas no ICP.'
          ],
          footerCallout: 'Alinhamento total de interesses entre a sua empresa e a Energy Intelligence.'
        },
        {
          badge: 'Próximos Passos',
          title: '5. Decisão & Próximo Passo',
          subtitle: 'Como avançar para captura imediata da economia',
          bullets: [
            '1. Assinatura da Carta de Intenção / Termo de Piloto (LOI).',
            '2. Coleta das faturas dos últimos 12 meses para consolidação histórica.',
            '3. Protocolo formal dos pedidos de readequação junto à concessionária.'
          ],
          footerCallout: 'Comece a economizar no próximo ciclo de faturamento.'
        }
      ]
    };
  }

  /**
   * Constrói Pitch Deck de Captação / Investidores (Sequoia / YC Standard)
   */
  static buildInvestorPitchDeck(params: {
    mrrBrl: number;
    clientsCount: number;
    totalSavingsFoundBrl: number;
    cacBrl?: number;
    ltvBrl?: number;
    askBrl?: string;
  }): DeckMetadata {
    return {
      title: 'Energy Intelligence • Pitch Deck Institucional',
      subtitle: 'O Sistema Operacional Autônomo de Inteligência Energética para o B2B',
      clientOrProject: 'Energy Intelligence AIOS',
      authorAgent: 'AG-015 (Investor Presentation Agent)',
      slides: [
        {
          badge: 'O Problema',
          title: '1. O Custo Invisível da Energia no Brasil',
          subtitle: 'Um dos mercados mais caros e regulatoriamente complexos do mundo',
          bullets: [
            'A conta de energia é o 2º maior custo operacional de indústrias, redes e condomínios.',
            '83% das faturas do Grupo A contêm erros de faturamento, ultrapassagens ou enquadramentos ineficientes.',
            'Consultorias tradicionais são lentas, artesanais, caras e não escalam para o mid-market.'
          ]
        },
        {
          badge: 'A Solução',
          title: '2. EI-AIOS: Inteligência Autônoma em Nuvem',
          subtitle: 'Auditoria matemática determinística combinada com agentes de IA soberanos',
          bullets: [
            '**Ingestão Multimodal:** Leitura de faturas de qualquer distribuidora via OCR multimodal.',
            '**Motor Determinístico:** Validação tarifária estrita conforme ANEEL REN 1.000/2021 sem alucinações.',
            '**Orquestração de Agentes:** Da prospecção até o cálculo de Success Fee com governança HITL.'
          ]
        },
        {
          badge: 'Tração & Métricas',
          title: '3. Tração & Métricas Financeiras',
          subtitle: 'Crescimento validado por clientes reais e dados no banco',
          kpiHighlight: {
            value: `R$ ${params.mrrBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            label: 'MRR Recorrente Vigente',
            trend: `${params.clientsCount} clientes ativos | R$ ${params.totalSavingsFoundBrl.toLocaleString('pt-BR')} em economia apurada`
          },
          bullets: [
            `LTV/CAC: Saudável com payback acelerado.`,
            'Retenção de clientes sustentada pelo relatório mensal de M&V.',
            'Receita híbrida: Assinatura SaaS + Success Fee sobre economia gerada.'
          ]
        },
        {
          badge: 'Visão & Oportunidade',
          title: '4. Mercado Endereçável (TAM/SAM/SOM)',
          subtitle: 'Abertura total do Mercado Livre e expansão da Geração Distribuída',
          bullets: [
            '**Portaria 50/2022:** Todo consumidor em alta tensão (Grupo A) agora pode migrar para o Mercado Livre.',
            'Mais de 200.000 unidades consumidoras no Brasil necessitando de gestão independente.',
            'Open Energy e inteligência de dados tarifários são o futuro do setor.'
          ]
        },
        {
          badge: 'O Investimento',
          title: '5. Próximos Passos & Oportunidade de Rodada',
          subtitle: 'Aceleração de aquisição comercial e ampliação dos conectores de distribuição',
          bullets: [
            `Captação Alvo: ${params.askBrl || 'R$ 1.500.000'} para 18 meses de runway.`,
            '60% Expansão Comercial B2B e Geração de Demanda Inbound.',
            '40% Engenharia de Produto, Conectores Automatizados de Distribuidoras e SRE.'
          ],
          footerCallout: 'Construindo o padrão ouro em governança energética corporativa.'
        }
      ]
    };
  }
}

