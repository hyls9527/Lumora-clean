# 语义搜索 / 以图搜图真实环境验收与 10K 性能基准

> 记录日期：2026-08-14　环境：Windows 11，CPU（torch 2.8.0+cpu），Ollama `nomic-embed-text`（768 维），CLIP `ViT-B-32 laion2b_s34b_b79k`（512 维）

## 结论

- 语义搜索（Ollama 文本嵌入）真实环境端到端通过：查询 “automobile” 时 “a red sports car” 的图片排在 “mountain lake” 之前。
- 以图搜图（CLIP 图片嵌入）真实环境端到端通过：以猫的照片为查询，自身相似度 > 0.9 且排名第一。
- 10K 语义搜索总延迟 **68ms**（热嵌入 39ms + KNN 29ms），预算 1.5s，余量约 22 倍。

## 架构说明（本次修复）

文本嵌入（Ollama nomic，768 维）与图片嵌入（CLIP，512 维）维度不同、跨空间相似度无意义，因此拆成两个独立的 sqlite-vec 索引（数据库迁移 V9）：

| 索引 | 维度 | 写入命令 | 查询命令 | 用途 |
|------|------|----------|----------|------|
| `vec_embeddings` | 768 | `generate_embedding_for_image_cmd` / `embed_missing_cmd` | `search_semantic_cmd` | 文本语义搜索 |
| `vec_embeddings_clip` | 512 | `embed_clip_missing_cmd` | `search_semantic_image_cmd` | 以图搜图 |

同时修复了 Windows 下直接执行 `.py` sidecar 报 `os error 193`（不是有效的 Win32 应用程序）的问题：CLIP 与审美评分 sidecar 现在统一经 Python 解释器启动（`LUMORA_PYTHON` 可覆盖解释器路径）。

## 复跑方式

```bash
# 前置：Ollama 已运行并装有 nomic-embed-text；CLIP 权重已缓存（离线可用）
cargo test --lib --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture --test-threads=1 real_ ten_k_
```

三个用例均为 `#[ignore]`（CI 无 Ollama/CLIP，默认跳过）：

- `real_semantic_search_ollama_e2e`：真实 Ollama 文本嵌入 + KNN 排序断言
- `real_image_search_clip_e2e`：真实 CLIP 图片嵌入 + 以图搜图排序断言
- `ten_k_semantic_search_latency_budget`：1 万条 768 维向量下的热嵌入 + KNN 延迟预算（<1.5s）

## TC-PERF-002（10K 滚动 ≥30fps）

仍属人工验收项（无头环境帧率不可靠）。虚拟滚动链路（`VirtualGrid` + `LazyLoad` + `InfiniteScroll`）已有单测与 `scripts/perf-budget.mjs` 预算门禁；发布前建议在 VM（`test-vm/`）用真实 10K 图库人工确认一次帧率后勾选路线图。
