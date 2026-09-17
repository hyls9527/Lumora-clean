import { useEffect, useRef, useState } from 'react';
import iconUrl from '../../assets/icon.png';

// The splash is a curtain over an already-loading app, so its duration is a
// direct addition to "time until the user can work". The acceptance budget is
// page load < 2s (TC-PERF-001): a 900ms hold + 240ms fade keeps the品牌
// choreography intact while leaving the app visible at ~1.1s, instead of the
// 2.16s the previous 1800ms hold cost.
const MIN_MS = 900;
const MAX_MS = 5200;
const FADE_MS = 240;
const WORDMARK = 'Lumora';

interface SplashScreenProps {
  /** Whether the app content is ready to be revealed. */
  ready: boolean;
  /** Called once after the logo animation and fade-out complete. */
  onFinish: () => void;
}

/**
 * Brand launch — 灯火初燃：
 * 1. 暖色光晕缓慢呼吸
 * 2. 灯笼图标自微缩中亮起
 * 3. 衬线字标逐字落定 + 一道金线扫过
 * 4. 琥珀色细线展开 + 副题「光之韵律」浮现
 * 5. 底部进度线走完后整屏淡出
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
        gap: 36,
        background:
          'radial-gradient(ellipse 70% 50% at 50% 40%, var(--color-accent-subtle), transparent 60%), var(--color-bg)',
        opacity: fading ? 0 : 1,
        transform: fading ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 360ms cubic-bezier(0.2, 0.7, 0.25, 1), transform 360ms cubic-bezier(0.2, 0.7, 0.25, 1)',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes splashInkRing {
          0% { transform: scale(0.4); opacity: 0; }
          40% { opacity: 0.55; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes splashSheen {
          0% { transform: translateX(-120%); opacity: 0; }
          20% { opacity: 0.55; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes splashProgress {
          0% { transform: scaleX(0); opacity: 0.2; }
          70% { opacity: 1; }
          100% { transform: scaleX(1); opacity: 0; }
        }
        @keyframes splashHalo {
          0%, 100% { opacity: 0.4; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {/* 灯笼图标 + 光晕 + 墨圈 */}
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: -22,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, var(--color-accent-subtle) 0%, transparent 70%)',
              animation: 'splashHalo 1.9s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: '50%',
              border: '1px solid var(--color-accent)',
              animation: 'splashInkRing 1.1s cubic-bezier(0.2, 0.7, 0.25, 1) 0.15s both',
              pointerEvents: 'none',
            }}
          />
          <img
            src={iconUrl}
            alt=""
            aria-hidden="true"
            width={80}
            height={80}
            style={{
              position: 'absolute',
              left: 4,
              top: 4,
              willChange: 'transform, opacity',
              animation: 'splashLogoIn 700ms cubic-bezier(0.2, 0.7, 0.25, 1) both',
            }}
          />
        </div>

        {/* 字标逐字 + 金线扫过 */}
        <div style={{ position: 'relative', overflow: 'hidden', padding: '0 8px' }}>
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
                  animation: `splashGlyph 560ms cubic-bezier(0.2, 0.7, 0.25, 1) ${0.18 + i * 0.055}s both`,
                }}
              >
                {ch}
              </span>
            ))}
          </h1>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '40%',
              background:
                'linear-gradient(100deg, transparent, var(--color-accent-subtle), transparent)',
              animation: 'splashSheen 900ms ease-out 0.85s both',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          style={{
            width: 96,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
            transformOrigin: 'center',
            willChange: 'transform, opacity',
            animation: 'splashRule 560ms cubic-bezier(0.4, 0, 0.2, 1) 0.95s both',
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
            animation: 'splashTag 560ms cubic-bezier(0.4, 0, 0.2, 1) 1.1s both',
          }}
        >
          光之韵律
        </p>
      </div>

      {/* 底部进度细线 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 48,
          left: '50%',
          width: 120,
          height: 1,
          marginLeft: -60,
          background: 'var(--color-accent)',
          transformOrigin: 'left center',
          animation: `splashProgress ${Math.min(MIN_MS, 2200)}ms cubic-bezier(0.4, 0, 0.2, 1) 0.3s both`,
        }}
      />
    </div>
  );
}

export default SplashScreen;
