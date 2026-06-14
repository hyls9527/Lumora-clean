import { type Image } from "@/lib/mock-data"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { Star, Heart } from "lucide-react"
import { useState } from "react"

interface ImageCardProps {
  image: Image
}

export function ImageCard({ image }: ImageCardProps) {
  const { selectedIds, toggleSelect, toggleFavorite, setRating, setDetailImage } =
    useAppStore()
  const [isHovered, setIsHovered] = useState(false)
  const isSelected = selectedIds.has(image.id)

  return (
    <div
      className={cn(
        "group relative rounded-[12px] overflow-hidden cursor-pointer",
        "shadow-card hover:shadow-card-hover",
        "transition-all duration-100 ease-out",
        "hover:-translate-y-[1px]",
        isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-bg"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setDetailImage(image)}
    >
      {/* Thumbnail */}
      <div className="aspect-square relative bg-bg-alt overflow-hidden">
        <img
          src={image.thumbnail}
          alt=""
          className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          loading="lazy"
        />

        {/* Hover overlay — gradient from bottom */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent transition-opacity duration-150",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Selection checkbox */}
        <button
          className={cn(
            "absolute top-2.5 left-2.5 w-[22px] h-[22px] rounded-[6px] border-[1.5px] flex items-center justify-center transition-all duration-100",
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

        {/* Favorite button */}
        <button
          className={cn(
            "absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-100",
            image.favorite
              ? "bg-accent text-text"
              : "bg-white/70 backdrop-blur-sm text-text-muted opacity-0 group-hover:opacity-100 hover:bg-white/90 hover:text-accent-hover"
          )}
          onClick={(e) => {
            e.stopPropagation()
            toggleFavorite(image.id)
          }}
        >
          <Heart
            className={cn("w-3.5 h-3.5", image.favorite && "fill-current")}
          />
        </button>

        {/* Bottom row: rating + format */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex items-end justify-between transition-opacity duration-150",
            isHovered || image.rating > 0 ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Rating stars */}
          <div className="flex items-center gap-px">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className="w-5 h-5 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  setRating(image.id, image.rating === star ? 0 : star)
                }}
              >
                <Star
                  className={cn(
                    "w-3.5 h-3.5 drop-shadow-sm",
                    star <= image.rating
                      ? "text-accent fill-accent"
                      : "text-white/40"
                  )}
                />
              </button>
            ))}
          </div>

          {/* Format badge */}
          <span
            className={cn(
              "px-1.5 py-px rounded-[4px] text-[9px] font-mono font-bold uppercase tracking-wider bg-black/35 text-white/80 backdrop-blur-sm",
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
