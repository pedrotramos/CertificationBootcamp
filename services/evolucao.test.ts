import { describe, expect, it } from 'vitest';
import type { ExamResult } from '../types';
import { buildEvolution } from './evolucao';

const resultado = (id: string, timestamp: string, corretas: boolean[], categoria = 'ELT', extra: Partial<ExamResult> = {}): ExamResult =>
  ({
    _id: id,
    userId: 'u1',
    exam: 'Prova',
    timestamp,
    score: corretas.filter(Boolean).length,
    totalQuestions: corretas.length,
    answers: corretas.map((isCorrect, i) => ({ questionId: `q${i}`, selectedOptionId: 'a', isCorrect, category: categoria })),
    ...extra,
  }) as unknown as ExamResult;

describe('buildEvolution', () => {
  it('sem tentativas devolve tudo vazio', () => {
    const e = buildEvolution([]);
    expect(e.points).toEqual([]);
    expect(e.best).toBeNull();
    expect(e.latest).toBeNull();
    expect(e.improvement).toBeNull();
  });

  it('uma tentativa não tem variação', () => {
    const e = buildEvolution([resultado('1', '2026-01-01T00:00:00Z', [true, false])]);
    expect(e.points[0]).toMatchObject({ attempt: 1, percentage: 50, delta: null });
    expect(e.improvement).toBeNull();
    expect(e.categories).toEqual([]);
  });

  it('ordena por data (mesmo vindo do mais novo ao mais antigo) e calcula a variação', () => {
    const e = buildEvolution([
      resultado('3', '2026-03-01T00:00:00Z', [true, true, true, false]),
      resultado('1', '2026-01-01T00:00:00Z', [true, false, false, false]),
      resultado('2', '2026-02-01T00:00:00Z', [true, true, false, false]),
    ]);
    expect(e.points.map(p => p.percentage)).toEqual([25, 50, 75]);
    expect(e.points.map(p => p.delta)).toEqual([null, 25, 25]);
    expect(e.points.map(p => p.attempt)).toEqual([1, 2, 3]);
    expect(e.improvement).toBe(50);
    expect(e.best?.id).toBe('3');
    expect(e.latest?.id).toBe('3');
  });

  it('usa o número da tentativa do servidor quando existe', () => {
    const e = buildEvolution([resultado('9', '2026-05-01T00:00:00Z', [true], 'ELT', { attempt: 4 })]);
    expect(e.points[0].attempt).toBe(4);
  });

  it('compara categorias presentes na primeira e na última tentativa', () => {
    const primeira = resultado('1', '2026-01-01T00:00:00Z', [true, false], 'ELT');
    const ultima = resultado('2', '2026-02-01T00:00:00Z', [true, true], 'ELT');
    ultima.answers.push({ questionId: 'x', selectedOptionId: 'a', isCorrect: true, category: 'Nova' });
    const e = buildEvolution([primeira, ultima]);
    expect(e.categories).toEqual([{ category: 'ELT', first: 50, latest: 100, delta: 50 }]);
  });

  it('prova sem questões não divide por zero', () => {
    const e = buildEvolution([resultado('1', '2026-01-01T00:00:00Z', [])]);
    expect(e.points[0].percentage).toBe(0);
  });
});
