import { t as tok } from '../../lib/tokens';
import { t } from '../../lib/i18n';
import { Collapsible } from '../../components/ui/Collapsible';

interface SearchAdvancedSettingsProps {
  searchHistory: string[];
  onSelectHistory: (term: string) => void;
}

export function SearchAdvancedSettings({ searchHistory, onSelectHistory }: SearchAdvancedSettingsProps) {
  return (
    <div style={{ marginTop: 48, borderTop: `1px solid ${tok.border}`, paddingTop: 24 }}>
      <Collapsible title={t('search.advancedSettings')}>
        <div style={{ paddingTop: 24 }}>
          {/* Search scope */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>{t('search.searchScope')}</label>
            <div style={{ display: 'flex', gap: 20 }}>
              {[t('search.creatorGallery'), t('search.normalGallery')].map((label) => (
                <label key={label} style={checkboxLabelStyle}>
                  <input type="checkbox" defaultChecked style={checkboxStyle} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Embedding model */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>{t('search.embeddingModel')}</label>
            <select style={selectStyle}>
              <option>CLIP ViT-L/14</option>
              <option>CLIP ViT-B/32</option>
              <option>OpenCLIP ViT-bigG</option>
            </select>
          </div>

          {/* Similarity threshold + Max results */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>{t('search.similarityThreshold')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min="0" max="100" defaultValue="70"
                  style={{ width: 140, accentColor: tok.accent, cursor: 'pointer' }} />
                <span style={{ fontSize: 13, color: tok.text, fontFamily: tok.fontBody, minWidth: 32 }}>0.7</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('search.maxResults')}</label>
              <input type="number" defaultValue="20" min="1" max="100" style={numberInputStyle} />
            </div>
          </div>

          {/* Search history */}
          <div>
            <label style={labelStyle}>{t('search.searchHistory')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {searchHistory.map((term) => (
                <button key={term} type="button" onClick={() => onSelectHistory(term)} style={historyBtnStyle}>
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

/* ── Shared styles ────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  fontFamily: tok.fontDisplay, color: tok.textSecondary,
  marginBottom: 10, letterSpacing: '0.05em',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 13, color: tok.text, cursor: 'pointer', fontFamily: tok.fontBody,
};

const checkboxStyle: React.CSSProperties = {
  accentColor: tok.accent, width: 16, height: 16, cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontFamily: tok.fontBody, color: tok.text,
  background: 'var(--color-surface)', border: `1px solid ${tok.border}`,
  borderRadius: 4, cursor: 'pointer', transition: 'border-color 200ms', minWidth: 200,
};

const numberInputStyle: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontFamily: tok.fontBody, color: tok.text,
  background: 'var(--color-surface)', border: `1px solid ${tok.border}`,
  borderRadius: 4, width: 80, transition: 'border-color 200ms',
};

const historyBtnStyle: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontFamily: tok.fontBody, color: tok.textSecondary,
  background: 'var(--color-surface)', border: `1px solid ${tok.border}`,
  borderRadius: 4, cursor: 'pointer', transition: 'background 200ms, color 200ms, border-color 200ms',
};
