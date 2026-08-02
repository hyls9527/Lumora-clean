# 性能优化 — 10K+ 图片虚拟滚动性能

> **v0.8.0** | P1 | 预估 2 天

## 目标

10K 图片库滚动帧率 ≥ 30fps，不改变现有瀑布流布局。

## 性能瓶颈（当前）

1. **`images.map()` 全量遍历** — 即使 LazyLoad 替换不可见卡片为占位 div，React 仍需协调完整的 images 数组（40×页数）
2. **ImageCard 重渲染** — 每个 ImageCard 订阅 4 个 zustand store，任意 store 变化触发全部重渲染
3. **动态内联样式** — hover 事件直接操作 `e.currentTarget.style`，阻止 React 批量更新
4. **无滚动节流** — InfiniteScroll 虽用 IntersectionObserver，但筛选/排序操作无去抖
5. **无可视化测量** — 有 usePerformanceMonitor 但不用于 ImageCard 级别

## 改动方案

### 1. 稳定 Key — `src/features/gallery/GalleryPage.tsx`

将 `key={index}` 改为 `key={image.id}`：
- 防止数组插入/删除时全部 ImageCard 卸载重挂
- React 可复用现有 DOM 节点
- 改动量：1 行

### 2. ImageCard 重渲染优化 — `src/components/ui/ImageCard.tsx`

- 将 4 个独立 zustand selector 合并为 1 个，使用 `useShallow` 做浅比较
- hover 内联样式改为 CSS class（`&:hover` 或 data attribute）
- `React.memo` 使用自定义比较函数，只比较 `image.id` 和 `focused`

### 3. 筛选/排序去抖 — `src/stores/imageStore.ts`

`getFilteredImages` 使用 `useMemo` 缓存结果，避免每次渲染都重新过滤。
筛选条件变化时重新计算。

### 4. 性能基准测量

在 `scripts/perf-budget.mjs` 中新增：
- ImageCard 平均渲染耗时 ≤ 5ms
- VirtualScroll 帧率 ≥ 30fps（1000 条数据基准）

通过 `usePerformanceMonitor('ImageCard')` 采集数据。

## 执行计划（两阶段并行）

```
Phase 1 ─────────────────────────────────────
  Agent A: GalleryPage.tsx (稳定 key) + ImageCard.tsx (store + CSS)
  Agent B: imageStore.ts (useMemo 缓存) + perf-budget.mjs 更新

Phase 2 (验证) ──────────────────────────────
  全量测试 + 性能基线验证
```
