import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { Sparkles, ThumbsUp, HelpCircle, X } from "lucide-react"
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
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-border-subtle bg-surface/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Sparkles className="w-[18px] h-[18px] text-accent" />
          <span className="text-[14px] font-semibold">{t("curation.title")}</span>
          <span className="text-[12px] text-text-muted font-mono tabular-nums">
            {currentIndex + 1} / {images.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[12px] text-success font-medium">{stats.keep} keep</span>
          <span className="text-[12px] text-accent-hover font-medium">{stats.maybe} maybe</span>
          <span className="text-[12px] text-danger font-medium">{stats.reject} reject</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center p-10">
        {currentImage ? (
          <div className="max-w-xl w-full">
            {/* Image */}
            <div className="rounded-[12px] overflow-hidden shadow-card-hover mb-8">
              <img
                src={currentImage.thumbnail}
                alt=""
                className="w-full object-cover max-h-[55vh]"
              />
            </div>

            {/* Decision buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleDecision("reject")}
                className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-danger/8 text-danger text-[13px] font-semibold hover:bg-danger/15 transition-all duration-200"
              >
                <X className="w-4 h-4" />
                {t("curation.reject")}
              </button>
              <button
                onClick={() => handleDecision("maybe")}
                className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-accent-subtle text-accent-hover text-[13px] font-semibold hover:bg-accent/15 transition-all duration-200"
              >
                <HelpCircle className="w-4 h-4" />
                {t("curation.maybe")}
              </button>
              <button
                onClick={() => handleDecision("keep")}
                className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-success/8 text-success text-[13px] font-semibold hover:bg-success/15 transition-all duration-200"
              >
                <ThumbsUp className="w-4 h-4" />
                {t("curation.keep")}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-10 h-10 text-text-faint" />
            </div>
            <h3 className="text-[15px] font-medium text-text-secondary mb-1.5">
              {t("curation.empty.title")}
            </h3>
            <p className="text-[13px] text-text-muted">
              {t("curation.empty.subtitle")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
