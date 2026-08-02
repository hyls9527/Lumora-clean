# 图片信息增强 — 显示完整 SD 生成参数

> **v0.8.0** | P1 | 预估 1 天

## 目标

在 DetailModal 中展示完整的 Stable Diffusion 生成参数，
让用户无需外部工具即可查看 Steps / CFG Scale / Sampler / Seed / Negative Prompt 等关键信息。

## 现状

Rust 后端（`metadata/sd.rs`）已完整解析 A1111 和 ComfyUI 格式的全部 SD 参数，
但前端 `parseMetadata()` 只提取了 `model` / `prompt` / `tags` 三个字段，
其余参数（`seed`, `steps`, `cfg_scale`, `sampler`, `negative_prompt` 等）全部丢弃。

## 修改方案

### 1. 类型层 — `src/types/image.ts`

在 `ImageRecord` 中新增字段（均为 `string | undefined`，不破坏向后兼容）：

```ts
export interface ImageRecord {
  // ...现有字段不变...
  /** SD 生成参数（从 metadata_json 解析） */
  seed?: string;
  steps?: string;
  cfgScale?: string;
  sampler?: string;
  negativePrompt?: string;
}
```

### 2. API 映射层 — `src/lib/api/images.ts`

扩展 `parseMetadata()`，提取全部 SD 参数：

```ts
function parseMetadata(json: string | null) {
  // 原有: model, prompt, tags
  // 新增: seed, steps, cfgScale, sampler, negativePrompt
}
```

同时更新 `toImageRecord()` 映射逻辑。

### 3. UI 层 — `src/components/ui/DetailModal.tsx`

在 MetaPanel 中「模型」行下方插入 **SD 参数区域**（仅当有参数时显示）：

```
┌─────────────────────────────────┐
│ 模型: sd_xl_base_1.0           │  ← 现有
│ ┌─ SD 参数 ─────────────────┐  │  ← 新增 section
│ │ Steps  20  CFG   7        │  │
│ │ Sampler Euler  Seed  42   │  │
│ │ Negative: (worst quality)  │  │
│ └────────────────────────────┘  │
│ 评分: ★★★★☆                     │  ← 现有
└─────────────────────────────────┘
```

布局：4列网格（每格: 标签 + 值），第5行占满整行显示 negativePrompt。
如果某字段为空/undefined，该格跳过。

### 4. 边界情况

| 场景 | 处理 |
|------|------|
| 图片无 metadata_json（如非 AI 图） | 整个 SD 参数区域不渲染 |
| Partially 空字段（有 steps 但无 seed） | 有值的显示，无值的跳过 |
| 参数值超长（如超长 negative prompt） | text-overflow ellipsis，hover 显示完整值 |
| 旧数据（升级前导入的图片） | seed/steps 等为 undefined，不展示对应格 |

## 不变的部分

- Rust 后端不动（metadata_json 已包含完整数据）
- `src/lib/tauri.ts` 不动
- `ImageRecord` 的序列化/反序列化不动（`seed` 等通过 parseMetadata 从 JSON 提取，不是独立 DB 字段）
- i18n 不动（字段名使用通用英文术语，AI 创作者习惯看英文）

## 执行计划（两阶段并行）

```
Phase 1 ──────────────────────────────────────
  Agent A: types/image.ts + lib/api/images.ts
           (类型和 API 映射紧耦合，放一个 agent)
           + 类型/API 层的测试

Phase 2 (等 Phase 1 完成后启动) ─────────────
  Agent B: components/ui/DetailModal.tsx
           (SD 参数区域 UI 渲染)
           + 组件测试
```

**为什么不分三路**：UI 组件强依赖 API 返回的新字段结构，
强行并行会导致 Agent B 等 Agent A 完成才能编译，空转等待。
两阶段是实际可并行度的上限。
