'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Phone,
  Mail,
  ShieldCheck,
  Trash2,
  X,
  RefreshCw,
  Loader2
} from 'lucide-react';
import {
  fetchClients,
  createClientRecord,
  deleteClientRecord
} from '@/lib/api-client';

interface ConsumerUnit {
  id?: string;
  uc_code: string;
  unit_name: string;
  distributor: string;
  tariff_group: string;
  tariff_modality: string;
  contracted_demand_peak_kw?: number;
}

interface ClientItem {
  id: string;
  company_name: string;
  cnpj?: string;
  segment?: string;
  stage: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  monthly_fee_brl?: number;
  success_fee_percent?: number;
  units?: ConsumerUnit[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states para Novo Cliente
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [segment, setSegment] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('1800');
  const [successFee, setSuccessFee] = useState('20');
  const [ucCode, setUcCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [distributor, setDistributor] = useState('CPFL Paulista');

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchClients();
      setClients(res?.clients || []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await createClientRecord({
        company_name: companyName.trim(),
        cnpj: cnpj.trim() || undefined,
        segment: segment.trim() || undefined,
        stage: 'active_saas',
        contact_name: contactName.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        monthly_fee_brl: Number(monthlyFee) || 0,
        success_fee_percent: Number(successFee) || 20,
        uc_code: ucCode.trim() || undefined,
        unit_name: unitName.trim() || undefined,
        distributor: distributor.trim() || undefined
      });
      setIsModalOpen(false);
      setCompanyName('');
      setCnpj('');
      setSegment('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setUcCode('');
      setUnitName('');
      await loadClients();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao cadastrar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: ClientItem) => {
    if (!confirm(`Deseja excluir o cliente "${client.company_name}" e suas unidades consumidoras?`)) {
      return;
    }
    try {
      await deleteClientRecord(client.id);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir cliente');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" />
            Gestão de Clientes, Unidades Consumidoras e Pilotos
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cadastre os clientes corporativos e suas unidades (Grupo A/B) para monitoramento contínuo e apuração de honorários.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadClients}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente / Piloto</span>
          </button>
        </div>
      </div>

      {/* LISTA DE CLIENTES */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Carregando base real de clientes...</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-semibold text-base">
            Nenhum cliente cadastrado na base.
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            A base operacional está limpa (Zero KM). Clique em &ldquo;Novo Cliente / Piloto&rdquo; acima para cadastrar o primeiro cliente real.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <div key={client.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-bold text-white">{client.company_name}</h2>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold">
                      {(client.stage || 'lead').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    CNPJ: {client.cnpj || 'Não informado'} • Segmento: {client.segment || 'Geral'}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block">Modelo Comercial:</span>
                    <span className="font-semibold text-emerald-400">
                      R$ {Number(client.monthly_fee_brl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês + {Number(client.success_fee_percent || 20).toFixed(2)}% Success Fee
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(client)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                    title="Excluir cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contato & Detalhes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span>{client.contact_name || 'Contato não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span>{client.contact_email || 'E-mail não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>{client.contact_phone || 'Telefone não informado'}</span>
                </div>
              </div>

              {/* UNIDADES CONSUMIDORAS ASSOCIADAS */}
              {client.units && client.units.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Unidades Consumidoras Monitoradas:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {client.units.map((uc) => (
                      <div key={uc.id || uc.uc_code} className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{uc.unit_name}</span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                            UC: {uc.uc_code}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                          <div>Distribuidora: <span className="text-slate-200">{uc.distributor}</span></div>
                          <div>Subgrupo: <span className="text-emerald-400 font-semibold">{uc.tariff_group}</span></div>
                          <div>Modalidade: <span className="text-slate-200">{uc.tariff_modality}</span></div>
                          <div>Demanda: <span className="text-slate-200 font-semibold">{uc.contracted_demand_peak_kw || 0} kW</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Cadastrar Novo Cliente</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Razão Social *</label>
                <input
                  required
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  placeholder="Ex: Indústria Beta Ltda"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Segmento</label>
                <input
                  type="text"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Contato Responsável</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">E-mail</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Mensalidade SaaS (R$)</label>
                <input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Success Fee (%)</label>
                <input
                  type="number"
                  value={successFee}
                  onChange={(e) => setSuccessFee(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Código da UC (opcional)</label>
                <input
                  type="text"
                  value={ucCode}
                  onChange={(e) => setUcCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Distribuidora</label>
                <input
                  type="text"
                  value={distributor}
                  onChange={(e) => setDistributor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs"
              >
                {saving ? 'Salvando...' : 'Cadastrar Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
