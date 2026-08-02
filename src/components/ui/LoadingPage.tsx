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
        color: tok.textMuted,
        fontFamily: tok.fontBody,
        fontSize: 13,
      }}
    >
      {t('common.loading')}
    </div>
  );
}
