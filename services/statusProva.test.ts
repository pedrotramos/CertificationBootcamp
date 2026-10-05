// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { EXAM_BUTTON_LABEL, EXAM_TIMER_KEY, hasPausedExam, resolveExamStatus } from './statusProva';

describe('status da prova', () => {
  beforeEach(() => localStorage.clear());

  it('sem cronômetro salvo a prova é nova', () => {
    expect(hasPausedExam('u1', 'Prova A')).toBe(false);
    expect(EXAM_BUTTON_LABEL[resolveExamStatus(false, false)]).toBe('Iniciar Prova');
  });

  it('cronômetro do mesmo usuário e prova indica prova pausada', () => {
    localStorage.setItem(EXAM_TIMER_KEY, JSON.stringify({ userId: 'u1', examId: 'Prova A' }));
    expect(hasPausedExam('u1', 'Prova A')).toBe(true);
    expect(EXAM_BUTTON_LABEL[resolveExamStatus(false, true)]).toBe('Continuar Prova');
  });

  it('cronômetro de outra prova ou outro usuário é ignorado', () => {
    localStorage.setItem(EXAM_TIMER_KEY, JSON.stringify({ userId: 'u1', examId: 'Prova A' }));
    expect(hasPausedExam('u1', 'Prova B')).toBe(false);
    expect(hasPausedExam('u2', 'Prova A')).toBe(false);
  });

  it('prova enviada mostra conferir resultados, mesmo com cronômetro salvo', () => {
    expect(EXAM_BUTTON_LABEL[resolveExamStatus(true, true)]).toBe('Conferir Resultados');
  });

  it('valor corrompido no armazenamento não quebra', () => {
    localStorage.setItem(EXAM_TIMER_KEY, '{nao-e-json');
    expect(hasPausedExam('u1', 'Prova A')).toBe(false);
  });
});
