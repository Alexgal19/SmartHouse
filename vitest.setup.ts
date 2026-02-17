import { expect, afterEach, vi } from 'vitest';
// Shim jest to vi
globalThis.jest = vi;

import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY = 'test-webpush-key';
process.env.SECRET_COOKIE_PASSWORD = 'test-secret-password-min-32-chars-long';
process.env.ADMIN_PASSWORD = 'test-admin-password';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
}));

// Mock Next.js cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  app: {},
  messagingPromise: Promise.resolve(null),
}));

// Suppress console errors in tests (optional)
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};
