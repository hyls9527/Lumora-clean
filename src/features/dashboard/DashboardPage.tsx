import { DotRow, SectionTitle, formatTime } from './DashboardComponents';
import { useEffect, useState, useCallback } from 'react';
import {
  getDashboardStats,
  toImageRecord,
  type DashboardStats,
} from '../../lib/api/images';
import { useEmbeddingStore } from '../../stores/embeddingStore';
import { useTranslation } from '../../lib/i18n';
import { formatFileSize } from '../../lib/format';
import { t as tokens } from '../../lib/tokens';


export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { t: tEmbed } = useTranslation('embedding');
  const embStats = useEmbeddingStore((s) => s.stats);
  const clipStats = useEmbeddingStore((s) => s.clipStats);
  const embLoading = useEmbeddingStore((s) => s.statsLoading);
  const fetchEmbStats = useEmbeddingStore((s) => s.fetchStats);
  const fetchClipStats = useEmbeddingStore((s) => s.fetchClipStats);
  const fillAllMissing = useEmbeddingStore((s) => s.fillAllMissing);
  const filling = useEmbeddingStore((s) => s.filling);
  const clipFilling = useEmbeddingStore((s) => s.clipFilling);
  const fillProgress = useEmbeddingStore((s) => s.fillProgress);
  const clipFillProgress = useEmbeddingStore((s) => s.clipFillProgress);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchEmbStats();
    void fetchClipStats();
  }, [load, fetchEmbStats, fetchClipStats]);

  // Ensure all ratings 0-5 are present
  const ratingMap = new Map<number, number>();
  for (let r = 0; r <= 5; r++) ratingMap.set(r, 0);
  if (stats) {
    for (const rc of stats.ratingCounts) {
      ratingMap.set(rc.rating, rc.count);
    }
  }

  const recentImages = stats?.recentImports.map(toImageRecord) ?? [];

  return (
    <div className="page-shell anim-page">
      {/* Header — 藏书目录 */}
      <div className="page-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="page-title">{t('nav.dashboard')}</h2>
        {stats && (
          <span style={{ fontSize: 11, color: tokens.textMuted, fontFamily: tokens.fontBody }}>
            {stats.totalImages} {t('dashboard.images')}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div
          className="empty-state"
          style={{ color: tokens.textMuted, fontFamily: tokens.fontBody, fontSize: 12 }}
        >
          {t('dashboard.loading')}
        </div>
      ) : error ? (
        <div className="empty-state">
          <p className="empty-state__desc">{error}</p>
          <button type="button" className="btn btn--accent" onClick={load}>
            {t('dashboard.retry')}
          </button>
        </div>
      ) : stats ? (
        <div
          style={{
            padding: '24px 28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            maxWidth: 720,
          }}
        >
          {/* Overview */}
          <section>
            <SectionTitle>{t('dashboard.overview')}</SectionTitle>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <DotRow
                label={t('dashboard.totalImages')}
                value={stats.totalImages.toLocaleString()}
              />
              <DotRow
                label={t('dashboard.storage')}
                value={formatFileSize(stats.totalSizeKb)}
              />
            </div>
          </section>

          {/* Embedding Coverage */}
          <section>
            <SectionTitle>{tEmbed('title')}</SectionTitle>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {embLoading ? (
                <span
                  style={{
                    fontSize: 12,
                    color: tokens.textMuted,
                    fontFamily: tokens.fontBody,
                  }}
                >
                  {t('dashboard.loading')}
                </span>
              ) : embStats ? (
                <>
                  <DotRow
                    label={tEmbed('statusEmbedded')}
                    value={embStats.embedded}
                  />
                  <DotRow
                    label={tEmbed('statusPending')}
                    value={embStats.pending}
                  />
                  <DotRow
                    label={tEmbed('statusError')}
                    value={embStats.error}
                  />
                  <DotRow
                    label={tEmbed('missing')}
                    value={embStats.missing}
                  />
                  <DotRow
                    label={tEmbed('visualMissing')}
                    value={clipStats?.missing ?? 0}
                  />
                  {(embStats.missing > 0 || (clipStats?.missing ?? 0) > 0) && (
                    <button
                      type="button"
                      className={filling || clipFilling ? 'btn' : 'btn btn--accent'}
                      disabled={filling || clipFilling}
                      onClick={() => void fillAllMissing()}
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    >
                      {filling || clipFilling
                        ? tEmbed('fillingProgress', {
                            remaining: String(
                              Math.max(
                                fillProgress?.remaining ?? 0,
                                clipFillProgress?.remaining ?? 0,
                              ),
                            ),
                          })
                        : tEmbed('fillMissing')}
                    </button>
                  )}
                  <DotRow
                    label={tEmbed('coverage')}
                    value={
                      embStats.total > 0
                        ? `${Math.round((embStats.embedded / embStats.total) * 100)}%`
                        : '—'
                    }
                  />
                </>
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    color: tokens.textMuted,
                    fontFamily: tokens.fontBody,
                  }}
                >
                  {t('dashboard.noData')}
                </span>
              )}
            </div>
          </section>

          {/* Format Distribution */}
          <section>
            <SectionTitle>{t('dashboard.formatDist')}</SectionTitle>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {stats.formatCounts.length === 0 ? (
                <span
                  style={{
                    fontSize: 12,
                    color: tokens.textMuted,
                    fontFamily: tokens.fontBody,
                  }}
                >
                  {t('dashboard.noData')}
                </span>
              ) : (
                stats.formatCounts.map((fc) => (
                  <DotRow
                    key={fc.format}
                    label={fc.format.toUpperCase()}
                    value={fc.count}
                  />
                ))
              )}
            </div>
          </section>

          {/* Rating Distribution */}
          <section>
            <SectionTitle>{t('dashboard.ratingDist')}</SectionTitle>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {Array.from(ratingMap.entries()).map(([rating, count]) => (
                <DotRow
                  key={rating}
                  label={
                    rating === 0
                      ? t('dashboard.unrated')
                      : `${'梅花'.slice(0, 1)} ${rating}`
                  }
                  value={count}
                />
              ))}
            </div>
          </section>

          {/* Top Tags */}
          <section>
            <SectionTitle>{t('dashboard.topTags')}</SectionTitle>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {stats.topTags.length === 0 ? (
                <span
                  style={{
                    fontSize: 12,
                    color: tokens.textMuted,
                    fontFamily: tokens.fontBody,
                  }}
                >
                  {t('dashboard.noTags')}
                </span>
              ) : (
                stats.topTags.map((tc) => (
                  <DotRow key={tc.name} label={tc.name} value={tc.count} />
                ))
              )}
            </div>
          </section>

          {/* Recent Imports */}
          <section>
            <SectionTitle>{t('dashboard.recentImports')}</SectionTitle>
            {recentImages.length === 0 ? (
              <span
                style={{
                  fontSize: 12,
                  color: tokens.textMuted,
                  fontFamily: tokens.fontBody,
                }}
              >
                {t('dashboard.noRecent')}
              </span>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {recentImages.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom: `1px solid ${tokens.borderSubtle}`,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 3,
                        background: tokens.bgAlt,
                        border: `1px solid ${tokens.border}`,
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: tokens.textMuted,
                          fontFamily: tokens.fontBody,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {img.format}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: tokens.text,
                          fontFamily: tokens.fontBody,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {img.fileName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: tokens.textMuted,
                          fontFamily: tokens.fontBody,
                          marginTop: 2,
                        }}
                      >
                        {img.width}×{img.height} · {formatFileSize(img.fileSizeKb)}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: tokens.textMuted,
                        fontFamily: tokens.fontBody,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatTime(img.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* Bottom bar */}
      <div
        style={{
          padding: '12px 28px',
          borderTop: `1px solid ${tokens.borderSubtle}`,
          marginTop: 'auto',
          fontSize: 11,
          color: tokens.textSecondary,
          fontFamily: tokens.fontBody,
        }}
      >
        {stats
          ? t('dashboard.summary', {
              count: stats.totalImages,
              size: formatFileSize(stats.totalSizeKb),
            })
          : ''}
      </div>
    </div>
  );
}

export default DashboardPage;
