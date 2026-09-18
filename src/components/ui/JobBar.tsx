import { useJobStore } from '../../stores/jobStore';
import { jobPercent, type JobKind, type JobStatus } from '../../lib/api/jobs';
import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

/**
 * Non-modal job bar: the "do not disturb" half of the job system.
 *
 * Deliberately *not* a modal or a blocking overlay. The user asked for background
 * work — they must be able to keep browsing, open an image, or start something
 * else while it runs. The bar only reports and offers Cancel, and renders nothing
 * at all when there is no work, so it costs zero attention in the common case.
 */

/** Human-readable name per job kind; unknown kinds fall back to the raw id. */
function kindLabel(kind: JobKind, t: (k: string) => string): string {
  const key = `jobs.kind.${kind}`;
  const value = t(key);
  return value === key ? kind : value;
}

function stateLabel(job: JobStatus, t: (k: string) => string): string {
  switch (job.state) {
    case 'completed':
      return t('jobs.state.completed');
    case 'cancelled':
      return t('jobs.state.cancelled');
    case 'failed':
      return t('jobs.state.failed');
    default:
      return t('jobs.state.running');
  }
}

function JobRow({ job }: { job: JobStatus }) {
  const { t } = useTranslation();
  const cancel = useJobStore((s) => s.cancel);
  const active = job.state === 'pending' || job.state === 'running';
  const percent = jobPercent(job);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        fontSize: 12,
        fontFamily: tok.fontBody,
        color: tok.text,
      }}
    >
      <span style={{ minWidth: 76, color: tok.textSecondary }}>{kindLabel(job.kind, t)}</span>

      <div
        style={{
          flex: 1,
          height: 3,
          background: tok.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label={kindLabel(job.kind, t)}
      >
        <div
          style={{
            width: percent === null ? '100%' : `${percent}%`,
            height: '100%',
            background: job.state === 'failed' ? tok.danger : tok.accent,
            transition: `width ${tok.transitionFast}`,
            // Unknown total: an indeterminate sliver rather than a fake 0%.
            opacity: percent === null ? 0.4 : 1,
          }}
        />
      </div>

      <span style={{ minWidth: 96, textAlign: 'right', color: tok.textSecondary }}>
        {percent === null
          ? t('jobs.progressUnknown', { processed: job.processed })
          : t('jobs.progress', { processed: job.processed, total: job.total })}
      </span>

      <span
        style={{
          minWidth: 64,
          color: job.state === 'failed' ? tok.danger : tok.textSecondary,
        }}
      >
        {stateLabel(job, t)}
      </span>

      {active && (
        <button
          type="button"
          onClick={() => void cancel(job.id)}
          disabled={job.cancelRequested}
          style={{
            fontSize: 12,
            fontFamily: tok.fontBody,
            color: job.cancelRequested ? tok.textMuted : tok.text,
            background: 'none',
            border: `1px solid ${tok.border}`,
            borderRadius: 4,
            padding: '2px 10px',
            cursor: job.cancelRequested ? 'default' : 'pointer',
          }}
        >
          {job.cancelRequested ? t('jobs.cancelling') : t('jobs.cancel')}
        </button>
      )}
    </div>
  );
}

export function JobBar() {
  const active = useJobStore((s) => s.active);
  const recent = useJobStore((s) => s.recent);
  const error = useJobStore((s) => s.error);

  // Nothing running and nothing just-finished to report: render nothing, so the
  // bar never becomes permanent furniture.
  if (active.length === 0 && recent.length === 0 && error === null) return null;

  return (
    <div
      role="status"
      // Named so it can be told apart from the splash screen, which also uses
      // role="status" during startup.
      aria-label="后台任务"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 900,
        background: tok.surface,
        borderTop: `1px solid ${tok.border}`,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        // Pointer events only on the bar itself, never on the page beneath it.
        pointerEvents: 'auto',
      }}
    >
      {error !== null && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 12,
            color: tok.danger,
            fontFamily: tok.fontBody,
          }}
        >
          {error}
        </div>
      )}
      {[...active, ...recent].map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  );
}

export default JobBar;