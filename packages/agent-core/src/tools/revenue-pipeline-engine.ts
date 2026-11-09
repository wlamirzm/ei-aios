// ==============================================================================
// REAL REVENUE PIPELINE & CONTRACT BILLING ENGINE (AG-011 CFO DIGITAL)
// Sprint 6 S6-03: Segregated Contracted, Invoiced, Received Revenue & Success Fee
// ==============================================================================

import { randomUUID } from 'node:crypto';
import {
  ClientContractModel,
  RevenueInvoiceModel,
  RevenueReceiptModel,
  SuccessFeeEventModel,
  RealMarginReport
} from '@ei-aios/shared';
import { ClientCostSummary } from './finops-ledger-engine.js';

// Helpers numéricos
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

export interface MVValidationReportInput {
  id: string;
  competence: string; // YYYY-MM
  clientId: string;
  verifiedSavingsBrl: number;
  isVerifiedByAG004: boolean;
  baselinePeriod?: string;
  measurementMethodology?: string;
}

export interface RegisterReceiptInput {
  amount: number;
  date: string;
  transactionReference: string;
}

export class RevenuePipelineEngine {
  private contractsStore: Map<string, ClientContractModel> = new Map();
  private invoicesStore: Map<string, RevenueInvoiceModel> = new Map();
  private receiptsStore: Map<string, RevenueReceiptModel[]> = new Map(); // invoice_id -> receipts
  private successFeeStore: Map<string, SuccessFeeEventModel> = new Map();

  constructor(initialData?: {
    contracts?: ClientContractModel[];
    invoices?: RevenueInvoiceModel[];
    receipts?: RevenueReceiptModel[];
    successFeeEvents?: SuccessFeeEventModel[];
  }) {
    if (initialData?.contracts) {
      for (const c of initialData.contracts) this.contractsStore.set(c.id, { ...c });
    }
    if (initialData?.invoices) {
      for (const inv of initialData.invoices) this.invoicesStore.set(inv.id, { ...inv });
    }
    if (initialData?.receipts) {
      for (const rec of initialData.receipts) {
        const list = this.receiptsStore.get(rec.invoice_id) || [];
        list.push({ ...rec });
        this.receiptsStore.set(rec.invoice_id, list);
      }
    }
    if (initialData?.successFeeEvents) {
      for (const sfe of initialData.successFeeEvents) this.successFeeStore.set(sfe.id, { ...sfe });
    }
  }

  public clear(): void {
    this.contractsStore.clear();
    this.invoicesStore.clear();
    this.receiptsStore.clear();
    this.successFeeStore.clear();
  }

  // ============================================================================
  // 1. GESTÃO CONTRATUAL E VIGÊNCIA (CONTRACTED REVENUE)
  // ============================================================================

  public registerContract(contract: ClientContractModel): ClientContractModel {
    const copy = { ...contract };
    this.contractsStore.set(copy.id, copy);
    return copy;
  }

  public getContract(contractId: string): ClientContractModel | undefined {
    return this.contractsStore.get(contractId);
  }

  /**
   * Verifica se o contrato é considerado vigente para uma data ou competência (YYYY-MM).
   */
  public isContractActive(contract: ClientContractModel, competenceOrDate?: string): boolean {
    if (contract.status !== 'active') return false;
    if (!competenceOrDate) return true;

    // Normaliza para comparação em formato YYYY-MM ou YYYY-MM-DD
    const target = competenceOrDate.length === 7 ? `${competenceOrDate}-01` : competenceOrDate;
    const start = contract.start_date.length === 7 ? `${contract.start_date}-01` : contract.start_date;

    if (target < start) return false;

    if (contract.end_date) {
      let end: string;
      if (contract.end_date.length === 7) {
        const parts = contract.end_date.split('-').map(Number);
        const y = parts[0]!;
        const m = parts[1]!;
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        end = `${contract.end_date}-${String(lastDay).padStart(2, '0')}`;
      } else {
        end = contract.end_date;
      }
      if (target > end) return false;
    }

    return true;
  }

  /**
   * Aplica reajuste inflacionário/contratual com registro auditável em metadata.
   */
  public applyContractAdjustment(
    contractId: string,
    adjustmentPercent: number,
    effectiveDate: string,
    reason = 'Reajuste anual contratual'
  ): ClientContractModel {
    const contract = this.contractsStore.get(contractId);
    if (!contract) {
      throw new Error(`Contrato ${contractId} não encontrado.`);
    }

    if (contract.monthly_recurring_value_brl === null || contract.monthly_recurring_value_brl === undefined) {
      throw new Error(`Contrato ${contract.contract_number} não possui valor recorrente definido para reajuste.`);
    }

    const previousValue = Number(contract.monthly_recurring_value_brl);
    const multiplier = 1 + adjustmentPercent / 100;
    const newValue = round2(previousValue * multiplier);

    const history = (contract.metadata?.adjustments as any[]) || [];
    history.push({
      previous_value_brl: previousValue,
      adjustment_percent: adjustmentPercent,
      new_value_brl: newValue,
      effective_date: effectiveDate,
      reason,
      applied_at: new Date().toISOString()
    });

    const updated: ClientContractModel = {
      ...contract,
      monthly_recurring_value_brl: newValue,
      last_adjustment_date: effectiveDate,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(contract.metadata || {}),
        adjustments: history
      }
    };

    this.contractsStore.set(contractId, updated);
    return updated;
  }

  // ============================================================================
  // 2. MOTOR DE SUCCESS FEE (M&V + CONTRATO + HITL NÍVEL 2)
  // ============================================================================

  /**
   * Avalia a elegibilidade de Success Fee baseando-se estritamente na validação do AG-004 e nas cláusulas.
   */
  public assessSuccessFeeEligibility(
    contract: ClientContractModel,
    mvReport: MVValidationReportInput
  ): {
    status: 'eligible' | 'not_eligible' | 'incomplete';
    eligibleAmount: number;
    clause: string;
    reason?: string;
  } {
    // 1. Exige que o AG-004 tenha validado a medição
    if (!mvReport.isVerifiedByAG004) {
      return {
        status: 'not_eligible',
        eligibleAmount: 0,
        clause: 'N/A',
        reason: 'Economia não comprovada pelo AG-004 via protocolo IPMVP (apenas estimativas não geram Success Fee).'
      };
    }

    if (mvReport.verifiedSavingsBrl <= 0) {
      return {
        status: 'not_eligible',
        eligibleAmount: 0,
        clause: 'N/A',
        reason: 'Economia apurada é nula ou negativa no período.'
      };
    }

    // 2. Exige contrato ativo na competência
    if (!this.isContractActive(contract, mvReport.competence)) {
      return {
        status: 'not_eligible',
        eligibleAmount: 0,
        clause: 'N/A',
        reason: `Contrato ${contract.contract_number} está expirado ou inativo na competência ${mvReport.competence}.`
      };
    }

    // 3. Exige cláusula expressa de Success Fee
    if (!contract.has_success_fee || contract.success_fee_percent === null || contract.success_fee_percent === undefined) {
      return {
        status: 'not_eligible',
        eligibleAmount: 0,
        clause: 'N/A',
        reason: `Contrato ${contract.contract_number} não prevê remuneração por Success Fee.`
      };
    }

    const feePct = Number(contract.success_fee_percent);
    if (feePct <= 0 || feePct > 100) {
      return {
        status: 'incomplete',
        eligibleAmount: 0,
        clause: contract.success_fee_clause || 'Cláusula de Success Fee inválida',
        reason: `Percentual contratual inválido (${feePct}%).`
      };
    }

    const eligible = round2(mvReport.verifiedSavingsBrl * (feePct / 100));
    const clause = contract.success_fee_clause || `Cláusula contratual de ${feePct}% sobre economia auditada`;

    return {
      status: 'eligible',
      eligibleAmount: eligible,
      clause
    };
  }

  /**
   * Registra um evento de Success Fee. Obrigatoriamente inicia como 'pending_approval' (HITL).
   */
  public registerSuccessFeeEvent(
    contract: ClientContractModel,
    mvReport: MVValidationReportInput
  ): SuccessFeeEventModel {
    const assessment = this.assessSuccessFeeEligibility(contract, mvReport);

    if (assessment.status !== 'eligible') {
      const blockedEvent: SuccessFeeEventModel = {
        id: randomUUID(),
        contract_id: contract.id,
        client_id: contract.client_id,
        mv_report_id: mvReport.id,
        competence: mvReport.competence,
        verified_savings_brl: mvReport.verifiedSavingsBrl,
        clause_applied: assessment.clause,
        fee_percent: contract.success_fee_percent || 0,
        eligible_amount_brl: 0,
        approval_status: 'rejected',
        status: 'not_eligible',
        created_at: new Date().toISOString()
      };
      this.successFeeStore.set(blockedEvent.id, blockedEvent);
      return blockedEvent;
    }

    const event: SuccessFeeEventModel = {
      id: randomUUID(),
      contract_id: contract.id,
      client_id: contract.client_id,
      mv_report_id: mvReport.id,
      competence: mvReport.competence,
      verified_savings_brl: mvReport.verifiedSavingsBrl,
      clause_applied: assessment.clause,
      fee_percent: contract.success_fee_percent!,
      eligible_amount_brl: assessment.eligibleAmount,
      approval_status: 'pending_approval',
      status: 'pending_approval',
      created_at: new Date().toISOString()
    };

    this.successFeeStore.set(event.id, event);
    return event;
  }

  /**
   * Aprovação humana (HITL Nível 2) obrigatória para liberar o faturamento de Success Fee.
   */
  public approveSuccessFee(eventId: string, approvedBy: string): SuccessFeeEventModel {
    const event = this.successFeeStore.get(eventId);
    if (!event) throw new Error(`Evento de Success Fee ${eventId} não encontrado.`);

    if (event.status === 'not_eligible') {
      throw new Error(`Evento ${eventId} não é elegível para aprovação financeira.`);
    }

    const updated: SuccessFeeEventModel = {
      ...event,
      approval_status: 'approved',
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    };

    this.successFeeStore.set(eventId, updated);
    return updated;
  }

  // ============================================================================
  // 3. FATURAMENTO (INVOICED REVENUE) & PREVENÇÃO DE DUPLICIDADE
  // ============================================================================

  /**
   * Gera a fatura da competência para o contrato.
   * Impede faturamento duplicado para a mesma competência e contrato.
   */
  public generateMonthlyInvoice(
    contractId: string,
    competence: string,
    successFeeEventId?: string
  ): RevenueInvoiceModel {
    const contract = this.contractsStore.get(contractId);
    if (!contract) throw new Error(`Contrato ${contractId} não encontrado.`);

    if (!this.isContractActive(contract, competence)) {
      throw new Error(`Contrato ${contract.contract_number} está expirado ou inativo na competência ${competence}.`);
    }

    // Prevenção estrita de duplicidade de faturamento
    const existing = Array.from(this.invoicesStore.values()).find(
      (inv) => inv.contract_id === contractId && inv.competence === competence && inv.status !== 'cancelled'
    );
    if (existing) {
      throw new Error(
        `Fatura já existente para o contrato ${contract.contract_number} na competência ${competence} (Fatura: ${existing.invoice_number}). Faturamento duplicado bloqueado.`
      );
    }

    const recurringAmount = contract.monthly_recurring_value_brl !== null && contract.monthly_recurring_value_brl !== undefined
      ? Number(contract.monthly_recurring_value_brl)
      : 0;

    let successFeeAmount = 0;
    if (successFeeEventId) {
      const sfEvent = this.successFeeStore.get(successFeeEventId);
      if (!sfEvent) throw new Error(`Evento de Success Fee ${successFeeEventId} não encontrado.`);
      if (sfEvent.approval_status !== 'approved') {
        throw new Error(`Evento de Success Fee ${successFeeEventId} requer aprovação humana prévia para faturamento.`);
      }
      if (sfEvent.status === 'invoiced') {
        throw new Error(`Evento de Success Fee ${successFeeEventId} já foi faturado anteriormente.`);
      }
      successFeeAmount = sfEvent.eligible_amount_brl;
    }

    const invoiceNumber = `FAT-${contract.contract_number}-${competence.replace('-', '')}`;
    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const invoice: RevenueInvoiceModel = {
      id: randomUUID(),
      contract_id: contract.id,
      client_id: contract.client_id,
      invoice_number: invoiceNumber,
      competence,
      issue_date: issueDate,
      due_date: dueDate,
      recurring_amount_brl: round2(recurringAmount),
      success_fee_amount_brl: round2(successFeeAmount),
      total_amount_brl: round2(recurringAmount + successFeeAmount),
      status: 'issued',
      created_at: new Date().toISOString()
    };

    this.invoicesStore.set(invoice.id, invoice);

    // Marca o evento de success fee como faturado
    if (successFeeEventId) {
      const sfEvent = this.successFeeStore.get(successFeeEventId)!;
      this.successFeeStore.set(successFeeEventId, {
        ...sfEvent,
        invoice_id: invoice.id,
        status: 'invoiced'
      });
    }

    return invoice;
  }

  // ============================================================================
  // 4. LIQUIDAÇÃO E RECEBIMENTO (RECEIVED REVENUE)
  // ============================================================================

  /**
   * Registra um pagamento recebido, tratando quitação total ou pagamentos parciais.
   */
  public registerReceipt(
    invoiceId: string,
    receiptInput: RegisterReceiptInput
  ): {
    updatedInvoice: RevenueInvoiceModel;
    receiptRecord: RevenueReceiptModel;
  } {
    const invoice = this.invoicesStore.get(invoiceId);
    if (!invoice) throw new Error(`Fatura ${invoiceId} não encontrada.`);

    const existingReceipts = this.receiptsStore.get(invoiceId) || [];
    const totalAlreadyReceived = existingReceipts.reduce((acc, r) => acc + r.amount_received_brl, 0);

    const newAmount = Number(receiptInput.amount);
    if (newAmount <= 0) throw new Error(`Valor do recebimento deve ser maior que zero.`);

    const totalAfterReceipt = round2(totalAlreadyReceived + newAmount);
    const balanceRemaining = round2(Math.max(0, invoice.total_amount_brl - totalAfterReceipt));
    const isPartial = balanceRemaining > 0;

    const receiptRecord: RevenueReceiptModel = {
      id: randomUUID(),
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      receipt_date: receiptInput.date,
      amount_received_brl: newAmount,
      transaction_reference: receiptInput.transactionReference,
      is_partial: isPartial,
      balance_remaining_brl: balanceRemaining,
      created_at: new Date().toISOString()
    };

    existingReceipts.push(receiptRecord);
    this.receiptsStore.set(invoiceId, existingReceipts);

    const updatedInvoice: RevenueInvoiceModel = {
      ...invoice,
      status: isPartial ? 'partially_paid' : 'paid'
    };
    this.invoicesStore.set(invoiceId, updatedInvoice);

    // Se a fatura continha success fee e foi 100% quitada, marca o evento de success fee como received
    if (!isPartial) {
      for (const [id, sf] of this.successFeeStore.entries()) {
        if (sf.invoice_id === invoice.id && sf.status === 'invoiced') {
          this.successFeeStore.set(id, { ...sf, status: 'received' });
        }
      }
    }

    return { updatedInvoice, receiptRecord };
  }

  // ============================================================================
  // 5. DEMONSTRATIVO CONSOLIDADO DE MARGEM REAL POR CLIENTE E COMPETÊNCIA
  // ============================================================================

  /**
   * Consolida a margem financeira real para o cliente na competência.
   * Integra custos de IA trazidos do FinOps Ledger (S6-02).
   */
  public generateClientMarginReport(
    clientId: string,
    competence: string,
    aiCostSummary: ClientCostSummary,
    directSupportCostBrl = 0
  ): RealMarginReport {
    // 1. Contratos
    const clientContracts = Array.from(this.contractsStore.values()).filter(
      (c) => c.client_id === clientId && this.isContractActive(c, competence)
    );

    let contractedMrr: number | null = 0;
    if (clientContracts.length === 0) {
      contractedMrr = null;
    } else {
      let sum = 0;
      let hasMissing = false;
      for (const c of clientContracts) {
        if (c.monthly_recurring_value_brl === null || c.monthly_recurring_value_brl === undefined) {
          hasMissing = true;
        } else {
          sum += Number(c.monthly_recurring_value_brl);
        }
      }
      contractedMrr = hasMissing && sum === 0 ? null : round2(sum);
    }

    // 2. Faturas emitidas na competência
    const invoices = Array.from(this.invoicesStore.values()).filter(
      (inv) => inv.client_id === clientId && inv.competence === competence && inv.status !== 'cancelled'
    );

    let invoicedMrr = 0;
    let invoicedSf = 0;
    for (const inv of invoices) {
      invoicedMrr += inv.recurring_amount_brl;
      invoicedSf += inv.success_fee_amount_brl;
    }
    const totalInvoiced = round2(invoicedMrr + invoicedSf);

    // 3. Recebimentos obtidos para as faturas dessa competência
    let receivedMrr = 0;
    let receivedSf = 0;
    for (const inv of invoices) {
      const receipts = this.receiptsStore.get(inv.id) || [];
      const totalRec = receipts.reduce((acc, r) => acc + r.amount_received_brl, 0);

      if (inv.total_amount_brl > 0) {
        const ratioRec = Math.min(1, totalRec / inv.total_amount_brl);
        receivedMrr += inv.recurring_amount_brl * ratioRec;
        receivedSf += inv.success_fee_amount_brl * ratioRec;
      }
    }
    receivedMrr = round2(receivedMrr);
    receivedSf = round2(receivedSf);
    const totalReceived = round2(receivedMrr + receivedSf);

    // 4. Custos Diretos (Suporte + IA vindo do Ledger)
    const aiUsd = round4(aiCostSummary.costUsd);
    const aiBrl = round2(aiCostSummary.costBrl);
    const totalCosts = round2(directSupportCostBrl + aiBrl);

    // 5. Margens
    const marginInvoicedBrl = round2(totalInvoiced - totalCosts);
    const marginInvoicedPct = totalInvoiced > 0 ? round2((marginInvoicedBrl / totalInvoiced) * 100) : 0;

    const marginReceivedBrl = round2(totalReceived - totalCosts);
    const marginReceivedPct = totalReceived > 0 ? round2((marginReceivedBrl / totalReceived) * 100) : 0;

    const reliability =
      contractedMrr !== null && (totalInvoiced > 0 || totalReceived > 0)
        ? 'measured'
        : 'incomplete';

    return {
      client_id: clientId,
      competence,
      contracted_mrr_brl: contractedMrr,
      invoiced_mrr_brl: invoicedMrr,
      invoiced_success_fee_brl: invoicedSf,
      total_invoiced_brl: totalInvoiced,
      received_mrr_brl: receivedMrr,
      received_success_fee_brl: receivedSf,
      total_received_brl: totalReceived,
      direct_support_cost_brl: directSupportCostBrl,
      ai_cost_usd: aiUsd,
      ai_cost_brl: aiBrl,
      total_direct_costs_brl: totalCosts,
      margin_on_invoiced_brl: marginInvoicedBrl,
      margin_on_invoiced_percent: marginInvoicedPct,
      margin_on_received_brl: marginReceivedBrl,
      margin_on_received_percent: marginReceivedPct,
      reliability
    };
  }
}

