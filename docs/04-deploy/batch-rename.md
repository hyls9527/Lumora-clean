# 批量重命名 — 设计文档

> **v0.8.0** | P1 | 预计 1 天

## 目标

允许用户按模板批量重命名图片文件（磁盘文件 + DB 记录同步更新），
作为导出前预处理步骤。

## 入口

1. **Gallery BatchToolbar** — 选中图片后显示「重命名」按钮，弹出 RenameDialog
2. **ExportPage** — 导出时已有模板输入框，保持现有交互不变

## 方案决策

| 决策 | 选项 |
|------|------|
| 生效范围 | 重命名磁盘文件 + 更新 DB |
| 冲突处理 | 自动追加数字后缀 (file → file, file_1, file_2...) |
| 交互 | 输入模板 → 预览新旧文件名列表 → 确认执行 |
| 模板变量 | 复用现有 `build_filename()` 系统 |

## 模板变量（复用 export.rs）

| 变量 | 来源 |
|------|------|
| `{name}` | 原始文件名 stem |
| `{id}` | 图片 UUID |
| `{date}` | `created_at` 日期部分 |
| `{rating}` | 整数评分 |
| `{tags}` | 逗号拼接标签 |
| `{model}` | `metadata_json.model` |
| `{prompt}` | `metadata_json.prompt` |
| `{seed}` | `metadata_json.seed` |
| `{width}` | 图片宽度 |
| `{height}` | 图片高度 |
| `{format}` | 原始格式 |

## 模块划分

### Rust 后端 — `src-tauri/src/commands/rename.rs`

```
batch_rename(ids: Vec<String>, template: String, dryRun: bool) -> RenameResult
```

**`RenameResult`**:
```rust
struct RenameItem {
    id: String,
    old_name: String,    // 旧文件名 (不含路径)
    new_name: String,    // 新文件名 (不含路径)
    status: String,      // "ok" | "conflict" | "error"
    error: Option<String>,
}

struct RenameResult {
    items: Vec<RenameItem>,
    renamed: u32,
    skipped: u32,
    errors: u32,
}
```

**逻辑**:
1. 遍历 `ids`，对每张图片调用 `build_filename()` 生成新文件名
2. 检查目标文件名冲突，冲突则追加数字后缀
3. `dryRun=true` 时只计算新文件名不执行
4. `dryRun=false` 时：重命名磁盘文件 → 更新 DB (`UPDATE images SET file_name=?, file_path=? WHERE id=?`)
5. 用事务包裹，单条目失败不阻断整体

**注册**: 在 `commands/mod.rs` 和 `lib.rs` invoke_handler 注册

### 前端组件 — `src/components/rename/RenameDialog.tsx`

```
RenameDialog
  Props: { open, imageIds, onClose, onComplete }
  State: template, previewItems[], loading, result
```

**交互流程**:
1. 打开对话框 → 显示选中图片数量
2. 用户输入模板字符串 (placeholder: `{name}_{model}_{seed}`)
3. 输入时 debounce 调用 `dryRun=true` 获取预览
4. 预览表格：旧文件名 → 新文件名（冲突项标黄）
5. 用户点击「执行重命名」→ `dryRun=false`
6. 执行完成后显示结果摘要

### API 层 — `src/lib/api/images.ts`

```ts
batchRename(ids: string[], template: string, dryRun?: boolean): Promise<RenameResult>
```

### i18n — `src/i18n/{en,zh}.json`

新增 `rename` 命名空间：
```
rename: {
  title: "批量重命名" / "Batch Rename",
  template: "命名模板",
  templatePlaceholder: "{name}_{model}_{seed}",
  preview: "预览",
  execute: "执行重命名",
  cancel: "取消",
  conflict: "文件名冲突",
  result: "成功 {renamed} 张，跳过 {skipped} 张",
  newName: "新文件名",
  oldName: "原文件名",
}
```

## BatchToolbar 集成

在 `BatchToolbar` 新增 `onRename` 回调 prop：
```tsx
<BatchToolbar
  count={selectedIds.size}
  onRename={() => setRenameOpen(true)}
  ...
/>
<RenameDialog open={renameOpen} imageIds={[...selectedIds]} ... />
```

## ExportPage 集成

ExportPage 已有关联的 rename 模板输入，保持现有交互不变。

## 边界情况

| 场景 | 处理 |
|------|------|
| 选中 0 张 | RenameDialog 不打开 |
| 模板为空 | 按钮 disabled，提示输入模板 |
| 文件名完全不变 | 跳过（不计入冲突/成功） |
| 文件名含非法字符 | build_filename 已做 sanitize |
| 文件被其他程序占用 | 捕获错误，标记为 error，继续处理其余 |
| 超大选中量 (1000+) | 前端分页预览（仅显示前 50 条） |
