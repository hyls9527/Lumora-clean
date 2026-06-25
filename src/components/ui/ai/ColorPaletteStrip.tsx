import { useTranslation } from '../../../lib/i18n';

interface ColorPaletteStripProps {
  colors: string[];
}

export function ColorPaletteStrip({ colors }: ColorPaletteStripProps) {
  const { t } = useTranslation('aiAnalysis');

  if (colors.length === 0) return null;

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-display)',
          color: '#a09480',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 6,
        }}
      >
        {t('colorPalette')}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {colors.map((color, i) => (
          <div
            key={`${color}-${i}`}
            style={{
              flex: 1,
              height: 28,
              background: color,
              transition: 'transform 200ms',
              cursor: 'pointer',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scaleY(1)';
            }}
            title={color}
            aria-label={color}
          />
        ))}
      </div>
    </div>
  );
}
