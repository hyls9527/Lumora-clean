import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLanInfo } from '../lan';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getLanInfo', () => {
  it('unpacks the [ip, port, token] tuple into a named object', async () => {
    mockInvoke.mockResolvedValueOnce(['192.168.1.20', 7890, 'abc123']);

    await expect(getLanInfo()).resolves.toEqual({
      ip: '192.168.1.20',
      port: 7890,
      token: 'abc123',
    });
    expect(mockInvoke).toHaveBeenCalledWith('get_lan_info');
  });

  it('propagates the failure when the LAN server is not running', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('LAN server disabled'));

    await expect(getLanInfo()).rejects.toThrow('LAN server disabled');
  });
});
