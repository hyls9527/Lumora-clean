import { useAiAnalysisStore } from '../../../stores/aiAnalysisStore';
import { useTranslation } from '../../../lib/i18n';
import { TagSuggestionCard } from './TagSuggestionCard';
import { ColorPaletteStrip } from './ColorPaletteStrip';
import { AnalysisHistoryList } from './AnalysisHistoryList';

interface AiAnalysisSectionProps {
  imageId: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-display)',
  color: '#a09480',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  color: '#2a2118',
};

export function AiAnalysisSection({ imageId }: AiAnalysisSectionProps) {
  const { t } = useTranslation('aiAnalysis');

  const result = useAiAnalysisStore((s) => s.results[imageId]);
  const history = useAiAnalysisStore((s) => s.history[imageId]);
  const analyzingId = useAiAnalysisStore((s) => s.analyzingId);
  const acceptedTags = useAiAnalysisStore((s) => s.acceptedTags[imageId] ?? []);
  const rejectedTags = useAiAnalysisStore((s) => s.rejectedTags[imageId] ?? []);

  const analyze = useAiAnalysisStore((s) => s.analyze);
  const acceptTag = useAiAnalysisStore((s) => s.acceptTag);
  const rejectTag = useAiAnalysisStore((s) => s.rejectTag);
  const loadHistory = useAiAnalysisStore((s) => s.loadHistory);

  const isAnalyzing = analyzingId === imageId;

  const handleAnalyze = () => {
    analyze(imageId);
  };

  // Load history on first render if result exists
  if (result && !history) {
    loadHistory(imageId);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section header with analyze button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-display)',
            color: '#a09480',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {t('title')}
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          style={{
            background: isAnalyzing ? 'rgba(139, 115, 75, 0.06)' : 'none',
            border: '1px solid rgba(139, 115, 75, 0.15)',
            borderRadius: 4,
            padding: '3px 10px',
            fontSize: 11,
            fontFamily: 'var(--font-body)',
            color: isAnalyzing ? '#a09480' : '#7a5c12',
            cursor: isAnalyzing ? 'default' : 'pointer',
            transition: 'background 200ms, color 200ms',
          }}
          onMouseEnter={(e) => {
            if (!isAnalyzing) {
              (e.currentTarget as HTMLElement).style.background = 'rgba(139, 115, 75, 0.06)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAnalyzing) {
              (e.currentTarget as HTMLElement).style.background = 'none';
            }
          }}
        >
          {isAnalyzing ? t('analyzing') : result ? t('reAnalyze') : t('analyze')}
        </button>
      </div>

      {/* Loading indicator */}
      {isAnalyzing && (
        <div
          style={{
            padding: '12px 0',
            textAlign: 'center',
            fontSize: 12,
            fontFamily: 'var(--font-body)',
            color: '#a09480',
          }}
        >
          {t('analyzingHint')}
        </div>
      )}

      {/* Results */}
      {result && !isAnalyzing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Description */}
          <div>
            <div style={labelStyle}>{t('description')}</div>
            <div
              style={{
                ...valueStyle,
                fontSize: 12,
                lineHeight: 1.6,
                color: '#6b5d48',
              }}
            >
              {result.description}
            </div>
          </div>

          {/* Tags */}
          {result.tags.length > 0 && (
            <div>
              <div style={labelStyle}>{t('suggestedTags')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {result.tags.map((tag) => (
                  <TagSuggestionCard
                    key={tag.name}
                    tag={tag}
                    accepted={acceptedTags.includes(tag.name)}
                    rejected={rejectedTags.includes(tag.name)}
                    onAccept={() => acceptTag(imageId, tag.name)}
                    onReject={() => rejectTag(imageId, tag.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Objects */}
          {result.objects.length > 0 && (
            <div>
              <div style={labelStyle}>{t('detectedObjects')}</div>
              <div
                style={{
                  ...valueStyle,
                  fontSize: 12,
                }}
              >
                {result.objects.join('、')}
              </div>
            </div>
          )}

          {/* Color Palette */}
          <ColorPaletteStrip colors={result.colorPalette} />

          {/* Composition */}
          <div>
            <div style={labelStyle}>{t('composition')}</div>
            <div
              style={{
                ...valueStyle,
                fontSize: 12,
                lineHeight: 1.6,
                color: '#6b5d48',
              }}
            >
              {result.composition}
            </div>
          </div>

          {/* History */}
          <AnalysisHistoryList items={history ?? []} />
        </div>
      )}
    </div>
  );
}
