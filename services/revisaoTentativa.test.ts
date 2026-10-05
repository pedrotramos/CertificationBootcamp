// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbService } from './dbService';

afterEach(() => vi.unstubAllGlobals());

function responder(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('dbService – revisão por tentativa', () => {
  it('pede a tentativa indicada por resultId e guarda cada uma no cache separadamente', async () => {
    const fetchMock = responder({ data: [{ _id: 'q1' }] });
    await dbService.getAnsweredQuestions('u1', 'Prova X', 'r1');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/results\/user\/u1\/questions\?exam=Prova%20X&resultId=r1$/);
    await dbService.getAnsweredQuestions('u1', 'Prova X', 'r1');     // cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await dbService.getAnsweredQuestions('u1', 'Prova X', 'r2');     // outra tentativa
    await dbService.getAnsweredQuestions('u1', 'Prova X');           // mais recente
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).not.toMatch(/resultId/);
  });
});
