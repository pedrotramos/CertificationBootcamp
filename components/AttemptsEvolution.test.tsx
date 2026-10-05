// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AttemptsEvolution from './AttemptsEvolution';
import type { ExamResult } from '../types';

// O Recharts depende de ResizeObserver, que não existe no jsdom
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const resultado = (id: string, timestamp: string, corretas: boolean[]): ExamResult =>
  ({
    _id: id,
    userId: 'u1',
    exam: 'Prova',
    timestamp,
    score: corretas.filter(Boolean).length,
    totalQuestions: corretas.length,
    answers: corretas.map((isCorrect, i) => ({ questionId: `q${i}`, selectedOptionId: 'a', isCorrect, category: 'ELT' })),
  }) as unknown as ExamResult;

const duas = [
  resultado('2', '2026-02-01T12:00:00Z', [true, true, true, false]),
  resultado('1', '2026-01-01T12:00:00Z', [true, false, false, false]),
];

describe('AttemptsEvolution', () => {
  it('com uma tentativa mostra o resumo e convida a tentar de novo', () => {
    render(<AttemptsEvolution results={[duas[1]]} selectedId="1" onSelect={() => {}} />);
    expect(screen.getByText(/Depois da próxima tentativa/)).toBeTruthy();
    expect(screen.queryByText(/Por categoria/)).toBeNull();
  });

  it('resume a evolução: melhor nota, última nota e variação desde a primeira', () => {
    render(<AttemptsEvolution results={duas} selectedId="2" onSelect={() => {}} />);
    expect(screen.getByText('Melhor nota').nextSibling?.textContent).toBe('75%');
    expect(screen.getByText('Última nota').nextSibling?.textContent).toBe('75%');
    expect(screen.getByText('Desde a primeira').nextSibling?.textContent).toBe('+50 p.p.');
    expect(screen.getByText(/Por categoria/)).toBeTruthy();
  });

  it('lista as tentativas da mais recente para a mais antiga e marca a exibida', () => {
    render(<AttemptsEvolution results={duas} selectedId="2" onSelect={() => {}} />);
    const botoes = screen.getAllByRole('button');
    expect(botoes[0].textContent).toMatch(/Tentativa 2/);
    expect(botoes[0].getAttribute('aria-pressed')).toBe('true');
    expect(botoes[1].textContent).toMatch(/Tentativa 1/);
    expect(botoes[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('clicar numa tentativa chama onSelect com o resultado dela', () => {
    const onSelect = vi.fn();
    render(<AttemptsEvolution results={duas} selectedId="2" onSelect={onSelect} />);
    fireEvent.click(within(screen.getByRole('list')).getByText(/Tentativa 1/));
    expect(onSelect).toHaveBeenCalledWith(duas[1]);
  });
});
