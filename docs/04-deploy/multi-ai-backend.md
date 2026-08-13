# 多 AI 后端（Ollama / OpenAI 兼容）

> v1.0 底座能力：语义搜索嵌入与视觉分析可切换后端，无需重启。

## 后端选择

| provider | 嵌入（语义搜索） | 视觉分析（AI 分析 / 自动标签） |
|----------|------------------|-------------------------------|
| `ollama`（默认） | `nomic-embed-text` | `llava:latest` |
| `openai` | `text-embedding-3-small` | `gpt-4o-mini` |

OpenAI 模式使用标准的 `/v1/embeddings` 与 `/v1/chat/completions` 接口，任何兼容服务（OpenAI、Azure OpenAI、DeepSeek、本地 vLLM 等）填对 Base URL 即可。

## 配置来源（优先级从高到低）

1. 设置页「AI 后端」保存到 `settings.json`（键前缀 `ai.`）
2. 环境变量
3. 内置默认值

| 设置键 | 环境变量 | 默认值 |
|--------|----------|--------|
| `ai.provider` | `LUMORA_AI_PROVIDER` | `ollama` |
| `ai.openai_base_url` | `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `ai.openai_api_key` | `OPENAI_API_KEY` | 空（未配置时给出友好报错） |
| `ai.openai_embedding_model` | `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `ai.openai_vision_model` | `OPENAI_VISION_MODEL` | `gpt-4o-mini` |
| `ai.ollama_embedding_model` | — | `nomic-embed-text` |
| `ai.ollama_vision_model` | — | `llava:latest` |

## 注意

- OpenAI 嵌入维度与 Ollama `nomic-embed-text`（768）可能不同（如 `text-embedding-3-small` 为 1536）。切换后端后需要重建文本索引：删除旧向量或使用「补齐索引」按新维度重新生成；`search_semantic_cmd` 会自动校验维度并给出友好错误。
- 视觉索引（CLIP 512 维）始终本地生成，与 AI 后端无关。
- API Key 只存本地 `settings.json`，不进入日志与导出（与既有 `.env` 策略一致）。

## 代码依据

- 后端：`src-tauri/src/provider.rs`（配置加载 / 分发 / OpenAI 请求与解析）
- 前端：`src/lib/api/aiProvider.ts`、`src/features/settings/SettingsPage.tsx`（AI 后端区块）
