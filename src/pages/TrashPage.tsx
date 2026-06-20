import { useTranslation } from "@/lib/i18n"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"

export function TrashPage() {
  const { t } = useTranslation()

  return (
    <PageErrorBoundary>
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-[17px] font-light tracking-[0.02em]">
              {t("trash.title")}
            </h1>
            <p className="text-[13px] text-text-muted mt-1.5">
              {t("trash.subtitle")}
            </p>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-20 h-20 rounded-[2px] bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-5">
              <span className="font-serif text-[24px] text-text-faint">◆</span>
            </div>
            <h3 className="font-serif text-[16px] text-text-muted mb-1.5">
              {t("trash.empty.title")}
            </h3>
            <p className="font-serif text-[13px] text-text-faint">
              {t("trash.empty.subtitle")}
            </p>
          </div>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  )
}
