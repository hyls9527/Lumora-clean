import { useSettingsStore } from '../../stores/settingsStore';
import { exportDatabase, importDatabase } from '../../lib/api/backup';
import { getLanInfo } from '../../lib/api/lan';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useState, useEffect } from 'react';
import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';
import type { Language } from '../../stores/settingsStore';

/* ───────────────────────── colour tokens ───────────────────────── */
const token = {
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  text: 'var(--color-text)',
  accent: 'var(--color-accent)',
  muted: tok.textSecondary,
  border: tok.border,
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
                  ? '#f2ede4'
                  : token.muted,
              background: active ? token.accent : token.surface,
              border: 'none',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: 'background 200ms, color 200ms',
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

  const [backupMsg, setBackupMsg] = useState('');
  const [lanInfo, setLanInfo] = useState<{ ip: string; port: number } | null>(null);

  useEffect(() => { getLanInfo().then(setLanInfo).catch(() => {}); }, []);

  const handleExport = async () => {
    try {
      const dest = await save({ defaultPath: 'lumora-backup.db', filters: [{ name: 'SQLite', extensions: ['db'] }] });
      if (dest) {
        await exportDatabase(dest);
        setBackupMsg('导出成功');
        setTimeout(() => setBackupMsg(''), 3000);
      }
    } catch {
      setBackupMsg('导出失败');
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({ filters: [{ name: 'SQLite', extensions: ['db'] }] });
      if (selected) {
        await importDatabase(selected as string);
        setBackupMsg('导入成功，请重启应用');
      }
    } catch {
      setBackupMsg('导入失败');
    }
  };

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
        justifyContent: 'flex-start',
        padding: '32px 16px',
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
          <Row label={t('interfaceLanguage')}>
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
          <Row label={t('appearanceTheme')}>
            <SegmentedControl
              options={themeOptions}
              value={theme}
              onChange={setTheme}
            />
          </Row>
          {/* Theme preview card */}
          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 6,
              background: 'var(--color-surface)',
              border: `1px solid ${tok.border}`,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {['#f2ede4', '#f7f2ea', tok.text, tok.textSecondary, tok.accent, '#4a7a3a', '#8b3030'].map((c) => (
                <div
                  key={c}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: c,
                    border: '1px solid rgba(139, 115, 75, 0.15)',
                  }}
                  title={c}
                />
              ))}
            </div>
            <span style={{ fontSize: 11, color: tok.textMuted, fontFamily: 'var(--font-body)' }}>
              {theme === 'light' ? '古卷·灯火' : '暗夜'}
            </span>
          </div>
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
          <SectionHeading>{t('backup')}</SectionHeading>
          <div
            style={{
              background: token.surface,
              borderRadius: 6,
              border: `1px solid ${token.border}`,
              padding: '20px 16px',
              display: 'flex',
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={handleExport}
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                color: token.bg,
                background: token.accent,
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {t('exportDb')}
            </button>
            <button
              type="button"
              onClick={handleImport}
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                color: token.text,
                background: 'none',
                border: `1px solid ${token.border}`,
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {t('importDb')}
            </button>
            {backupMsg && (
              <span style={{ fontSize: 12, color: tok.success, alignSelf: 'center' }}>
                {backupMsg}
              </span>
            )}
          </div>
        </section>

        {/* ── LAN Access ── */}
        {lanInfo && (
          <section style={{ marginBottom: 36 }}>
            <SectionHeading>{t('lanAccess') || '局域网访问'}</SectionHeading>
            <div
              style={{
                background: token.surface,
                borderRadius: 6,
                border: `1px solid ${token.border}`,
                padding: '16px',
              }}
            >
              <p style={{ margin: '0 0 8px', fontSize: 13, color: token.text }}>
                在同一 WiFi 下的手机或平板浏览器访问：
              </p>
              <a
                href={`http://${lanInfo.ip}:${lanInfo.port}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  color: token.accent,
                  textDecoration: 'none',
                  padding: '8px 16px',
                  background: 'var(--color-accent-subtle)',
                  borderRadius: 4,
                  border: `1px solid ${token.accent}`,
                }}
              >
                http://{lanInfo.ip}:{lanInfo.port}
              </a>
            </div>
          </section>
        )}

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
              <span>{t('version')}: 0.6.0</span>
              <span>{t('license')}: MIT</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default SettingsPage;
