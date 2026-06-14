# UI 合约 — Lumora

> 每个组件的 API、状态、交互、无障碍规范
> 实现前必须读，验收时必须对

---

## 全局约定

### 组件 API 规范

```typescript
// 所有组件使用 Props 接口，不用 type
interface ComponentProps {
  // 必填 props 在前
  items: Item[]
  // 可选 props 在后，有默认值
  variant?: 'default' | 'compact'  // 默认 'default'
  onSelect?: (id: string) => void   // 事件回调用 on 前缀
  className?: string                // 允许外部覆盖样式
}
```

### 状态模型（四态）

每个数据驱动的组件必须处理 4 种状态：

| 状态 | 条件 | 渲染 |
|------|------|------|
| **loading** | 数据加载中 | Skeleton 骨架屏 |
| **empty** | 数据为空 | EmptyState 组件 |
| **error** | 加载失败 | 错误信息 + 重试按钮 |
| **success** | 数据就绪 | 正常渲染 |

```typescript
// 标准四态模式
function DataComponent({ data, isLoading, error, onRetry }) {
  if (isLoading) return <Skeleton />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!data?.length) return <EmptyState />
  return <DataList data={data} />
}
```

### 响应式断点

| 断点 | 宽度 | 列数 | 侧边栏 |
|------|------|------|--------|
| mobile | < 768px | 2 列 | 隐藏，Sheet 触发 |
| tablet | 768-1024px | 3 列 | 折叠为图标 |
| desktop | 1024-1440px | 4 列 | 展开 220px |
| wide | > 1440px | 5 列 | 展开 220px |

### 无障碍要求

- 所有交互元素必须有 `aria-label`
- 键盘导航：Tab 遍历、Enter 激活、Escape 关闭
- 焦点可见：2px gold ring, offset 2px
- 颜色不是唯一的信息通道（配合图标/文字）

---

## 组件合约

### Sidebar

```typescript
interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  stats: { images: number; favorites: number; avgRating: number }
  trashCount: number
}
type View = 'gallery' | 'curation' | 'dashboard' | 'trash' | 'settings'
```

| 行为 | 说明 |
|------|------|
| Logo 点击 | 无动作（品牌展示） |
| 搜索框 | 实时过滤，⌘K 聚焦 |
| 导航项点击 | 切换页面，active 态黑底白字 |
| 回收站角标 | 显示 trashCount，红色圆形 |
| 统计区 | 只读，实时更新 |

### ImageGrid

```typescript
interface ImageGridProps {
  images: Image[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onDetail: (image: Image) => void
  onFavorite: (id: string) => void
  onRate: (id: string, rating: number) => void
  columns?: 2 | 3 | 4 | 5  // 默认 4
  isLoading?: boolean
}
```

| 行为 | 说明 |
|------|------|
| 点击卡片 | 打开 DetailPanel |
| 右键卡片 | ContextMenu（收藏/评分/删除/标签） |
| 悬停卡片 | 底部渐变遮罩 + 操作按钮 |
| 多选 | Ctrl/⌘ + 点击，或 Shift + 点击范围选 |
| 滚动 | 虚拟化（@tanstack/react-virtual），1000 张不卡 |
| 加载 | 骨架屏占位 |
| 空状态 | EmptyState 组件 |

### DetailPanel

```typescript
interface DetailPanelProps {
  image: Image | null
  onClose: () => void
  onFavorite: (id: string) => void
  onRate: (id: string, rating: number) => void
  onTagAdd: (imageId: string, tagName: string) => void
  onTagRemove: (imageId: string, tagId: string) => void
}
```

| 行为 | 说明 |
|------|------|
| 打开 | Sheet 从右侧滑入，320px 宽 |
| 关闭 | 点击 X 或按 Escape |
| 图片预览 | 点击图片打开全屏灯箱 |
| 标签 | 添加/删除标签，pill 形 |
| 评分 | 5 星评分，点击即设 |
| 元数据 | 只读展示（路径、尺寸、格式、日期） |
| AI 分析 | 只读展示（subject/style/composition/visual） |
| 生成参数 | 只读展示（prompt/model/sampler/steps） |

### SearchBar

```typescript
interface SearchBarProps {
  query: string
  onQueryChange: (query: string) => void
  mode: 'text' | 'structured' | 'semantic'
  onModeChange: (mode: 'text' | 'structured' | 'semantic') => void
  filters: Filter[]
  onFilterAdd: (filter: Filter) => void
  onFilterRemove: (index: number) => void
  onClear: () => void
  resultCount: number
}
```

| 行为 | 说明 |
|------|------|
| 输入 | 实时搜索，300ms 防抖 |
| 模式切换 | 三个 pill 按钮切换搜索模式 |
| 过滤标签 | 点击维度标签添加过滤 |
| 清除 | X 按钮清除所有过滤 |
| 结果计数 | 右侧显示 "N 张图片" |
| 快捷键 | ⌘K 聚焦，Escape 清除 |

### CurationPage

```typescript
interface CurationPageProps {
  images: Image[]
  currentIndex: number
  onNavigate: (index: number) => void
  onDecision: (imageId: string, decision: 'keep' | 'maybe' | 'reject') => void
  onRate: (imageId: string, rating: number) => void
  scores: ScoreBreakdown | null
  aiWeight: number
  onAiWeightChange: (weight: number) => void
}
```

| 行为 | 说明 |
|------|------|
| 导航 | ← → 箭头或键盘方向键 |
| 决策 | Keep(绿) / Maybe(金) / Reject(红) 按钮 |
| 评分 | 5 星评分 |
| 分数 | 6 维评分条，颜色编码 |
| 标签 | 只读展示 |
| Prompt | 只读展示 |
| 快捷键 | K=Keep, M=Maybe, R=Reject, ←→=导航 |

### SettingsPage

```typescript
interface SettingsPageProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}
type SettingsTab = 'appearance' | 'language' | 'gpu' | 'data' | 'shortcuts' | 'about'
```

| Tab | 内容 |
|-----|------|
| Appearance | 主题切换、强调色选择 |
| Language | 中英文切换 |
| GPU | GPU 状态、提供者选择 |
| Data | 备份/恢复、导入/导出 |
| Shortcuts | 快捷键自定义 |
| About | 版本、许可证、更新检查 |

### DashboardPage

```typescript
interface DashboardPageProps {
  stats: LibraryStats
  isLoading: boolean
}
interface LibraryStats {
  totalImages: number
  storageUsed: string
  avgRating: number
  favorites: number
  analyzed: number
  rated: number
  formatDistribution: Record<string, number>
  ratingDistribution: Record<number, number>
  styleDistribution: Record<string, number>
}
```

| 区域 | 内容 |
|------|------|
| 统计卡片 | 总图片、存储、平均评分、收藏 |
| 覆盖率 | 已分析、已评分、已收藏进度条 |
| 分布图 | 风格、格式、评分分布 |

### EmptyState

```typescript
interface EmptyStateProps {
  icon?: LucideIcon     // 默认 Image
  title: string         // "图库为空"
  description?: string  // "导入图片开始使用"
  action?: { label: string; onClick: () => void }
}
```

### ErrorState

```typescript
interface ErrorStateProps {
  title?: string        // "加载失败"
  message: string       // 错误详情
  onRetry?: () => void  // 重试按钮
}
```

### Skeleton

```typescript
interface SkeletonProps {
  variant: 'card' | 'list' | 'detail' | 'text'
  count?: number        // 默认 1
}
```

---

## Store 合约

### useImageStore

```typescript
interface ImageStore {
  // State
  images: Image[]
  selectedIds: Set<string>
  detailImage: Image | null
  sortBy: 'date' | 'rating' | 'size'
  searchQuery: string
  isLoading: boolean
  error: string | null

  // Actions
  loadImages: () => Promise<void>
  setSortBy: (sort: 'date' | 'rating' | 'size') => void
  setSearchQuery: (query: string) => void
  setDetailImage: (image: Image | null) => void
  toggleSelect: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  toggleFavorite: (id: string) => Promise<void>
  setRating: (id: string, rating: number) => Promise<void>
  deleteImages: (ids: string[]) => Promise<void>
}
```

### useFilterStore

```typescript
interface FilterStore {
  filters: Filter[]
  searchMode: 'text' | 'structured' | 'semantic'
  resultCount: number

  addFilter: (filter: Filter) => void
  removeFilter: (index: number) => void
  clearFilters: () => void
  setSearchMode: (mode: 'text' | 'structured' | 'semantic') => void
}
```

### useCurationStore

```typescript
interface CurationStore {
  currentIndex: number
  decisions: Record<string, 'keep' | 'maybe' | 'reject'>
  scores: Record<string, ScoreBreakdown>
  aiWeight: number
  sessions: Session[]

  navigate: (direction: 'next' | 'prev') => void
  recordDecision: (imageId: string, decision: 'keep' | 'maybe' | 'reject') => void
  setRating: (imageId: string, rating: number) => void
  setAiWeight: (weight: number) => void
}
```

### useSettingsStore

```typescript
interface SettingsStore {
  theme: 'warm-white' | 'light' | 'auto'
  language: 'en' | 'zh'
  accentColor: string
  gpuProvider: string
  keybindings: Record<string, string>

  setTheme: (theme: 'warm-white' | 'light' | 'auto') => void
  setLanguage: (lang: 'en' | 'zh') => void
  setAccentColor: (color: string) => void
}
```

---

## 事件合约（Tauri IPC → 前端）

| 事件 | 方向 | 说明 |
|------|------|------|
| `import-progress` | 后端→前端 | 导入进度更新 |
| `analysis-progress` | 后端→前端 | 分析进度更新 |
| `crash-recovery` | 后端→前端 | 崩溃恢复通知 |
| `startup-complete` | 后端→前端 | 启动完成 |
| `integrity-warning` | 后端→前端 | 文件完整性警告 |
| `pending-maybe-reminder` | 后端→前端 | Maybe 决策提醒 |

---

## 验收检查清单

每个组件实现后必须通过：

- [ ] 4 种状态正确渲染（loading/empty/error/success）
- [ ] 键盘可操作（Tab/Enter/Escape）
- [ ] 焦点可见（gold ring）
- [ ] 响应式 4 断点正确
- [ ] aria-label 完整
- [ ] 无 console.error
- [ ] TypeScript 零错误
- [ ] 符合 DESIGN.md 色彩/字体/间距

---

*本合约是 Lumora UI 的实现基线。所有组件必须遵循此合约。*
