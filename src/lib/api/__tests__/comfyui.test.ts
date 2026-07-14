import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tauri module
const mockInvoke = vi.fn();
vi.mock('../../tauri', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  isTauriAvailable: true,
}));

import { detectComfyuiPath } from '../comfyui';

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('detectComfyuiPath', () => {
  it('calls detect_comfyui_path with no custom path', async () => {
    mockInvoke.mockResolvedValue('/home/user/ComfyUI/output');
    const result = await detectComfyuiPath();
    expect(mockInvoke).toHaveBeenCalledWith('detect_comfyui_path', {
      customPath: null,
    });
    expect(result).toBe('/home/user/ComfyUI/output');
  });

  it('calls detect_comfyui_path with custom path', async () => {
    mockInvoke.mockResolvedValue('/custom/path');
    const result = await detectComfyuiPath('/custom/path');
    expect(mockInvoke).toHaveBeenCalledWith('detect_comfyui_path', {
      customPath: '/custom/path',
    });
    expect(result).toBe('/custom/path');
  });

  it('returns null when ComfyUI not found', async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await detectComfyuiPath();
    expect(result).toBeNull();
  });
});
