# MCP 接入（AI 访问 Lumora 图库）

Lumora 内置一个 MCP（Model Context Protocol）Streamable HTTP 服务端，让 Claude、Cursor、Codex 等 AI 客户端直接读写图库信息。

## 连接信息

- **端点**：`http://127.0.0.1:{port}/mcp`（端口与局域网访问端口相同，默认从 8079 开始）
- **鉴权**：与局域网访问共用同一个 token，通过 `Authorization: Bearer <token>` 请求头传入
- **token 位置**：设置页 → 「局域网访问」卡片；token 已持久化，重启应用后不变

## 暴露的工具

AI 可以浏览、搜索、理解图库，也可以执行管理操作（标签、收藏、回收站）。**评分只保留给人工**，AI 无法调用任何评分相关工具。

| 工具 | 说明 | 主要参数 |
| --- | --- | --- |
| `import_images` | 从文件夹导入单图（**2x2 四宫格会被门禁拒绝**，不入库；reference 模式记录路径） | `path` |
| `list_images` | 按时间倒序分页列出图片 | `page`、`per_page` |
| `search_images` | FTS5 全文搜索（prompt / 元数据 / 文件路径） | `query`、`limit` |
| `get_image` | 单张图片完整信息（含标签、最新 AI 分析、嵌入状态） | `id` |
| `get_image_file` | 读取图片内容（自动缩放至最大 1024px 的 PNG，供视觉模型使用） | `id` |
| `list_tags` | 列出全部标签及使用次数 | — |
| `get_stats` | 图库统计（总数、格式、评分、热门标签） | — |
| `semantic_search` | 语义搜索：用自然语言找图（需要 Ollama + nomic-embed-text，且图库已生成嵌入） | `query`、`limit`、`min_similarity` |
| `create_tag` | 创建标签 | `name`、`color` |
| `add_tag_to_image` | 给图片打标签 | `image_id`、`tag_id` |
| `remove_tag_from_image` | 移除图片标签 | `image_id`、`tag_id` |
| `toggle_favorite` | 切换收藏状态 | `id` |
| `move_to_trash` | 移入回收站（可恢复的软删除） | `id` |
| `restore_from_trash` | 从回收站恢复 | `id` |

## 边界

- **评分 / 审美评分：仅人工**。MCP 不提供 `update_rating`、`score_*` 等写工具，AI 无法给图片打分。
- **不可逆操作未开放**：永久删除、清空回收站不在 MCP 工具中，AI 只能做可恢复的移入回收站。

## 客户端配置示例

### Claude Desktop

编辑 `claude_desktop_config.json`（Claude 菜单 → Settings → Developer → Edit Config）：

```json
{
  "mcpServers": {
    "lumora": {
      "url": "http://127.0.0.1:8079/mcp",
      "headers": {
        "Authorization": "Bearer 你的token"
      }
    }
  }
}
```

### Cursor

项目根目录 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "lumora": {
      "url": "http://127.0.0.1:8079/mcp",
      "headers": {
        "Authorization": "Bearer 你的token"
      }
    }
  }
}
```

### MCP Inspector（调试用）

```bash
npx @modelcontextprotocol/inspector
```

在 Inspector 中连接 `http://127.0.0.1:8079/mcp`，并在请求头中加入 `Authorization: Bearer <token>`。

## 注意事项

- 端口和 token 每次启动都会复用持久化的 token；如果手动清除了 `settings.json`，会重新生成。
- 默认只允许 `localhost` / `127.0.0.1` / `::1` 的 Host 访问 `/mcp`，防止 DNS rebinding；跨设备访问请使用本机地址或自行调整。
- `semantic_search` 依赖 Ollama（`nomic-embed-text`）和库内嵌入数据；未嵌入的图库会返回可读的错误信息。
- `get_image_file` 返回的图片已缩放到 1024px 以内，避免超大原始文件超出 AI 客户端限制。
