import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import type { Image, AspectRatio } from "@/lib/mock-data"

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function fileToMockImage(file: File): Image {
  const w = pick([512, 768, 1024])
  const h = pick([512, 768, 1024])
  const aspectRatios: AspectRatio[] = ["1/1", "4/3", "3/4", "16/9", "3/2"]
  const format = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1]

  return {
    id: makeId(),
    path: file.name,
    thumbnail: URL.createObjectURL(file),
    width: w,
    height: h,
    sizeKb: Math.round(file.size / 1024),
    format,
    rating: 0,
    favorite: false,
    tags: ["imported"],
    createdAt: new Date().toISOString(),
    aspectRatio: pick(aspectRatios),
  }
}

export function DropZone() {
  const { t } = useTranslation()
  const images = useAppStore((s) => s.images)
  const openFolderDialog = useAppStore((s) => s.openFolderDialog)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dragCountRef = useRef(0)

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const simulateImport = useCallback(
    (files: File[]) => {
      if (importing) return
      const validFiles = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
      if (validFiles.length === 0) return

      setImporting(true)
      setProgress(0)
      setImportedCount(0)

      const newImages = validFiles.map(fileToMockImage)
      const totalSteps = newImages.length
      let step = 0

      intervalRef.current = setInterval(() => {
        step++
        setProgress(Math.round((step / totalSteps) * 100))
        setImportedCount(step)

        if (step >= totalSteps) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          // Add to store
          useAppStore.setState((s) => ({
            images: [...newImages, ...s.images],
          }))
          setTimeout(() => {
            setImporting(false)
            setProgress(0)
            setImportedCount(0)
          }, 600)
        }
      }, 200)
    },
    [importing],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current = 0
      setDragOver(false)

      if (false) { // Tauri removed
        openFolderDialog()
        return
      }

      const files = Array.from(e.dataTransfer.files)
      simulateImport(files)
    },
    [simulateImport, openFolderDialog],
  )

  const handleClick = useCallback(() => {
    if (false) { // Tauri removed
      openFolderDialog()
    }
  }, [openFolderDialog])

  return (
    <div
      className="fixed inset-0 z-[90] pointer-events-none"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ pointerEvents: dragOver || importing ? "auto" : "none" }}
    >
      {/* Overlay */}
      <div
        className={cn(
          "absolute inset-0 transition-all duration-200 ease-out",
          dragOver
            ? "bg-accent/5 backdrop-blur-[2px]"
            : "bg-transparent"
        )}
      />

      {/* Drop target area */}
      {dragOver && (
        <div
          className="absolute inset-8 rounded-[6px] border-2 border-dashed border-accent/30 flex items-center justify-center cursor-pointer"
          onClick={handleClick}
        >
          <div className="text-center">
            <div className="text-[32px] mb-3 opacity-40">
              <svg
                className="w-10 h-10 mx-auto text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                />
              </svg>
            </div>
            <p className="font-serif text-[14px] text-text-muted">
              {t("dropzone.title")}
            </p>
            <p className="font-serif text-[11px] text-text-faint mt-1">
              {t("dropzone.subtitle")}
            </p>
          </div>
        </div>
      )}

      {/* Import progress overlay */}
      {importing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <div className="bg-surface rounded-[6px] shadow-elevated border border-border p-6 min-w-[280px]">
            <p className="font-serif text-[13px] text-text mb-3 text-center">
              {t("dropzone.importing")}
            </p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-serif">
                {importedCount} {t("dropzone.imported")}
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
        </div>
      )}
    </div>
  )
}
