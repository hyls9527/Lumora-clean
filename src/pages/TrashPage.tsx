import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Trash2, RotateCcw, X } from "lucide-react"
import { Card } from "@/components/ui/card"

export function TrashPage() {
  const { t } = useTranslation()

  const trashItems: { id: string; name: string; deletedAt: string }[] = []

  return (
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
          {trashItems.length > 0 && (
            <button className="flex items-center gap-2 px-4 py-2 rounded-[4px] text-[13px] font-medium text-danger hover:bg-danger/5 transition-all duration-200 ease-out">
              <X className="w-4 h-4" />
              {t("trash.emptyAll")}
            </button>
          )}
        </div>

        {/* Content */}
        {trashItems.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-20 h-20 rounded-[2px] bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-5">
                <Trash2 className="w-10 h-10 text-text-faint" />
              </div>
              <h3 className="font-serif text-[16px] text-text-muted mb-1.5">
                {t("empty.no_images")}
              </h3>
              <p className="text-[13px] text-text-muted">
                {t("trash.empty.subtitle")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {trashItems.map((item) => (
              <Card key={item.id} className="p-5 rounded-[2px] flex items-center justify-between shadow-sm border-border-subtle">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-[4px] bg-bg border border-border-subtle flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-text-muted" />
                  </div>
                  <div>
                    <span className="text-[13px] font-medium">{item.name}</span>
                    <span className="block text-[12px] text-text-muted mt-0.5">
                      {t("trash.deletedOn")}{" "}
                      {new Date(item.deletedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-3.5 py-2 rounded-[4px] text-[12px] font-medium text-text-secondary hover:bg-surface-hover transition-all duration-200 ease-out">
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t("trash.restore")}
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
