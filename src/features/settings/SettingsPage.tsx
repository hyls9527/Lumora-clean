import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../lib/i18n';
import type { Language } from '../../stores/settingsStore';

/* ───────────────────────── colour tokens ───────────────────────── */
const token = {
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  text: 'var(--color-text)',
  accent: 'var(--color-accent)',
  muted: '#6b5d48',
  border: 'rgba(139, 115, 75, 0.10)',
};

/* ───────────────────────── sub-components ──────────────────────── */

function SectionHeading({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: token.muted,
        marginBottom: 12,
        marginTop: 0,
      }}
    >
      {children}
    </h2>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: `1px solid ${token.border}`,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontFamily: 'var(--font-display)',
          color: token.text,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: (v: T) => boolean;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        borderRadius: 4,
        border: `1px solid ${token.border}`,
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        const isDisabled = disabled?.(opt.key) ?? false;
        return (
          <button
            key={opt.key}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(opt.key)}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              fontWeight: active ? 700 : 500,
              color: isDisabled
                ? 'rgba(107, 93, 72, 0.35)'
                : active
                  ? '#fff'
                  : token.muted,
              background: active ? token.accent : token.surface,
              border: 'none',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: 'background 150ms, color 150ms',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: 11,
        fontFamily: 'var(--font-display)',
        background: token.surface,
        border: `1px solid ${token.border}`,
        borderRadius: 3,
        color: token.muted,
      }}
    >
      {children}
    </kbd>
  );
}

/* ───────────────────────── main page ───────────────────────────── */

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const langOptions: { key: Language; label: string }[] = [
    { key: 'zh', label: '中文' },
    { key: 'en', label: 'English' },
  ];

  const themeOptions = [
    { key: 'light' as const, label: t('lightTheme') },
    { key: 'dark' as const, label: t('darkTheme') },
  ];

  const shortcuts: { action: string; key: string }[] = [
    { action: t('shortcutSearch'), key: t('shortcutSearchKey') },
    { action: t('shortcutSelectAll'), key: t('shortcutSelectAllKey') },
    { action: t('shortcutDelete'), key: t('shortcutDeleteKey') },
    { action: t('shortcutEscape'), key: t('shortcutEscapeKey') },
  ];

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        padding: '48px 24px',
        background: token.bg,
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Title */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: token.text,
            marginTop: 0,
            marginBottom: 32,
          }}
        >
          {t('title')}
        </h1>

        {/* ── Language ── */}
        <section style={{ marginBottom: 36 }}>
          <SectionHeading>{t('language')}</SectionHeading>
          <Row label={t('language')}>
            <SegmentedControl
              options={langOptions}
              value={language}
              onChange={setLanguage}
            />
          </Row>
        </section>

        {/* ── Theme ── */}
        <section style={{ marginBottom: 36 }}>
          <SectionHeading>{t('theme')}</SectionHeading>
          <Row label={t('theme')}>
            <SegmentedControl
              options={themeOptions}
              value={theme}
              onChange={setTheme}
              disabled={(v) => v === 'dark'}
            />
          </Row>
        </section>

        {/* ── Shortcuts ── */}
        <section style={{ marginBottom: 36 }}>
          <SectionHeading>{t('shortcuts')}</SectionHeading>
          <div
            style={{
              background: token.surface,
              borderRadius: 6,
              border: `1px solid ${token.border}`,
              overflow: 'hidden',
            }}
          >
            {shortcuts.map((s, i) => (
              <div
                key={s.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom:
                    i < shortcuts.length - 1
                      ? `1px solid ${token.border}`
                      : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: 'var(--font-display)',
                    color: token.text,
                  }}
                >
                  {s.action}
                </span>
                <Kbd>{s.key}</Kbd>
              </div>
            ))}
          </div>
        </section>

        {/* ── About ── */}
        <section>
          <SectionHeading>{t('about')}</SectionHeading>
          <div
            style={{
              background: token.surface,
              borderRadius: 6,
              border: `1px solid ${token.border}`,
              padding: '20px 16px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                color: token.text,
                lineHeight: 1.6,
              }}
            >
              {t('aboutDesc')}
            </p>
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                color: token.muted,
                display: 'flex',
                gap: 24,
              }}
            >
              <span>{t('version')}: 0.1.0</span>
              <span>{t('license')}: MIT</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default SettingsPage;
