
import { User, Question, ExamResult } from '../types';

const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:3001/api';

// Cache configuration
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const CACHE_CLEANUP_INTERVAL = 15 * 60 * 1000; // Clean up every 15 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of cache entries

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

// Cleanup function to remove expired entries
function cleanupCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of cache.entries()) {
    const age = now - entry.timestamp;
    if (age > CACHE_DURATION) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));

  // If cache is still too large, remove oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp (oldest first)

    const entriesToRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
    entriesToRemove.forEach(([key]) => cache.delete(key));
  }
}

// Start periodic cleanup
let cleanupInterval: number | null = null;

function startCacheCleanup(): void {
  if (cleanupInterval === null) {
    // Run cleanup immediately
    cleanupCache();
    // Then run cleanup every CACHE_CLEANUP_INTERVAL
    cleanupInterval = window.setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL);
  }
}

// Initialize cleanup on module load
if (typeof window !== 'undefined') {
  startCacheCleanup();
}

function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  const age = now - entry.timestamp;

  if (age > CACHE_DURATION) {
    // Cache expired
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });

  // Cleanup if cache is getting too large
  if (cache.size > MAX_CACHE_SIZE) {
    cleanupCache();
  }
}

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
  getExams: async (): Promise<string[]> => {
    const cacheKey = 'getExams';
    const cached = getCachedData<string[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const data = await apiRequest<string[]>('/questions/exams');
    setCachedData(cacheKey, data);
    return data;
  },

  getQuestions: async (exam?: string): Promise<Question[]> => {
    const endpoint = exam ? `/questions?exam=${encodeURIComponent(exam)}` : '/questions';
    const data = await apiRequest<Question[]>(endpoint);
    return data;
  },

  getAnsweredQuestions: async (userId: string, exam: string): Promise<Question[]> => {
    const cacheKey = `getAnsweredQuestions:${userId}:${exam}`;
    const cached = getCachedData<Question[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const endpoint = `/results/user/${encodeURIComponent(userId)}/questions?exam=${encodeURIComponent(exam)}`;
    const data = await apiRequest<Question[]>(endpoint);
    setCachedData(cacheKey, data);
    return data;
  },

  getUserByEmail: async (email: string): Promise<User | null> => {
    const cacheKey = `getUserByEmail:${email}`;
    const cached = getCachedData<User | null>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const data = await apiRequest<User | null>(`/users/email/${email}`);
    setCachedData(cacheKey, data);
    return data;
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

  getUserResults: async (userId: string, exam: string): Promise<ExamResult[]> => {
    const cacheKey = `getUserResults:${userId}:${exam}`;
    const cached = getCachedData<ExamResult[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const data = await apiRequest<ExamResult[]>(`/results/user/${encodeURIComponent(userId)}?exam=${encodeURIComponent(exam)}`);
    setCachedData(cacheKey, data);
    return data;
  },

  checkDomain: async (email: string): Promise<{ whitelisted: boolean; company?: string }> => {
    const domain = email.split('@')[1];
    return apiRequest<{ whitelisted: boolean; company?: string }>(`/domain/${encodeURIComponent(domain)}`);
  },

  generateOTP: async (email: string): Promise<{ email: string; message?: string }> => {
    return apiRequest<{ email: string; message?: string }>('/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  validateOTP: async (email: string, otp: string): Promise<{ valid: boolean; message?: string }> => {
    return apiRequest<{ valid: boolean; message?: string }>('/otp/validate', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  addDomain: async (domain: string, requesterEmail: string, company: string): Promise<{ success: boolean; message?: string }> => {
    return apiRequest<{ success: boolean; message?: string }>('/domain', {
      method: 'POST',
      body: JSON.stringify({ domain, requesterEmail, company }),
    });
  }
};
