import { vi } from 'vitest';

// Default mock — individual tests override this with vi.mocked(pbAdmin).mockResolvedValue(...)
export const pbAdmin = vi.fn();
