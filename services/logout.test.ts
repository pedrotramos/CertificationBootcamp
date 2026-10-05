// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbService } from './dbService';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('dbService.logout', () => {
  it('descarta o token na hora e pede ao servidor para revogá-lo', async () => {
    localStorage.setItem('sessionToken', 'token-atual');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { revoked: true } }) });
    vi.stubGlobal('fetch', fetchMock);

    const promessa = dbService.logout();
    expect(localStorage.getItem('sessionToken')).toBeNull();      // já saiu, antes da resposta do servidor
    expect(dbService.hasSession()).toBe(false);
    await promessa;

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.endsWith('/session/logout')).toBe(true);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-atual');
  });

  it('sem sessão não chama o servidor', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await dbService.logout();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falha de rede não impede o logout local', async () => {
    localStorage.setItem('sessionToken', 'token-atual');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(dbService.logout()).resolves.toBeUndefined();
    expect(localStorage.getItem('sessionToken')).toBeNull();
  });
});
