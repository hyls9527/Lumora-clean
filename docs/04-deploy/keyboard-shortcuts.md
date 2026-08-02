# 键盘快捷键完善

> **v0.8.0** | P2 | 预估 1 天

## 目标

补齐缺失的全局快捷键，修复现有快捷键问题，新增快捷键帮助面板。

## 改动清单

### 1. `⌘A` 全选/取消全选 — `src/features/gallery/GalleryPage.tsx`

在 `useKeyboardNav` 中新增 `onSelectAll` 回调：
- 按 `⌘A`：全选当前页所有图片
- 再次按 `⌘A`：取消全选

### 2. `⌘I`/`⌘R` 全局注册 — `src/App.tsx`

当前命令面板只「显示」快捷键但不注册全局监听。在 App.tsx 的 `window.keydown` 监听中补充：
- `⌘I` → `navigate('/import')`
- `⌘R` → `navigate('/gallery')` + 刷新

### 3. 方向键网格列感知 — `src/hooks/useKeyboardNav.ts` + `GalleryPage.tsx`

当前 `ArrowLeft` 行为同 `ArrowUp`（都是 `prev-1`）。
改为真正的网格导航：
- `ArrowLeft` → `prev - 1`（同列）
- `ArrowRight` → `prev + 1`
- `ArrowUp` → `prev - columnCount`
- `ArrowDown` → `prev + columnCount`

需要 `columnCount` 参数传入 useKeyboardNav。

### 4. `Home`/`End` — `src/features/gallery/GalleryPage.tsx`

在 useKeyboardNav 中新增：
- `Home` → `focusedIndex = 0`
- `End` → `focusedIndex = images.length - 1`

### 5. `?` 快捷键帮助面板 — 新建 `src/components/ui/ShortcutsPanel.tsx`

- 全局 `?` / `Shift+/` 触发
- 模态浮层，展示所有可用快捷键分组列表
- 按 `Escape` 关闭
- 分组：导航、图库操作、全局

### 快捷键总表（帮助面板内容）

| 快捷键 | 行为 | 作用域 |
|--------|------|--------|
| `↑` `↓` | 上/下移动焦点 | Gallery |
| `←` `→` | 左/右移一列 | Gallery |
| `Enter` | 打开详情 | Gallery |
| `Space` | 切换选中 | Gallery |
| `⌘A` | 全选/取消全选 | Gallery |
| `Delete`/`Backspace` | 移到回收站 | Gallery |
| `F` | 切换收藏 | Gallery |
| `1`-`5` | 评分 | Gallery |
| `Home` | 跳到第一张 | Gallery |
| `End` | 跳到最后一张 | Gallery |
| `Escape` | 取消/关闭 | 全局 |
| `⌘K` | 命令面板 | 全局 |
| `⌘I` | 导入 | 全局 |
| `⌘R` | 刷新图库 | 全局 |
| `?` | 快捷键帮助 | 全局 |

## 执行计划（三路并行）

```
Phase 1 ─────────────────────────────────────
  Agent A: ShortcutsPanel 组件 + 测试
  Agent B: useKeyboardNav 增强（网格感知+Home/End+⌘A）+ GalleryPage 集成 + 测试
  Agent C: App.tsx ⌘I/⌘R 全局注册 + 测试
```
