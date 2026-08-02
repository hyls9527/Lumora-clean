import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazy, Suspense } from 'react';
import { render, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;

function ThrowingComponent(): React.ReactNode {
  throw new Error('Test error');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('should render children when no error', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    expect(container.textContent).toContain('Test Content');
  });

  it('should render error UI when child throws', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(container.textContent).toContain('error');
  });

  it('should render error UI when a lazy chunk fails to load', async () => {
    const FailingLazy = lazy(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module: /chunk.js')),
    );
    const { container } = render(
      <ErrorBoundary>
        <Suspense fallback={<div>Loading chunk…</div>}>
          <FailingLazy />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(container.textContent).toContain('Loading chunk');

    await waitFor(() => {
      expect(container.textContent).toContain('Failed to fetch dynamically imported module');
    });
  });
});
