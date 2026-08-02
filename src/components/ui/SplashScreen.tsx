import { useEffect, useRef, useState } from 'react';

const MIN_MS = 2000;
const MAX_MS = 5000;
const FADE_MS = 420;

interface SplashScreenProps {
  /** Whether the app content is ready to be revealed. */
  ready: boolean;
  /** Called once after the logo animation and fade-out complete. */
  onFinish: () => void;
}

/**
 * Brand launch animation: logo mark pops in with a drawn ring and light
 * sheen, the LUMORA wordmark settles, then the whole screen fades out to
 * reveal the app. Stays at least MIN_MS and never longer than MAX_MS.
 */
export function SplashScreen({ ready, onFinish }: SplashScreenProps) {
  const [fading, setFading] = useState(false);
  const startedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    const beginFade = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFading(true);
      window.setTimeout(onFinish, FADE_MS);
    };

    const maxTimer = window.setTimeout(beginFade, MAX_MS);
    let readyTimer: number | undefined;
    if (ready) {
      const elapsed = Date.now() - startedAtRef.current;
      readyTimer = window.setTimeout(beginFade, Math.max(0, MIN_MS - elapsed));
    }

    return () => {
      window.clearTimeout(maxTimer);
      if (readyTimer !== undefined) window.clearTimeout(readyTimer);
    };
  }, [ready, onFinish]);

  return (
    <div
      role="status"
      aria-label="Lumora 启动中"
      className="splash-anim"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        background:
          'radial-gradient(circle at 50% 42%, var(--color-accent-subtle), transparent 55%), var(--color-bg)',
        opacity: fading ? 0 : 1,
        transform: fading ? 'scale(1.03)' : 'scale(1)',
        transition: 'opacity 420ms ease, transform 420ms ease, background-color 500ms ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div style={{ position: 'relative', width: 112, height: 112 }}>
        <svg
          viewBox="0 0 112 112"
          aria-hidden="true"
          style={{ position: 'absolute', inset: -6, width: 'calc(100% + 12px)', height: 'calc(100% + 12px)' }}
        >
          <circle
            cx="56"
            cy="56"
            r="53"
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            strokeDasharray="333"
            strokeDashoffset="333"
            style={{ animation: 'splashRing 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.25s forwards' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 26,
            background: 'linear-gradient(145deg, var(--color-accent-hover), var(--color-accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            animation:
              'splashMarkIn 850ms cubic-bezier(0.22, 1, 0.36, 1) both, splashGlow 2.2s ease-in-out 0.9s infinite',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 52,
              fontWeight: 700,
              color: 'var(--color-bg)',
              lineHeight: 1,
            }}
          >
            L
          </span>
          <span
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '42%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent)',
              transform: 'translateX(-160%) skewX(-18deg)',
              animation: 'splashSheen 1.15s ease-in-out 0.55s forwards',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 30,
            fontWeight: 600,
            color: 'var(--color-text)',
            letterSpacing: '0.16em',
            textIndent: '0.16em',
            animation: 'splashWord 900ms cubic-bezier(0.22, 1, 0.36, 1) 0.35s both',
          }}
        >
          LUMORA
        </h1>
        <div
          style={{
            width: 72,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
            transformOrigin: 'center',
            animation: 'splashRule 700ms ease 0.85s both',
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: '0.34em',
            textIndent: '0.34em',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            animation: 'splashTag 700ms ease 1s both',
          }}
        >
          光之韵律
        </p>
      </div>
    </div>
  );
}
