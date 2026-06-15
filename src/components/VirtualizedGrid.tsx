import { Grid } from 'react-window'
import { ImageCard } from './ImageCard'
import { type Image } from '@/lib/mock-data'

interface VirtualizedGridProps {
  images: Image[]
  columns: number
  columnWidth: number
  rowHeight: number
  height: number
  width: number
  focusedIndex: number
}

export function VirtualizedGrid({
  images,
  columns,
  columnWidth,
  rowHeight,
  height,
  width,
  focusedIndex,
}: VirtualizedGridProps) {
  const rowCount = Math.ceil(images.length / columns)

  const Cell = ({
    columnIndex,
    rowIndex,
    style,
  }: {
    columnIndex: number
    rowIndex: number
    style: React.CSSProperties
  }) => {
    const index = rowIndex * columns + columnIndex
    if (index >= images.length) return null

    return (
      <div style={{ ...style, paddingLeft: 4, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}>
        <ImageCard image={images[index]} focused={index === focusedIndex} />
      </div>
    )
  }

  return (
    <Grid
      columnCount={columns}
      columnWidth={columnWidth}
      height={height}
      rowCount={rowCount}
      rowHeight={rowHeight}
      width={width}
      overscanRowCount={2}
    >
      {Cell}
    </Grid>
  )
}
