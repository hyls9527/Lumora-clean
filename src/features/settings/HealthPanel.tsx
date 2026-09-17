import { useCallback, useEffect, useState } from 'react';
import { getBackupStatus, createBackupNow, type BackupStatus } from '../../lib/api/diagnostics';
import { reliabilitySnapshot } from '../../lib/reliability';
import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

/**
 * Health panel — the two numbers that back the reliability promises:
 * how many restore points exist (RPO) and whether this run has crashed
 * (crash rate). Deliberately read-only reporting plus one manual action;
 * it never pretends a backend it cannot reach is healthy.
 */
export function HealthPanel() {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getBackupStatus()
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((e: unknown) => {
        // Fail visibly: an unreachable backend must not render as "0 snapshots".
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBackupNow = useCallback(() => {
    setBusy(true);
    setMessage(null);
    void createBackupNow()
      .then(() => {
        setMessage(t('autoBackupDone'));
        refresh();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, [refresh, t]);

  const crashes = reliabilitySnapshot().recentCrashes.length;

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 6,
        border: `1px solid ${tok.border}`,
        padding: '16px',
        marginTop: 12,
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text)' }}>
        {t('autoBackupTitle')}
      </p>

      {error && (
        <p role="alert" style={{ margin: '0 0 8px', fontSize: 12, color: tok.danger }}>
          {error}
        </p>
      )}
      {status?.lastError && (
        <p role="alert" style={{ margin: '0 0 8px', fontSize: 12, color: tok.danger }}>
          {t('autoBackupError', { message: status.lastError })}
        </p>
      )}

      <p style={{ margin: '0 0 4px', fontSize: 12, color: tok.textSecondary }}>
        {status && status.snapshots > 0
          ? t('autoBackupCount', { count: status.snapshots })
          : t('autoBackupNone')}
      </p>
      {status?.newest && (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: tok.textSecondary }}>
          {t('autoBackupNewest', { name: status.newest })}
        </p>
      )}
      {status && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: tok.textSecondary }}>
          {t('autoBackupEvery', {
            minutes: Math.round(status.intervalSeconds / 60),
            count: status.retain,
          })}
        </p>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text)' }}>
        {t('crashTitle')}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: tok.textSecondary }}>
        {crashes === 0 ? t('crashNone') : t('crashSome', { count: crashes })}
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleBackupNow}
          disabled={busy}
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
            background: 'none',
            border: `1px solid ${tok.border}`,
            padding: '6px 14px',
            borderRadius: 4,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {t('autoBackupNow')}
        </button>
        {message && (
          <span style={{ fontSize: 12, color: tok.success }}>{message}</span>
        )}
      </div>
    </div>
  );
}

export default HealthPanel;
