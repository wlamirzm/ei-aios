'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Send,
  Copy,
  Check,
  FileText,
  Server,
  Play,
  Inbox,
  ArrowRight
} from 'lucide-react';
import {
  fetchEmailAccounts,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  syncEmailAccount,
  simulateIncomingEmail,
  fetchEmailMessages,
  executeEmailNextStep
} from '@/lib/api-client';

export default function EmailsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [operationalMetrics, setOperationalMetrics] = useState<any | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Form states for new account
  const [accountLabel, setAccountLabel] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [operationMode, setOperationMode] = useState<
    'monitor_only' | 'read_summarize' | 'assisted_action' | 'auto_action'
  >('read_summarize');

  const [isCreating, setIsCreating] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [accRes, msgRes] = await Promise.all([
        fetchEmailAccounts(),
        fetchEmailMessages(selectedAccountId || undefined)
      ]);
      if (accRes?.accounts) setAccounts(accRes.accounts);
      if (msgRes?.messages) setMessages(msgRes.messages);
      if (msgRes?.operational_metrics) setOperationalMetrics(msgRes.operational_metrics);
    } catch {
      // ignore background error
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 6000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Auto-preenche mail.seudominio.com.br (padrão cPanel HostGator) ao digitar o e-mail
  const handleEmailChange = (val: string) => {
    setEmailAddress(val);
    const parts = val.trim().split('@');
    if (parts.length === 2 && parts[1]) {
      const autoHost = `mail.${parts[1].toLowerCase()}`;
      setImapHost(autoHost);
      setSmtpHost(autoHost);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAddress.trim() || !password.trim() || isCreating) return;

    setIsCreating(true);
    setFeedback(null);
    try {
      await createEmailAccount({
        account_label: accountLabel.trim() || emailAddress.trim(),
        email_address: emailAddress.trim(),
        password,
        imap_host: imapHost.trim() || undefined,
        imap_port: Number(imapPort) || 993,
        smtp_host: smtpHost.trim() || undefined,
        smtp_port: Number(smtpPort) || 465,
        operation_mode: operationMode
      });

      setAccountLabel('');
      setEmailAddress('');
      setPassword('');
      setImapHost('');
      setSmtpHost('');
      setFeedback({
        text: 'Conta de e-mail HostGator cPanel cadastrada com sucesso! Você já pode sincronizar via IMAP ou simular um e-mail na linha da conta.'
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Erro ao cadastrar conta de e-mail', isError: true });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleRowMode = async (
    accountId: string,
    newMode: 'monitor_only' | 'read_summarize' | 'assisted_action' | 'auto_action'
  ) => {
    setBusyAccountId(accountId);
    try {
      await updateEmailAccount(accountId, { operation_mode: newMode });
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, operation_mode: newMode } : a))
      );
      setFeedback({
        text: `Modo da conta atualizado para: ${
          newMode === 'auto_action'
            ? 'Ação Automática (Ler, Resumir + Disparar Agentes conforme Política)'
            : newMode === 'assisted_action'
              ? 'Ação Assistida (Cria Tarefa com Aprovação Humana Obrigatória)'
              : 'Somente Monitorar e Resumir'
        }`
      });
    } catch (err: any) {
      setFeedback({ text: err.message, isError: true });
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleSyncAccount = async (accountId: string) => {
    setBusyAccountId(accountId);
    setFeedback(null);
    try {
      const res = await syncEmailAccount(accountId);
      setFeedback({
        text: res.status || `Sincronização IMAP concluída (${res.syncedCount || 0} mensagem(ns) processada(s)).`
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ text: `IMAP HostGator: ${err.message}`, isError: true });
      await loadData();
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleSimulateEmail = async (accountId: string, scenario: 'bill' | 'regulatory') => {
    setBusyAccountId(accountId);
    setFeedback(null);
    try {
      const res = await simulateIncomingEmail(accountId, scenario);
      const modeUsed = res?.message?.operation_mode_applied;
      const taskCode = res?.message?.triggered_task_code;
      setFeedback({
        text:
          modeUsed === 'auto_action'
            ? `E-mail recebido e analisado pelo AG-012! Modo Ação Automática ativo: Tarefa ${taskCode} disparada para ${res?.message?.recommended_agent_id}.`
            : modeUsed === 'assisted_action'
              ? `E-mail recebido! Modo Ação Assistida: Tarefa ${taskCode} criada aguardando aprovação humana em /approvals.`
              : `E-mail recebido e resumido pelo AG-012 (Modo Somente Monitorar e Resumir). Confira o próximo passo recomendado abaixo!`
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ text: err.message, isError: true });
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    setBusyAccountId(accountId);
    try {
      await deleteEmailAccount(accountId);
      await loadData();
    } catch (err: any) {
      setFeedback({ text: err.message, isError: true });
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleExecuteNextStep = async (messageId: string) => {
    setBusyMessageId(messageId);
    setFeedback(null);
    try {
      const res = await executeEmailNextStep(messageId);
      setFeedback({
        text: `Próximo passo acionado com sucesso! Tarefa ${res?.task?.task_code || res?.triggered_task_code} enviada para execução.`
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ text: err.message, isError: true });
    } finally {
      setBusyMessageId(null);
    }
  };

  const handleCopyDraft = (id: string, draft: string) => {
    navigator.clipboard.writeText(draft || '');
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Mail className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold text-white">
              Central de E-mails HostGator cPanel & Governança AG-012
            </h1>
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-mono font-bold px-2.5 py-0.5 rounded">
              AG-012 ONLINE
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Cadastre múltiplas contas de e-mail cPanel da HostGator (IMAP SSL 993 / SMTP SSL 465) e escolha em cada linha entre{' '}
            <strong className="text-slate-200">Somente Monitorar</strong>,{' '}
            <strong className="text-amber-400">Ação Assistida</strong> ou{' '}
            <strong className="text-emerald-400">Ação Automática</strong>.
          </p>
        </div>

        <button
          onClick={loadData}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar Caixa ({messages.length})</span>
        </button>
      </div>

      {/* INDICADORES OPERACIONAIS DO AG-012 (SEÇÃO 7.14) */}
      {operationalMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[10px] font-mono uppercase text-slate-400">E-mails Processados</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              {operationalMetrics.total_messages_processed}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {operationalMetrics.active_accounts_count} conta(s) ativa(s)
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[10px] font-mono uppercase text-slate-400">% Classificados</div>
            <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
              {operationalMetrics.classified_rate_percent}%
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Contrato email.analysis</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[10px] font-mono uppercase text-slate-400">P0 / P1 Críticos</div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              {operationalMetrics.p0_p1_identified_count}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Triagem Prioritária</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[10px] font-mono uppercase text-slate-400">Ações Automáticas</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {operationalMetrics.auto_actions_executed_count}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              +{operationalMetrics.assisted_actions_queued_count || 0} assistida(s)
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[10px] font-mono uppercase text-slate-400">Bloqueios Segurança</div>
            <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
              {operationalMetrics.actions_blocked_security_count}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Anti-Injection / Anexos</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[10px] font-mono uppercase text-slate-400">Minutas Geradas</div>
            <div className="text-lg font-bold font-mono text-purple-300 mt-0.5">
              {operationalMetrics.drafts_produced_count}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Prontas p/ Revisão</div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
            feedback.isError
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          {feedback.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. FORMULÁRIO DE CADASTRO DE CONTA HOSTGATOR CPANEL */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Adicionar Nova Conta de E-mail (Padrão cPanel HostGator)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            IMAP SSL: 993 • SMTP SSL: 465 • Host: mail.seudominio.com.br
          </span>
        </div>

        <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">Identificação / Setor</label>
            <input
              type="text"
              placeholder="Ex: Comercial / Faturas"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] text-slate-400 block mb-1">E-mail cPanel HostGator *</label>
            <input
              type="email"
              required
              placeholder="contato@seudominio.com.br"
              value={emailAddress}
              onChange={(e) => handleEmailChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">Senha do E-mail *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">Servidor IMAP (Porta 993)</label>
            <input
              type="text"
              placeholder="mail.seudominio.com.br"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">Modo Inicial na Linha</label>
            <select
              value={operationMode}
              onChange={(e) =>
                setOperationMode(
                  e.target.value as 'monitor_only' | 'read_summarize' | 'assisted_action' | 'auto_action'
                )
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="read_summarize">📖 Somente Monitorar e Resumir</option>
              <option value="assisted_action">🛡️ Ação Assistida (c/ Aprovação)</option>
              <option value="auto_action">⚡ Ação Automática</option>
            </select>
          </div>

          <div className="md:col-span-6 flex justify-end pt-1">
            <button
              type="submit"
              disabled={isCreating}
              className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-sky-500/10"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Cadastrando...' : 'Cadastrar Conta de E-mail'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. TABELA DE MÚLTIPLAS CONTAS CADASTRADAS (CONTROLE POR LINHA) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              Contas de E-mail Cadastradas ({accounts.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Em cada linha, alterne quando quiser entre <strong>Somente Monitorar</strong>,{' '}
              <strong>Ação Assistida</strong> ou <strong>Ação Automática</strong>.
            </p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhuma conta de e-mail cadastrada ainda. Adicione sua primeira conta HostGator cPanel no formulário acima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <th className="py-3 px-4">Conta / E-mail</th>
                  <th className="py-3 px-4">Servidor IMAP cPanel</th>
                  <th className="py-3 px-4">Modo de Operação (Por Linha)</th>
                  <th className="py-3 px-4">Último Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {accounts.map((acc) => {
                  const isBusy = busyAccountId === acc.id;
                  const isAuto = acc.operation_mode === 'auto_action';
                  const isAssisted = acc.operation_mode === 'assisted_action';

                  return (
                    <tr key={acc.id} className="hover:bg-slate-950/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{acc.account_label}</div>
                        <div className="text-[11px] text-sky-400 font-mono">{acc.email_address}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                        {acc.imap_host}:{acc.imap_port} (SSL)
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          disabled={isBusy}
                          value={acc.operation_mode}
                          onChange={(e) =>
                            handleToggleRowMode(
                              acc.id,
                              e.target.value as 'monitor_only' | 'read_summarize' | 'assisted_action' | 'auto_action'
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border focus:outline-none transition ${
                            isAuto
                              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                              : isAssisted
                                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                                : 'bg-slate-950 border-slate-700 text-slate-200'
                          }`}
                        >
                          <option value="read_summarize">📖 Somente Monitorar e Resumir</option>
                          <option value="assisted_action">🛡️ Ação Assistida (Cria Tarefa c/ Aprovação)</option>
                          <option value="auto_action">⚡ Ação Automática (Disparar Agentes)</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-slate-300 line-clamp-1">
                          {acc.last_sync_status || 'Pronta para sincronizar'}
                        </div>
                        {acc.last_synced_at && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {new Date(acc.last_synced_at).toLocaleString('pt-BR')}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSyncAccount(acc.id)}
                            disabled={isBusy}
                            className="bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
                            title="Conectar ao servidor IMAP da HostGator e ler últimos e-mails"
                          >
                            <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                            <span>Ler IMAP</span>
                          </button>

                          <button
                            onClick={() => handleSimulateEmail(acc.id, 'bill')}
                            disabled={isBusy}
                            className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
                            title="Simular chegada de um e-mail comercial/fatura nesta conta para testar o AG-012"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Testar Triagem</span>
                          </button>

                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            disabled={isBusy}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/30 transition"
                            title="Remover conta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. FEED DE E-MAILS ANALISADOS PELO AG-012 & PRÓXIMOS PASSOS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              E-mails Analisados & Próximo Passo Recomendado (AG-012)
            </h2>
            <p className="text-xs text-slate-400">
              Cada e-mail lido exibe o resumo executivo, o próximo passo estratégico e a minuta de resposta.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtrar por Conta:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="">Todas as Contas ({messages.length})</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_label} ({a.email_address})
                </option>
              ))}
            </select>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center space-y-2">
            <Inbox className="w-9 h-9 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200">Nenhum E-mail Analisado Ainda</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cadastre uma conta de e-mail acima e clique em <strong>Ler IMAP</strong> (para buscar da sua caixa HostGator) ou em <strong>Testar Triagem</strong> para ver o <strong>AG-012</strong> em ação.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isAutoMode = msg.operation_mode_applied === 'auto_action';
              const isAssistedMode = msg.operation_mode_applied === 'assisted_action';
              const hasTask = Boolean(msg.triggered_task_id || msg.triggered_task_code);

              return (
                <div
                  key={msg.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg hover:border-slate-700 transition"
                >
                  {/* Cabeçalho do E-mail */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                          {msg.account?.account_label || 'Conta E-mail'} ({msg.account?.email_address})
                        </span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          {msg.category}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Prioridade {msg.priority}
                        </span>
                        {msg.confidence_score && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
                            Confiança: {Math.round(Number(msg.confidence_score) * 100)}%
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            isAutoMode
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : isAssistedMode
                                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                                : 'bg-slate-950 border-slate-700 text-slate-400'
                          }`}
                        >
                          {isAutoMode
                            ? '⚡ Processado em Ação Automática'
                            : isAssistedMode
                              ? '🛡️ Processado em Ação Assistida'
                              : '📖 Processado em Somente Monitorar'}
                        </span>
                        {msg.thread_id && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-500">
                            Thread: {String(msg.thread_id).slice(0, 22)}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white">{msg.subject}</h3>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                        <span>
                          <strong>De:</strong> {msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          {msg.received_at ? new Date(msg.received_at).toLocaleString('pt-BR') : 'Hoje'}
                        </span>
                        {msg.has_attachments && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-400 font-mono text-[11px] flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Anexo: {(msg.attachment_names || []).join(', ') || 'fatura.pdf'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Botão ou Badge de Tarefa */}
                    <div className="shrink-0">
                      {hasTask ? (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <div className="text-left">
                            <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                              Tarefa Disparada ({msg.recommended_agent_id})
                            </div>
                            <Link
                              href="/tasks"
                              className="text-xs font-mono text-white hover:underline flex items-center gap-1"
                            >
                              <span>{msg.triggered_task_code || 'Ver no Kanban'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleExecuteNextStep(msg.id)}
                          disabled={busyMessageId === msg.id}
                          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>
                            {busyMessageId === msg.id
                              ? 'Disparando...'
                              : `Disparar Próximo Passo (${msg.recommended_agent_id})`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid: Resumo Executivo + Próximo Passo Recomendado */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-sky-400 font-bold block">
                        📋 Resumo Executivo (AG-012)
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed">{msg.ai_summary}</p>
                      <details className="pt-1">
                        <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-300">
                          Ver trecho original do e-mail recebido
                        </summary>
                        <p className="mt-1.5 text-[11px] text-slate-400 font-mono bg-slate-900 p-2.5 rounded border border-slate-800 whitespace-pre-wrap">
                          {msg.body_excerpt}
                        </p>
                      </details>
                    </div>

                    <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-lg p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-indigo-300 font-bold">
                          🎯 Próximo Passo Recomendado pelo AG-012
                        </span>
                        <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold">
                          Agente Sugerido: {msg.recommended_agent_id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-medium">
                        {msg.recommended_next_step}
                      </p>
                    </div>
                  </div>

                  {/* Minuta de Resposta Sugerida */}
                  {msg.suggested_reply_draft && (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                          ✉️ Minuta de Resposta Sugerida pelo AG-012
                        </span>
                        <button
                          onClick={() => handleCopyDraft(msg.id, msg.suggested_reply_draft)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] flex items-center gap-1 transition"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar Resposta</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                        {msg.suggested_reply_draft}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

