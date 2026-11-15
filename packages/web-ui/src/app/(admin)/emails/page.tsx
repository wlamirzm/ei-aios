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
  ArrowRight,
  ExternalLink,
  X,
  Globe
} from 'lucide-react';
import {
  fetchEmailAccounts,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  syncEmailAccount,
  simulateIncomingEmail,
  fetchEmailMessages,
  executeEmailNextStep,
  sendEmailMessage
} from '@/lib/api-client';

export default function EmailsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [operationalMetrics, setOperationalMetrics] = useState<any | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Provider: hostgator_cpanel ou gmail
  const [accountProvider, setAccountProvider] = useState<'hostgator_cpanel' | 'gmail'>('hostgator_cpanel');
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

  // Estado do Modal de Envio de E-mail via Gmail / SMTP
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendAccountId, setSendAccountId] = useState<string>('');
  const [sendTo, setSendTo] = useState<string>('');
  const [sendSubject, setSendSubject] = useState<string>('');
  const [sendBody, setSendBody] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

  // Altera os hosts automaticamente de acordo com o provedor selecionado
  const handleProviderChange = (newProvider: 'hostgator_cpanel' | 'gmail') => {
    setAccountProvider(newProvider);
    if (newProvider === 'gmail') {
      setImapHost('imap.gmail.com');
      setImapPort(993);
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(465);
    } else {
      const parts = emailAddress.trim().split('@');
      const domain = parts[1] ? parts[1].toLowerCase() : 'seudominio.com.br';
      setImapHost(`mail.${domain}`);
      setImapPort(993);
      setSmtpHost(`mail.${domain}`);
      setSmtpPort(465);
    }
  };

  // Auto-detecta Gmail ou host cPanel ao digitar o e-mail
  const handleEmailChange = (val: string) => {
    setEmailAddress(val);
    const lower = val.trim().toLowerCase();
    if (lower.includes('@gmail.com') || lower.includes('@googlemail.com')) {
      setAccountProvider('gmail');
      setImapHost('imap.gmail.com');
      setImapPort(993);
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(465);
    } else if (accountProvider === 'hostgator_cpanel') {
      const parts = lower.split('@');
      if (parts.length === 2 && parts[1]) {
        const autoHost = `mail.${parts[1]}`;
        setImapHost(autoHost);
        setSmtpHost(autoHost);
      }
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
        provider: accountProvider,
        imap_host: imapHost.trim() || (accountProvider === 'gmail' ? 'imap.gmail.com' : undefined),
        imap_port: Number(imapPort) || 993,
        smtp_host: smtpHost.trim() || (accountProvider === 'gmail' ? 'smtp.gmail.com' : undefined),
        smtp_port: Number(smtpPort) || 465,
        operation_mode: operationMode
      });

      setAccountLabel('');
      setEmailAddress('');
      setPassword('');
      setImapHost('');
      setSmtpHost('');
      setFeedback({
        text: `Conta de e-mail (${accountProvider === 'gmail' ? 'Gmail' : 'HostGator cPanel'}) cadastrada com sucesso!`
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
      setFeedback({ text: `IMAP: ${err.message}`, isError: true });
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

  // Abre a tela oficial do Gmail Web com destinatário, assunto e corpo já preenchidos (1 clique)
  const openGmailWebCompose = (to: string, subject: string, body: string) => {
    if (!to.trim()) {
      setFeedback({ text: 'Por favor, informe o destinatário (Para) antes de enviar.', isError: true });
      return;
    }
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsSendModalOpen(false);
    setFeedback({
      text: `Tela de envio do Gmail aberta com sucesso em nova aba para ${to.trim()}! O e-mail está pronto para disparo.`,
      isError: false
    });
  };

  // Abre o modal de envio com a minuta sugerida pelo AG-012
  const handleOpenSendModalForMessage = (msg: any) => {
    setSendAccountId(msg.account_id || '');
    setSendTo(msg.from_address || '');
    setSendSubject(msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || ''}`);
    setSendBody(msg.suggested_reply_draft || '');
    setIsSendModalOpen(true);
  };

  // Abre o modal para compor novo e-mail
  const handleOpenComposeModal = () => {
    setSendAccountId(accounts[0]?.id || '');
    setSendTo('');
    setSendSubject('');
    setSendBody('');
    setIsSendModalOpen(true);
  };

  // Disparo direto via servidor SMTP (Gmail / HostGator)
  const handleSendViaSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTo.trim()) {
      setFeedback({ text: 'Por favor, informe o destinatário (Para).', isError: true });
      return;
    }
    if (!sendSubject.trim()) {
      setFeedback({ text: 'Por favor, informe o assunto da mensagem.', isError: true });
      return;
    }
    if (!sendBody.trim()) {
      setFeedback({ text: 'Por favor, informe o corpo da mensagem.', isError: true });
      return;
    }
    if (isSendingEmail) return;

    setIsSendingEmail(true);
    setFeedback(null);
    try {
      const res = await sendEmailMessage({
        accountId: sendAccountId || undefined,
        to: sendTo.trim(),
        subject: sendSubject.trim(),
        text: sendBody.trim()
      });

      setIsSendModalOpen(false);
      setFeedback({
        text: `E-mail enviado com sucesso via SMTP! ID da mensagem: ${res.messageId || 'OK'} (${res.sentFrom || 'Enviado'}).`,
        isError: false
      });
    } catch (err: any) {
      setIsSendModalOpen(false);
      setFeedback({
        text: `Falha no envio do e-mail: ${err.message || 'Erro ao autenticar no servidor de e-mail.'}`,
        isError: true
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Mail className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold text-white">
              Central de E-mails & Governança AG-012 (HostGator cPanel & Gmail)
            </h1>
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-mono font-bold px-2.5 py-0.5 rounded">
              AG-012 ONLINE
            </span>
            <span className="bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-mono font-bold px-2.5 py-0.5 rounded flex items-center gap-1">
              <Send className="w-3 h-3" /> GMAIL READY
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Conecte suas contas de e-mail corporativas (<strong>HostGator cPanel</strong> ou <strong>Gmail</strong>),
            leia mensagens via IMAP SSL e envie respostas diretamente pelo <strong>Gmail (1-clique)</strong> ou via <strong>SMTP</strong> sob a governança do <strong>AG-012</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* BOTÃO PRINCIPAL DE ENVIO DE E-MAIL VIA GMAIL */}
          <button
            onClick={handleOpenComposeModal}
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-red-600/20 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar E-mail via Gmail</span>
          </button>

          <button
            onClick={loadData}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Caixa ({messages.length})</span>
          </button>
        </div>
      </div>

      {/* INDICADORES OPERACIONAIS DO AG-012 */}
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
            <div className="text-[10px] text-slate-500 font-mono">Prontas p/ Envio</div>
          </div>
        </div>
      )}

      {/* NOTIFICAÇÃO FLUTUANTE (TOAST) DE STATUS DE ENVIO */}
      {feedback && (
        <div
          className={`fixed top-5 right-5 z-[80] max-w-md w-[calc(100vw-40px)] sm:w-full p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-top-4 duration-200 ${
            feedback.isError
              ? 'bg-rose-950/95 border-rose-500/60 text-rose-200 shadow-rose-950/50'
              : 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200 shadow-emerald-950/50'
          }`}
        >
          {feedback.isError ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          )}
          <div className="flex-1 text-xs font-mono leading-relaxed">
            <span className="font-bold block text-white text-sm mb-1">
              {feedback.isError ? 'Falha no Envio de E-mail' : 'Confirmação de Envio'}
            </span>
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
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
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. FORMULÁRIO DE CADASTRO DE CONTA (HOSTGATOR OU GMAIL) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Adicionar Conta de E-mail para Monitoramento & Envio
              </h2>
              <p className="text-xs text-slate-400">
                Selecione o provedor para preenchimento automático das configurações de conexão segura.
              </p>
            </div>
          </div>

          {/* SELETOR DE PROVEDOR: HOSTGATOR CPANEL vs GMAIL */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => handleProviderChange('hostgator_cpanel')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition cursor-pointer ${
                accountProvider === 'hostgator_cpanel'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>HostGator cPanel</span>
            </button>
            <button
              type="button"
              onClick={() => handleProviderChange('gmail')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition cursor-pointer ${
                accountProvider === 'gmail'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-red-400" />
              <span>Gmail / Google Workspace</span>
            </button>
          </div>
        </div>

        {/* DICA DE SENHA DE APP QUANDO GMAIL SELECIONADO */}
        {accountProvider === 'gmail' && (
          <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-200 rounded-xl text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                Para contas Google / Gmail, use uma <strong>Senha de App de 16 caracteres</strong> (com autenticação em duas etapas ativa) gerada em sua conta Google.
              </span>
            </div>
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 underline hover:text-red-300 flex items-center gap-1 shrink-0 font-medium"
            >
              <span>Gerar Senha de App</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">Identificação / Setor</label>
            <input
              type="text"
              placeholder="Ex: Comercial / Gmail Fundador"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] text-slate-400 block mb-1">
              Endereço de E-mail ({accountProvider === 'gmail' ? 'Gmail' : 'cPanel'}) *
            </label>
            <input
              type="email"
              required
              placeholder={accountProvider === 'gmail' ? 'seuemail@gmail.com' : 'contato@seudominio.com.br'}
              value={emailAddress}
              onChange={(e) => handleEmailChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">
              {accountProvider === 'gmail' ? 'Senha de App (16 dígitos) *' : 'Senha do E-mail *'}
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">Servidor IMAP (SSL 993)</label>
            <input
              type="text"
              placeholder={accountProvider === 'gmail' ? 'imap.gmail.com' : 'mail.seudominio.com.br'}
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-[11px] text-slate-400 block mb-1">Modo na Linha</label>
            <select
              value={operationMode}
              onChange={(e) =>
                setOperationMode(
                  e.target.value as 'monitor_only' | 'read_summarize' | 'assisted_action' | 'auto_action'
                )
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="read_summarize">📖 Somente Monitorar</option>
              <option value="assisted_action">🛡️ Ação Assistida (c/ Aprovação)</option>
              <option value="auto_action">⚡ Ação Automática</option>
            </select>
          </div>

          <div className="md:col-span-6 flex items-center justify-between pt-1">
            <div className="text-[11px] text-slate-500 font-mono">
              SMTP: {smtpHost || (accountProvider === 'gmail' ? 'smtp.gmail.com:465' : 'mail.seudominio:465')} (SSL)
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Cadastrando...' : 'Cadastrar Conta de E-mail'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. TABELA DE MÚLTIPLAS CONTAS CADASTRADAS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              Contas de E-mail Cadastradas ({accounts.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gerencie conexões da HostGator e do Gmail. Dispare e-mails ou sincronize a caixa com 1 clique.
            </p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhuma conta de e-mail cadastrada ainda. Adicione uma conta HostGator ou Gmail no formulário acima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <th className="py-3 px-4">Conta / Provedor</th>
                  <th className="py-3 px-4">Servidor IMAP / SMTP</th>
                  <th className="py-3 px-4">Modo de Operação</th>
                  <th className="py-3 px-4">Último Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {accounts.map((acc) => {
                  const isBusy = busyAccountId === acc.id;
                  const isAuto = acc.operation_mode === 'auto_action';
                  const isAssisted = acc.operation_mode === 'assisted_action';
                  const isGmailAccount = acc.provider === 'gmail' || acc.email_address.includes('gmail.com');

                  return (
                    <tr key={acc.id} className="hover:bg-slate-950/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{acc.account_label}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              isGmailAccount
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {isGmailAccount ? 'Gmail' : 'HostGator'}
                          </span>
                        </div>
                        <div className="text-[11px] text-sky-400 font-mono mt-0.5">{acc.email_address}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                        <div>IMAP: {acc.imap_host}:{acc.imap_port}</div>
                        <div className="text-slate-500 text-[10px]">SMTP: {acc.smtp_host || 'smtp.gmail.com'}:{acc.smtp_port || 465}</div>
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
                          <option value="read_summarize">📖 Somente Monitorar</option>
                          <option value="assisted_action">🛡️ Ação Assistida (c/ Aprovação)</option>
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
                          {/* BOTÃO ENVIAR VIA GMAIL / SMTP DESSA CONTA */}
                          <button
                            onClick={() => {
                              setSendAccountId(acc.id);
                              setSendTo('');
                              setSendSubject('');
                              setSendBody('');
                              setIsSendModalOpen(true);
                            }}
                            className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Disparar novo e-mail através desta conta"
                          >
                            <Send className="w-3 h-3 text-red-400" />
                            <span>Enviar</span>
                          </button>

                          <button
                            onClick={() => handleSyncAccount(acc.id)}
                            disabled={isBusy}
                            className="bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Conectar ao servidor IMAP e sincronizar mensagens"
                          >
                            <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                            <span>Ler IMAP</span>
                          </button>

                          <button
                            onClick={() => handleSimulateEmail(acc.id, 'bill')}
                            disabled={isBusy}
                            className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Simular chegada de e-mail nesta conta para testar o AG-012"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Testar Triagem</span>
                          </button>

                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            disabled={isBusy}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/30 transition cursor-pointer"
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
              E-mails Analisados & Resposta Sugerida pelo AG-012
            </h2>
            <p className="text-xs text-slate-400">
              Cada mensagem recebida conta com resumo executivo, próximo passo estratégico e minuta pronta para envio via Gmail.
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
            <Inbox className="w-9 h-9 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200">Nenhum E-mail Analisado Ainda</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cadastre uma conta de e-mail acima e clique em <strong>Ler IMAP</strong> ou em <strong>Testar Triagem</strong> para ver o <strong>AG-012</strong> classificar e minutar a resposta automaticamente.
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
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg hover:border-slate-700 transition"
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
                    <div className="shrink-0 flex items-center gap-2">
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
                          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md cursor-pointer"
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
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
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

                    <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5">
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

                  {/* Minuta de Resposta Sugerida COM DISPARO GMAIL DIRETO */}
                  {msg.suggested_reply_draft && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <span className="text-[11px] font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-emerald-400" />
                          <span>✉️ Minuta de Resposta Gerada pelo AG-012</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {/* BOTÃO 1: ENVIAR VIA GMAIL WEB (1 CLIQUE) */}
                          <button
                            onClick={() =>
                              openGmailWebCompose(
                                msg.from_address,
                                msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || ''}`,
                                msg.suggested_reply_draft
                              )
                            }
                            className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                            title="Abrir diretamente na tela de resposta do Gmail Web"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Responder via Gmail</span>
                            <ExternalLink className="w-3 h-3 text-red-200" />
                          </button>

                          {/* BOTÃO 2: OPÇÕES DE ENVIO / SMTP */}
                          <button
                            onClick={() => handleOpenSendModalForMessage(msg)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                            title="Abrir editor de envio para disparar via SMTP ou customizar"
                          >
                            <Mail className="w-3.5 h-3.5 text-sky-400" />
                            <span>Opções de Envio</span>
                          </button>

                          {/* BOTÃO 3: COPIAR RESPOSTA */}
                          <button
                            onClick={() => handleCopyDraft(msg.id, msg.suggested_reply_draft)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
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

      {/* ========================================================================= */}
      {/* MODAL DE ENVIO DE E-MAIL VIA GMAIL / SERVIDOR SMTP                         */}
      {/* ========================================================================= */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-red-950/40 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Disparo de E-mail via Gmail</h3>
                  <p className="text-xs text-slate-400">
                    Envie em 1 clique pelo <strong>Gmail Web</strong> ou dispare diretamente pelo <strong>Servidor SMTP</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSendModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendViaSmtp} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Seleção de Conta Remetente */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Conta Remetente (De)
                </label>
                <select
                  value={sendAccountId}
                  onChange={(e) => setSendAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="">Minha Conta Gmail Padrão (Gmail Web)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_label} ({acc.email_address}) • {acc.provider === 'gmail' ? 'Gmail' : 'HostGator'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destinatário */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Destinatário (Para) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="cliente@empresa.com.br ou distribuidora@concessionaria.com.br"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Assunto */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Assunto da Mensagem *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Re: Análise de Fatura de Energia / Laudo Técnico AG-003"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Corpo da Mensagem */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 font-semibold">
                    Corpo do E-mail / Mensagem *
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {sendBody.length} caracteres
                  </span>
                </div>
                <textarea
                  required
                  rows={8}
                  placeholder="Prezada diretoria, segue parecer conclusivo..."
                  value={sendBody}
                  onChange={(e) => setSendBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-red-500 leading-relaxed"
                />
              </div>

              {/* Modal Actions */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => openGmailWebCompose(sendTo, sendSubject, sendBody)}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Abrir no Gmail Web (1-Clique)</span>
                  <ExternalLink className="w-3.5 h-3.5 text-red-200" />
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsSendModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSendingEmail}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isSendingEmail ? 'Disparando...' : 'Disparar via SMTP'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
