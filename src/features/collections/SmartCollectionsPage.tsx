import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';
import { ImageCard } from '../../components/ui/ImageCard';
import { DetailModal } from '../../components/ui/DetailModal';
import { ErrorState } from '../../components/ui/ErrorState';
import type { ImageRecord } from '../../types/image';
import {
  listSmartCollections,
  createSmartCollection,
  updateSmartCollection,
  deleteSmartCollection,
  getSmartCollectionImages,
  type SmartCollection,
  type SmartCollectionRule,
} from '../../lib/api/smartCollections';

type Field = SmartCollectionRule['field'];
type Op = SmartCollectionRule['op'];

const FIELD_OPTIONS: { key: Field; labelKey: string }[] = [
  { key: 'model', labelKey: 'fields.model' },
  { key: 'prompt', labelKey: 'fields.prompt' },
  { key: 'rating', labelKey: 'fields.rating' },
  { key: 'score', labelKey: 'fields.score' },
  { key: 'date', labelKey: 'fields.date' },
  { key: 'format', labelKey: 'fields.format' },
  { key: 'tag', labelKey: 'fields.tag' },
  { key: 'seed', labelKey: 'fields.seed' },
  { key: 'steps', labelKey: 'fields.steps' },
  { key: 'cfg', labelKey: 'fields.cfg' },
  { key: 'sampler', labelKey: 'fields.sampler' },
];

const OP_OPTIONS: Record<Field, { key: Op; labelKey: string }[]> = {
  model: [{ key: 'equals', labelKey: 'ops.equals' }],
  format: [{ key: 'equals', labelKey: 'ops.equals' }],
  rating: [
    { key: 'gte', labelKey: 'ops.gte' },
    { key: 'lte', labelKey: 'ops.lte' },
  ],
  score: [{ key: 'equals', labelKey: 'ops.equals' }],
  date: [
    { key: 'gte', labelKey: 'ops.gte' },
    { key: 'lte', labelKey: 'ops.lte' },
  ],
  prompt: [{ key: 'contains', labelKey: 'ops.contains' }],
  tag: [
    { key: 'equals', labelKey: 'ops.equals' },
    { key: 'in', labelKey: 'ops.in' },
  ],
  seed: [{ key: 'equals', labelKey: 'ops.equals' }],
  steps: [{ key: 'equals', labelKey: 'ops.equals' }],
  cfg: [
    { key: 'gte', labelKey: 'ops.gte' },
    { key: 'lte', labelKey: 'ops.lte' },
  ],
  sampler: [{ key: 'equals', labelKey: 'ops.equals' }],
};

const PAGE_SIZE = 40;

function ruleText(
  rule: SmartCollectionRule,
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  switch (rule.field) {
    case 'model':
      return t('summaryModel', { value: rule.value });
    case 'format':
      return t('summaryFormat', { value: rule.value });
    case 'rating':
      return rule.op === 'gte'
        ? t('summaryRatingGte', { value: rule.value })
        : t('summaryRatingLte', { value: rule.value });
    case 'score':
      return t('summaryScore', { value: rule.value });
    case 'date':
      return rule.op === 'gte'
        ? t('summaryDateGte', { value: rule.value })
        : t('summaryDateLte', { value: rule.value });
    case 'prompt':
      return t('summaryPrompt', { value: rule.value });
    case 'tag':
      return rule.op === 'in'
        ? t('summaryTagIn', { value: rule.value })
        : t('summaryTagEquals', { value: rule.value });
    case 'seed':
      return t('summarySeed', { value: rule.value });
    case 'steps':
      return t('summarySteps', { value: rule.value });
    case 'cfg':
      return rule.op === 'gte'
        ? t('summaryCfgGte', { value: rule.value })
        : t('summaryCfgLte', { value: rule.value });
    case 'sampler':
      return t('summarySampler', { value: rule.value });
  }
}

function RulesPreview({
  rules,
  t,
}: {
  rules: SmartCollectionRule[];
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 6,
      }}
    >
      {rules.map((rule, i) => (
        <span
          key={i}
          style={{
            fontSize: 9,
            fontFamily: tok.fontBody,
            color: tok.textSecondary,
            background: 'var(--color-accent-subtle)',
            border: `1px solid ${tok.border}`,
            borderRadius: 3,
            padding: '2px 6px',
          }}
        >
          {ruleText(rule, t)}
        </span>
      ))}
    </div>
  );
}

export function SmartCollectionsPage() {
  const { t } = useTranslation('smartCollections');

  const [collections, setCollections] = useState<SmartCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SmartCollection | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftRules, setDraftRules] = useState<SmartCollectionRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<SmartCollection | null>(null);
  const [detailImages, setDetailImages] = useState<ImageRecord[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<ImageRecord | null>(null);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCollections(await listSmartCollections());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setDraftName('');
    setDraftRules([
      { field: 'model', op: 'equals', value: '' },
    ]);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((collection: SmartCollection) => {
    setEditing(collection);
    setDraftName(collection.name);
    setDraftRules(
      collection.rules.length > 0
        ? collection.rules.map((r) => ({ ...r }))
        : [{ field: 'model', op: 'equals', value: '' }],
    );
    setEditorOpen(true);
  }, []);

  const updateRule = useCallback((index: number, patch: Partial<SmartCollectionRule>) => {
    setDraftRules((rules) =>
      rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );
  }, []);

  const save = useCallback(async () => {
    const name = draftName.trim();
    const rules = draftRules
      .map((r) => ({ ...r, value: r.value.trim() }))
      .filter((r) => r.value.length > 0);
    if (!name) return;
    if (rules.length === 0) return;

    setSaving(true);
    try {
      if (editing) {
        await updateSmartCollection(editing.id, name, rules);
      } else {
        await createSmartCollection(name, rules);
      }
      setEditorOpen(false);
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [draftName, draftRules, editing, loadCollections, t]);

  const handleDelete = useCallback(
    async (collection: SmartCollection) => {
      if (!window.confirm(t('deleteConfirm', { name: collection.name }))) return;
      try {
        await deleteSmartCollection(collection.id);
        if (detail?.id === collection.id) setDetail(null);
        await loadCollections();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('deleteError'));
      }
    },
    [detail, loadCollections, t],
  );

  const openDetail = useCallback(
    (collection: SmartCollection) => {
      setDetail(collection);
      setDetailPage(1);
    },
    [],
  );

  const loadDetailPage = useCallback(
    async (collection: SmartCollection, page: number) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const result = await getSmartCollectionImages(collection.id, page, PAGE_SIZE);
        setDetailImages(result.items);
        setDetailTotal(result.total);
        setDetailPage(page);
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : t('loadError'));
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (detail) {
      void loadDetailPage(detail, 1);
    }
  }, [detail, loadDetailPage]);

  const totalPages = Math.max(1, Math.ceil(detailTotal / PAGE_SIZE));

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 32px',
          borderBottom: `1px solid ${tok.border}`,
          background: 'var(--color-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            fontFamily: tok.fontDisplay,
            color: tok.text,
            margin: 0,
          }}
        >
          {detail ? detail.name : t('title')}
        </h2>
        {detail ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setDetail(null)}
              style={secondaryButtonStyle}
            >
              {t('back')}
            </button>
            <button
              type="button"
              onClick={() => openEdit(detail)}
              style={secondaryButtonStyle}
            >
              {t('edit')}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(detail)}
              style={{ ...secondaryButtonStyle, color: tok.danger, borderColor: tok.danger }}
            >
              {t('delete')}
            </button>
          </div>
        ) : (
          <button type="button" onClick={openCreate} style={primaryButtonStyle}>
            + {t('add')}
          </button>
        )}
      </div>

      {detail ? (
        <DetailView
          rules={detail.rules}
          images={detailImages}
          total={detailTotal}
          page={detailPage}
          totalPages={totalPages}
          loading={detailLoading}
          error={detailError}
          onPrev={() => detailPage > 1 && void loadDetailPage(detail, detailPage - 1)}
          onNext={() => detailPage < totalPages && void loadDetailPage(detail, detailPage + 1)}
          onOpenImage={setModalImage}
          t={t}
        />
      ) : error ? (
        <ErrorState message={error} onRetry={loadCollections} />
      ) : loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tok.textMuted, fontFamily: tok.fontBody, fontSize: 13 }}>
          {t('loading')}
        </div>
      ) : collections.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: tok.textMuted, fontFamily: tok.fontBody, fontSize: 13 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="14" width="32" height="24" rx="3" stroke={tok.textFaint} strokeWidth="1.5" fill="rgba(122,92,18,0.06)" />
            <path d="M8 22h32M14 28h8" stroke={tok.textFaint} strokeWidth="1.5" />
          </svg>
          {t('empty')}
        </div>
      ) : (
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {collections.map((collection) => (
            <div
              key={collection.id}
              style={{
                background: 'var(--color-surface)',
                border: `1px solid ${tok.border}`,
                borderRadius: 6,
                padding: 14,
                cursor: 'pointer',
                transition: 'border-color 200ms',
              }}
              onClick={() => openDetail(collection)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: tok.fontDisplay, color: tok.text }}>
                  {collection.name}
                </span>
                <span style={{ fontSize: 10, fontFamily: tok.fontBody, color: tok.textSecondary, whiteSpace: 'nowrap' }}>
                  {t('imageCount', { count: collection.count })}
                </span>
              </div>
              <RulesPreview rules={collection.rules} t={t} />
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openEdit(collection); }}
                  style={smallButtonStyle}
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleDelete(collection); }}
                  style={{ ...smallButtonStyle, color: tok.danger }}
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <div style={overlayStyle} onClick={() => setEditorOpen(false)}>
          <div
            style={{
              width: 460,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: 'var(--color-surface)',
              border: `1px solid ${tok.border}`,
              borderRadius: 8,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, fontFamily: tok.fontDisplay, color: tok.text }}>
              {editing ? t('edit') : t('add')}
            </h3>
            <label style={{ display: 'block', fontSize: 11, fontFamily: tok.fontDisplay, color: tok.textSecondary, marginBottom: 4 }}>
              {t('name')}
            </label>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t('namePlaceholder')}
              style={inputStyle}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 4px' }}>
              <span style={{ fontSize: 11, fontFamily: tok.fontDisplay, color: tok.textSecondary }}>
                {t('rules')}
              </span>
              <button type="button" onClick={() => setDraftRules((r) => [...r, { field: 'model', op: 'equals', value: '' }])} style={smallButtonStyle}>
                + {t('addRule')}
              </button>
            </div>
            <div style={{ fontSize: 9, color: tok.textMuted, marginBottom: 8 }}>
              {t('matchAll')}
            </div>

            {draftRules.map((rule, index) => (
              <div key={index} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <select
                  value={rule.field}
                  onChange={(e) => {
                    const field = e.target.value as Field;
                    const ops = OP_OPTIONS[field];
                    updateRule(index, { field, op: ops[0].key });
                  }}
                  style={selectStyle}
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.op}
                  onChange={(e) => updateRule(index, { op: e.target.value as Op })}
                  style={{ ...selectStyle, width: 110 }}
                >
                  {OP_OPTIONS[rule.field].map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
                <input
                  value={rule.value}
                  onChange={(e) => updateRule(index, { value: e.target.value })}
                  placeholder={
                    rule.field === 'tag' && rule.op === 'in'
                      ? t('tagValueHint')
                      : rule.field === 'score'
                        ? t('scoreValueHint')
                      : rule.field === 'date'
                        ? t('datePlaceholder')
                        : t('valuePlaceholder')
                  }
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setDraftRules((rules) => rules.filter((_, i) => i !== index))}
                  disabled={draftRules.length <= 1}
                  style={{ ...smallButtonStyle, color: tok.danger, opacity: draftRules.length <= 1 ? 0.4 : 1 }}
                >
                  ✕
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setEditorOpen(false)} style={secondaryButtonStyle}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !draftName.trim() || draftRules.filter((r) => r.value.trim()).length === 0}
                style={{ ...primaryButtonStyle, opacity: saving || !draftName.trim() || draftRules.filter((r) => r.value.trim()).length === 0 ? 0.5 : 1 }}
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailModal image={modalImage} onClose={() => setModalImage(null)} />
    </div>
  );
}

function DetailView({
  rules,
  images,
  total,
  page,
  totalPages,
  loading,
  error,
  onPrev,
  onNext,
  onOpenImage,
  t,
}: {
  rules: SmartCollectionRule[];
  images: ImageRecord[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  onPrev: () => void;
  onNext: () => void;
  onOpenImage: (img: ImageRecord) => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  if (error) {
    return <ErrorState message={error} />;
  }
  if (loading && images.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tok.textMuted, fontFamily: tok.fontBody, fontSize: 13 }}>
        {t('loading')}
      </div>
    );
  }
  if (images.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: tok.textMuted, fontFamily: tok.fontBody, fontSize: 13 }}>
        <div style={{ padding: '0 32px' }}>
          <RulesPreview rules={rules} t={t} />
        </div>
        {t('emptyImages')}
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext} t={t} />
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: '10px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <RulesPreview rules={rules} t={t} />
        <span style={{ fontSize: 11, color: tok.textSecondary, fontFamily: tok.fontBody }}>
          {t('imageCount', { count: total })}
        </span>
      </div>
      <div style={{ columnCount: 4, columnGap: 12, padding: '24px 32px' }}>
        {images.map((img) => (
          <div key={img.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <ImageCard image={img} onOpen={() => onOpenImage(img)} />
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext} t={t} />
      )}
    </>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  t,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 32px 16px' }}>
      <button type="button" onClick={onPrev} disabled={page <= 1} style={smallButtonStyle}>
        {t('prevPage')}
      </button>
      <span style={{ fontSize: 11, color: tok.textSecondary, fontFamily: tok.fontBody }}>
        {page} / {totalPages}
      </span>
      <button type="button" onClick={onNext} disabled={page >= totalPages} style={smallButtonStyle}>
        {t('nextPage')}
      </button>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: tok.fontDisplay,
  color: tok.bg,
  background: tok.accent,
  border: 'none',
  padding: '8px 16px',
  borderRadius: 4,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: tok.fontDisplay,
  color: tok.text,
  background: 'none',
  border: `1px solid ${tok.border}`,
  padding: '8px 16px',
  borderRadius: 4,
  cursor: 'pointer',
};

const smallButtonStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: tok.fontDisplay,
  color: tok.textSecondary,
  background: 'none',
  border: `1px solid ${tok.border}`,
  borderRadius: 3,
  padding: '3px 10px',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 12,
  fontFamily: tok.fontBody,
  color: tok.text,
  background: 'var(--color-bg)',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  padding: '7px 10px',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: tok.fontBody,
  color: tok.text,
  background: 'var(--color-bg)',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  padding: '6px 8px',
  outline: 'none',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

export default SmartCollectionsPage;
