
import { User, Question, ExamResult } from '../types';

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const dbService = {
  getQuestions: async (): Promise<Question[]> => {
    return apiRequest<Question[]>('/questions');
  },

  getUserByEmail: async (email: string): Promise<User | null> => {
    return apiRequest<User | null>(`/users/email/${encodeURIComponent(email)}`);
  },

  saveUser: async (user: Omit<User, 'id'>): Promise<User> => {
    return apiRequest<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  saveResult: async (result: Omit<ExamResult, 'id'>): Promise<ExamResult> => {
    return apiRequest<ExamResult>('/results', {
      method: 'POST',
      body: JSON.stringify(result),
    });
  },

  getUserResults: async (userId: string): Promise<ExamResult[]> => {
    return apiRequest<ExamResult[]>(`/results/user/${encodeURIComponent(userId)}`);
  },

  checkDomain: async (email: string): Promise<boolean> => {
    const domain = email.split('@')[1];
    return apiRequest<boolean>(`/domain/${encodeURIComponent(domain)}`);
  }
};
