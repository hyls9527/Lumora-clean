import { useState, useCallback } from 'react';
import { useImageStore } from '../../stores/imageStore';
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
import { useTranslation } from '../../lib/i18n';
import { useIsMobile, useMediaQuery } from '../../hooks/useMediaQuery';
import { t as tok } from '../../lib/tokens';

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

  const normalResults = getSearchResults();
  const results = isImageSearch ? imageSearch.results : normalResults;
  const currentLoading = isImageSearch ? imageSearch.loading : loading;
  const currentError = isImageSearch ? imageSearch.error : error;

  const handleSearch = useCallback(() => {
    setSearchQuery(inputValue);
    searchImagesApi(inputValue);
    addHistory(inputValue);
    setShowSuggestions(false);
  }, [inputValue, setSearchQuery, searchImagesApi, addHistory]);

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
      <div style={{ padding: isMobile ? '24px 16px 40px' : '48px 48px 64px' }}>
        {/* Header */}
        <header style={{ marginBottom: isMobile ? 20 : 32 }}>
          <h2
            style={{
              fontSize: isMobile ? 18 : 20,
              fontWeight: 600,
              fontFamily: tok.fontDisplay,
              color: tok.text,
              marginBottom: 6,
              marginTop: 0,
            }}
          >
            语义搜索
          </h2>
          {isImageSearch ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: tok.accent, fontFamily: tok.fontBody }}>
                以图搜图 · 找到 {results.length} 个相似结果
              </span>
              <button
                type="button"
                onClick={clearImageSearch}
                style={{
                  fontSize: 11, fontFamily: tok.fontBody, color: tok.textSecondary,
                  background: 'none', border: `1px solid ${tok.border}`,
                  padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
                }}
              >
                清除
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: tok.textSecondary, fontFamily: tok.fontBody, margin: 0 }}>
              {results.length > 0
                ? `找到 ${results.length} 个相似结果`
                : '输入关键词开始搜索'}
            </p>
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
                aria-label={tT("search.searchField")}
                style={{
                  padding: isMobile ? '12px 10px' : '14px 12px',
                  fontSize: 13,
                  fontFamily: tok.fontBody,
                  color: tok.text,
                  background: 'var(--color-surface)',
                  border: `1px solid ${tok.border}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'border-color 200ms',
                  minWidth: isMobile ? 100 : 130,
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
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={tT('textDescription')}
                aria-label={tT('textDescription')}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 100px 12px 14px' : '14px 110px 14px 20px',
                  fontSize: isMobile ? 14 : 15,
                  fontFamily: tok.fontBody,
                  color: tok.text,
                  background: 'var(--color-surface)',
                  border: `1px solid ${tok.border}`,
                  borderRadius: 4,
                  outline: 'none',
                  transition: 'border-color 200ms, box-shadow 200ms',
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
                  onClick={handleSearch}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: tok.fontDisplay,
                    color: tok.bg,
                    background: tok.accent,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 200ms',
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
              padding: '8px 0',
              borderBottom: `1px solid ${tok.border}`,
              marginBottom: 20,
              fontSize: 11,
              fontFamily: tok.fontBody,
            }}
          >
            <span style={{ color: tok.textSecondary }}>
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
                    fontFamily: tok.fontBody,
                    color: activeFilter === f.key ? tok.bg : tok.textSecondary,
                    background: activeFilter === f.key ? tok.accent : 'var(--color-surface)',
                    border: activeFilter === f.key ? 'none' : `1px solid ${tok.border}`,
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
              也可以降低{tT("search.similarityThreshold")}，或切换到以图搜图模式。
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
        {!currentLoading && !currentError && filteredResults.length > 0 && (
          <section aria-label={tT("search.searchResults")}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gap: isMobile ? 12 : 16,
              }}
            >
              {filteredResults.map((img) =>
                isImageSearch ? (
                  <SearchResultCard key={img.id} result={img} />
                ) : (
                  <ResultCard
                    key={img.id}
                    image={img as Parameters<typeof ResultCard>[0]['image']}
                  />
                )
              )}
            </div>
          </section>
        )}

        {/* High similarity compare */}
        {filteredResults.some((r) => (r.similarity ?? 0) >= 90) && (
          <section aria-label={tT("search.highSimilarityCompare")} style={{ marginTop: 32, borderTop: `1px solid ${tok.border}`, borderBottom: `1px solid ${tok.border}`, padding: '12px 0' }}>
            <Collapsible title={tT("search.highSimilarityCompare")}>
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: tok.textSecondary }}>
                  {tT("search.selectTwoImages")}
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
          }}
        />
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function SearchResultCard({ result }: { result: { id: string; similarity?: number } }) {
  const image = useImageStore.getState().getFilteredImages().find((img) => img.id === result.id);
  if (!image) return null;
  return <ResultCard image={{ ...image, similarity: result.similarity }} />;
}

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
