
import { User, Question, ExamResult, BrowseQuestionsResponse, AdminResultsDashboardData, SubmitResultPayload } from '../types';

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

/** Extrai `data` de `{ "data": T }` ou devolve o corpo em bruto (legado). */
function unwrapApiBody<T>(body: unknown): T {
  if (body !== null && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function errorMessageFromBody(body: unknown, fallback: string): string {
  if (body !== null && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return String((err as { message: string }).message);
    }
    if (typeof err === 'string') return err;
  }
  return fallback;
}

/**
 * Normaliza lista de categorias (API devolve `string[]` em `data`).
 * Fallback: documentos de pergunta com campo `category`.
 */
function asDistinctCategoryList(data: unknown): string[] {
  const raw = Array.isArray(data) ? data : [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (rawStr: string) => {
    const s = rawStr.trim();
    if (!s) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  for (const item of raw) {
    if (typeof item === 'string') {
      push(item);
    } else if (item !== null && typeof item === 'object' && 'category' in item) {
      const c = (item as { category: unknown }).category;
      if (typeof c === 'string') push(c);
    }
  }
  return out;
}

// Sessão do usuário: token assinado emitido pelo backend quando o OTP é validado
const SESSION_TOKEN_KEY = 'sessionToken';

function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearSessionToken(): void {
  cache.clear(); // respostas em cache pertencem ao usuário que está saindo
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// Sessão de admin (e-mail + OTP já validado), enviada nas rotas protegidas do backend
let adminAuth: { email: string; otp: string } | null = null;

function adminHeaders(): Record<string, string> {
  return adminAuth ? { 'X-Admin-Email': adminAuth.email, 'X-Admin-Otp': adminAuth.otp } : {};
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // `headers` é separado de `...rest` para não sobrescrever o Content-Type ao enviar cabeçalhos extras
  const { headers, ...rest } = options ?? {};
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Token expirado/inválido: descarta a sessão para o app voltar à tela de login
    if (
      body !== null && typeof body === 'object' && 'error' in body &&
      (body as { error?: { code?: string } }).error?.code === 'SESSION_INVALID'
    ) {
      clearSessionToken();
    }
    throw new Error(errorMessageFromBody(body, `Request failed (${response.status})`));
  }

  return unwrapApiBody<T>(body);
}

export const dbService = {
  hasSession: (): boolean => getSessionToken() !== null,

  clearSession: (): void => clearSessionToken(),

  /**
   * Encerra a sessão: descarta o token localmente na hora e pede ao servidor para revogá-lo
   * (vale também para os tokens de outros dispositivos). Falha de rede não impede o logout local.
   */
  logout: async (): Promise<void> => {
    const token = getSessionToken();
    clearSessionToken();
    if (!token) return;
    try {
      await apiRequest('/session/logout', {
        method: 'POST',
        keepalive: true,
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Failed to revoke session on the server:', error);
    }
  },

  /** Usuário dono da sessão (null se o OTP foi validado mas o cadastro ainda não foi feito). */
  getCurrentUser: async (): Promise<User | null> => apiRequest<User | null>('/users/me'),

  setAdminAuth: (email: string, otp: string): void => {
    adminAuth = { email, otp };
  },

  clearAdminAuth: (): void => {
    adminAuth = null;
  },

  getAdminResultsDashboard: async (email: string, otp: string): Promise<AdminResultsDashboardData> =>
    apiRequest<AdminResultsDashboardData>('/admin/results-dashboard', {
      headers: { 'X-Admin-Email': email, 'X-Admin-Otp': otp },
    }),

  startExamSession: async (userId: string, exam: string): Promise<{ id: string }> =>
    apiRequest<{ id: string }>('/exam-sessions/start', { method: 'POST', body: JSON.stringify({ userId, exam }) }),

  completeExamSession: async (userId: string, exam: string): Promise<void> => {
    await apiRequest('/exam-sessions/complete', { method: 'POST', body: JSON.stringify({ userId, exam }) });
  },

  /**
   * Lista nomes de prova distintos.
   * Com `minQuestions`, a API retorna só provas com pelo menos essa quantidade de questões na base (ex.: home do simulado).
   */
  getExams: async (options?: { minQuestions?: number }): Promise<string[]> => {
    const cacheKey =
      options?.minQuestions != null && options.minQuestions > 0
        ? `getExams:minQuestions=${options.minQuestions}`
        : 'getExams';
    const cached = getCachedData<string[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const qs =
      options?.minQuestions != null && options.minQuestions > 0
        ? `?minQuestions=${encodeURIComponent(String(options.minQuestions))}`
        : '';
    const data = await apiRequest<string[]>(`/exams${qs}`);
    setCachedData(cacheKey, data);
    return data;
  },

  /** GET /categories?exam= — categorias distintas (campo `category`). */
  getQuestionCategoriesForExam: async (exam: string): Promise<string[]> => {
    const q = encodeURIComponent(exam.trim());
    const data = await apiRequest<unknown>(`/categories?exam=${q}`);
    return asDistinctCategoryList(data);
  },

  getQuestions: async (exam?: string): Promise<Question[]> => {
    const endpoint = exam ? `/questions?exam=${encodeURIComponent(exam)}` : '/questions';
    const data = await apiRequest<Question[]>(endpoint);
    return data;
  },

  /** Todas as perguntas de uma prova (ordem: categoria, id) — uso administrativo. */
  listAllQuestionsForExam: async (exam: string): Promise<Question[]> => {
    const q = encodeURIComponent(exam.trim());
    return apiRequest<Question[]>(`/questions?exam=${q}&listAll=1`, { headers: adminHeaders() });
  },

  /** Lista paginada por prova; `search` ativa ordenação por relevância (busca semântica leve no servidor). */
  browseQuestions: async (params: {
    exam: string;
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
  }): Promise<BrowseQuestionsResponse> => {
    const e = encodeURIComponent(params.exam.trim());
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    let qs = `?exam=${e}&page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`;
    const s = (params.search ?? '').trim();
    if (s.length >= 2) {
      qs += `&search=${encodeURIComponent(s)}`;
    }
    const cat = (params.category ?? '').trim();
    if (cat) {
      qs += `&category=${encodeURIComponent(cat)}`;
    }
    return apiRequest<BrowseQuestionsResponse>(`/questions/browse${qs}`, { headers: adminHeaders() });
  },

  updateQuestion: async (id: string, question: Omit<Question, '_id'>): Promise<Question> => {
    const updated = await apiRequest<Question>(`/questions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(question),
    });
    cache.delete('getExams');
    return updated;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await apiRequest<unknown>(`/questions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    cache.delete('getExams');
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

  /** Envia só as respostas escolhidas; o servidor corrige, calcula a nota e define a data. */
  saveResult: async (result: SubmitResultPayload): Promise<ExamResult> => {
    return apiRequest<ExamResult>('/results', {
      method: 'POST',
      body: JSON.stringify(result),
    });
  },

  getUserResults: async (userId: string, exam: string): Promise<ExamResult[]> => {
    const data = await apiRequest<ExamResult[]>(`/results/user/${encodeURIComponent(userId)}?exam=${encodeURIComponent(exam)}`);
    return data;
  },

  deleteUserResults: async (userId: string, exam?: string): Promise<{ deletedCount: number }> => {
    const query = exam ? `?exam=${encodeURIComponent(exam)}` : '';
    return apiRequest<{ deletedCount: number }>(`/results/user/${encodeURIComponent(userId)}${query}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
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

  validateOTP: async (email: string, otp: string): Promise<{ valid: boolean; message?: string; token?: string }> => {
    const result = await apiRequest<{ valid: boolean; message?: string; token?: string }>('/otp/validate', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    if (result.valid && result.token) {
      localStorage.setItem(SESSION_TOKEN_KEY, result.token);
    }
    return result;
  },

  addDomain: async (domain: string, requesterEmail: string, company: string): Promise<{ success: boolean; message?: string }> => {
    return apiRequest<{ success: boolean; message?: string }>('/domain', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ domain, requesterEmail, company }),
    });
  },

  addQuestion: async (question: Omit<Question, '_id'>): Promise<Question> => {
    const created = await apiRequest<Question>('/questions', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(question),
    });
    cache.delete('getExams');
    return created;
  },
};
