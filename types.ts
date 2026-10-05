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
  answers: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
    category: string;
  }[];
}

/** Corpo de POST /api/results: nota, acertos e data são calculados pelo servidor. */
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
