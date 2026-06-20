import { useToastStore } from "@/stores/toast-store"
import { cn } from "@/lib/utils"

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto px-4 py-2.5 rounded-[6px] shadow-elevated text-[13px] font-sans max-w-[360px]",
            "border transition-all duration-200 ease-out",
            // Type-based border color — warm tones matching DESIGN.md
            toast.type === "success" && "bg-surface text-text border-accent/30",
            toast.type === "warning" && "bg-surface text-text border-amber-600/30",
            toast.type === "info" && "bg-surface text-text border-border"
          )}
          role="status"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="leading-snug">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-[11px] text-text-muted hover:text-text transition-all duration-200 ease-out"
              aria-label="Close notification"
            >
              关闭
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
