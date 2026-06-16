import { ErrorBoundary } from "./ErrorBoundary"

export function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="font-serif text-[16px] text-text-muted mb-2">
              此页尚有未竟之事
            </p>
            <button
              aria-label="重新加载"
              onClick={() => window.location.reload()}
              className="font-serif text-[13px] text-accent hover:underline"
            >
              重新加载
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
