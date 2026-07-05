import { useState } from 'react';
import { useAiAnalysisStore } from '../../../stores/aiAnalysisStore';
import { useImageTagsStore } from '../../../stores/imageTagsStore';
import { createTag, listTags } from '../../../lib/api/images';
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
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const result = useAiAnalysisStore((s) => s.results[imageId]);
  const history = useAiAnalysisStore((s) => s.history[imageId]);
  const analyzingId = useAiAnalysisStore((s) => s.analyzingId);
  const acceptedTags = useAiAnalysisStore((s) => s.acceptedTags[imageId] ?? []);
  const rejectedTags = useAiAnalysisStore((s) => s.rejectedTags[imageId] ?? []);

  const analyze = useAiAnalysisStore((s) => s.analyze);
  const acceptTag = useAiAnalysisStore((s) => s.acceptTag);
  const rejectTag = useAiAnalysisStore((s) => s.rejectTag);
  const loadHistory = useAiAnalysisStore((s) => s.loadHistory);

  const addTagToImage = useImageTagsStore((s) => s.addTagToImage);
  const fetchImageTags = useImageTagsStore((s) => s.fetchImageTags);

  const isAnalyzing = analyzingId === imageId;

  const handleAnalyze = () => {
    analyze(imageId);
  };

  const handleApplyAllTags = async () => {
    if (!result || applying) return;
    setApplying(true);
    setApplied(false);

    const nonRejected = result.tags.filter((tag) => !rejectedTags.includes(tag.name));
    if (nonRejected.length === 0) {
      setApplying(false);
      return;
    }

    try {
      const existingTags = await listTags();

      for (const tag of nonRejected) {
        const existing = existingTags.find((et) => et.name === tag.name);
        const tagId = existing ? existing.id : (await createTag(tag.name, null)).id;
        await addTagToImage(imageId, tagId);
      }

      await fetchImageTags(imageId);

      for (const tag of nonRejected) {
        acceptTag(imageId, tag.name);
      }

      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    } catch (err) {
      console.error('Failed to apply tags:', { imageId, err });
    } finally {
      setApplying(false);
    }
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
              <button
                type="button"
                onClick={handleApplyAllTags}
                disabled={applying || result.tags.every((tag) => rejectedTags.includes(tag.name))}
                style={{
                  marginTop: 8,
                  background: applied ? 'rgba(122, 92, 18, 0.08)' : applying ? 'rgba(139, 115, 75, 0.06)' : 'none',
                  border: '1px solid rgba(122, 92, 18, 0.25)',
                  borderRadius: 4,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontFamily: 'var(--font-body)',
                  color: applied ? '#5a7a3a' : '#7a5c12',
                  cursor: applying ? 'default' : 'pointer',
                  transition: 'background 200ms, color 200ms',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!applying) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(122, 92, 18, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!applying) {
                    (e.currentTarget as HTMLElement).style.background = applied ? 'rgba(122, 92, 18, 0.08)' : 'none';
                  }
                }}
              >
                {applied
                  ? t('tagsApplied', { count: result.tags.filter((tag) => !rejectedTags.includes(tag.name)).length })
                  : applying
                    ? t('applyingTags')
                    : t('applyAllTags')}
              </button>
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
