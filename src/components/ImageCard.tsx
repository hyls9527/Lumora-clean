import { type Image } from "@/lib/mock-data"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { useState } from "react"

function PlumFlower({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {[0, 72, 144, 216, 288].map(angle => (
        <ellipse
          key={angle}
          cx="9" cy="3.5"
          rx="3" ry="4.5"
          transform={`rotate(${angle} 9 9)`}
          fill={filled ? 'var(--color-accent)' : 'none'}
          stroke={filled ? 'none' : 'rgba(139,115,75,0.2)'}
          strokeWidth="1"
        />
      ))}
      <circle
        cx="9" cy="9" r="2"
        fill={filled ? 'var(--color-accent)' : 'rgba(139,115,75,0.12)'}
      />
      {filled && (
        <circle cx="9" cy="9" r="2" fill="var(--color-accent)" opacity="0.8" />
      )}
    </svg>
  );
}

interface ImageCardProps {
  image: Image
  focused?: boolean
}

export function ImageCard({ image, focused }: ImageCardProps) {
  const { selectedIds, toggleSelect, toggleFavorite, setRating, setDetailImage } =
    useAppStore()
  const [isHovered, setIsHovered] = useState(false)
  const isSelected = selectedIds.has(image.id)

  return (
    <div
      className={cn(
        "group relative rounded-[2px] overflow-hidden cursor-pointer",
        "shadow-card hover:shadow-card-hover",
        "transition-all duration-200 ease-out",
        isSelected && "bg-accent/10 border border-accent/20",
        !isSelected && "border border-transparent",
        focused && !isSelected && "ring-1 ring-text-muted/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setDetailImage(image)}
    >
      {/* Thumbnail */}
      <div style={{ aspectRatio: image.aspectRatio || '1/1' }} className="relative bg-bg-alt overflow-hidden">
        <img
          src={image.thumbnail}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Hover overlay — gradient from bottom */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Selection checkbox */}
        <button
          className={cn(
            "absolute top-2.5 left-2.5 w-[22px] h-[22px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-all duration-200",
            isSelected
              ? "bg-accent border-accent text-text"
              : "bg-white/70 border-white/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-white/90"
          )}
          onClick={(e) => {
            e.stopPropagation()
            toggleSelect(image.id)
          }}
        >
          {isSelected && (
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Favorite stamp */}
        <div
          className={cn(
            "absolute top-2.5 right-2.5 w-5 h-5 rounded-[4px] bg-accent/80 flex items-center justify-center transition-opacity duration-200",
            image.favorite || isHovered ? "opacity-100" : "opacity-0"
          )}
          onClick={(e) => {
            e.stopPropagation()
            toggleFavorite(image.id)
          }}
        >
          <span className={cn(
            "text-[11px] leading-none text-surface",
            !image.favorite && "opacity-40"
          )}>
            ◆
          </span>
        </div>

        {/* Bottom row: rating + format */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex items-end justify-between transition-opacity duration-200",
            isHovered || image.rating > 0 ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Rating — plum flowers */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className="w-[14px] h-[14px] flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  setRating(image.id, image.rating === star ? 0 : star)
                }}
              >
                <PlumFlower filled={star <= image.rating} />
              </button>
            ))}
          </div>

          {/* Format badge */}
          <span
            className={cn(
              "px-1.5 py-px rounded-[4px] font-sans text-[8px] font-bold uppercase tracking-wider bg-black/25 text-white/60 backdrop-blur-sm",
              isHovered ? "opacity-100" : "opacity-0"
            )}
          >
            {image.format}
          </span>
        </div>
      </div>
    </div>
  )
}
