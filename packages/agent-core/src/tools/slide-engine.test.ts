// ==============================================================================
// SLIDE ENGINE UNIT TESTS (AG-015)
// ==============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SlideEngine } from './slide-engine.js';

describe('Executive Presentation & Pitch Deck Engine (AG-015)', () => {
  test('generateMarpMarkdown produz formato Marp válido com paginação e tags de slide', () => {
    const markdown = SlideEngine.generateMarpMarkdown({
      title: 'Apresentação Teste',
      subtitle: 'Subtítulo Teste',
      clientOrProject: 'Cliente Teste',
      slides: [
        {
          title: 'Primeiro Slide',
          subtitle: 'Subtítulo Slide',
          bullets: ['Ponto A', 'Ponto B'],
          footerCallout: 'Conclusão preliminar'
        }
      ]
    });

    assert.match(markdown, /marp:\s*true/);
    assert.match(markdown, /<!-- slide -->/);
    assert.match(markdown, /# ⚡ Apresentação Teste/);
    assert.match(markdown, /## Primeiro Slide/);
    assert.match(markdown, /Ponto A/);
    assert.match(markdown, /> \*\*Destaque:\*\* Conclusão preliminar/);
  });

  test('buildSalesPitchDeck gera estrutura completa de 5 slides com KPIs numéricos', () => {
    const deck = SlideEngine.buildSalesPitchDeck({
      clientName: 'Indústria Metalúrgica ABC',
      annualSavingsBrl: 145000,
      monthlySavingsBrl: 12083.33,
      recommendedModality: 'HOROSSAZONAL_VERDE',
      overageBrl: 3500,
      powerFineBrl: 1800,
      successFeePercent: 20
    });

    assert.strictEqual(deck.slides.length, 5);
    assert.match(deck.clientOrProject, /Indústria Metalúrgica ABC/);
    
    const kpiSlide = deck.slides[1]!;
    assert.ok(kpiSlide.kpiHighlight);
    assert.match(kpiSlide.kpiHighlight!.value, /145\.000/);

    const marpOutput = SlideEngine.generateMarpMarkdown(deck);
    assert.match(marpOutput, /R\$ 145\.000,00/);
    assert.match(marpOutput, /HOROSSAZONAL_VERDE/);
  });

  test('buildInvestorPitchDeck gera estrutura no padrão Sequoia/YC com métricas SaaS', () => {
    const deck = SlideEngine.buildInvestorPitchDeck({
      mrrBrl: 25000,
      clientsCount: 8,
      totalSavingsFoundBrl: 450000,
      askBrl: 'R$ 2.000.000'
    });

    assert.strictEqual(deck.slides.length, 5);
    assert.match(deck.slides[0]!.title, /O Custo Invisível da Energia/);
    assert.match(deck.slides[2]!.kpiHighlight!.value, /25\.000/);
    assert.match(deck.slides[4]!.bullets![0]!, /R\$ 2\.000\.000/);

    const marpOutput = SlideEngine.generateMarpMarkdown(deck);
    assert.match(marpOutput, /TAM\/SAM\/SOM/);
  });
});

