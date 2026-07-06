import { useState } from 'react';

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          transition: 'color 200ms',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 200ms',
            fontSize: 10,
            color: '#6b5d48',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font-display)',
            color: open ? '#2a2118' : '#6b5d48',
          }}
        >
          {title}
        </span>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
