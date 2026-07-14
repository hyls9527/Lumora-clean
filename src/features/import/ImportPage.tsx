import { useState, useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useImageStore } from '../../stores/imageStore';
import { ErrorState } from '../../components/ui/ErrorState';
import { Collapsible } from '../../components/ui/Collapsible';
import { StatCard, StatusBadge, SectionHeader, SettingRow, Toggle, inputStyle, selectStyle } from './ImportComponents';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePerformanceMonitor } from '../../hooks/usePerformance';
import { t as tok } from '../../lib/tokens';
import { detectComfyuiPath } from '../../lib/api/comfyui';

interface ImportPageProps {
  droppedPaths?: string[];
  onPathsConsumed?: () => void;
}

export function ImportPage({ droppedPaths, onPathsConsumed }: ImportPageProps = {}) {
  const [dragOver, setDragOver] = useState(false);
  const [recentImports, setRecentImports] = useState<
    { name: string; status: 'done' | 'processing' }[]
  >([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [comfyuiPath, setComfyuiPath] = useState<string | null>(null);
  const [comfyuiDetecting, setComfyuiDetecting] = useState(false);
  const isMobile = useIsMobile();

  usePerformanceMonitor('ImportPage');

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

  // Auto-import dropped files from App.tsx
  useEffect(() => {
    if (droppedPaths && droppedPaths.length > 0) {
      // Get parent folders of dropped files
      const folders = [...new Set(droppedPaths.map(p => {
        const parts = p.split(/[/\\]/);
        parts.pop();
        return parts.join('/');
      }))];
      folders.forEach(folder => handleImport(folder));
      onPathsConsumed?.();
    }
  }, [droppedPaths, onPathsConsumed, handleImport]);

  const handleBrowseFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'] }],
      title: '选择图片文件',
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      paths.forEach(p => handleImport(p));
    }
  }, [handleImport]);

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

  const handleDetectComfyui = useCallback(async () => {
    setComfyuiDetecting(true);
    try {
      const path = await detectComfyuiPath();
      setComfyuiPath(path);
    } catch {
      setComfyuiPath(null);
    } finally {
      setComfyuiDetecting(false);
    }
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: isMobile ? 16 : 32 }}>
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? 24 : 40,
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? 18 : 20,
              fontWeight: 600,
              fontFamily: tok.fontDisplay,
              color: tok.text,
              margin: 0,
            }}
          >
            导入管理
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleBrowseFolder}
              style={{
                padding: isMobile ? '10px 20px' : '8px 16px',
                fontSize: isMobile ? 13 : 12,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
                fontFamily: tok.fontDisplay,
                color: tok.bg,
                background: tok.accent,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'background 200ms',
                minHeight: '44px',
              }}
            >
              选择文件夹
            </button>
            <button
              type="button"
              onClick={handleBrowseFiles}
              style={{
                padding: isMobile ? '10px 20px' : '8px 16px',
                fontSize: isMobile ? 13 : 12,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
                fontFamily: tok.fontDisplay,
                color: tok.text,
                background: 'none',
                border: `1px solid ${tok.border}`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'background 200ms',
                minHeight: '44px',
              }}
            >
              选择文件
            </button>
          </div>
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
            border: `2px dashed ${dragOver ? tok.accent : tok.border}`,
            borderRadius: 4,
            background: dragOver ? 'rgba(122, 92, 18, 0.04)' : 'var(--color-surface)',
            height: isMobile ? 120 : 140,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'border-color 200ms, background 200ms',
            marginBottom: isMobile ? 24 : 32,
            padding: '16px',
          }}
        >
          <p
            style={{
              fontSize: isMobile ? 13 : 14,
              fontFamily: tok.fontDisplay,
              color: tok.textSecondary,
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            拖拽文件夹到此处，或点击选择
          </p>
          <p
            style={{ fontSize: isMobile ? 10 : 11, fontFamily: tok.fontBody, color: tok.textMuted, textAlign: 'center' }}
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
                fontFamily: tok.fontBody,
                color: tok.textSecondary,
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
              fontFamily: tok.fontBody,
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
            <span style={{ color: tok.textMuted }}>
              共扫描 {importResult.total} 个文件
            </span>
          </div>
        )}

        {/* Status overview: 3 stat cards */}
        <section
          aria-label="导入状态概览"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 48,
          }}
        >
          <StatCard
            dotColor={tok.textMuted}
            title="手动导入"
            status="就绪"
            detail={recentImports.length > 0 ? `最近导入 ${recentImports.length} 张` : '选择文件夹开始导入'}
          />
          <StatCard
            dotColor={comfyuiPath ? tok.success : tok.textMuted}
            title="ComfyUI"
            status={comfyuiDetecting ? '检测中...' : comfyuiPath ? '已连接' : '未连接'}
            detail={comfyuiPath || '点击下方按钮自动检测'}
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
              fontFamily: tok.fontDisplay,
              color: tok.textSecondary,
              borderBottom: `1px solid ${tok.border}`,
              paddingBottom: 12,
            }}
          >
            最近导入
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: `1px solid ${tok.border}`,
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
                      ? `1px solid ${tok.border}`
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
                      color: tok.text,
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
        <section aria-label="高级设置" style={{ borderTop: `1px dotted ${tok.border}`, padding: '12px 0' }}>
          <Collapsible title="高级设置">
            <div>
              {/* ComfyUI Config */}
              <div style={{ marginTop: 24, marginBottom: 40 }}>
                <SectionHeader>ComfyUI 配置</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <SettingRow label="监控文件夹路径">
                    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                      <input
                        type="text"
                        value={comfyuiPath || ''}
                        placeholder="点击右侧按钮自动检测"
                        readOnly
                        aria-label="监控文件夹路径"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={handleDetectComfyui}
                        disabled={comfyuiDetecting}
                        style={{
                          padding: '8px 16px',
                          fontSize: 12,
                          fontWeight: 500,
                          fontFamily: tok.fontDisplay,
                          color: tok.bg,
                          background: comfyuiDetecting ? tok.textMuted : tok.accent,
                          border: 'none',
                          borderRadius: 4,
                          cursor: comfyuiDetecting ? 'wait' : 'pointer',
                          transition: 'background 200ms',
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        {comfyuiDetecting ? '检测中...' : '自动检测'}
                      </button>
                    </div>
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
                            color: tok.text,
                          }}
                        >
                          <input
                            type="checkbox"
                            defaultChecked
                            style={{
                              width: 14,
                              height: 14,
                              accentColor: tok.accent,
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
                    <span style={{ fontSize: 12, color: tok.textSecondary }}>
                      PNG（含 metadata）、JPG、WEBP
                    </span>
                  </SettingRow>
                </div>
              </div>
            </div>
          </Collapsible>
        </section>
      </div>
    </div>
  );
}

/* --- Sub-components --- */

export default ImportPage;
