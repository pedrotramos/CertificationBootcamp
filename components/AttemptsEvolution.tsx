import React, { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExamResult } from '../types';
import { buildEvolution } from '../services/evolucao';
import Card from './Card';

interface AttemptsEvolutionProps {
  results: ExamResult[];
  /** id do resultado exibido no relatório abaixo */
  selectedId?: string;
  onSelect: (result: ExamResult) => void;
  loadingId?: string | null;
}

const PASS_PERCENTAGE = 70;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
};

const formatDelta = (delta: number | null) => (delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta} p.p.`);
const deltaColor = (delta: number | null) => (delta === null || delta === 0 ? 'text-slate-500' : delta > 0 ? 'text-green-600' : 'text-[#FF3621]');

/** Resumo da evolução nas tentativas e lista para abrir o relatório de cada uma. */
const AttemptsEvolution: React.FC<AttemptsEvolutionProps> = ({ results, selectedId, onSelect, loadingId }) => {
  const evolution = useMemo(() => buildEvolution(results), [results]);
  const { points, best, latest, improvement, categories } = evolution;
  if (points.length === 0) return null;

  const byId = new Map(results.map(result => [result._id?.toString() ?? '', result]));

  return (
    <Card className="p-8 shadow-xl bg-white" aria-label="Evolução nas tentativas">
      <h2 className="text-xl font-black text-[#1B3139] uppercase tracking-tight">Sua evolução</h2>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-center">
        <div><dt className="text-xs font-black uppercase tracking-widest text-slate-500">Tentativas</dt><dd className="text-2xl font-black text-[#1B3139]">{points.length}</dd></div>
        <div><dt className="text-xs font-black uppercase tracking-widest text-slate-500">Melhor nota</dt><dd className="text-2xl font-black text-[#1B3139]">{best?.percentage}%</dd></div>
        <div><dt className="text-xs font-black uppercase tracking-widest text-slate-500">Última nota</dt><dd className="text-2xl font-black text-[#1B3139]">{latest?.percentage}%</dd></div>
        <div>
          <dt className="text-xs font-black uppercase tracking-widest text-slate-500">Desde a primeira</dt>
          <dd className={`text-2xl font-black ${deltaColor(improvement)}`}>{formatDelta(improvement)}</dd>
        </div>
      </dl>

      {points.length === 1 ? (
        <p className="mt-6 text-sm text-slate-600">Depois da próxima tentativa você poderá acompanhar aqui como sua nota evolui.</p>
      ) : (
        <div className="h-56 mt-6" aria-hidden="true">
          <ResponsiveContainer>
            <LineChart data={points.map(p => ({ name: `#${p.attempt}`, percentage: p.percentage }))} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Nota']} />
              <ReferenceLine y={PASS_PERCENTAGE} stroke="#16a34a" strokeDasharray="4 4" label={{ value: `${PASS_PERCENTAGE}%`, position: 'right', fontSize: 12 }} />
              <Line type="monotone" dataKey="percentage" stroke="#FF3621" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 className="mt-8 text-xs font-black uppercase tracking-widest text-slate-500">Tentativas (toque para ver o relatório)</h3>
      <ul className="mt-2 divide-y divide-slate-100">
        {[...points].reverse().map(point => {
          const selected = point.id === selectedId;
          return (
            <li key={point.id}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={loadingId === point.id}
                onClick={() => { const result = byId.get(point.id); if (result) onSelect(result); }}
                className={`w-full flex items-center justify-between gap-4 py-3 px-3 text-left text-sm rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF3621] ${selected ? 'bg-[#FF3621]/5 font-bold' : 'hover:bg-slate-50'}`}
              >
                <span>
                  Tentativa {point.attempt}
                  <span className="ml-3 font-normal text-slate-500">{formatDate(point.timestamp)}</span>
                  {point.expired && <span className="ml-3 text-xs font-bold text-red-700">tempo esgotado</span>}
                  {selected && <span className="ml-3 text-xs font-black uppercase text-[#FF3621]">exibindo</span>}
                </span>
                <span className="flex items-center gap-4">
                  <span className={`text-xs ${deltaColor(point.delta)}`}>{formatDelta(point.delta)}</span>
                  <span className={`font-black ${point.percentage >= PASS_PERCENTAGE ? 'text-green-600' : 'text-[#FF3621]'}`}>{point.percentage}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {categories.length > 0 && (
        <>
          <h3 className="mt-8 text-xs font-black uppercase tracking-widest text-slate-500">Por categoria: primeira × última tentativa</h3>
          <table className="w-full mt-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 font-black">Categoria</th><th className="py-2 font-black">Primeira</th><th className="py-2 font-black">Última</th><th className="py-2 font-black">Variação</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.category} className="border-t border-slate-100">
                  <td className="py-2">{c.category}</td><td className="py-2">{c.first}%</td><td className="py-2">{c.latest}%</td>
                  <td className={`py-2 font-bold ${deltaColor(c.delta)}`}>{formatDelta(c.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
};

export default AttemptsEvolution;
