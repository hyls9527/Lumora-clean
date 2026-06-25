import { useEffect, useState, useCallback } from 'react';
import {
  getDashboardStats,
  type DashboardStats,
} from '../../lib/api/images';
import type { ImageRecord } from '../../stores/imageStore';
import { useTranslation } from '../../lib/i18n';

/** Format bytes to human-readable string */
function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/** Convert TauriImageRecord → ImageRecord for display */
function toImageRecord(raw: {
  id: string;
  filePath: string;
  fileHash: string;
  fileSizeKb: number;
  width: number | null;
  height: number | null;
  format: string;
  createdAt: string;
  importedAt: string;
  deleted: boolean;
  deletedAt: string | null;
  rating: number;
  favorite: boolean;
  metadataJson: string | null;
}): ImageRecord {
  let model = '';
  let prompt = '';
  let tags: string[] = [];
  if (raw.metadataJson) {
    try {
      const meta = JSON.parse(raw.metadataJson);
      model = meta.model ?? '';
      prompt = meta.prompt ?? '';
      tags = Array.isArray(meta.tags) ? meta.tags : [];
    } catch {
      /* ignore */
    }
  }
  return {
    id: raw.id,
    filePath: raw.filePath,
    fileName: raw.filePath.split(/[/\\]/).pop() ?? raw.filePath,
    fileSizeKb: raw.fileSizeKb,
    width: raw.width ?? 0,
    height: raw.height ?? 0,
    format: raw.format as ImageRecord['format'],
    createdAt: raw.createdAt,
    rating: raw.rating,
    favorite: raw.favorite,
    deletedAt: raw.deletedAt ?? undefined,
    model,
    prompt,
    tags,
  };
}

/** Dotted separator row for directory-style layout */
function DotRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: '#6b5d48',
          fontFamily: 'var(--font-body)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          borderBottom: '1px dotted rgba(139, 115, 75, 0.25)',
          minWidth: 24,
        }}
      />
      <span
        style={{
          fontSize: 12,
          color: '#2a2118',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Section header */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: '#7a5c12',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        margin: '0 0 14px',
      }}
    >
      {children}
    </h3>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '14px 32px',
          background: 'var(--color-bg)',
          borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: '#2a2118',
            margin: 0,
          }}
        >
          {t('nav.dashboard')}
        </h2>
        {stats && (
          <span
            style={{
              fontSize: 10,
              color: '#a09480',
              fontFamily: 'var(--font-body)',
            }}
          >
            {stats.totalImages} {t('dashboard.images')}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a09480',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
          }}
        >
          {t('dashboard.loading')}
        </div>
      ) : error ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#a09480',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={load}
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-display)',
              color: '#7a5c12',
              background: 'none',
              border: '1px solid rgba(122, 92, 18, 0.2)',
              padding: '4px 14px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {t('dashboard.retry')}
          </button>
        </div>
      ) : stats ? (
        <div
          style={{
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 36,
            maxWidth: 560,
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
                value={formatSize(stats.totalSizeKb)}
              />
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
                    color: '#a09480',
                    fontFamily: 'var(--font-body)',
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
                    color: '#a09480',
                    fontFamily: 'var(--font-body)',
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
                  color: '#a09480',
                  fontFamily: 'var(--font-body)',
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
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(139, 115, 75, 0.06)',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 3,
                        background: 'var(--color-surface)',
                        border: '1px solid rgba(139, 115, 75, 0.08)',
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
                          color: '#a09480',
                          fontFamily: 'var(--font-body)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {img.format}
                      </span>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#2a2118',
                          fontFamily: 'var(--font-body)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {img.fileName}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: '#a09480',
                          fontFamily: 'var(--font-body)',
                          marginTop: 2,
                        }}
                      >
                        {img.width}×{img.height} · {formatSize(img.fileSizeKb)}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        color: '#a09480',
                        fontFamily: 'var(--font-body)',
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
          padding: '14px 32px',
          borderTop: '1px solid rgba(139, 115, 75, 0.10)',
          marginTop: 'auto',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#6b5d48',
            fontFamily: 'var(--font-body)',
          }}
        >
          {stats
            ? t('dashboard.summary', {
                count: stats.totalImages,
                size: formatSize(stats.totalSizeKb),
              })
            : ''}
        </span>
      </div>
    </div>
  );
}
