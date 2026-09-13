import { useState } from 'react';
import { useFilterStore } from '../../stores/filterStore';
import { countActiveFilters } from '../../types/filter';
import { t } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

export function FilterPanel() {
  const { criteria, updateCriteria, clearFilters, toggleFavorite } = useFilterStore();
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(criteria);

  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0' }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={activeCount > 0 ? 'btn btn--accent' : 'btn'}
          aria-expanded={expanded}
        >
          {t('filter.title')}
          {activeCount > 0 && ` (${activeCount})`}
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          className={criteria.favorite ? 'btn btn--accent' : 'btn'}
          aria-pressed={criteria.favorite}
        >
          ◆ {t('filter.favorite')}
        </button>
        {activeCount > 0 && (
          <button type="button" onClick={clearFilters} className="btn btn--danger">
            {t('filter.clear')}
          </button>
        )}
      </div>

      {expanded && (
        <div
          className="anim-unfurl"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
            padding: '12px 0 14px',
            borderTop: `1px solid ${tok.borderSubtle}`,
          }}
        >
          <Field label={t('filter.model')}>
            <input
              type="text"
              value={criteria.model ?? ''}
              onChange={(e) => updateCriteria({ model: e.target.value || undefined })}
              placeholder="sd1.5, flux..."
              className="field-input"
              style={{ minWidth: 120 }}
            />
          </Field>

          <Field label={t('filter.rating')}>
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
                className="field-input"
                style={{ width: 52 }}
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
                className="field-input"
                style={{ width: 52 }}
              />
            </div>
          </Field>

          <Field label={t('filter.format')}>
            <select
              value={criteria.format ?? ''}
              onChange={(e) => updateCriteria({ format: e.target.value || undefined })}
              className="field-input"
            >
              <option value="">—</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
            </select>
          </Field>

          <Field label={t('filter.dateFrom')}>
            <input
              type="date"
              value={criteria.dateFrom ?? ''}
              onChange={(e) => updateCriteria({ dateFrom: e.target.value || undefined })}
              className="field-input"
            />
          </Field>

          <Field label={t('filter.dateTo')}>
            <input
              type="date"
              value={criteria.dateTo ?? ''}
              onChange={(e) => updateCriteria({ dateTo: e.target.value || undefined })}
              className="field-input"
            />
          </Field>

          <Field label={t('filter.seed')}>
            <input
              type="number"
              value={criteria.seed ?? ''}
              onChange={(e) =>
                updateCriteria({ seed: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="0"
              className="field-input"
              style={{ width: 100 }}
            />
          </Field>

          <Field label={t('filter.steps')}>
            <input
              type="number"
              value={criteria.steps ?? ''}
              onChange={(e) =>
                updateCriteria({ steps: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="0"
              className="field-input"
              style={{ width: 100 }}
            />
          </Field>

          <Field label={t('filter.cfg')}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="number"
                step="0.1"
                value={criteria.cfgMin ?? ''}
                onChange={(e) =>
                  updateCriteria({ cfgMin: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="0"
                className="field-input"
                style={{ width: 60 }}
              />
              <span style={{ fontSize: 11, color: tok.textMuted }}>–</span>
              <input
                type="number"
                step="0.1"
                value={criteria.cfgMax ?? ''}
                onChange={(e) =>
                  updateCriteria({ cfgMax: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="20"
                className="field-input"
                style={{ width: 60 }}
              />
            </div>
          </Field>

          <Field label={t('filter.sampler')}>
            <input
              type="text"
              value={criteria.sampler ?? ''}
              onChange={(e) => updateCriteria({ sampler: e.target.value || undefined })}
              placeholder="Euler a"
              className="field-input"
              style={{ minWidth: 110 }}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
