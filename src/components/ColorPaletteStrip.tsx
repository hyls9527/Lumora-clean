import { cn } from "@/lib/utils"

interface ColorPaletteStripProps {
  palette: string[]
}

export function ColorPaletteStrip({ palette }: ColorPaletteStripProps) {
  if (!palette || palette.length === 0) return null

  return (
    <div className="flex gap-1 justify-center">
      {palette.map((hex, i) => (
        <div key={`${hex}-${i}`} className="flex flex-col items-center gap-1">
          <div
            className={cn(
              "w-5 h-5 rounded-[2px] border border-border",
            )}
            style={{ backgroundColor: hex }}
          />
          <span className="text-[11px] font-mono text-text-muted leading-none">
            {hex}
          </span>
        </div>
      ))}
    </div>
  )
}
