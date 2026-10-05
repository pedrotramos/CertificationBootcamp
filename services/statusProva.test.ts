// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { EXAM_BUTTON_LABEL, EXAM_TIMER_KEY, formatTimeUntil, hasPausedExam, resolveExamStatus } from './statusProva';

describe('status da prova', () => {
  beforeEach(() => localStorage.clear());

  it('cada estado do servidor tem o rótulo certo no botão', () => {
    expect(EXAM_BUTTON_LABEL[resolveExamStatus('new', false)]).toBe('Iniciar Prova');
    expect(EXAM_BUTTON_LABEL[resolveExamStatus('in_progress', false)]).toBe('Continuar Prova');
    expect(EXAM_BUTTON_LABEL[resolveExamStatus('cooldown', false)]).toBe('Conferir Resultados');
    expect(EXAM_BUTTON_LABEL[resolveExamStatus('can_retake', false)]).toBe('Fazer Nova Tentativa');
  });

  it('o servidor prevalece sobre o cronômetro local', () => {
    expect(resolveExamStatus('cooldown', true)).toBe('cooldown');
  });

  it('sem resposta do servidor, o cronômetro local indica prova em andamento', () => {
    localStorage.setItem(EXAM_TIMER_KEY, JSON.stringify({ userId: 'u1', examId: 'Prova A' }));
    expect(hasPausedExam('u1', 'Prova A')).toBe(true);
    expect(resolveExamStatus(null, true)).toBe('in_progress');
    expect(resolveExamStatus(null, false)).toBe('new');
  });

  it('cronômetro de outra prova ou outro usuário é ignorado', () => {
    localStorage.setItem(EXAM_TIMER_KEY, JSON.stringify({ userId: 'u1', examId: 'Prova A' }));
    expect(hasPausedExam('u1', 'Prova B')).toBe(false);
    expect(hasPausedExam('u2', 'Prova A')).toBe(false);
  });

  it('valor corrompido no armazenamento não quebra', () => {
    localStorage.setItem(EXAM_TIMER_KEY, '{nao-e-json');
    expect(hasPausedExam('u1', 'Prova A')).toBe(false);
  });
});

describe('formatTimeUntil', () => {
  const agora = new Date('2026-10-10T12:00:00Z');
  it.each([
    ['2026-10-16T16:00:00Z', '6d 4h'],
    ['2026-10-10T15:20:00Z', '3h 20min'],
    ['2026-10-10T12:45:00Z', '45min'],
    ['2026-10-10T12:00:10Z', '1min'],
    ['2026-10-10T11:00:00Z', 'menos de 1 min'],
  ])('%s → %s', (alvo, esperado) => {
    expect(formatTimeUntil(alvo, agora)).toBe(esperado);
  });
  it('data inválida devolve vazio', () => {
    expect(formatTimeUntil('xx', agora)).toBe('');
  });
});
