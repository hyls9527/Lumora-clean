import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useImageStore } from '../../stores/imageStore';
import { ErrorState } from '../../components/ui/ErrorState';

export function ImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [recentImports, setRecentImports] = useState<
    { name: string; status: 'done' | 'processing' }[]
  >([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
  } | null>(null);

  const { loading, error, importImages } = useImageStore();

  const handleImport = useCallback(
    async (folderPath?: string) => {
      if (!folderPath) return;
      setRecentImports([]);
      setImportResult(null);
      try {
        const result = await importImages(folderPath);
        setImportResult({
          imported: result.imported,
          skipped: result.skipped,
          total: result.totalScanned,
        });
        setRecentImports((prev) => [
          { name: folderPath.split(/[/\\]/).pop() ?? folderPath, status: 'done' },
          ...prev.slice(0, 9),
        ]);
      } catch {
        // error 已在 store 中设置
      }
    },
    [importImages],
  );

  const handleBrowseFolder = useCallback(async () => {
    const selected = await open({ directory: true, title: '选择导入文件夹' });
    if (selected) handleImport(selected);
  }, [handleImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      // Tauri 中拖拽文件带有 path 属性
      const file = e.dataTransfer?.files[0] as (File & { path?: string }) | undefined;
      handleImport(file?.path);
    },
    [handleImport],
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 40,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: '#2a2118',
              margin: 0,
            }}
          >
            导入管理
          </h2>
          <button
            type="button"
            onClick={handleBrowseFolder}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
              fontFamily: 'var(--font-display)',
              color: '#f2ede4',
              background: '#7a5c12',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'background 200ms',
            }}
          >
            选择文件夹
          </button>
        </div>

        {/* Folder picker / Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseFolder}
          role="button"
          tabIndex={0}
          aria-label="选择文件夹导入"
          style={{
            border: `2px dashed ${dragOver ? '#7a5c12' : 'rgba(139, 115, 75, 0.10)'}`,
            borderRadius: 4,
            background: dragOver ? 'rgba(122, 92, 18, 0.04)' : 'var(--color-surface)',
            height: 140,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'border-color 200ms, background 200ms',
            marginBottom: 32,
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontFamily: 'var(--font-display)',
              color: '#6b5d48',
              marginBottom: 8,
            }}
          >
            拖拽文件夹到此处，或点击选择
          </p>
          <p
            style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: '#a09480' }}
          >
            支持 PNG、JPG、WEBP 格式
          </p>
        </div>

        {/* Error state */}
        {error && <ErrorState message={error} onRetry={handleBrowseFolder} />}

        {/* Import loading */}
        {loading && (
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                color: '#6b5d48',
              }}
            >
              正在导入，请稍候…
            </span>
          </div>
        )}

        {/* Import result feedback */}
        {importResult && !loading && (
          <div
            style={{
              marginBottom: 32,
              padding: '12px 16px',
              background: 'rgba(74, 122, 58, 0.06)',
              border: '1px solid rgba(74, 122, 58, 0.15)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              color: '#3b5635',
            }}
          >
            <span>导入完成</span>
            <span>新增 <strong>{importResult.imported}</strong> 张</span>
            {importResult.skipped > 0 && (
              <span style={{ color: '#87571e' }}>
                跳过 <strong>{importResult.skipped}</strong> 张（已存在）
              </span>
            )}
            <span style={{ color: '#a09480' }}>
              共扫描 {importResult.total} 个文件
            </span>
          </div>
        )}

        {/* Status overview: 3 stat cards */}
        <section
          aria-label="导入状态概览"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            marginBottom: 48,
          }}
        >
          <StatCard
            dotColor="#a09480"
            title="手动导入"
            status="就绪"
            detail={recentImports.length > 0 ? `最近导入 ${recentImports.length} 张` : '选择文件夹开始导入'}
          />
          <StatCard
            dotColor="#a09480"
            title="ComfyUI"
            status="未连接"
            detail="即将推出"
          />
        </section>

        {/* Recent imports list */}
        <section style={{ marginBottom: 48 }} aria-label="最近导入">
          <h3
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              marginBottom: 24,
              fontFamily: 'var(--font-display)',
              color: '#6b5d48',
              borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
              paddingBottom: 12,
            }}
          >
            最近导入
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(139, 115, 75, 0.10)',
              borderRadius: 2,
            }}
          >
            {recentImports.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 16px',
                  transition: 'background 200ms',
                  borderBottom:
                    i < recentImports.length - 1
                      ? '1px solid rgba(139, 115, 75, 0.10)'
                      : 'none',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: 2,
                    background: 'rgba(139, 115, 75, 0.08)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                      color: '#2a2118',
                    }}
                  >
                    {item.name}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </section>

        {/* Advanced settings (expandable) */}
        <section aria-label="高级设置">
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
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 0',
              transition: 'color 200ms',
              borderTop: '1px dotted rgba(139, 115, 75, 0.10)',
            }}
          >
            <span style={{ fontSize: 12, color: '#6b5d48' }}>
              {advancedOpen ? '▾' : '▸'}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                fontFamily: 'var(--font-display)',
                color: '#6b5d48',
              }}
            >
              高级设置
            </span>
          </div>

          {advancedOpen && (
            <div>
              {/* ComfyUI Config */}
              <div style={{ marginTop: 24, marginBottom: 40 }}>
                <SectionHeader>ComfyUI 配置</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <SettingRow label="监控文件夹路径">
                    <input
                      type="text"
                      defaultValue="D:\ComfyUI\output"
                      aria-label="监控文件夹路径"
                      style={inputStyle}
                    />
                  </SettingRow>
                  <SettingRow label="自动导入">
                    <Toggle defaultChecked />
                  </SettingRow>
                  <SettingRow label="文件格式过滤">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {['PNG', 'JPG', 'WEBP'].map((fmt) => (
                        <label
                          key={fmt}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#2a2118',
                          }}
                        >
                          <input
                            type="checkbox"
                            defaultChecked
                            style={{
                              width: 14,
                              height: 14,
                              accentColor: '#7a5c12',
                            }}
                          />
                          {fmt}
                        </label>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow label="导入间隔">
                    <input
                      type="text"
                      defaultValue="5秒"
                      aria-label="导入间隔"
                      style={{ ...inputStyle, width: 96 }}
                    />
                  </SettingRow>
                  <SettingRow label="子文件夹递归">
                    <Toggle defaultChecked />
                  </SettingRow>
                </div>
              </div>

              {/* Manual Import Config */}
              <div style={{ marginBottom: 40 }}>
                <SectionHeader>手动导入配置</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <SettingRow label="默认分类">
                    <select style={selectStyle} aria-label="默认分类">
                      <option>创作者图库</option>
                      <option>普通图库</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="自动解析元数据">
                    <Toggle defaultChecked />
                  </SettingRow>
                  <SettingRow label="支持格式">
                    <span style={{ fontSize: 12, color: '#6b5d48' }}>
                      PNG（含 metadata）、JPG、WEBP
                    </span>
                  </SettingRow>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function StatCard({
  dotColor,
  title,
  status,
  detail,
}: {
  dotColor: string;
  title: string;
  status: string;
  detail: string;
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid rgba(139, 115, 75, 0.10)',
        borderRadius: 2,
        padding: 20,
        boxShadow:
          'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flexShrink: 0,
            background: dotColor,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 500, color: '#2a2118' }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: 14, color: '#6b5d48' }}>{status}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: '#6b5d48' }}>{detail}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'done' | 'processing' }) {
  const isDone = status === 'done';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 10,
        flexShrink: 0,
        color: isDone ? '#3b5635' : '#87571e',
        background: isDone ? 'rgba(74, 122, 58, 0.08)' : 'rgba(122, 92, 18, 0.06)',
        borderRadius: 2,
      }}
    >
      {isDone ? '完成' : '处理中'}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: 24,
        fontFamily: 'var(--font-display)',
        color: '#6b5d48',
        borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
        paddingBottom: 12,
      }}
    >
      {children}
    </h3>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <label
        style={{
          fontSize: 12,
          width: 128,
          flexShrink: 0,
          color: '#2a2118',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ defaultChecked }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked ?? false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        position: 'relative',
        cursor: 'pointer',
        background: on ? '#7a5c12' : '#a09480',
        border: 'none',
        transition: 'background 200ms',
        padding: 0,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          background: on ? '#f2ede4' : '#f7f2ea',
          transition: 'left 200ms',
        }}
      />
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--color-surface)',
  border: '1px solid rgba(139, 115, 75, 0.10)',
  borderRadius: 4,
  color: '#2a2118',
  fontFamily: 'var(--font-body)',
  transition: 'border-color 200ms',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--color-surface)',
  border: '1px solid rgba(139, 115, 75, 0.10)',
  borderRadius: 4,
  color: '#2a2118',
};

export default ImportPage;
