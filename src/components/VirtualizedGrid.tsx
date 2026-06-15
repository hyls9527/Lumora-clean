import { type GridProps } from 'react-window'
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

function Cell({ columnIndex, rowIndex, style, images, columns, focusedIndex }: {
  columnIndex: number
  rowIndex: number
  style: React.CSSProperties
  images: Image[]
  columns: number
  focusedIndex: number
}) {
  const index = rowIndex * columns + columnIndex
  if (index >= images.length) return null

  return (
    <div style={{ ...style, paddingLeft: 4, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}>
      <ImageCard image={images[index]} focused={index === focusedIndex} />
    </div>
  )
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

  if (columnWidth <= 0 || rowHeight <= 0 || height <= 0 || width <= 0) {
    return null
  }

  return (
    <Grid
      cellComponent={Cell}
      cellProps={{ images, columns, focusedIndex }}
      columnCount={columns}
      columnWidth={columnWidth}
      height={height}
      rowCount={rowCount}
      rowHeight={rowHeight}
      width={width}
      overscanCount={2}
    />
  )
}
