// Estado de uma prova para o usuário logado, usado no rótulo do botão da home
export const EXAM_TIMER_KEY = 'examTimer';

export type ExamStatus = 'new' | 'paused' | 'completed';

/** Há um cronômetro salvo neste navegador para o usuário e a prova (prova iniciada e ainda não enviada). */
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

/** Concluída tem prioridade: depois do envio o cronômetro local é apagado, mas o resultado permanece. */
export function resolveExamStatus(hasResult: boolean, paused: boolean): ExamStatus {
  if (hasResult) return 'completed';
  return paused ? 'paused' : 'new';
}

export const EXAM_BUTTON_LABEL: Record<ExamStatus, string> = {
  new: 'Iniciar Prova',
  paused: 'Continuar Prova',
  completed: 'Conferir Resultados',
};
