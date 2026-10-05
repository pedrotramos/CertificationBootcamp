// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, dbService } from './dbService';

function responder(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('dbService – erros da API', () => {
  it('expõe status e código do backend em ApiError', async () => {
    responder(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } });
    const erro = await dbService.generateOTP('a@empresa.com').catch(e => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({ status: 429, code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' });
  });

  it('domínio não liberado chega como FORBIDDEN', async () => {
    responder(403, { error: { code: 'FORBIDDEN', message: 'Email domain is not allowed' } });
    const erro = await dbService.generateOTP('a@uberip.com').catch(e => e);
    expect(erro.code).toBe('FORBIDDEN');
  });

  it('sessão inválida descarta o token guardado', async () => {
    localStorage.setItem('sessionToken', 'velho');
    responder(401, { error: { code: 'SESSION_INVALID', message: 'Session invalid' } });
    await dbService.getCurrentUser().catch(() => undefined);
    expect(localStorage.getItem('sessionToken')).toBeNull();
  });

  it('não existe mais consulta pública de domínio', () => {
    expect((dbService as Record<string, unknown>).checkDomain).toBeUndefined();
  });
});
