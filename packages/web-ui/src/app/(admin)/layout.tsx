import Link from 'next/link';
import {
  Zap,
  ShieldCheck,
  Activity,
  ListTodo,
  Building2,
  FileText,
  Bot,
  BarChart3,
  RefreshCw,
  Power,
  Mail
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-slate-950 text-slate-100 min-h-screen flex print:bg-white print:text-slate-900 print:block">
      {/* SIDEBAR FIXA DE NAVEGAÇÃO */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 sticky top-0 h-screen z-50 print:hidden">
        <div>
          {/* Logo & Header */}
          <div className="flex items-center gap-3 px-2 py-4 mb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white block">EI-AIOS</span>
              <span className="text-[10px] text-emerald-400 tracking-wider font-semibold uppercase block">Energy Intelligence</span>
            </div>
          </div>

          {/* Menu de Navegação */}
          <nav className="space-y-1 text-sm font-medium">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Command Center</span>
            </Link>

            <Link href="/approvals" className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Aprovações</span>
              </div>
              <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs px-2 py-0.5 rounded-full font-semibold">HITL</span>
            </Link>

            <Link href="/emails" className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-sky-400" />
                <span>E-mails & Triagem</span>
              </div>
              <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">AG-012</span>
            </Link>

            <Link href="/energy" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Auditoria & M&V</span>
            </Link>

            <Link href="/tasks" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <ListTodo className="w-4 h-4 text-cyan-400" />
              <span>Tarefas & Kanban</span>
            </Link>

            <Link href="/clients" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Clientes & Pilotos</span>
            </Link>

            <Link href="/artifacts" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Artefatos & Laudos</span>
            </Link>

            <Link href="/agents" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <Bot className="w-4 h-4 text-purple-400" />
              <span>Catálogo de Agentes</span>
            </Link>

            <Link href="/finops" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>FinOps & Métricas</span>
            </Link>
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center justify-between">
            <span>Fundador Solo</span>
            <span className="text-emerald-400 font-mono">v1.6.1</span>
          </div>
          <div className="text-[11px] text-slate-400">
            ANEEL REN 1.000/2021 Compliant
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL COM TOPBAR GLOBAL */}
      <div className="flex-1 flex flex-col min-w-0 print:block">
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40 print:hidden">
          {/* Indicador luminoso Autonomous Worker */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-slate-200 tracking-wide">
              AUTONOMOUS WORKER: <span className="text-emerald-400 font-mono">ONLINE (5s poll)</span>
            </span>
          </div>

          {/* Status de FinOps e Ações Rápidas */}
          <div className="flex items-center gap-5 text-xs">
            <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-md border border-slate-700/60">
              <span className="text-slate-400">Gasto IA Hoje / Mês:</span>
              <span className="font-mono text-emerald-400 font-semibold">$0.42 / $15.00</span>
            </div>

            <button
              title="Forçar ciclo imediato do worker"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-300" />
              <span>Trigger</span>
            </button>

            <button
              title="Pausa de Emergência do Worker"
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-md border border-rose-500/30 transition font-semibold"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Kill Switch</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto print:p-0 print:m-0 print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}
