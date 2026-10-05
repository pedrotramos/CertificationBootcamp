// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbService } from './dbService';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('dbService – timeout e erros de rede', () => {
  it('aborta a requisição após 20 s com mensagem em português', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError')));
      })));
    const chamada = dbService.getExams().catch(e => e as Error);
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await chamada).message).toMatch(/demorou demais/);
  });

  it('falha de rede vira mensagem amigável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(dbService.getExams()).rejects.toThrow(/Não foi possível conectar/);
  });
});
