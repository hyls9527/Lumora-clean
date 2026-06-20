interface PlumFlowerProps {
  filled: boolean
  size?: number
}

export function PlumFlower({ filled, size = 18 }: PlumFlowerProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
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
      <circle cx="9" cy="9" r="2" fill={filled ? 'var(--color-accent)' : 'rgba(139,115,75,0.12)'} />
    </svg>
  )
}
