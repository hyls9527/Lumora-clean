import { t } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

/** Lightweight loading placeholder — extracted from App.tsx */
export function LoadingPage() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: tok.textMuted,
        fontFamily: tok.fontBody,
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: tok.accent,
          animation: 'splashPulse 1s ease-in-out infinite',
        }}
      />
      {t('common.loading')}
    </div>
  );
}
