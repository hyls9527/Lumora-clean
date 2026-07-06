import { useState } from 'react';
import { t as tok } from '../../lib/tokens';

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
            color: tok.textSecondary,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontFamily: tok.fontDisplay,
            color: open ? tok.text : tok.textSecondary,
          }}
        >
          {title}
        </span>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
