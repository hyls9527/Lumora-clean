import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { reliabilitySnapshot, resetReliability } from '../../../lib/reliability';

/** A component that always throws, to drive the boundary's error path. */
function Boom(): never {
  throw new Error('render exploded');
}

describe('ErrorBoundary crash telemetry', () => {
  beforeEach(() => {
    resetReliability();
    sessionStorage.clear();
  });
  afterEach(() => {
    resetReliability();
    vi.restoreAllMocks();
  });

  it('records a caught render error so it counts toward the crash rate', () => {
    // React logs the caught error to console.error; that is expected noise.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/render exploded/)).toBeTruthy();
    const { recentCrashes } = reliabilitySnapshot();
    expect(recentCrashes).toHaveLength(1);
    expect(recentCrashes[0]).toMatchObject({
      source: 'react',
      message: 'render exploded',
    });
  });
});
