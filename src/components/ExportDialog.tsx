import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download } from "lucide-react"

type ExportFormat = "original" | "png" | "jpg" | "webp"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { t } = useTranslation()
  const { selectedIds, images } = useAppStore()
  const [format, setFormat] = useState<ExportFormat>("original")
  const [quality, setQuality] = useState(85)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedImages = images.filter((img) => selectedIds.has(img.id))
  const showQuality = format !== "original" && format !== "png"

  useEffect(() => {
    if (!open) {
      setFormat("original")
      setQuality(85)
      setExporting(false)
      setProgress(0)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [open])

  const handleExport = useCallback(() => {
    if (exporting || selectedImages.length === 0) return
    setExporting(true)
    setProgress(0)

    const totalSteps = 20
    let step = 0
    intervalRef.current = setInterval(() => {
      step++
      setProgress(Math.round((step / totalSteps) * 100))
      if (step >= totalSteps) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setTimeout(() => {
          setExporting(false)
          setProgress(0)
          onOpenChange(false)
        }, 500)
      }
    }, 120)
  }, [exporting, selectedImages.length, onOpenChange])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const formats: { value: ExportFormat; label: string }[] = [
    { value: "original", label: t("export.format.original") },
    { value: "png", label: "PNG" },
    { value: "jpg", label: "JPG" },
    { value: "webp", label: "WebP" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "rounded-[6px] bg-surface shadow-elevated border border-border max-w-[420px] p-6",
          "font-serif text-text"
        )}

      >
        <DialogHeader>
          <DialogTitle className="font-serif text-[16px] font-semibold text-text tracking-[-0.01em]">
            {t("export.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Selected count */}
        <p className="text-[12px] text-text-muted mt-1">
          {selectedImages.length} {t("export.selectedCount")}
        </p>

        {/* Format selector */}
        <div className="space-y-2 mt-4">
          <label className="text-[9px] uppercase tracking-[0.1em] text-text-faint font-sans block">
            {t("export.format.label")}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {formats.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-[4px] text-[12px] font-serif transition-all duration-200 ease-out border",
                  format === f.value
                    ? "bg-accent-subtle border-accent text-text"
                    : "bg-transparent border-border-subtle text-text-secondary hover:bg-surface-hover"
                )}
              >
                <span
                  className={cn(
                    "w-3 h-3 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200",
                    format === f.value
                      ? "border-accent"
                      : "border-border"
                  )}
                >
                  {format === f.value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quality slider */}
        {showQuality && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <label className="text-[9px] uppercase tracking-[0.1em] text-text-faint font-sans">
                {t("export.quality.label")}
              </label>
              <span className="text-[11px] font-mono text-text-muted tabular-nums">
                {quality}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-[2px] bg-bg-alt cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3.5
                [&::-webkit-slider-thumb]:h-3.5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-accent
                [&::-webkit-slider-thumb]:border-2
                [&::-webkit-slider-thumb]:border-surface
                [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(78,50,23,0.15)]
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:duration-200
                [&::-webkit-slider-thumb]:hover:scale-110"
            />
          </div>
        )}

        {/* Destination folder (simulated) */}
        <div className="space-y-2 mt-4">
          <label className="text-[9px] uppercase tracking-[0.1em] text-text-faint font-sans block">
            {t("export.destination.label")}
          </label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-bg border border-border-subtle text-[12px] text-text-secondary font-mono">
            <span className="flex-1 truncate">D:\Gallery\Exports</span>
            <button className="text-accent hover:text-accent-hover text-[11px] font-serif transition-colors">
              {t("export.destination.browse")}
            </button>
          </div>
        </div>

        {/* Progress */}
        {exporting && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted font-serif">
                {t("export.progress")}
              </span>
              <span className="text-[11px] font-mono text-text-muted tabular-nums">
                {progress}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-[2px] bg-bg overflow-hidden">
              <div
                className="h-full rounded-[2px] bg-accent transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border-subtle">
          <button
            onClick={() => onOpenChange(false)}
            disabled={exporting}
            className="px-4 py-2 rounded-[4px] text-[12px] font-serif text-text-secondary hover:bg-surface-hover transition-all duration-200 ease-out disabled:opacity-50"
          >
            {t("export.cancel")}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selectedImages.length === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-[4px] text-[12px] font-serif transition-all duration-200 ease-out",
              "bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            )}
          >
            <span>{exporting ? t("export.exporting") : t("export.button")}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
