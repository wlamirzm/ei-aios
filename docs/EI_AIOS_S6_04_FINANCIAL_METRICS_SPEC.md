# EI-AIOS — ESPECIFICAÇÃO DE MÉTRICAS FINANCEIRAS
## S6-04: Metodologia e Governança de CAC, LTV e Payback

---

## 1. CUSTOMER ACQUISITION COST (CAC REAL)

### 1.1 Fórmula Matemática
$$\text{CAC}_{\text{Janela}} = \frac{\sum \text{Despesas de Vendas e Marketing Elegíveis e Validadas na Janela}}{\text{Número de Novos Clientes Adquiridos na Janela}}$$

### 1.2 Regras de Governança
- **Janelas Padrão:** 30 dias (visão tática), 60 dias e 90 dias (visão estratégica/suavizada).
- **Critério de Elegibilidade:** Somente despesas com `validation_status === 'validated'` e comprovante anexado.
- **Prevenção de Divisão por Zero:** Se a contagem de novos clientes for zero, o sistema retorna `cac_brl: null` e status `incomplete` com rationale explicativo.
- **Despesas Compartilhadas:** Não são rateadas arbitrariamente enquanto não houver política de alocação auditável aprovada pelo Founder.

---

## 2. LIFETIME VALUE (LTV REAL)

### 2.1 Fórmula Matemática
$$\text{LTV} = \text{Margem de Contribuição Mensal Média Real} \times \text{Vida Útil Média Estimada (Meses)}$$

Onde a vida útil média com taxa de churn mensal observada ($c$) é:
$$\text{Vida Útil (Meses)} = \frac{1}{c}$$

### 2.2 Regras de Governança
- **Margem de Contribuição Real:** Calculada estritamente pelo módulo **S6-03** como:
  $$\text{Margem} = (\text{MRR Faturado} + \text{Success Fee Faturado}) - (\text{COGS de Suporte} + \text{Custo de IA do Ledger S6-02})$$
- **Trava de Amostragem:** Requer histórico mínimo de **3 meses** de relacionamento com o cliente.
- **Bloqueio de Margem Negativa:** Margens nulas ou negativas geram status `incomplete` imediato, bloqueando estimativas artificiais de LTV.

---

## 3. PAYBACK DO CAC (TEMPO DE RECUPERAÇÃO)

### 3.1 Fórmula Matemática
$$\text{Payback (Meses)} = \frac{\text{CAC Real}}{\text{Margem de Contribuição Mensal Média por Cliente}}$$

### 3.2 Regras de Governança
- Requer tanto um CAC válido quanto uma Margem de Contribuição mensal real estritamente positiva.
- Caso a margem seja zero ou negativa, o Payback é classificado como `incomplete` com nota de advertência ("Payback infinito / investimento não recuperável sob as condições operacionais atuais").
