// ==============================================================================
// UNIT ECONOMICS & FINANCIAL DATA FOUNDATION (AG-011 CFO DIGITAL)
// Sprint 6 S6-04: CAC, LTV & Payback Real Calculation Engine
// ==============================================================================

import {
  AcquisitionExpenseModel,
  OperationalExpenseModel,
  CustomerAcquisitionEvent,
  RealCacResult,
  RealLtvResult,
  RealPaybackResult
} from '@ei-aios/shared';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface CalculateCacOptions {
  windowDays?: number; // 30, 60, 90 (default: 30)
  referenceDate?: string; // YYYY-MM-DD (default: now)
  tenantId?: string;
  allowSharedExpenses?: boolean;
}

export interface CalculateLtvOptions {
  clientId?: string;
  monthlyContributionMarginBrl: number | null;
  historicalMonthsCount?: number;
  observedChurnRateMonthly?: number | null; // ex: 0.02 (2% a.m.)
  benchmarkLifespanMonths?: number;
  tenantId?: string;
}

export interface CalculatePaybackOptions {
  cacBrl: number | null;
  monthlyContributionMarginBrl: number | null;
  clientId?: string;
}

export class UnitEconomicsEngine {
  private acquisitionExpensesStore: Map<string, AcquisitionExpenseModel> = new Map();
  private operationalExpensesStore: Map<string, OperationalExpenseModel> = new Map();
  private acquisitionEventsStore: Map<string, CustomerAcquisitionEvent> = new Map();

  constructor(initialData?: {
    acquisitionExpenses?: AcquisitionExpenseModel[];
    operationalExpenses?: OperationalExpenseModel[];
    acquisitionEvents?: CustomerAcquisitionEvent[];
  }) {
    if (initialData?.acquisitionExpenses) {
      for (const e of initialData.acquisitionExpenses) this.acquisitionExpensesStore.set(e.id, { ...e });
    }
    if (initialData?.operationalExpenses) {
      for (const e of initialData.operationalExpenses) this.operationalExpensesStore.set(e.id, { ...e });
    }
    if (initialData?.acquisitionEvents) {
      for (const e of initialData.acquisitionEvents) this.acquisitionEventsStore.set(e.id, { ...e });
    }
  }

  public clear(): void {
    this.acquisitionExpensesStore.clear();
    this.operationalExpensesStore.clear();
    this.acquisitionEventsStore.clear();
  }

  // ============================================================================
  // 1. MÓDULO A: DESPESAS DE AQUISIÇÃO (SALES & MARKETING)
  // ============================================================================

  public registerAcquisitionExpense(expense: AcquisitionExpenseModel): AcquisitionExpenseModel {
    const copy: AcquisitionExpenseModel = {
      ...expense,
      currency: 'BRL',
      amount_brl: round2(Math.max(0, Number(expense.amount_brl))),
      history: expense.history || []
    };
    this.acquisitionExpensesStore.set(copy.id, copy);
    return copy;
  }

  public getAcquisitionExpense(id: string): AcquisitionExpenseModel | undefined {
    return this.acquisitionExpensesStore.get(id);
  }

  public updateAcquisitionExpenseAmount(
    id: string,
    newAmount: number,
    changedBy: string,
    reason: string
  ): AcquisitionExpenseModel {
    const existing = this.acquisitionExpensesStore.get(id);
    if (!existing) throw new Error(`Despesa de aquisição ${id} não encontrada.`);

    const previousAmount = existing.amount_brl;
    const historyEntry = {
      previous_amount_brl: previousAmount,
      new_amount_brl: round2(newAmount),
      changed_by: changedBy,
      reason,
      timestamp: new Date().toISOString()
    };

    const updated: AcquisitionExpenseModel = {
      ...existing,
      amount_brl: round2(newAmount),
      updated_at: new Date().toISOString(),
      history: [...(existing.history || []), historyEntry]
    };

    this.acquisitionExpensesStore.set(id, updated);
    return updated;
  }

  public validateAcquisitionExpense(id: string, status: 'validated' | 'rejected'): AcquisitionExpenseModel {
    const existing = this.acquisitionExpensesStore.get(id);
    if (!existing) throw new Error(`Despesa de aquisição ${id} não encontrada.`);

    const updated: AcquisitionExpenseModel = {
      ...existing,
      validation_status: status,
      updated_at: new Date().toISOString()
    };
    this.acquisitionExpensesStore.set(id, updated);
    return updated;
  }

  // ============================================================================
  // 2. MÓDULO B: CUSTOS OPERACIONAIS E SUPORTE (COGS)
  // ============================================================================

  public registerOperationalExpense(expense: OperationalExpenseModel): OperationalExpenseModel {
    const copy: OperationalExpenseModel = {
      ...expense,
      currency: 'BRL',
      amount_brl: round2(Math.max(0, Number(expense.amount_brl)))
    };
    this.operationalExpensesStore.set(copy.id, copy);
    return copy;
  }

  public getOperationalExpensesByClient(clientId: string, competence?: string): OperationalExpenseModel[] {
    return Array.from(this.operationalExpensesStore.values()).filter((e) => {
      const matchClient = e.client_id === clientId;
      const matchComp = competence ? e.competence === competence : true;
      return matchClient && matchComp;
    });
  }

  // ============================================================================
  // 3. EVENTOS DE AQUISIÇÃO DE CLIENTES
  // ============================================================================

  public recordCustomerAcquisition(event: CustomerAcquisitionEvent): CustomerAcquisitionEvent {
    // Evita duplicar o mesmo cliente
    const existing = Array.from(this.acquisitionEventsStore.values()).find(
      (ev) => ev.client_id === event.client_id && ev.tenant_id === event.tenant_id
    );
    if (existing) {
      throw new Error(`Cliente ${event.client_id} já possui evento de aquisição registrado em ${existing.acquisition_date}.`);
    }

    const copy = { ...event };
    this.acquisitionEventsStore.set(copy.id, copy);
    return copy;
  }

  // ============================================================================
  // 4. MÓDULO C: CÁLCULO REAL DE CAC
  // ============================================================================

  /**
   * Calcula o CAC real em janelas de tempo (30, 60, 90 dias) com isolamento multi-tenant.
   */
  public calculateRealCac(options?: CalculateCacOptions): RealCacResult {
    const windowDays = options?.windowDays || 30;
    const refDateStr = options?.referenceDate || new Date().toISOString().slice(0, 10);
    const tenantId = options?.tenantId || 'default_tenant';
    const allowShared = options?.allowSharedExpenses ?? false;

    const refDate = new Date(`${refDateStr}T23:59:59.999Z`);
    const startDate = new Date(refDate.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().slice(0, 10);

    const limitations: string[] = [];

    // 1. Filtra despesas de aquisição elegíveis
    const allExpenses = Array.from(this.acquisitionExpensesStore.values()).filter(
      (e) => e.tenant_id === tenantId
    );

    const eligibleExpenses = allExpenses.filter((e) => {
      const inWindow = e.payment_date >= startDateStr && e.payment_date <= refDateStr;
      if (!inWindow) return false;

      // Exige despesa validada
      if (e.validation_status !== 'validated') {
        limitations.push(`Despesa '${e.description}' (R$ ${e.amount_brl}) ignorada: status '${e.validation_status}'.`);
        return false;
      }

      // Despesas compartilhadas só entram se permitido por regra explícita
      if (e.is_shared && !allowShared) {
        limitations.push(`Despesa compartilhada '${e.description}' (R$ ${e.amount_brl}) ignorada por falta de regra de rateio.`);
        return false;
      }

      return true;
    });

    const totalSpend = round2(eligibleExpenses.reduce((acc, e) => acc + e.amount_brl, 0));

    // 2. Filtra novos clientes adquiridos na janela (sem duplicações)
    const allEvents = Array.from(this.acquisitionEventsStore.values()).filter(
      (ev) => ev.tenant_id === tenantId
    );

    const acquiredInWindow = allEvents.filter(
      (ev) => ev.acquisition_date >= startDateStr && ev.acquisition_date <= refDateStr
    );

    const uniqueClientIds = Array.from(new Set(acquiredInWindow.map((ev) => ev.client_id)));
    const newClientsCount = uniqueClientIds.length;

    // 3. Regra de divisão por zero e consistência
    if (newClientsCount === 0) {
      limitations.push('Nenhum novo cliente adquirido na janela de apuração (divisão por zero prevenida).');
      return {
        window_days: windowDays,
        window_start: startDateStr,
        window_end: refDateStr,
        total_eligible_spend_brl: totalSpend,
        new_clients_acquired_count: 0,
        cac_brl: null,
        status: 'incomplete',
        limitation_notes: limitations,
        included_expense_ids: eligibleExpenses.map((e) => e.id),
        included_client_ids: []
      };
    }

    if (totalSpend === 0) {
      limitations.push('Nenhuma despesa elegível validada de aquisição registrada na janela.');
      return {
        window_days: windowDays,
        window_start: startDateStr,
        window_end: refDateStr,
        total_eligible_spend_brl: 0,
        new_clients_acquired_count: newClientsCount,
        cac_brl: null,
        status: 'incomplete',
        limitation_notes: limitations,
        included_expense_ids: [],
        included_client_ids: uniqueClientIds
      };
    }

    const cac = round2(totalSpend / newClientsCount);
    const hasUnverified = allExpenses.some(
      (e) => e.payment_date >= startDateStr && e.payment_date <= refDateStr && e.validation_status === 'pending'
    );
    const status = hasUnverified ? 'estimated' : 'measured';

    return {
      window_days: windowDays,
      window_start: startDateStr,
      window_end: refDateStr,
      total_eligible_spend_brl: totalSpend,
      new_clients_acquired_count: newClientsCount,
      cac_brl: cac,
      status,
      limitation_notes: limitations,
      included_expense_ids: eligibleExpenses.map((e) => e.id),
      included_client_ids: uniqueClientIds
    };
  }

  // ============================================================================
  // 5. MÓDULO D: LTV REAL
  // ============================================================================

  /**
   * Calcula LTV real baseado estritamente na margem de contribuição mensal e histórico.
   */
  public calculateRealLtv(options: CalculateLtvOptions): RealLtvResult {
    const margin = options.monthlyContributionMarginBrl;
    const historyMonths = options.historicalMonthsCount || 0;
    const limitations: string[] = [];

    // 1. Margem inválida, nula ou negativa
    if (margin === null || margin === undefined || margin <= 0) {
      limitations.push('Margem de contribuição mensal nula, negativa ou ausente impede cálculo sustentável de LTV.');
      return {
        client_id: options.clientId || null,
        monthly_contribution_margin_brl: margin !== undefined ? margin : null,
        observed_churn_rate_monthly: options.observedChurnRateMonthly || null,
        estimated_lifespan_months: null,
        ltv_brl: null,
        status: 'incomplete',
        methodology: 'Margem Contribuição x Lifespan',
        limitation_notes: limitations
      };
    }

    // 2. Histórico insuficiente (< 3 meses de operação)
    if (historyMonths < 3) {
      limitations.push(`Base histórica insuficiente (${historyMonths} meses registrados; mínimo exigido: 3 meses).`);
      return {
        client_id: options.clientId || null,
        monthly_contribution_margin_brl: margin,
        observed_churn_rate_monthly: options.observedChurnRateMonthly || null,
        estimated_lifespan_months: null,
        ltv_brl: null,
        status: 'incomplete',
        methodology: 'Margem Contribuição x Lifespan',
        limitation_notes: limitations
      };
    }

    // 3. Churn observado disponível
    let lifespanMonths: number;
    let status: 'measured' | 'estimated' = 'measured';

    if (options.observedChurnRateMonthly && options.observedChurnRateMonthly > 0) {
      lifespanMonths = round2(1 / options.observedChurnRateMonthly);
    } else if (options.benchmarkLifespanMonths && options.benchmarkLifespanMonths > 0) {
      lifespanMonths = options.benchmarkLifespanMonths;
      status = 'estimated';
      limitations.push(`Vida útil baseada em benchmark de setor (${options.benchmarkLifespanMonths} meses) por ausência de churn consolidado.`);
    } else {
      limitations.push('Ausência de taxa de churn observada ou benchmark válido.');
      return {
        client_id: options.clientId || null,
        monthly_contribution_margin_brl: margin,
        observed_churn_rate_monthly: null,
        estimated_lifespan_months: null,
        ltv_brl: null,
        status: 'incomplete',
        methodology: 'Margem Contribuição x Lifespan',
        limitation_notes: limitations
      };
    }

    const ltv = round2(margin * lifespanMonths);

    return {
      client_id: options.clientId || null,
      monthly_contribution_margin_brl: margin,
      observed_churn_rate_monthly: options.observedChurnRateMonthly || null,
      estimated_lifespan_months: lifespanMonths,
      ltv_brl: ltv,
      status,
      methodology: 'Margem Contribuição x (1 / Churn)',
      limitation_notes: limitations
    };
  }

  // ============================================================================
  // 6. MÓDULO E: PAYBACK REAL
  // ============================================================================

  /**
   * Calcula o Payback em meses (tempo de recuperação do CAC).
   */
  public calculateRealPayback(options: CalculatePaybackOptions): RealPaybackResult {
    const cac = options.cacBrl;
    const margin = options.monthlyContributionMarginBrl;
    const limitations: string[] = [];

    if (cac === null || cac === undefined || cac <= 0) {
      limitations.push('CAC não apurado ou igual a zero.');
      return {
        client_id: options.clientId || null,
        cac_brl: cac !== undefined ? cac : null,
        monthly_contribution_margin_brl: margin !== undefined ? margin : null,
        payback_months: null,
        status: 'incomplete',
        limitation_notes: limitations
      };
    }

    if (margin === null || margin === undefined || margin <= 0) {
      limitations.push('Margem de contribuição mensal nula ou negativa impossibilita recuperação do investimento (Payback infinito).');
      return {
        client_id: options.clientId || null,
        cac_brl: cac,
        monthly_contribution_margin_brl: margin !== undefined ? margin : null,
        payback_months: null,
        status: 'incomplete',
        limitation_notes: limitations
      };
    }

    const payback = round2(cac / margin);

    return {
      client_id: options.clientId || null,
      cac_brl: cac,
      monthly_contribution_margin_brl: margin,
      payback_months: payback,
      status: 'measured',
      limitation_notes: limitations
    };
  }
}
