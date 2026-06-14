import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import {
  Star,
  Heart,
  HardDrive,
  TrendingUp,
} from "lucide-react"

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

  return (
    <div className="flex-1 h-screen overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-8 py-8">
        {/* Hero stat — 56px with negative tracking */}
        <div className="mb-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-faint mb-2">
            {t("dashboard.subtitle")}
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-[56px] font-light tracking-[-0.03em] leading-none tabular-nums">
              {stats.total}
            </span>
            <span className="text-[15px] text-text-muted font-light">
              {t("dashboard.totalImages").toLowerCase()}
            </span>
          </div>
        </div>

        {/* Inline stats — rhythm: 32px gap from hero */}
        <div className="flex items-center gap-8 mb-10 pb-8 border-b border-border-subtle">
          <InlineStat
            icon={<Heart className="w-4 h-4" />}
            value={stats.favorites.toString()}
            label={t("dashboard.favorites")}
          />
          <InlineStat
            icon={<Star className="w-4 h-4" />}
            value={stats.avgRating.toFixed(1)}
            label={t("dashboard.avgRating")}
          />
          <InlineStat
            icon={<HardDrive className="w-4 h-4" />}
            value={`${stats.totalSize.toFixed(1)} GB`}
            label={t("dashboard.totalSize")}
          />
          <InlineStat
            icon={<TrendingUp className="w-4 h-4" />}
            value={`${stats.rated}`}
            label={t("sidebar.rated")}
          />
        </div>

        {/* Two-column: Rating distribution + Formats */}
        <div className="grid grid-cols-5 gap-8 mb-10">
          {/* Rating distribution — 3 cols */}
          <div className="col-span-3">
            <SectionLabel>{t("dashboard.ratingDistribution")}</SectionLabel>
            <div className="space-y-2.5 mt-4">
              {ratingDistribution.map(({ rating, count }) => (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-[11px] text-text-muted w-4 text-right font-mono tabular-nums">
                    {rating === 0 ? "—" : rating}
                  </span>
                  {rating > 0 && (
                    <Star className="w-3 h-3 text-accent fill-accent shrink-0" />
                  )}
                  {rating === 0 && <div className="w-3 shrink-0" />}
                  <div className="flex-1 h-6 bg-bg rounded-[6px] overflow-hidden border border-border-subtle">
                    <div
                      className={cn(
                        "h-full rounded-[6px] transition-all duration-700 ease-out",
                        rating === 0 ? "bg-border" : "bg-accent"
                      )}
                      style={{
                        width: `${maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-text-muted w-6 text-right tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Formats — 2 cols */}
          <div className="col-span-2">
            <SectionLabel>{t("dashboard.formats")}</SectionLabel>
            <div className="space-y-2.5 mt-4">
              {Object.entries(stats.formats)
                .sort(([, a], [, b]) => b - a)
                .map(([format, count]) => {
                  const pct = ((count / stats.total) * 100).toFixed(0)
                  return (
                    <div key={format} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono font-semibold uppercase text-text-secondary w-10">
                        {format}
                      </span>
                      <div className="flex-1 h-6 bg-bg rounded-[6px] overflow-hidden border border-border-subtle">
                        <div
                          className="h-full rounded-[6px] bg-text/[0.07] transition-all duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-text-muted w-6 text-right tabular-nums">
                        {count}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Top tags */}
        <div>
          <SectionLabel>{t("dashboard.topTags")}</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-4">
            {topTags.map(([tag, count], i) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all duration-100",
                  i === 0
                    ? "bg-text text-surface font-medium"
                    : "bg-bg text-text-secondary border border-border-subtle hover:border-border hover:shadow-xs"
                )}
              >
                <span>{tag}</span>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    i === 0 ? "text-surface/50" : "text-text-faint"
                  )}
                >
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-faint">
      {children}
    </h3>
  )
}

function InlineStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-text-faint">{icon}</div>
      <span className="text-[15px] font-semibold tabular-nums">{value}</span>
      <span className="text-[12px] text-text-muted">{label}</span>
    </div>
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
