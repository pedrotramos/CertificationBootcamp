import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
}

export interface Option {
  id: string;
  text?: string;
  imageUrl?: string;
}

export interface Question {
  _id?: ObjectId;
  enunciado: string;
  enunciadoImageUrl?: string;
  options: Option[];
  // Ausentes nas questões da prova: o servidor só envia gabarito e explicação depois que a prova é entregue
  correctOptionId?: string;
  explanation?: string;
  category: string;
  exam: string;
}

/** Resposta de GET /api/questions/browse (admin). */
export interface BrowseQuestionsResponse {
  questions: Question[];
  total: number;
  page: number;
  pageSize: number;
  semanticRanked: boolean;
  searchMatchMode?: 'strict' | 'relaxed';
}

export interface ExamResult {
  _id?: ObjectId;
  userId: string;
  timestamp: Date;
  score: number;
  totalQuestions: number;
  exam: string;
  /** true quando o servidor encerrou a tentativa por tempo esgotado (as respostas não foram aproveitadas) */
  expired?: boolean;
  /** número da tentativa do usuário nesta prova (1, 2, …) */
  attempt?: number;
  answers: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
    category: string;
  }[];
}

/** Corpo de POST /api/results: nota, acertos e data são calculados pelo servidor. */
/** Relógio da prova mantido pelo servidor */
export interface ExamClock {
  id?: string;
  durationSeconds: number;
  remainingSeconds: number;
  paused: boolean;
  expired: boolean;
}

export interface SubmitResultPayload {
  userId: string;
  exam: string;
  answers: { questionId: string; selectedOptionId: string }[];
}

export interface AdminResultAttempt {
  id: string;
  userId: string;
  name: string;
  email: string;
  company: string;
  exam: string;
  timestamp: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  categoryScores: { category: string; correct: number; total: number; percentage: number }[];
}

export interface AdminResultsDashboardData {
  attempts: AdminResultAttempt[];
  sessions: { id: string; userId: string; exam: string; startedAt: string; completedAt?: string; status: 'in_progress' | 'completed' }[];
  updatedAt: string;
}

export type AppState = 'welcome' | 'register' | 'exam' | 'results' | 'contact' | 'faq';

/**
 * Maps question IDs to the selected option ID for each question.
 * Each entry represents the user's answer choice for a specific question.
 */
export type Answers = { [questionId: string]: string };

/** Situação da prova para o usuário, segundo GET /api/exam-status. */
export type ExamState = 'new' | 'in_progress' | 'cooldown' | 'can_retake';

export interface ExamStatusInfo {
  state: ExamState;
  attempts: number;
  lastResult: { id: string; score: number; totalQuestions: number; timestamp: string; attempt: number } | null;
  /** ISO 8601 (UTC): quando a próxima tentativa é liberada; null se não há envio anterior ou há prova em andamento */
  availableAt: string | null;
}
