import { useAppStore } from "@/stores/app-store"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"

export function DashboardPage() {
  const { t } = useTranslation()
  const { images } = useAppStore()

  const stats = {
    total: images.length,
    favorites: images.filter((i) => i.favorite).length,
    rated: images.filter((i) => i.rating > 0).length,
    avgRating:
      images.filter((i) => i.rating > 0).reduce((sum, i) => sum + i.rating, 0) /
        images.filter((i) => i.rating > 0).length || 0,
    totalSize: images.reduce((sum, i) => sum + i.sizeKb, 0) / 1024 / 1024,
    formats: images.reduce(
      (acc, i) => {
        acc[i.format] = (acc[i.format] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    ),
  }

  const ratingDistribution = [0, 1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: images.filter((i) => i.rating === r).length,
  }))
  const maxRatingCount = Math.max(...ratingDistribution.map((d) => d.count))

  const topTags = getTopTags(images)

  const directoryStats = [
    { label: t("dashboard.favorites"), value: stats.favorites.toString() },
    { label: t("dashboard.avgRating"), value: stats.avgRating.toFixed(1) },
    { label: t("dashboard.totalSize"), value: `${stats.totalSize.toFixed(1)} GB` },
    { label: t("sidebar.rated"), value: stats.rated.toString() },
  ]

  return (
    <PageErrorBoundary>
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-8 py-8">
        {/* Page title */}
        <p className="font-serif text-[11px] uppercase tracking-[0.18em] text-text-muted pb-3 border-b border-border">
          {t("dashboard.subtitle")}
        </p>

        {images.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <h3 className="font-serif text-[16px] text-text-muted mb-1.5">
                仪表盘需要先有藏品
              </h3>
              <p className="font-serif text-[13px] text-text-faint">
                此处尚无藏品, 研墨中…
              </p>
            </div>
          </div>
        ) : (
        <>
        {/* Hero stat */}
        <div className="pt-6 pb-8">
          <span className="font-serif text-[32px] font-light tracking-[-0.02em] text-text leading-none tabular-nums">
            {stats.total}
          </span>
          <span className="ml-3 text-[15px] text-text-muted font-light">
            {t("dashboard.totalImages").toLowerCase()}
          </span>
        </div>

        {/* Directory-style stats */}
        <div className="mb-10 pb-8 border-b border-dotted border-border">
          {directoryStats.map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between py-2">
              <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-sans shrink-0">
                {label}
              </span>
              <div className="flex-1 mx-3 border-b border-dotted border-border" />
              <span className="font-sans text-[15px] font-medium text-text tabular-nums shrink-0">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Section divider */}
        <div className="mb-8">
          <h3 className="font-serif text-[11px] uppercase tracking-[0.18em] text-text-muted mb-4">
            {t("dashboard.ratingDistribution")}
          </h3>
          <div className="space-y-2">
            {ratingDistribution.map(({ rating, count }) => (
              <div key={rating} className="flex items-center gap-3">
                <span className="font-sans text-[11px] text-text-muted w-4 text-right">
                  {rating === 0 ? "—" : rating}
                </span>
                <div className="flex-1 h-5 bg-accent/20 rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-[2px] transition-all duration-200 ease-out"
                    style={{
                      width: `${maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="font-sans text-[12px] font-medium text-text-secondary tabular-nums w-6 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dotted section divider */}
        <div className="border-b border-dotted border-border mb-8" />

        {/* Formats */}
        <div className="mb-10">
          <h3 className="font-serif text-[11px] uppercase tracking-[0.18em] text-text-muted mb-4">
            {t("dashboard.formats")}
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.formats)
              .sort(([, a], [, b]) => b - a)
              .map(([format, count]) => {
                const pct = ((count / stats.total) * 100).toFixed(0)
                return (
                  <div key={format} className="flex items-center gap-3">
                    <span className="font-sans text-[11px] text-text-muted uppercase w-10 shrink-0">
                      {format}
                    </span>
                    <div className="flex-1 h-5 bg-accent/20 rounded-[2px] overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-[2px] transition-all duration-200 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-sans text-[12px] font-medium text-text-secondary tabular-nums w-6 text-right">
                      {count}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Dotted section divider */}
        <div className="border-b border-dotted border-border mb-8" />

        {/* Top tags */}
        <div>
          <h3 className="font-serif text-[11px] uppercase tracking-[0.18em] text-text-muted mb-4">
            {t("dashboard.topTags")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {topTags.map(([tag, count], i) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] font-serif text-[12px] transition-all duration-200 ease-out",
                  i === 0
                    ? "bg-text text-surface"
                    : "text-text-secondary bg-accent-subtle border border-accent/10"
                )}
              >
                <span>{tag}</span>
                <span
                  className={cn(
                    "font-sans text-[10px]",
                    i === 0 ? "text-surface/50" : "text-text-faint"
                  )}
                >
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
    </PageErrorBoundary>
  )
}

function getTopTags(images: { tags: string[] }[]): [string, number][] {
  const tagCounts: Record<string, number> = {}
  images.forEach((img) =>
    img.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  )
  return Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
}
