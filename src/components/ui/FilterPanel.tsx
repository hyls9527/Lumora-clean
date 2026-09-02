import { useState } from 'react';
import { useFilterStore } from '../../stores/filterStore';
import { countActiveFilters } from '../../types/filter';
import { t } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
  padding: '12px 0',
};

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '4px 8px',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  background: 'var(--color-surface)',
  color: tok.text,
  outline: 'none',
  minWidth: 80,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: tok.textSecondary,
  fontFamily: 'inherit',
};

const btnStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'inherit',
  padding: '4px 10px',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  background: 'var(--color-surface)',
  color: tok.textSecondary,
  cursor: 'pointer',
  transition: 'background 200ms',
};

const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: tok.accentSubtle,
  borderColor: tok.accent,
  color: tok.accent,
};

export function FilterPanel() {
  const { criteria, updateCriteria, clearFilters, toggleFavorite } = useFilterStore();
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(criteria);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={activeCount > 0 ? activeBtnStyle : btnStyle}
        >
          {t('filter.title')}
          {activeCount > 0 && ` (${activeCount})`}
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          style={criteria.favorite ? activeBtnStyle : btnStyle}
        >
          ◆ {t('filter.favorite')}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            style={{ ...btnStyle, color: tok.danger, borderColor: tok.danger }}
          >
            {t('filter.clear')}
          </button>
        )}
      </div>

      {expanded && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.model')}</label>
            <input
              type="text"
              value={criteria.model ?? ''}
              onChange={(e) => updateCriteria({ model: e.target.value || undefined })}
              placeholder="sd1.5, flux..."
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.rating')}</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="number"
                min={0}
                max={5}
                value={criteria.ratingMin ?? ''}
                onChange={(e) =>
                  updateCriteria({
                    ratingMin: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                style={{ ...inputStyle, width: 48 }}
              />
              <span style={{ fontSize: 11, color: tok.textMuted }}>–</span>
              <input
                type="number"
                min={0}
                max={5}
                value={criteria.ratingMax ?? ''}
                onChange={(e) =>
                  updateCriteria({
                    ratingMax: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="5"
                style={{ ...inputStyle, width: 48 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.format')}</label>
            <select
              value={criteria.format ?? ''}
              onChange={(e) => updateCriteria({ format: e.target.value || undefined })}
              style={inputStyle}
            >
              <option value="">—</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.dateFrom')}</label>
            <input
              type="date"
              value={criteria.dateFrom ?? ''}
              onChange={(e) => updateCriteria({ dateFrom: e.target.value || undefined })}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.dateTo')}</label>
            <input
              type="date"
              value={criteria.dateTo ?? ''}
              onChange={(e) => updateCriteria({ dateTo: e.target.value || undefined })}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.seed')}</label>
            <input
              type="number"
              value={criteria.seed ?? ''}
              onChange={(e) => updateCriteria({ seed: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="0"
              style={{ ...inputStyle, width: 96 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.steps')}</label>
            <input
              type="number"
              value={criteria.steps ?? ''}
              onChange={(e) => updateCriteria({ steps: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="0"
              style={{ ...inputStyle, width: 96 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.cfg')}</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="number"
                step="0.1"
                value={criteria.cfgMin ?? ''}
                onChange={(e) => updateCriteria({ cfgMin: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
                style={{ ...inputStyle, width: 56 }}
              />
              <span style={{ fontSize: 11, color: tok.textMuted }}>–</span>
              <input
                type="number"
                step="0.1"
                value={criteria.cfgMax ?? ''}
                onChange={(e) => updateCriteria({ cfgMax: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="20"
                style={{ ...inputStyle, width: 56 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('filter.sampler')}</label>
            <input
              type="text"
              value={criteria.sampler ?? ''}
              onChange={(e) => updateCriteria({ sampler: e.target.value || undefined })}
              placeholder="Euler a"
              style={inputStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
