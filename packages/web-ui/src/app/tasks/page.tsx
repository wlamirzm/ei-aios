'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ListTodo,
  GitBranch,
  LayoutGrid,
  Eye,
  X,
  RefreshCw,
  Send
} from 'lucide-react';
import { fetchTasks, createObjective, triggerWorkerCycle } from '@/lib/api-client';

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<'kanban' | 'tree'>('kanban');
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [newObj, setNewObj] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetchTasks();
      if (res?.tasks) {
        setTasks(res.tasks);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const timer = setInterval(loadTasks, 5000);
    return () => clearInterval(timer);
  }, [loadTasks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObj.trim()) return;
    setIsCreating(true);
    try {
      await createObjective(newObj, 'P1');
      setNewObj('');
      await loadTasks();
    } catch {
      // ignore
    } finally {
      setIsCreating(false);
    }
  };

  const columns = [
    { id: 'pending', label: 'Pending', color: 'border-slate-700' },
    { id: 'running', label: 'Running', color: 'border-cyan-500' },
    { id: 'review', label: 'QA Review (AG-008)', color: 'border-amber-500' },
    { id: 'waiting_input', label: 'Waiting Human Approval', color: 'border-rose-500' },
    { id: 'completed', label: 'Completed', color: 'border-emerald-500' }
  ];

  const parentTasks = tasks.filter((t) => !t.parent_task_id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-cyan-400" />
            Quadro de Orquestração & Backlog de Tarefas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Visualização em árvore hierárquica e Kanban das tarefas reais distribuídas aos agentes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await triggerWorkerCycle().catch(() => {});
              await loadTasks();
            }}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Forçar Ciclo</span>
          </button>

          {/* Alternador de Visualização */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'kanban' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'tree' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Árvore de Dependências</span>
            </button>
          </div>
        </div>
      </div>

      {/* BARRA RÁPIDA DE NOVO OBJETIVO */}
      <form onSubmit={handleCreate} className="flex gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <input
          type="text"
          value={newObj}
          onChange={(e) => setNewObj(e.target.value)}
          placeholder="Novo objetivo para decomposição pelo AG-001..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={isCreating || !newObj.trim()}
          className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isCreating ? 'Criando...' : 'Criar Objetivo'}</span>
        </button>
      </form>

      {/* VISÃO KANBAN */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {columns.map((col) => {
            const tasksInCol = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col">
                <div className={`flex items-center justify-between pb-2 border-b-2 ${col.color} mb-3`}>
                  <span className="text-xs font-bold text-slate-200">{col.label}</span>
                  <span className="text-xs text-slate-500 font-mono">{tasksInCol.length}</span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto min-h-[300px]">
                  {tasksInCol.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="bg-slate-950 p-3 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                          {task.task_code}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{task.priority}</span>
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                        {task.objective}
                      </p>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                        <span className="font-mono font-semibold text-emerald-400">{task.assigned_agent_id}</span>
                        <Eye className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
                      </div>
                    </div>
                  ))}
                  {tasksInCol.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-600">Nenhuma tarefa</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISÃO EM ÁRVORE HIERÁRQUICA */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          {parentTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">Nenhum objetivo macro registrado.</div>
          ) : (
            parentTasks.map((parent) => {
              const children = tasks.filter((t) => t.parent_task_id === parent.id);
              return (
                <div key={parent.id} className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                  <div
                    onClick={() => setSelectedTask(parent)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        {parent.task_code} (Objetivo Macro)
                      </span>
                      <span className="text-sm font-semibold text-white">{parent.objective}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{parent.status}</span>
                  </div>

                  <div className="pl-6 border-l-2 border-slate-800 space-y-2 pt-2">
                    {children.map((subtask) => (
                      <div
                        key={subtask.id}
                        onClick={() => setSelectedTask(subtask)}
                        className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 hover:border-slate-700 cursor-pointer transition text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-cyan-400 font-semibold">{subtask.task_code}</span>
                          <span className="text-slate-300">{subtask.objective}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-mono font-bold">{subtask.assigned_agent_id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                            {subtask.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL / INSPECTOR DE TASK ENVELOPE */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-cyan-400">{selectedTask.task_code}</span>
                <h3 className="text-sm font-bold text-white mt-1">{selectedTask.objective}</h3>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block">Agente Responsável:</span>
                <span className="text-slate-200 font-semibold">{selectedTask.assigned_agent_id}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block">Status Atual:</span>
                <span className="text-emerald-400 font-semibold uppercase">{selectedTask.status}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block">Nível de Risco:</span>
                <span className="text-rose-400 font-semibold">{selectedTask.risk_level}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1">
                Resultado / Entregável do Agente (result_payload & qa_review_payload):
              </span>
              <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-80 whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    result_payload: selectedTask.result_payload,
                    qa_review_payload: selectedTask.qa_review_payload
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTask(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
