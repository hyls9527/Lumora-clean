# 批量格式转换

> **v0.9.0** | P1 | 预估 2 天

## 目标

1. 独立格式转换功能（选中图片 → 选格式 → 原地转）
2. 导出页面增加更多目标格式

## 现状

- 格式转换只存在于导出流程中，无独立功能
- Rust `image` crate 已启用 png/jpeg/webp/avif/bmp/gif/tiff 全部 feature
- 但 `export_single` 的 match 只实现了 png/jpg/webp 三种写入

## 改动

### Rust 后端 — `src-tauri/src/commands/export.rs`

**1. 扩展 `export_single` match 分支**，增加：
- `avif` → `image::ImageFormat::Avif`
- `bmp` → `image::ImageFormat::Bmp`
- `gif` → `image::ImageFormat::Gif`
- `tiff` → `image::ImageFormat::Tiff`

**2. 新增 `batch_convert` 命令**：
```rust
#[tauri::command]
fn batch_convert(db: State<DbHandle>, ids: Vec<String>, target_format: String) -> AppResult<ConvertResult>
```
- 遍历 ids，对每张图片：读原始文件 → 解码 → 编码为目标格式 → **覆盖写入同一位置**（扩展名改为目标格式）
- 更新 DB 中的 `format` 和 `file_path` 字段
- 失败不阻断整体

### 前端 API — `src/lib/api/images.ts`

```ts
interface ConvertResult { success: number; failed: number; }
function batchConvert(ids: string[], targetFormat: string): Promise<ConvertResult>
```

### 前端组件 — `src/components/convert/ConvertDialog.tsx`

- 在 Gallery 打开，选中图片后点击 BatchToolbar 的「转换格式」按钮
- 对话框：选择目标格式（PNG/JPEG/WebP/AVIF/BMP/GIF/TIFF）+ 确认
- 确认后调用 `batchConvert`，显示进度/结果

### 导出增强 — `src/features/export/ExportPage.tsx`

格式选项从 `original/png/jpg/webp` 扩展为：
`original/png/jpg/webp/avif/bmp/gif/tiff`

### i18n

新增 `convert` 命名空间（标题、格式名、结果等）。

## 执行计划

```
Phase 1 ─────────────────────────────────────
  Agent A: Rust export_single 扩展 + batch_convert 命令 + 测试

Phase 2 (并行) ───────────────────────────────
  Agent B: ConvertDialog + BatchToolbar 集成 + 测试
  Agent C: ExportPage 格式扩展 + 测试
```
