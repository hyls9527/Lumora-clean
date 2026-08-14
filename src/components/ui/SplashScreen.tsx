import { useEffect, useRef, useState } from 'react';

const MIN_MS = 1400;
const MAX_MS = 5000;
const FADE_MS = 300;
const WORDMARK = 'Lumora';

interface SplashScreenProps {
  /** Whether the app content is ready to be revealed. */
  ready: boolean;
  /** Called once after the logo animation and fade-out complete. */
  onFinish: () => void;
}

/**
 * Brand launch animation: an amber crosshair draws in, the serif wordmark
 * settles glyph by glyph with a single sheen sweep and an amber rule, then
 * the whole screen fades out to reveal the app. Stays at least MIN_MS and
 * never longer than MAX_MS.
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
        transition: 'opacity 300ms ease, transform 300ms ease, background-color 400ms ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        {/* drawn amber crosshair, then the serif wordmark takes over */}
        <svg
          width={34}
          height={34}
          viewBox="0 0 34 34"
          aria-hidden="true"
          style={{ animation: 'splashCrossFade 240ms ease 0.62s forwards' }}
        >
          <line
            x1="17"
            y1="2"
            x2="17"
            y2="32"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="40"
            strokeDashoffset="40"
            style={{ animation: 'splashCross 320ms cubic-bezier(0.4, 0, 0.2, 1) both' }}
          />
          <line
            x1="2"
            y1="17"
            x2="32"
            y2="17"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="40"
            strokeDashoffset="40"
            style={{ animation: 'splashCross 320ms cubic-bezier(0.4, 0, 0.2, 1) 0.14s both' }}
          />
        </svg>

        {/* letterpress wordmark, glyph by glyph, with a single sheen sweep */}
        <div style={{ position: 'relative', overflow: 'visible' }}>
          <h1
            style={{
              position: 'relative',
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 58,
              fontWeight: 600,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'flex-end',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clipPath: 'inset(50%)',
              }}
            >
              LUMORA
            </span>
            {WORDMARK.split('').map((ch, i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  transformOrigin: 'center bottom',
                  willChange: 'transform, opacity',
                  animation: `splashGlyph 500ms cubic-bezier(0.2, 0.7, 0.25, 1) ${0.1 + i * 0.045}s both`,
                }}
              >
                {ch}
              </span>
            ))}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '46%',
                background: 'linear-gradient(90deg, transparent, rgba(122, 92, 18, 0.22), transparent)',
                transform: 'translateX(-160%) skewX(-18deg)',
                willChange: 'transform',
                animation: 'splashSheen 700ms ease-in-out 0.55s forwards',
              }}
            />
          </h1>
        </div>

        <div
          style={{
            width: 88,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
            transformOrigin: 'center',
            willChange: 'transform, opacity',
            animation: 'splashRule 500ms cubic-bezier(0.4, 0, 0.2, 1) 0.62s both',
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: '0.32em',
            textIndent: '0.32em',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            willChange: 'transform, opacity',
            animation: 'splashTag 500ms cubic-bezier(0.4, 0, 0.2, 1) 0.72s both',
          }}
        >
          光之韵律
        </p>
      </div>
    </div>
  );
}
