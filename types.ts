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
  text: string;
  imageUrl?: string;
}

export interface Question {
  _id?: ObjectId;
  enunciado: string;
  enunciadoImageUrl?: string;
  options: Option[];
  correctOptionId: string;
  explanation: string;
  category: string;
  exam: string;
}

export interface ExamResult {
  _id?: ObjectId;
  userId: string;
  timestamp: Date;
  score: number;
  totalQuestions: number;
  answers: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
  }[];
}

export type AppState = 'welcome' | 'register' | 'exam' | 'results';

/**
 * Maps question IDs to the selected option ID for each question.
 * Each entry represents the user's answer choice for a specific question.
 */
export type Answers = { [questionId: string]: string };
