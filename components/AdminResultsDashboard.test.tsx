// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminResultsDashboard from './AdminResultsDashboard';
import { dbService } from '../services/dbService';
import { AdminResultAttempt } from '../types';

vi.mock('../services/dbService', () => ({
  dbService: { getAdminResultsDashboard: vi.fn() },
}));

// O Recharts depende de ResizeObserver, que não existe no jsdom
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tentativa = (sobrescrever: Partial<AdminResultAttempt> = {}): AdminResultAttempt => ({
  id: '1',
  userId: 'u1',
  name: 'Maria Silva',
  email: 'maria@empresa.com',
  company: 'Empresa',
  exam: 'Data Engineer Associate',
  timestamp: '2026-09-03T12:00:00Z',
  score: 40,
  totalQuestions: 45,
  percentage: 40 / 45,
  passed: true,
  categoryScores: [{ category: 'ELT', correct: 4, total: 5, percentage: 0.8 }],
  ...sobrescrever,
});

const mockarResposta = (attempts: AdminResultAttempt[]) =>
  vi.mocked(dbService.getAdminResultsDashboard).mockResolvedValue({
    attempts,
    sessions: [],
    updatedAt: '2026-09-03T12:00:00Z',
  });

describe('AdminResultsDashboard', () => {
  it('renderiza os resultados com dados válidos', async () => {
    mockarResposta([tentativa()]);
    render(<AdminResultsDashboard email="admin@databricks.com" otp="123456" />);
    expect(await screen.findByText('Resultados dos simulados')).toBeTruthy();
  });

  // Regressão: resultados antigos sem `timestamp` (o backend devolve '') derrubavam a página inteira
  it.each([
    ['vazio', ''],
    ['não parseável', 'nao-e-uma-data'],
  ])('não quebra quando o timestamp é %s', async (_rotulo, timestamp) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockarResposta([tentativa(), tentativa({ id: '2', timestamp })]);
    render(<AdminResultsDashboard email="admin@databricks.com" otp="123456" />);
    expect(await screen.findByText('Resultados dos simulados')).toBeTruthy();
  });

  it('mostra erro visível (e não tela em branco) quando a renderização falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // `categoryScores` ausente faz o componente lançar durante a renderização
    mockarResposta([tentativa({ categoryScores: undefined as unknown as [] })]);
    render(<AdminResultsDashboard email="admin@databricks.com" otp="123456" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('mostra a tentativa e filtra só a primeira de cada usuário', async () => {
    mockarResposta([tentativa({ id: '1', attempt: 1 }), tentativa({ id: '2', attempt: 2, timestamp: '2026-09-20T12:00:00Z' })]);
    render(<AdminResultsDashboard email="admin@databricks.com" otp="123456" />);
    expect(await screen.findByText('2 de 2 tentativas exibidas')).toBeTruthy();
    expect(screen.getByText('Tentativa', { selector: 'th' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Só a primeira tentativa'));
    expect(await screen.findByText('1 de 2 tentativas exibidas')).toBeTruthy();
  });
});
