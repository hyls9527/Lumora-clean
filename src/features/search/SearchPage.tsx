import { useState, useCallback } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { SearchSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { SemanticSearchBar } from '../../components/ui/SemanticSearchBar';
import { SimilarityBadge } from '../../components/ui/SimilarityBadge';
import { useSemanticSearchStore } from '../../stores/semanticSearchStore';
import { useTranslation } from '../../lib/i18n';

const filterOptions = [
  { key: 'all', label: '全部' },
  { key: '90', label: '90%以上' },
  { key: '80', label: '80%以上' },
  { key: '70', label: '70%以上' },
];

const searchFieldOptions = [
  { key: 'all', label: '全部字段' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'negative_prompt', label: 'Negative Prompt' },
  { key: 'seed', label: 'Seed' },
  { key: 'model', label: 'Model' },
  { key: 'sampler', label: 'Sampler' },
];

const searchHistory = [
  '月光下的森林',
  '东方女性角色',
  '雪山日出',
  '抽象流体色彩',
  '未来城市建筑',
];

export function SearchPage() {
  const { t } = useTranslation('search');
  const {
    filters,
    setSearchQuery,
    setSearchField,
    getSearchResults,
    searchImages: searchImagesApi,
    loading,
    error,
  } = useImageStore();

  const { mode: searchMode } =
    useSemanticSearchStore();

  const [activeFilter, setActiveFilter] = useState('all');
  const [compareOpen, setCompareOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [inputValue, setInputValue] = useState(filters.searchQuery);

  const results = getSearchResults();

  const handleSearch = useCallback(() => {
    setSearchQuery(inputValue);
    searchImagesApi(inputValue);
  }, [inputValue, setSearchQuery, searchImagesApi]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  const filteredResults =
    activeFilter === 'all'
      ? results
      : results.filter((r) => (r.similarity ?? 0) >= parseInt(activeFilter, 10));

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 48px 64px' }}>
        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: '#2a2118',
              marginBottom: 6,
              marginTop: 0,
            }}
          >
            语义搜索
          </h2>
          <p
            style={{
              fontSize: 12,
              color: '#6b5d48',
              fontFamily: 'var(--font-body)',
              margin: 0,
            }}
          >
            {results.length > 0
              ? `找到 ${results.length} 个相似结果`
              : '输入关键词开始搜索'}
          </p>
        </header>

        {/* Search bar with semantic search integration */}
        {searchMode === 'semantic' ? (
          <SemanticSearchBar />
        ) : (
          <section aria-label={t('searchQuery')} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
              <select
                value={filters.searchField}
                onChange={(e) => setSearchField(e.target.value)}
                aria-label="搜索字段"
                style={{
                  padding: '14px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  color: '#2a2118',
                  background: 'var(--color-surface)',
                  border: '1px solid rgba(139, 115, 75, 0.10)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'border-color 200ms',
                  minWidth: 130,
                  outline: 'none',
                }}
              >
                {searchFieldOptions.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('textDescription')}
                aria-label={t('textDescription')}
                style={{
                  width: '100%',
                  padding: '14px 110px 14px 20px',
                  fontSize: 15,
                  fontFamily: 'var(--font-body)',
                  color: '#2a2118',
                  background: 'var(--color-surface)',
                  border: '1px solid rgba(139, 115, 75, 0.10)',
                  borderRadius: 4,
                  outline: 'none',
                  transition: 'border-color 200ms, box-shadow 200ms',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {inputValue && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue('');
                      setSearchQuery('');
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      fontSize: 16,
                      color: '#6b5d48',
                      background: 'none',
                      border: '1px solid rgba(139, 115, 75, 0.10)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'color 200ms, border-color 200ms',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label={t('clearSearch')}
                  >
                    ×
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSearch}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'var(--font-display)',
                    color: '#f2ede4',
                    background: '#7a5c12',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 200ms',
                  }}
                  aria-label={t('search')}
                >
                  {t('search')}
                </button>
              </div>
            </div>
            </div>
          </section>
        )}

        {/* Results status bar */}
        {results.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
              marginBottom: 20,
              fontSize: 11,
              fontFamily: 'var(--font-body)',
            }}
          >
            <span style={{ color: '#6b5d48' }}>
              共 {filteredResults.length} 个结果 · 按相似度排序
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {filterOptions.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 11,
                    fontFamily: 'var(--font-body)',
                    color: activeFilter === f.key ? '#f2ede4' : '#6b5d48',
                    background: activeFilter === f.key ? '#7a5c12' : 'var(--color-surface)',
                    border: activeFilter === f.key ? 'none' : '1px solid rgba(139, 115, 75, 0.10)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 200ms, color 200ms, border-color 200ms',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filters.searchQuery && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                color: 'var(--color-text-secondary)',
                marginBottom: 16,
                lineHeight: 1,
              }}
            >
              灯影未寻得
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                color: '#2a2118',
                marginBottom: 8,
              }}
            >
              未找到相似结果
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#6b5d48',
                maxWidth: 400,
                margin: '0 auto',
                lineHeight: 1.8,
              }}
            >
              尝试使用更具体的画面描述，如风格、色调、构图。
              <br />
              也可以降低相似度阈值，或切换到以图搜图模式。
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && <SearchSkeleton count={6} />}

        {/* Error state */}
        {error && !loading && (
          <ErrorState message={error} onRetry={handleSearch} />
        )}

        {/* Results grid */}
        {!loading && !error && filteredResults.length > 0 && (
          <section aria-label="搜索结果">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
              }}
            >
              {filteredResults.map((img) => (
                <ResultCard
                  key={img.id}
                  image={img}
                />
              ))}
            </div>
          </section>
        )}

        {/* High similarity compare */}
        {filteredResults.some((r) => (r.similarity ?? 0) >= 90) && (
          <section aria-label="高相似度对比" style={{ marginTop: 32 }}>
            <div
              onClick={() => setCompareOpen(!compareOpen)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCompareOpen(!compareOpen);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={compareOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '12px 0',
                borderTop: '1px solid rgba(139, 115, 75, 0.10)',
                borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
                transition: 'color 200ms',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transition: 'transform 200ms',
                  fontSize: 10,
                  color: '#6b5d48',
                  transform: compareOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▶
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-display)',
                  color: '#2a2118',
                }}
              >
                高相似度对比
              </span>
            </div>

            {compareOpen && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#6b5d48' }}>
                  选择两张图片进行详细对比
                </p>
              </div>
            )}
          </section>
        )}

        {/* Advanced settings */}
        <div style={{ marginTop: 48, borderTop: '1px solid rgba(139, 115, 75, 0.10)', paddingTop: 24 }}>
          <div
            onClick={() => setAdvancedOpen(!advancedOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setAdvancedOpen(!advancedOpen);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={advancedOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'color 200ms',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 200ms',
                fontSize: 10,
                color: '#6b5d48',
                transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              ▶
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'var(--font-display)',
                color: '#6b5d48',
              }}
            >
              高级设置
            </span>
          </div>

          {advancedOpen && (
            <div style={{ paddingTop: 24 }}>
              {/* Search scope */}
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'var(--font-display)',
                    color: '#6b5d48',
                    marginBottom: 10,
                    letterSpacing: '0.05em',
                  }}
                >
                  搜索范围
                </label>
                <div style={{ display: 'flex', gap: 20 }}>
                  {['创作者图库', '普通图库'].map((label) => (
                    <label
                      key={label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        color: '#2a2118',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <input
                        type="checkbox"
                        defaultChecked
                        style={{
                          accentColor: '#7a5c12',
                          width: 16,
                          height: 16,
                          cursor: 'pointer',
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Embedding model */}
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'var(--font-display)',
                    color: '#6b5d48',
                    marginBottom: 10,
                    letterSpacing: '0.05em',
                  }}
                >
                  嵌入模型
                </label>
                <select
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    color: '#2a2118',
                    background: 'var(--color-surface)',
                    border: '1px solid rgba(139, 115, 75, 0.10)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'border-color 200ms',
                    minWidth: 200,
                  }}
                >
                  <option>CLIP ViT-L/14</option>
                  <option>CLIP ViT-B/32</option>
                  <option>OpenCLIP ViT-bigG</option>
                </select>
              </div>

              {/* Similarity threshold + Max results */}
              <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'var(--font-display)',
                      color: '#6b5d48',
                      marginBottom: 10,
                      letterSpacing: '0.05em',
                    }}
                  >
                    相似度阈值
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      defaultValue="70"
                      style={{ width: 140, accentColor: '#7a5c12', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: '#2a2118', fontFamily: 'var(--font-body)', minWidth: 32 }}>
                      0.7
                    </span>
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'var(--font-display)',
                      color: '#6b5d48',
                      marginBottom: 10,
                      letterSpacing: '0.05em',
                    }}
                  >
                    最大结果数
                  </label>
                  <input
                    type="number"
                    defaultValue="20"
                    min="1"
                    max="100"
                    style={{
                      padding: '8px 14px',
                      fontSize: 13,
                      fontFamily: 'var(--font-body)',
                      color: '#2a2118',
                      background: 'var(--color-surface)',
                      border: '1px solid rgba(139, 115, 75, 0.10)',
                      borderRadius: 4,
                      width: 80,
                      transition: 'border-color 200ms',
                    }}
                  />
                </div>
              </div>

              {/* Search history */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'var(--font-display)',
                    color: '#6b5d48',
                    marginBottom: 10,
                    letterSpacing: '0.05em',
                  }}
                >
                  搜索历史
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {searchHistory.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setInputValue(term);
                        setSearchQuery(term);
                        searchImagesApi(term);
                      }}
                      style={{
                        padding: '6px 14px',
                        fontSize: 12,
                        fontFamily: 'var(--font-body)',
                        color: '#6b5d48',
                        background: 'var(--color-surface)',
                        border: '1px solid rgba(139, 115, 75, 0.10)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'background 200ms, color 200ms, border-color 200ms',
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function ResultCard({
  image,
}: {
  image: { id: string; filePath: string; prompt: string; model: string; width: number; height: number; similarity?: number };
}) {
  return (
    <article
      style={{
        borderRadius: 2,
        overflow: 'hidden',
        background: 'var(--color-surface)',
        border: '1px solid rgba(139, 115, 75, 0.10)',
        cursor: 'pointer',
        boxShadow:
          'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
        transition: 'box-shadow 200ms ease-out',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: '100%',
            aspectRatio: '1',
            background: 'rgba(139, 115, 75, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: '#a09480',
          }}
        >
          {image.width}×{image.height}
        </div>
        {image.similarity != null && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <SimilarityBadge value={image.similarity} />
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <p
          style={{
            fontSize: 12,
            color: '#2a2118',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.5,
            marginBottom: 6,
            marginTop: 0,
          }}
        >
          {image.prompt}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: '#6b5d48', fontFamily: 'var(--font-body)' }}>
            {image.model}
          </span>
          <span style={{ fontSize: 10, color: '#6b5d48', fontFamily: 'var(--font-body)' }}>
            {image.width} × {image.height}
          </span>
        </div>
      </div>
    </article>
  );
}

export default SearchPage;
