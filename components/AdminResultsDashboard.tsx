import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dbService } from '../services/dbService';
import { AdminResultAttempt } from '../types';

const PASS = '#00A972';
const FAIL = '#FF3621';
const NAVY = '#1B3139';
const PAGE_SIZE = 10;

const pct = (value: number) => `${Math.round(value * 100)}%`;
const duration = (milliseconds: number | null) => {
  if (milliseconds === null) return '—';
  const minutes = Math.round(milliseconds / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes} min`;
};
const dateKey = (value: string) => value.slice(0, 7);
const labelMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
};

function useClampedTooltip(width = 240, height = 96) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const move = (state: unknown) => {
    if (!state || typeof state !== 'object') return;
    const { chartX, chartY } = state as { chartX?: unknown; chartY?: unknown };
    if (typeof chartX !== 'number' || typeof chartY !== 'number') return;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const gap = 14;
    const preferredX = chartX + gap + width <= bounds.width ? chartX + gap : chartX - width - gap;
    const preferredY = chartY + gap + height <= bounds.height ? chartY + gap : chartY - height - gap;
    setPosition({
      x: Math.max(4, Math.min(preferredX, bounds.width - width - 4)),
      y: Math.max(4, Math.min(preferredY, bounds.height - height - 4)),
    });
  };
  return { containerRef, position, move, leave: () => setPosition(undefined), width };
}

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <section className={`relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
    <div className="mb-4">
      <h3 className="text-sm font-black uppercase tracking-tight text-[#1B3139]">{title}</h3>
      {subtitle && <p className="mt-1 text-[10px] text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const SearchFilter: React.FC<{ id: string; label: string; placeholder: string; value: string; options: string[]; onChange: (value: string) => void }> = ({ id, label, placeholder, value, options, onChange }) => (
  <label className="min-w-0 space-y-1">
    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span>
    <input list={`${id}-options`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded border border-slate-300 p-2 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
    <datalist id={`${id}-options`}>{options.map(option => <option key={option} value={option} />)}</datalist>
  </label>
);

const AdminResultsDashboard: React.FC<{ email: string; otp: string }> = ({ email, otp }) => {
  const [attempts, setAttempts] = useState<AdminResultAttempt[]>([]);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof dbService.getAdminResultsDashboard>>['sessions']>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [company, setCompany] = useState('');
  const [exam, setExam] = useState('');
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'all' | 'passed' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'date' | 'score'>('date');
  const [tableSearch, setTableSearch] = useState('');
  const passTooltip = useClampedTooltip();
  const distributionTooltip = useClampedTooltip();
  const trendTooltip = useClampedTooltip();
  const categoryTooltip = useClampedTooltip();
  const companyTooltip = useClampedTooltip();

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await dbService.getAdminResultsDashboard(email, otp);
      setAttempts(data.attempts); setUpdatedAt(data.updatedAt);
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os resultados.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [email, otp]);

  const options = useMemo(() => ({
    companies: [...new Set(attempts.map(a => a.company))].sort(),
    exams: [...new Set(attempts.map(a => a.exam))].sort(),
    users: [...new Map(attempts.map(a => [a.userId, { id: a.userId, name: a.name }])).values()].sort((a, b) => a.name.localeCompare(b.name)),
  }), [attempts]);

  const filtered = useMemo(() => attempts.filter(a => {
    const day = a.timestamp.slice(0, 10);
    const companyMatch = !company || a.company.toLocaleLowerCase().includes(company.toLocaleLowerCase());
    const examMatch = !exam || a.exam.toLocaleLowerCase().includes(exam.toLocaleLowerCase());
    const userMatch = !user || `${a.name} ${a.email}`.toLocaleLowerCase().includes(user.toLocaleLowerCase());
    return companyMatch && examMatch && userMatch
      && (!from || day >= from) && (!to || day <= to)
      && (status === 'all' || (status === 'passed' ? a.passed : !a.passed));
  }), [attempts, company, exam, user, from, to, status]);

  useEffect(() => { setPage(1); }, [company, exam, user, from, to, status, sort, tableSearch]);

  const metrics = useMemo(() => {
    const users = new Set(filtered.map(a => a.userId));
    const companies = new Set(filtered.map(a => a.company).filter(Boolean));
    const average = filtered.length ? filtered.reduce((s, a) => s + a.percentage, 0) / filtered.length : 0;
    const passed = filtered.filter(a => a.passed).length;
    return { users: users.size, companies: companies.size, average, passed, failed: filtered.length - passed };
  }, [filtered]);

  const trend = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    filtered.forEach(a => { const k = dateKey(a.timestamp); const v = map.get(k) || { sum: 0, count: 0 }; v.sum += a.percentage; v.count += 1; map.set(k, v); });
    return [...map.entries()].sort().map(([month, v]) => ({ month, label: labelMonth(month), score: v.sum / v.count }));
  }, [filtered]);

  const categories = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    filtered.flatMap(a => a.categoryScores).forEach(c => { const v = map.get(c.category) || { correct: 0, total: 0 }; v.correct += c.correct; v.total += c.total; map.set(c.category, v); });
    return [...map.entries()].map(([category, v]) => ({ category, score: v.total ? v.correct / v.total : 0 })).sort((a, b) => a.score - b.score);
  }, [filtered]);

  const distribution = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const min = i / 10; const max = (i + 1) / 10;
    return { range: `${i * 10}–${(i + 1) * 10}%`, count: filtered.filter(a => a.percentage >= min && (i === 9 ? a.percentage <= max : a.percentage < max)).length, passed: min >= .7 };
  }), [filtered]);

  const companyBreakdown = useMemo(() => {
    const map = new Map<string, { passed: number; failed: number }>();
    filtered.forEach(a => { const v = map.get(a.company) || { passed: 0, failed: 0 }; v[a.passed ? 'passed' : 'failed'] += 1; map.set(a.company, v); });
    return [...map.entries()].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.passed + b.failed - a.passed - a.failed).slice(0, 12);
  }, [filtered]);

  const abandonment = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const userLookup = new Map(attempts.map(a => [a.userId, a]));
    const scoped = sessions.filter(s => {
      const related = userLookup.get(s.userId);
      const started = s.startedAt.slice(0, 10);
      return (!company || related?.company.toLowerCase().includes(company.toLowerCase()))
        && (!exam || s.exam.toLowerCase().includes(exam.toLowerCase()))
        && (!user || `${related?.name || ''} ${related?.email || ''}`.toLowerCase().includes(user.toLowerCase()))
        && (!from || started >= from) && (!to || started <= to);
    });
    const completed = scoped.filter(s => s.status === 'completed').length;
    const completionDurations = scoped
      .filter(s => s.status === 'completed' && s.completedAt)
      .map(s => new Date(s.completedAt as string).getTime() - new Date(s.startedAt).getTime())
      .filter(value => value >= 0);
    const abandoned = scoped.filter(s => s.status === 'in_progress' && new Date(s.startedAt).getTime() < cutoff).length;
    const active = scoped.length - completed - abandoned;
    const averageCompletionMs = completionDurations.length ? completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length : null;
    return { total: scoped.length, completed, abandoned, active, rate: completed + abandoned ? abandoned / (completed + abandoned) : null, averageCompletionMs };
  }, [sessions, attempts, company, exam, user, from, to]);

  const tableFiltered = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    return query ? filtered.filter(a => `${a.name} ${a.company}`.toLowerCase().includes(query)) : filtered;
  }, [filtered, tableSearch]);
  const sorted = useMemo(() => [...tableFiltered].sort((a, b) => sort === 'score' ? b.percentage - a.percentage : b.timestamp.localeCompare(a.timestamp)), [tableFiltered, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const clear = () => { setCompany(''); setExam(''); setUser(''); setFrom(''); setTo(''); setStatus('all'); };
  const activeFilters = [company && { label: 'Empresa', value: company, clear: () => setCompany('') }, exam && { label: 'Exame', value: exam, clear: () => setExam('') }, user && { label: 'Usuário', value: user, clear: () => setUser('') }, from && { label: 'Desde', value: new Date(`${from}T00:00:00`).toLocaleDateString('pt-BR'), clear: () => setFrom('') }, to && { label: 'Até', value: new Date(`${to}T00:00:00`).toLocaleDateString('pt-BR'), clear: () => setTo('') }, status !== 'all' && { label: 'Status', value: status === 'passed' ? 'Aprovado' : 'Reprovado', clear: () => setStatus('all') }].filter(Boolean) as { label: string; value: string; clear: () => void }[];

  if (loading) return <div className="space-y-4" aria-label="Carregando dashboard">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p>{error}</p><button onClick={() => void load()} className="mt-3 font-black uppercase underline">Tentar novamente</button></div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-black uppercase tracking-tight text-[#1B3139]">Resultados dos simulados</h2><p className="text-xs text-slate-500">Visão dos times de conta · aprovação a partir de 70% · fonte MongoDB</p></div>
      <div className="text-right"><button onClick={() => void load()} className="rounded border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 hover:border-[#FF3621] hover:text-[#FF3621]">Atualizar</button>{updatedAt && <p className="mt-1 text-[9px] text-slate-400">Atualizado {new Date(updatedAt).toLocaleString('pt-BR')}</p>}</div>
    </div>

    <Panel title="Filtros" subtitle={`${filtered.length} de ${attempts.length} tentativas exibidas`}>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SearchFilter id="company" label="Empresa" placeholder="Buscar empresa" value={company} options={options.companies} onChange={setCompany} />
        <SearchFilter id="exam" label="Exame" placeholder="Buscar exame" value={exam} options={options.exams} onChange={setExam} />
        <SearchFilter id="user" label="Usuário" placeholder="Buscar nome ou e-mail" value={user} options={options.users.map(v => v.name)} onChange={setUser} />
        <label className="space-y-1"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Data inicial</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded border border-slate-300 p-2 text-xs" /></label>
        <label className="space-y-1"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Data final</span><input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded border border-slate-300 p-2 text-xs" /></label>
        <button onClick={clear} disabled={!activeFilters.length} className="h-[34px] rounded bg-slate-100 p-2 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-200 disabled:opacity-40">Limpar filtros</button>
      </div>
      {activeFilters.length > 0 && <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtros aplicados">{activeFilters.map(filter => <button key={filter.label} onClick={filter.clear} title={`Remover filtro ${filter.label}`} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-800">{filter.label}: {filter.value} <span aria-hidden>×</span></button>)}</div>}
    </Panel>

    {filtered.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center"><p className="font-bold text-slate-700">Nenhum resultado para estes filtros.</p><button onClick={clear} className="mt-2 text-xs font-black uppercase text-[#FF3621]">Limpar filtros</button></div> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {[
          { label: 'Simulados concluídos', value: filtered.length, note: 'Período e filtros selecionados' },
          { label: 'Nota média', value: pct(metrics.average), note: 'Período e filtros selecionados' },
          { label: 'Empresas impactadas', value: metrics.companies, note: 'Período e filtros selecionados' },
          { label: 'Usuários distintos', value: metrics.users, note: 'Período e filtros selecionados' },
          { label: 'Tempo até conclusão', value: duration(abandonment.averageCompletionMs), note: abandonment.completed ? `${abandonment.completed} sessão(ões) monitorada(s)` : 'Aguardando primeira conclusão monitorada' },
        ].map(({label, value, note}) => <div key={label} className="rounded-lg bg-[#1B3139] p-4 text-white"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-300">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-[9px] text-slate-400">{note}</p></div>)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Aprovados vs. reprovados" subtitle="Clique em uma fatia para cruzar o filtro de status"><div ref={passTooltip.containerRef} className="h-72"><ResponsiveContainer><PieChart onMouseMove={passTooltip.move} onMouseLeave={passTooltip.leave}><Pie data={[{ name: 'Aprovados', value: metrics.passed, key: 'passed' }, { name: 'Reprovados', value: metrics.failed, key: 'failed' }]} dataKey="value" innerRadius={60} outerRadius={100} onClick={d => setStatus(d.key)}>{[PASS, FAIL].map(c => <Cell key={c} fill={c} />)}</Pie><Tooltip position={passTooltip.position} wrapperStyle={{zIndex:20, maxWidth: passTooltip.width}} contentStyle={{maxWidth: passTooltip.width, whiteSpace:'normal', overflowWrap:'anywhere'}} /><Legend /></PieChart></ResponsiveContainer></div></Panel>
        <Panel title="Distribuição das notas" subtitle="Frequência por faixa de 10 pontos percentuais"><div ref={distributionTooltip.containerRef} className="h-72"><ResponsiveContainer><BarChart data={distribution} onMouseMove={distributionTooltip.move} onMouseLeave={distributionTooltip.leave}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="range" tick={{fontSize:9}}/><YAxis allowDecimals={false}/><Tooltip position={distributionTooltip.position} wrapperStyle={{zIndex:20, maxWidth:distributionTooltip.width}} contentStyle={{maxWidth:distributionTooltip.width, whiteSpace:'normal', overflowWrap:'anywhere'}}/><Bar dataKey="count" name="Tentativas">{distribution.map(d => <Cell key={d.range} fill={d.passed ? PASS : FAIL}/>)}</Bar></BarChart></ResponsiveContainer></div></Panel>
        <Panel title="Nota média ao longo do tempo" subtitle="Média mensal; o eixo inicia em zero"><div ref={trendTooltip.containerRef} className="h-72"><ResponsiveContainer><LineChart data={trend} onMouseMove={trendTooltip.move} onMouseLeave={trendTooltip.leave}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis domain={[0,1]} tickFormatter={pct}/><Tooltip position={trendTooltip.position} wrapperStyle={{zIndex:20, maxWidth:trendTooltip.width}} contentStyle={{maxWidth:trendTooltip.width, whiteSpace:'normal', overflowWrap:'anywhere'}} formatter={(v: number) => pct(v)}/><Line type="monotone" dataKey="score" name="Nota média" stroke={NAVY} strokeWidth={3}/></LineChart></ResponsiveContainer></div></Panel>
        <Panel title="Desempenho por categoria" subtitle="Categorias mais frágeis aparecem primeiro"><div ref={categoryTooltip.containerRef} className="h-72"><ResponsiveContainer><BarChart data={categories} layout="vertical" margin={{left: 70, right: 24}} onMouseMove={categoryTooltip.move} onMouseLeave={categoryTooltip.leave}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" domain={[0,1]} tickFormatter={pct}/><YAxis type="category" dataKey="category" width={160} tick={{fontSize:9}}/><Tooltip position={categoryTooltip.position} wrapperStyle={{zIndex:20, maxWidth:categoryTooltip.width}} contentStyle={{maxWidth:categoryTooltip.width, whiteSpace:'normal', overflowWrap:'anywhere'}} formatter={(v: number) => pct(v)}/><Bar dataKey="score" name="Nota média" fill={NAVY}/></BarChart></ResponsiveContainer></div></Panel>
      </div>

      <Panel title="Prontidão por empresa" subtitle="Top 12 empresas por volume; clique na barra para filtrar">
        <div ref={companyTooltip.containerRef} className="h-72"><ResponsiveContainer><BarChart data={companyBreakdown} onMouseMove={companyTooltip.move} onMouseLeave={companyTooltip.leave} onClick={state => { const value = state?.activeLabel; if (typeof value === 'string') setCompany(value); }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:9}}/><YAxis allowDecimals={false}/><Tooltip position={companyTooltip.position} wrapperStyle={{zIndex:20, maxWidth:companyTooltip.width}} contentStyle={{maxWidth:companyTooltip.width, whiteSpace:'normal', overflowWrap:'anywhere'}}/><Legend/><Bar dataKey="passed" stackId="a" name="Aprovados" fill={PASS}/><Bar dataKey="failed" stackId="a" name="Reprovados" fill={FAIL}/></BarChart></ResponsiveContainer></div>
      </Panel>

      <Panel title="Abandono de simulados" subtitle="Sessões sem conclusão após 2 horas são consideradas abandonadas">
          {abandonment.total === 0 ? <div className="rounded border border-dashed p-8 text-center text-xs text-slate-500">Monitoramento iniciado nesta versão. A métrica aparecerá após novas sessões.</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Taxa', abandonment.rate === null ? '—' : pct(abandonment.rate)], ['Iniciados', abandonment.total], ['Concluídos', abandonment.completed], ['Abandonados', abandonment.abandoned]].map(([label,value]) => <div key={String(label)} className="rounded bg-slate-50 p-4"><p className="text-[9px] font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-[#1B3139]">{value}</p></div>)}</div>}
          {abandonment.active > 0 && <p className="mt-3 text-[10px] text-blue-700">{abandonment.active} sessão(ões) ainda dentro da janela ativa.</p>}
      </Panel>

      <Panel title="Resultados por usuário" subtitle="Detalhe pesquisável pelos filtros acima; ordenação e paginação local">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><label className="space-y-1"><span className="block text-[9px] font-black uppercase text-slate-500">Buscar na tabela</span><input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder="Nome ou empresa" className="rounded border border-slate-300 p-2 text-xs" /></label><div className="flex items-center gap-3"><span className="text-[10px] text-slate-500">Página {page} de {pageCount}</span><select aria-label="Ordenar resultados" value={sort} onChange={e => setSort(e.target.value as 'date'|'score')} className="rounded border border-slate-300 p-2 text-xs"><option value="date">Mais recentes</option><option value="score">Maior nota</option></select></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b text-[9px] uppercase tracking-wider text-slate-500">{['Nome','E-mail','Empresa','Exame','Nota','Status','Data'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(a => <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-2 font-bold">{a.name}</td><td className="p-2">{a.email || '—'}</td><td className="p-2">{a.company}</td><td className="p-2">{a.exam}</td><td className={`p-2 font-black ${a.passed ? 'text-green-600':'text-[#FF3621]'}`}>{pct(a.percentage)}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${a.passed ? 'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>{a.passed ? 'Aprovado':'Reprovado'}</span></td><td className="p-2">{new Date(a.timestamp).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div>
        <div className="mt-4 flex justify-end gap-2"><button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded border px-3 py-2 text-[10px] font-black uppercase disabled:opacity-30">Anterior</button><button disabled={page === pageCount} onClick={() => setPage(p => p + 1)} className="rounded border px-3 py-2 text-[10px] font-black uppercase disabled:opacity-30">Próxima</button></div>
      </Panel>
    </>}
  </div>;
};

export default AdminResultsDashboard;
