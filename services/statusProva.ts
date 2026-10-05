import type { ExamState } from '../types';

// Estado de uma prova para o usuário logado, usado no rótulo do botão da home e na tela de resultados
export const EXAM_TIMER_KEY = 'examTimer';

export type ExamStatus = ExamState;

/** Há um cronômetro salvo neste navegador para o usuário e a prova (só serve de reserva se o servidor não responder). */
export function hasPausedExam(userId: string, examId: string): boolean {
  try {
    const stored = localStorage.getItem(EXAM_TIMER_KEY);
    if (!stored) return false;
    const timer = JSON.parse(stored) as { userId?: string; examId?: string };
    return timer.userId === userId && timer.examId === examId;
  } catch {
    return false;
  }
}

/** O servidor é a fonte da verdade; sem resposta dele, vale o cronômetro guardado neste navegador. */
export function resolveExamStatus(serverState: ExamState | null, paused: boolean): ExamStatus {
  if (serverState) return serverState;
  return paused ? 'in_progress' : 'new';
}

export const EXAM_BUTTON_LABEL: Record<ExamStatus, string> = {
  new: 'Iniciar Prova',
  in_progress: 'Continuar Prova',
  cooldown: 'Conferir Resultados',
  can_retake: 'Fazer Nova Tentativa',
};

/** "6d 4h", "3h 20min" ou "menos de 1 min": tempo que falta até a nova tentativa ser liberada. */
export function formatTimeUntil(isoUtc: string, now: Date = new Date()): string {
  const target = new Date(isoUtc).getTime();
  if (Number.isNaN(target)) return '';
  const minutesLeft = Math.max(0, Math.ceil((target - now.getTime()) / 60_000));
  if (minutesLeft < 1) return 'menos de 1 min';
  const days = Math.floor(minutesLeft / 1440);
  const hours = Math.floor((minutesLeft % 1440) / 60);
  const minutes = minutesLeft % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}
