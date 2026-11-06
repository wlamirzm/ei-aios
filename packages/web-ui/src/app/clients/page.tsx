'use client';

import React, { useState } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Zap,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function ClientsPage() {
  const [clients] = useState([
    {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      company_name: 'Indústrias Metalúrgicas Alvorada S.A.',
      cnpj: '12.345.678/0001-90',
      segment: 'Indústria Metal-Mecânica',
      stage: 'active_saas',
      contact: 'Carlos Eduardo Mendes (Diretor Industrial)',
      email: 'carlos.mendes@metalurgicaalvorada.com.br',
      phone: '(19) 98765-4321',
      monthly_fee: 'R$ 1.800,00',
      success_fee: '20,00%',
      units: [
        {
          code: '9876543210',
          name: 'Planta Industrial Paulínia',
          distributor: 'CPFL Paulista',
          tariff_group: 'A4',
          modality: 'HOROSSAZONAL_VERDE',
          contracted_demand: '250 kW'
        }
      ]
    }
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" />
            Gestão de Clientes, Unidades Consumidoras e Pilotos
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cadastre os clientes corporativos e suas unidades (Grupo A/B) para monitoramento contínuo e apuração de honorários.
          </p>
        </div>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition">
          <Plus className="w-4 h-4" />
          <span>Novo Cliente / Piloto</span>
        </button>
      </div>

      {/* LISTA DE CLIENTES */}
      <div className="space-y-4">
        {clients.map((client) => (
          <div key={client.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-white">{client.company_name}</h2>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold">
                    {client.stage.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  CNPJ: {client.cnpj} • Segmento: {client.segment}
                </p>
              </div>

              <div className="text-right text-xs">
                <span className="text-slate-400 block">Modelo Comercial:</span>
                <span className="font-semibold text-emerald-400">
                  {client.monthly_fee}/mês + {client.success_fee} Success Fee
                </span>
              </div>
            </div>

            {/* Contato & Detalhes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span>{client.contact}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-4 h-4 text-slate-500" />
                <span>{client.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-slate-500" />
                <span>{client.phone}</span>
              </div>
            </div>

            {/* UNIDADES CONSUMIDORAS ASSOCIADAS */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Unidades Consumidoras Monitoradas:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {client.units.map((uc) => (
                  <div key={uc.code} className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{uc.name}</span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                        UC: {uc.code}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                      <div>Distribuidora: <span className="text-slate-200">{uc.distributor}</span></div>
                      <div>Subgrupo: <span className="text-emerald-400 font-semibold">{uc.tariff_group}</span></div>
                      <div>Modalidade: <span className="text-slate-200">{uc.modality}</span></div>
                      <div>Demanda: <span className="text-slate-200 font-semibold">{uc.contracted_demand}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

