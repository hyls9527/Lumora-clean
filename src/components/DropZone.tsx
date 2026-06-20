import { useState, useCallback, useRef } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { useToastStore } from "@/stores/toast-store"
import { cn } from "@/lib/utils"
import type { Image, AspectRatio } from "@/lib/mock-data"

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]

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
  const [dragOver, setDragOver] = useState(false)
  const dragCountRef = useRef(0)

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

  const handleFiles = useCallback((files: File[]) => {
    const validFiles = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
    if (validFiles.length === 0) return

    // Warn at 500+ files
    if (validFiles.length >= 500) {
      useToastStore.getState().addToast(
        t("dropzone.warningManyFiles"),
        "warning"
      )
    }

    // Create Image objects from valid files
    const newImages = validFiles.map(fileToMockImage)

    // Add to store — prepend so newest appear first
    useAppStore.setState((s) => ({
      images: [...newImages, ...s.images],
    }))

    // Show success toast
    const count = newImages.length.toString()
    useToastStore.getState().addToast(
      t("dropzone.importedToast").replace("{count}", count),
      "success"
    )

    // Auto-navigate to gallery
    useAppStore.getState().setView("gallery")
  }, [t])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current = 0
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      handleFiles(files)
    },
    [handleFiles],
  )

  return (
    <div
      className="fixed inset-0 z-[90] pointer-events-none"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ pointerEvents: dragOver ? "auto" : "none" }}
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
          className="absolute inset-8 rounded-[6px] border-2 border-dashed border-accent/30 flex items-center justify-center"
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
    </div>
  )
}
