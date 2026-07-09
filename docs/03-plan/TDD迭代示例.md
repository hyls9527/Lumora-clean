# 迭代代码开发示例 — TDD 循环

> 以 `search_images_advanced` 功能为例，展示完整的 RED → GREEN → REFACTOR 循环。

## 功能：字段范围搜索

用户可以选择特定字段（prompt/seed/model）搜索图片，而非全文搜索。

## RED 阶段：编写失败测试

```typescript
// src/lib/api/__tests__/images.test.ts

describe('searchImagesAdvanced', () => {
  it('should invoke search_images_advanced with query and field', async () => {
    const mockInvoke = vi.mocked(tauri.invoke);
    mockInvoke.mockResolvedValue([{ id: '1', filePath: '/test.png' }]);

    const result = await searchImagesAdvanced('cat', 'prompt');

    expect(mockInvoke).toHaveBeenCalledWith('search_images_advanced', {
      query: 'cat',
      field: 'prompt',
    });
    expect(result).toHaveLength(1);
  });

  it('should work without field parameter (defaults to all)', async () => {
    const mockInvoke = vi.mocked(tauri.invoke);
    mockInvoke.mockResolvedValue([]);

    await searchImagesAdvanced('test');

    expect(mockInvoke).toHaveBeenCalledWith('search_images_advanced', {
      query: 'test',
      field: undefined,
    });
  });

  it('should handle empty results', async () => {
    const mockInvoke = vi.mocked(tauri.invoke);
    mockInvoke.mockResolvedValue([]);

    const result = await searchImagesAdvanced('nonexistent', 'seed');

    expect(result).toEqual([]);
  });
});
```

**运行测试：** `npx vitest run` → ❌ FAIL（函数不存在）

## GREEN 阶段：最小实现

```typescript
// src/lib/api/images.ts

export async function searchImagesAdvanced(
  query: string,
  field?: string,
): Promise<TauriImageRecord[]> {
  const raw = await invoke<TauriImageRecord[]>('search_images_advanced', {
    query,
    field: field || undefined,
  });
  return raw;
}
```

```rust
// src-tauri/src/commands/images.rs

#[tauri::command]
pub fn search_images_advanced(
    db: tauri::State<'_, DbHandle>,
    query: String,
    field: Option<String>,
) -> AppResult<Vec<ImageRecord>> {
    let field = field.unwrap_or_else(|| "all".to_string());
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;

    if field == "all" || field.is_empty() {
        // 委托给 FTS5
        return search_images(db, query);
    }

    if field == "seed" {
        // seed 是数值，精确匹配
        let seed_val: i64 = query.trim().parse().unwrap_or(0);
        let mut stmt = conn.prepare(
            "SELECT * FROM images
             WHERE json_extract(metadata_json, '$.seed') = ?1 AND deleted = 0
             ORDER BY imported_at DESC LIMIT 200",
        )?;
        let items = stmt.query_map(params![seed_val], row_to_record)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(items);
    }

    // 文本字段，LIKE 匹配
    let json_path = match field.as_str() {
        "prompt" => "$.prompt",
        "negative_prompt" => "$.negative_prompt",
        "model" => "$.model",
        "sampler" => "$.sampler",
        _ => return Ok(vec![]),
    };
    // ... LIKE 查询
}
```

**运行测试：** `npx vitest run` → ✅ PASS

## REFACTOR 阶段：优化

```rust
// 重构点：
// 1. 提取 escape_like() 辅助函数
// 2. json_path 映射使用常量
// 3. 添加 FTS5 特殊字符转义

fn escape_like(query: &str) -> String {
    query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}
```

**运行测试：** `npx vitest run` → ✅ PASS（行为不变）

## 完整 TDD 循环记录

| 功能 | RED | GREEN | REFACTOR | 测试数 |
|------|-----|-------|----------|--------|
| import_images | 3 | ✅ | 提取 scan_folder | 3 |
| search_images | 2 | ✅ | FTS5 转义 | 2 |
| search_images_advanced | 3 | ✅ | escape_like | 3 |
| list_favorites | 2 | ✅ | — | 2 |
| batch_soft_delete | 2 | ✅ | 事务封装 | 2 |
| toggle_favorite | 3 | ✅ | 乐观更新 | 3 |
| analyze_image_cmd | 2 | ✅ | 超时处理 | 2 |
| search_semantic_cmd | 2 | ✅ | 缓存集成 | 2 |
| **总计** | **19** | | | **19** |
