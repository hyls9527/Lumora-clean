import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"
import { useState } from "react"

type Decision = "keep" | "maybe" | "reject"

export function CurationPage() {
  const { t } = useTranslation()
  const { images } = useAppStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  const currentImage = images[currentIndex]

  const handleDecision = (decision: Decision) => {
    if (!currentImage) return
    setDecisions((prev) => ({ ...prev, [currentImage.id]: decision }))
    if (currentIndex < images.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  const stats = {
    keep: Object.values(decisions).filter((d) => d === "keep").length,
    maybe: Object.values(decisions).filter((d) => d === "maybe").length,
    reject: Object.values(decisions).filter((d) => d === "reject").length,
  }

  return (
    <PageErrorBoundary>
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Counter at top right */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-border-subtle bg-surface/80 shrink-0">
        <h3 className="font-serif text-[11px] uppercase tracking-[0.18em] text-text-muted">
          {t("curation.title")}
        </h3>
        <div className="flex items-center gap-4">
          <span className="font-sans text-[11px] text-success tabular-nums">
            {stats.keep} {t("curation.keep")}
          </span>
          <span className="font-sans text-[11px] text-accent-hover tabular-nums">
            {stats.maybe} {t("curation.maybe")}
          </span>
          <span className="font-sans text-[11px] text-danger tabular-nums">
            {stats.reject} {t("curation.reject")}
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center p-10">
        {currentImage ? (
          <div className="max-w-[640px] w-full text-center">
            {/* Counter */}
            <p className="font-sans text-[11px] tracking-[0.16em] text-text-muted tabular-nums mb-8">
              {currentIndex + 1} / {images.length}
            </p>

            {/* Image wrapper */}
            <div className="relative mb-8">
              <div className="rounded-[2px] overflow-hidden shadow-card border border-border">
                <img
                  src={currentImage.thumbnail}
                  alt={`Curation image ${currentIndex + 1} of ${images.length}`}
                  className="w-full aspect-[16/10] object-cover"
                />
                {/* Bottom gradient overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-bg/30 to-transparent rounded-b-[2px] pointer-events-none" />
              </div>
            </div>

            {/* Decision buttons */}
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={() => handleDecision("reject")}
                className="flex items-center gap-2.5 px-6 py-2 rounded-[4px] border border-border bg-surface text-text-secondary font-serif text-[12px] font-normal hover:border-danger/30 hover:text-danger transition-all duration-200 ease-out"
              >
                {t("curation.reject")}
              </button>
              <button
                onClick={() => handleDecision("maybe")}
                className="flex items-center gap-2.5 px-6 py-2 rounded-[4px] border border-border bg-surface text-text-secondary font-serif text-[12px] font-normal hover:border-accent hover:text-accent hover:bg-accent-subtle transition-all duration-200 ease-out"
              >
                {t("curation.maybe")}
              </button>
              <button
                onClick={() => handleDecision("keep")}
                className="flex items-center gap-2.5 px-6 py-2 rounded-[4px] border border-border bg-surface text-text-secondary font-serif text-[12px] font-normal hover:border-accent hover:text-accent hover:bg-accent-subtle transition-all duration-200 ease-out"
              >
                {t("curation.keep")}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-[2px] bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-5">
              <span className="font-serif text-[24px] text-text-faint">◆</span>
            </div>
            <h3 className="font-serif text-[16px] text-text-muted mb-1.5">
              策展需要先有藏品
            </h3>
            <p className="font-serif text-[13px] text-text-faint">
              此处尚无藏品, 研墨中…
            </p>
          </div>
        )}
      </div>
    </div>
    </PageErrorBoundary>
  )
}
