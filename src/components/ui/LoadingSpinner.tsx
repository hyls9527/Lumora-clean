interface LoadingSpinnerProps {
  /** 圆环直径，默认 24px */
  size?: number;
  /** 颜色，默认继承当前文本颜色 */
  color?: string;
}

export function LoadingSpinner({ size = 24, color = 'currentColor' }: LoadingSpinnerProps) {
  const strokeWidth = Math.max(2, Math.round(size / 12));

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ animation: 'spin 0.8s linear infinite' }}
        role="status"
        aria-label="Loading"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - strokeWidth) / 2}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${(size - strokeWidth) * Math.PI * 0.75} ${(size - strokeWidth) * Math.PI * 0.25}`}
        />
      </svg>
    </>
  );
}
