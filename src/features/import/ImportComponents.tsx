import { useState } from 'react';
import { t as tok } from '../../lib/tokens';

export function StatCard({
  dotColor,
  title,
  status,
  detail,
}: {
  dotColor: string;
  title: string;
  status: string;
  detail: string;
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${tok.border}`,
        borderRadius: 2,
        padding: 20,
        boxShadow:
          'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: tok.text }}>{title}</span>
      </div>
      <div style={{ fontSize: 14, color: tok.textSecondary }}>{status}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: tok.textSecondary }}>{detail}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: 'done' | 'processing' }) {
  const isDone = status === 'done';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 10,
        flexShrink: 0,
        color: isDone ? '#3b5635' : '#87571e',
        background: isDone ? 'rgba(74, 122, 58, 0.08)' : 'rgba(122, 92, 18, 0.06)',
        borderRadius: 2,
      }}
    >
      {isDone ? '完成' : '处理中'}
    </span>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: 24,
        fontFamily: tok.fontDisplay,
        color: tok.textSecondary,
        borderBottom: `1px solid ${tok.border}`,
        paddingBottom: 12,
      }}
    >
      {children}
    </h3>
  );
}

export function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <label style={{ fontSize: 12, width: 128, flexShrink: 0, color: tok.text }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function Toggle({ defaultChecked }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked ?? false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        position: 'relative',
        cursor: 'pointer',
        background: on ? tok.accent : tok.textMuted,
        border: 'none',
        transition: 'background 200ms',
        padding: 0,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          background: on ? tok.bg : '#f7f2ea',
          transition: 'left 200ms',
        }}
      />
    </button>
  );
}

export const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--color-surface)',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  color: tok.text,
  fontFamily: tok.fontBody,
  transition: 'border-color 200ms',
};

export const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--color-surface)',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  color: tok.text,
};
