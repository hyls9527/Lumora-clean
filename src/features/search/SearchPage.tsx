import { useState, useCallback, useEffect } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useEmbeddingStore } from '../../stores/embeddingStore';
import { SearchSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { SemanticSearchBar } from '../../components/ui/SemanticSearchBar';
import { SimilarityBadge } from '../../components/ui/SimilarityBadge';
import { Collapsible } from '../../components/ui/Collapsible';
import { SearchSuggestions } from '../../components/ui/SearchSuggestions';
import { SearchAdvancedSettings } from './SearchAdvancedSettings';
import { useSemanticSearchStore } from '../../stores/semanticSearchStore';
import { useImageSearchStore } from '../../stores/imageSearchStore';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { usePerformanceMonitor } from '../../hooks/usePerformance';
import { useImageSrc } from '../../hooks/useImageSrc';
import { getImagesByIds } from '../../lib/api/images';
import type { ImageRecord } from '../../types/image';
import { useTranslation } from '../../lib/i18n';
import { useIsMobile, useMediaQuery } from '../../hooks/useMediaQuery';
import { t as tok } from '../../lib/tokens';

const filterOptions = [
  { key: 'all', label: '全部' },
  { key: '90', label: '90%以上' },
  { key: '80', label: '80%以上' },
  { key: '70', label: '70%以上' },
];

const SEARCH_PER_PAGE = 20;

const searchFieldOptions = [
  { key: 'all', label: '全部字段' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'negative_prompt', label: 'Negative Prompt' },
  { key: 'seed', label: 'Seed' },
  { key: 'model', label: 'Model' },
  { key: 'sampler', label: 'Sampler' },
];

export function SearchPage() {
  const { t: tT } = useTranslation('search');
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
  const embStats = useEmbeddingStore((s) => s.stats);
  const clipStats = useEmbeddingStore((s) => s.clipStats);
  const filling = useEmbeddingStore((s) => s.filling);
  const clipFilling = useEmbeddingStore((s) => s.clipFilling);
  const fillProgress = useEmbeddingStore((s) => s.fillProgress);
  const clipFillProgress = useEmbeddingStore((s) => s.clipFillProgress);
  const fillAllMissing = useEmbeddingStore((s) => s.fillAllMissing);
  const fetchEmbStats = useEmbeddingStore((s) => s.fetchStats);
  const fetchClipStats = useEmbeddingStore((s) => s.fetchClipStats);

  usePerformanceMonitor('SearchPage');

  // Image search results (from "以图搜图")
  const imageSearch = useImageSearchStore();
  const isImageSearch = imageSearch.sourceImageId !== null;
  const clearImageSearch = useImageSearchStore((s) => s.clear);

  const isMobile = useIsMobile();
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const { history: searchHistory, addHistory } = useSearchHistory();

  const [activeFilter, setActiveFilter] = useState('all');
  const [inputValue, setInputValue] = useState(filters.searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  // Semantic / image-to-image results only carry {id, similarity}; the full
  // records are fetched per result batch so cards render (F-1/F-4) even when
  // the ids are not on the currently loaded gallery page.
  const semanticResults = useSemanticSearchStore((s) => s.results);
  const semanticLoading = useSemanticSearchStore((s) => s.loading);
  const semanticError = useSemanticSearchStore((s) => s.error);
  const [resolvedRecords, setResolvedRecords] = useState<ImageRecord[]>([]);

  const idBasedResults = isImageSearch ? imageSearch.results : semanticResults;
  const idBasedLoading = isImageSearch ? imageSearch.loading : semanticLoading;
  const idBasedError = isImageSearch ? imageSearch.error : semanticError;
  const idKey = idBasedResults.map((r) => r.id).join(',');

  useEffect(() => {
    let cancelled = false;
    if (!idKey) {
      setResolvedRecords([]);
      return;
    }
    const ids = idKey.split(',');
    void getImagesByIds(ids)
      .then((records) => {
        if (cancelled) return;
        // Preserve the similarity ordering/info of the result list.
        const simById = new Map(idBasedResults.map((r) => [r.id, r.similarity]));
        setResolvedRecords(
          records.map((r) => ({ ...r, similarity: simById.get(r.id) ?? r.similarity })),
        );
      })
      .catch(() => {
        if (!cancelled) setResolvedRecords([]);
      });
    return () => {
      cancelled = true;
    };
    // idKey is derived from results; deliberate: the search must re-resolve
    // when a new result set arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const normalResults = getSearchResults();
  const results = isImageSearch || searchMode === 'semantic' ? resolvedRecords : normalResults;
  const currentLoading = isImageSearch || searchMode === 'semantic' ? idBasedLoading : loading;
  const currentError = isImageSearch || searchMode === 'semantic' ? idBasedError : error;

  const handleSearch = useCallback(() => {
    setSearchQuery(inputValue);
    searchImagesApi(inputValue);
    addHistory(inputValue);
    setShowSuggestions(false);
    setSearchPage(1);
  }, [inputValue, setSearchQuery, searchImagesApi, addHistory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  // Reset search page when search query or results change
  const filteredResults =
    activeFilter === 'all'
      ? results
      : results.filter((r) => (r.similarity ?? 0) >= parseInt(activeFilter, 10));

  const paginatedResults = filteredResults.slice(0, searchPage * SEARCH_PER_PAGE);
  const hasMore = paginatedResults.length < filteredResults.length;

  const handleLoadMore = useCallback(() => {
    setSearchPage((p) => p + 1);
  }, []);

  useEffect(() => {
    void fetchEmbStats();
    void fetchClipStats();
  }, [fetchEmbStats, fetchClipStats]);

  return (
    <div className="page-shell anim-page">
      <div style={{ padding: isMobile ? '24px 16px 40px' : '40px 48px 56px', maxWidth: 960 }}>
        {/* Header */}
        <header style={{ marginBottom: isMobile ? 20 : 28 }}>
          <h2 className={isMobile ? 'page-title page-title--mobile' : 'page-title'} style={{ marginBottom: 6 }}>
            语义搜索
          </h2>
          {isImageSearch ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: tok.accent, fontFamily: tok.fontBody }}>
                以图搜图 · 找到 {results.length} 个相似结果
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  clearImageSearch();
                  setSearchPage(1);
                }}
                style={{ padding: '3px 10px', fontSize: 11 }}
              >
                清除
              </button>
            </div>
          ) : (
            <p
              style={{
                fontSize: 12,
                color: tok.textSecondary,
                fontFamily: tok.fontBody,
                margin: 0,
              }}
            >
              {results.length > 0 ? `找到 ${results.length} 个相似结果` : '输入关键词开始搜索'}
            </p>
          )}
          {searchMode === 'semantic' &&
            ((embStats?.missing ?? 0) > 0 || (clipStats?.missing ?? 0) > 0) && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 14,
                padding: '10px 12px',
                background: tok.accentSubtle,
                border: `1px solid ${tok.border}`,
                borderRadius: 4,
                fontSize: 12,
                color: tok.textSecondary,
                fontFamily: tok.fontBody,
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(embStats?.missing ?? 0) > 0 && (
                  <span>{tT('indexIncomplete', { count: String(embStats?.missing ?? 0) })}</span>
                )}
                {(clipStats?.missing ?? 0) > 0 && (
                  <span>{tT('clipIndexIncomplete', { count: String(clipStats?.missing ?? 0) })}</span>
                )}
              </span>
              <button
                type="button"
                className={filling || clipFilling ? 'btn' : 'btn btn--accent'}
                disabled={filling || clipFilling}
                onClick={() => void fillAllMissing()}
                style={{ marginLeft: 'auto', flexShrink: 0 }}
              >
                {filling || clipFilling
                  ? tT('fillingProgress', {
                      remaining: String(
                        Math.max(fillProgress?.remaining ?? 0, clipFillProgress?.remaining ?? 0),
                      ),
                    })
                  : tT('fillMissing')}
              </button>
            </div>
          )}
        </header>

        {/* Search bar with semantic search integration */}
        {searchMode === 'semantic' ? (
          <SemanticSearchBar />
        ) : (
          <section aria-label={tT('searchQuery')} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 0, flexWrap: 'wrap' }}>
              <select
                value={filters.searchField}
                onChange={(e) => setSearchField(e.target.value)}
                aria-label={tT('searchField')}
                className="field-input"
                style={{
                  padding: isMobile ? '12px 10px' : '14px 12px',
                  fontSize: 13,
                  minWidth: isMobile ? 100 : 130,
                  cursor: 'pointer',
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
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={tT('textDescription')}
                aria-label={tT('textDescription')}
                className="field-input"
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 100px 12px 14px' : '14px 110px 14px 18px',
                  fontSize: isMobile ? 14 : 15,
                }}
              />
              <SearchSuggestions
                query={inputValue}
                suggestions={searchHistory}
                visible={showSuggestions && searchHistory.length > 0}
                onSelect={(suggestion) => {
                  setInputValue(suggestion);
                  setSearchQuery(suggestion);
                  searchImagesApi(suggestion);
                  setShowSuggestions(false);
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
                      color: tok.textSecondary,
                      background: 'none',
                      border: `1px solid ${tok.border}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'color 200ms, border-color 200ms',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label={tT('clearSearch')}
                  >
                    ×
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={handleSearch}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: tok.fontDisplay,
                  }}
                  aria-label={tT('search')}
                >
                  {tT('search')}
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
              padding: '10px 0',
              borderBottom: `1px solid ${tok.borderSubtle}`,
              marginBottom: 16,
              fontSize: 11,
              fontFamily: tok.fontBody,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ color: tok.textSecondary }}>
              共 {filteredResults.length} 个结果
              {hasMore && ` · 已显示 ${paginatedResults.length}`}
              {' · '}按相似度排序
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {filterOptions.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`tab-underline${activeFilter === f.key ? ' tab-underline--active' : ''}`}
                  onClick={() => {
                    setActiveFilter(f.key);
                    setSearchPage(1);
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
                fontFamily: tok.fontDisplay,
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
                fontFamily: tok.fontDisplay,
                fontSize: 18,
                color: tok.text,
                marginBottom: 8,
              }}
            >
              未找到相似结果
            </div>
            <div
              style={{
                fontSize: 13,
                color: tok.textSecondary,
                maxWidth: 400,
                margin: '0 auto',
                lineHeight: 1.8,
              }}
            >
              尝试使用更具体的画面描述，如风格、色调、构图。
              <br />
              也可以降低{tT('similarityThreshold')}，或切换到以图搜图模式。
            </div>
          </div>
        )}

        {/* Loading state */}
        {currentLoading && <SearchSkeleton count={6} />}

        {/* Error state */}
        {currentError && !currentLoading && (
          <ErrorState message={currentError} onRetry={handleSearch} />
        )}

        {/* Results grid */}
        {!currentLoading && !currentError && paginatedResults.length > 0 && (
          <section aria-label={tT('searchResults')}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gap: isMobile ? 12 : 16,
              }}
            >
              {paginatedResults.map((img) => (
                <ResultCard key={img.id} image={img} />
              ))}
            </div>
            {/* Load more button */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  style={{
                    padding: '10px 36px',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: tok.fontDisplay,
                    color: tok.accent,
                    background: 'transparent',
                    border: `1px solid ${tok.accent}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 200ms, color 200ms',
                  }}
                >
                  加载更多 ({filteredResults.length - paginatedResults.length} 项)
                </button>
              </div>
            )}
          </section>
        )}

        {/* High similarity compare */}
        {paginatedResults.some((r) => (r.similarity ?? 0) >= 90) && (
          <section aria-label={tT('highSimilarityCompare')} style={{ marginTop: 32, borderTop: `1px solid ${tok.border}`, borderBottom: `1px solid ${tok.border}`, padding: '12px 0' }}>
            <Collapsible title={tT('highSimilarityCompare')}>
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: tok.textSecondary }}>
                  {tT('selectTwoImages')}
                </p>
              </div>
            </Collapsible>
          </section>
        )}

        {/* Advanced settings */}
        <SearchAdvancedSettings
          searchHistory={searchHistory}
          onSelectHistory={(term) => {
            setInputValue(term);
            setSearchQuery(term);
            searchImagesApi(term);
            setSearchPage(1);
          }}
        />
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function ResultCard({
  image,
}: {
  image: ImageRecord & { similarity?: number };
}) {
  const imgSrc = useImageSrc(image.filePath, { thumbnailMaxWidth: 640 });
  return (
    <article
      style={{
        borderRadius: 2,
        overflow: 'hidden',
        background: 'var(--color-surface)',
        border: `1px solid ${tok.border}`,
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
            color: tok.textMuted,
            overflow: 'hidden',
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={image.prompt || image.fileName}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span>
              {image.width}×{image.height}
            </span>
          )}
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
            color: tok.text,
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
          <span style={{ fontSize: 10, color: tok.textSecondary, fontFamily: tok.fontBody }}>
            {image.model}
          </span>
          <span style={{ fontSize: 10, color: tok.textSecondary, fontFamily: tok.fontBody }}>
            {image.width} × {image.height}
          </span>
        </div>
      </div>
    </article>
  );
}

export default SearchPage;
