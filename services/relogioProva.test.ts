// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbService } from './dbService';

const relogio = { durationSeconds: 5400, remainingSeconds: 5000, paused: false, expired: false };

function responder(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
}

function chamadaDoFetch() {
  const [url, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
  return { url, init };
}

afterEach(() => vi.unstubAllGlobals());

describe('dbService – relógio da prova no servidor', () => {
  it('start, heartbeat e pause chamam as rotas certas e devolvem o relógio', async () => {
    const rotas: Array<[() => Promise<unknown>, string]> = [
      [() => dbService.startExamSession('u1', 'Prova'), '/exam-sessions/start'],
      [() => dbService.heartbeatExamSession('u1', 'Prova'), '/exam-sessions/heartbeat'],
      [() => dbService.pauseExamSession('u1', 'Prova'), '/exam-sessions/pause'],
    ];
    for (const [chamar, rota] of rotas) {
      responder({ data: relogio });
      expect(await chamar()).toEqual(relogio);
      const { url, init } = chamadaDoFetch();
      expect(url.endsWith(rota)).toBe(true);
      expect(JSON.parse(init.body as string)).toEqual({ userId: 'u1', exam: 'Prova' });
    }
  });

  it('a pausa ao fechar a aba usa keepalive para a chamada terminar', async () => {
    responder({ data: relogio });
    await dbService.pauseExamSession('u1', 'Prova', true);
    expect(chamadaDoFetch().init.keepalive).toBe(true);
  });
});
