import type { ExamResult } from '../types';

export interface AttemptPoint {
  id: string;
  attempt: number;
  timestamp: string;
  percentage: number;
  score: number;
  total: number;
  /** variação em pontos percentuais em relação à tentativa anterior (null na primeira) */
  delta: number | null;
  expired: boolean;
}

export interface CategoryEvolution {
  category: string;
  first: number;
  latest: number;
  delta: number;
}

export interface Evolution {
  /** da mais antiga para a mais recente */
  points: AttemptPoint[];
  best: AttemptPoint | null;
  latest: AttemptPoint | null;
  /** última menos primeira, em pontos percentuais (null com menos de 2 tentativas) */
  improvement: number | null;
  /** categorias presentes na primeira e na última tentativa */
  categories: CategoryEvolution[];
}

const percent = (correct: number, total: number): number => (total > 0 ? Math.round((correct / total) * 100) : 0);

function categoryPercentages(result: ExamResult): Map<string, number> {
  const totals = new Map<string, { correct: number; total: number }>();
  for (const answer of result.answers ?? []) {
    const name = answer.category || 'Sem Categoria';
    const entry = totals.get(name) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (answer.isCorrect) entry.correct += 1;
    totals.set(name, entry);
  }
  return new Map([...totals].map(([name, { correct, total }]) => [name, percent(correct, total)]));
}

/** Resumo da evolução do usuário numa prova a partir das tentativas enviadas (em qualquer ordem). */
export function buildEvolution(results: ExamResult[]): Evolution {
  const ordered = [...results].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const points: AttemptPoint[] = ordered.map((result, index) => {
    const percentage = percent(result.score, result.totalQuestions);
    return {
      id: result._id?.toString() ?? String(index),
      attempt: result.attempt ?? index + 1,
      timestamp: String(result.timestamp),
      percentage,
      score: result.score,
      total: result.totalQuestions,
      delta: null,
      expired: Boolean(result.expired),
    };
  });
  points.forEach((point, index) => {
    if (index > 0) point.delta = point.percentage - points[index - 1].percentage;
  });

  const latest = points[points.length - 1] ?? null;
  const best = points.reduce<AttemptPoint | null>((top, point) => (top === null || point.percentage > top.percentage ? point : top), null);

  let categories: CategoryEvolution[] = [];
  if (ordered.length >= 2) {
    const first = categoryPercentages(ordered[0]);
    const last = categoryPercentages(ordered[ordered.length - 1]);
    categories = [...last]
      .filter(([name]) => first.has(name))
      .map(([name, value]) => ({ category: name, first: first.get(name) as number, latest: value, delta: value - (first.get(name) as number) }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  return {
    points,
    best,
    latest,
    improvement: points.length >= 2 && latest ? latest.percentage - points[0].percentage : null,
    categories,
  };
}
