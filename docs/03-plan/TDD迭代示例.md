# TDD 迭代示例 — Lumora

> **审计原则**：每个测试用例必须追溯到具体代码。

## 1. TDD 流程

```
RED → GREEN → REFACTOR
  │       │        │
  │       │        └── 优化代码，保持测试通过
  │       └─────────── 最简实现让测试通过
  └─────────────────── 编写失败的测试用例
```

---

## 2. 示例：导入图片功能 (import_images)

### 2.1 RED 阶段 — 编写测试

**测试文件**：`src/lib/api/__tests__/images.test.ts`

```typescript
describe('importImages', () => {
  it('should import images from folder', async () => {
    const result = await importImages('/path/to/folder');
    expect(result.imported).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should skip duplicate images', async () => {
    const result1 = await importImages('/path/to/folder');
    const result2 = await importImages('/path/to/folder');
    expect(result2.skipped).toBe(result1.imported);
  });

  it('should extract metadata from PNG', async () => {
    const result = await importImages('/path/to/png/folder');
    const item = result.items[0];
    expect(item.model).toBeDefined();
    expect(item.prompt).toBeDefined();
  });
});
```

**Rust 测试**：`src-tauri/src/commands/images/import.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_folder_returns_image_files() {
        let entries = scan_folder("test_data/images").unwrap();
        assert!(entries.len() > 0);
    }

    #[test]
    fn insert_image_duplicate_returns_false() {
        // 测试重复导入
    }
}
```

---

### 2.2 GREEN 阶段 — 最简实现

**前端实现**：`src/lib/api/images.ts`

```typescript
export async function importImages(folderPath: string): Promise<ImportResult> {
  const raw = await invoke<{
    items: TauriImageRecord[];
    imported: number;
    skipped: number;
    totalScanned: number;
  }>('import_images', { path: folderPath });

  return {
    items: raw.items.map(toImageRecord),
    imported: raw.imported,
    skipped: raw.skipped,
    totalScanned: raw.totalScanned,
  };
}
```

**后端实现**：`src-tauri/src/commands/images/import.rs`

```rust
#[tauri::command]
pub fn import_images(
    db: tauri::State<'_, DbHandle>,
    path: String,
) -> AppResult<ImportResult> {
    let entries = scan_folder(&path)?;
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let tx = conn.unchecked_transaction()?;
    
    let mut imported = Vec::new();
    let mut skipped = 0;
    
    for entry in &entries {
        if insert_image(&tx, entry)? {
            imported.push(load_record(&tx, &entry.id)?);
        } else {
            skipped += 1;
        }
    }
    
    tx.commit()?;
    
    Ok(ImportResult {
        imported: imported.len() as u32,
        skipped,
        total_scanned: entries.len() as u32,
        items: imported,
    })
}
```

---

### 2.3 REFACTOR 阶段 — 优化

**优化点**：
1. 提取 `scan_folder` 函数
2. 提取 `insert_image` 函数
3. 添加错误处理
4. 添加日志

---

## 3. 示例：语义搜索缓存 (semanticCache)

### 3.1 RED 阶段

**测试文件**：`src/lib/api/__tests__/semanticCache.test.ts`

```typescript
describe('semanticCache', () => {
  beforeEach(() => {
    invalidateCache();
  });

  it('should cache and retrieve results', () => {
    const results = [{ id: '1', similarity: 95 }];
    setCachedResult('test query', results);
    expect(getCachedResult('test query')).toEqual(results);
  });

  it('should return null for expired entries', () => {
    const results = [{ id: '1', similarity: 95 }];
    setCachedResult('test query', results);
    
    // Mock time advancement
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    
    expect(getCachedResult('test query')).toBeNull();
  });

  it('should normalize query keys', () => {
    const results = [{ id: '1', similarity: 95 }];
    setCachedResult('  Test Query  ', results);
    expect(getCachedResult('test query')).toEqual(results);
  });

  it('should enforce max entries limit', () => {
    for (let i = 0; i < 201; i++) {
      setCachedResult(`query ${i}`, [{ id: String(i), similarity: 90 }]);
    }
    expect(getCachedResult('query 0')).toBeNull(); // Evicted
    expect(getCachedResult('query 200')).not.toBeNull(); // Kept
  });
});
```

---

### 3.2 GREEN 阶段

**实现**：`src/lib/api/semanticCache.ts`

```typescript
const CACHE_KEY = 'lumora:semantic-cache';
const TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_ENTRIES = 200;

let cache = new Map<string, CachedEntry>();

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isExpired(entry: CachedEntry): boolean {
  return Date.now() - entry.ts > TTL_MS;
}

export function getCachedResult(query: string) {
  const key = normalizeQuery(query);
  const entry = cache.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cache.delete(key);
    return null;
  }
  // LRU: move to end
  cache.delete(key);
  cache.set(key, entry);
  return entry.results;
}

export function setCachedResult(query: string, results: SemanticSearchResult[]) {
  const key = normalizeQuery(query);
  cache.set(key, { results, ts: Date.now() });
  
  // Evict oldest if over limit
  if (cache.size > MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  
  persist();
}
```

---

### 3.3 REFACTOR 阶段

**优化点**：
1. 添加 localStorage 持久化
2. 添加防抖写入 (300ms)
3. 添加写命令监听（缓存失效）
4. 添加 `invalidateCache` 函数

---

## 4. 示例：回收站乐观更新 (trashStore)

### 4.1 RED 阶段

**测试文件**：`src/stores/__tests__/trashStore.test.ts`

```typescript
describe('trashStore', () => {
  it('should optimistically remove image on restore', async () => {
    const { result } = renderHook(() => useTrashStore());
    
    // Setup: add image to store
    act(() => {
      result.current.images = [{ id: '1', ... }];
    });
    
    // Restore
    await act(async () => {
      await result.current.restoreImage('1');
    });
    
    // Should be removed immediately (optimistic)
    expect(result.current.images).toHaveLength(0);
  });

  it('should rollback on restore failure', async () => {
    // Mock API failure
    vi.spyOn(api, 'restoreImage').mockRejectedValue(new Error('Network error'));
    
    const { result } = renderHook(() => useTrashStore());
    const prev = [...result.current.images];
    
    await act(async () => {
      await result.current.restoreImage('1');
    });
    
    // Should rollback
    expect(result.current.images).toEqual(prev);
    expect(result.current.error).toBe('Network error');
  });
});
```

---

### 4.2 GREEN 阶段

**实现**：`src/stores/trashStore.ts`

```typescript
restoreImage: async (id: string) => {
  // 1. Optimistic update
  const prev = get().images;
  set({ images: prev.filter(img => img.id !== id), total: get().total - 1 });
  
  try {
    // 2. API call
    await api.restoreImage(id);
  } catch (err) {
    // 3. Rollback on failure
    set({ images: prev, total: get().total + 1 });
    set({ error: err instanceof Error ? err.message : '恢复失败' });
  }
}
```

---

### 4.3 REFACTOR 阶段

**优化点**：
1. 提取通用的乐观更新函数
2. 添加重试逻辑
3. 添加 loading 状态

---

## 5. 示例：Ollama 状态轮询 (useOllamaStatus)

### 5.1 RED 阶段

**测试文件**：`src/hooks/__tests__/useOllamaStatus.test.ts`

```typescript
describe('useOllamaStatus', () => {
  it('should poll Ollama status every 60 seconds', async () => {
    vi.useFakeTimers();
    const checkStatus = vi.spyOn(api, 'checkOllamaStatus');
    
    renderHook(() => useOllamaStatus());
    
    expect(checkStatus).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(60 * 1000);
    expect(checkStatus).toHaveBeenCalledTimes(2);
    
    vi.advanceTimersByTime(60 * 1000);
    expect(checkStatus).toHaveBeenCalledTimes(3);
    
    vi.useRealTimers();
  });

  it('should report available when Ollama responds', async () => {
    vi.spyOn(api, 'checkOllamaStatus').mockResolvedValue([true, null]);
    
    const { result } = renderHook(() => useOllamaStatus());
    
    await waitFor(() => {
      expect(result.current.available).toBe(true);
    });
  });

  it('should report error when Ollama fails', async () => {
    vi.spyOn(api, 'checkOllamaStatus').mockResolvedValue([false, 'Not running']);
    
    const { result } = renderHook(() => useOllamaStatus());
    
    await waitFor(() => {
      expect(result.current.available).toBe(false);
      expect(result.current.error).toBe('Not running');
    });
  });
});
```

---

### 5.2 GREEN 阶段

**实现**：`src/hooks/useOllamaStatus.ts`

```typescript
export function useOllamaStatus() {
  const [status, setStatus] = useState<OllamaStatus>({
    available: false,
    checking: true,
    error: null,
  });

  const check = useCallback(async () => {
    setStatus(prev => ({ ...prev, checking: true }));
    try {
      const [available, error] = await checkOllamaStatus();
      setStatus({ available, checking: false, error });
    } catch (err) {
      setStatus({ available: false, checking: false, error: '检查失败' });
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [check]);

  return { ...status, recheck: check };
}
```

---

## 6. TDD 统计

| 模块 | 测试文件 | 测试数 | 覆盖率 |
|------|----------|--------|--------|
| imageStore | 1 | 18 | 高 |
| trashStore | 1 | 15 | 高 |
| settingsStore | 1 | 18 | 高 |
| aiAnalysisStore | 1 | 11 | 高 |
| embeddingStore | 1 | 9 | 高 |
| semanticSearchStore | 1 | 12 | 高 |
| imageSearchStore | 1 | 6 | 中 |
| imageTagsStore | 1 | 7 | 中 |
| images API | 1 | 16 | 高 |
| semanticCache | 1 | 8 | 高 |
| write-commands | 1 | 20 | 高 |
| useOllamaStatus | 1 | 7 | 高 |
| useKeyboardNav | 1 | 11 | 高 |
| useSelection | 1 | 11 | 高 |
| ImageCard | 1 | 12 | 中 |
| CommandPalette | 1 | 9 | 中 |
| DetailModal | 1 | 12 | 中 |
| Rust commands | 10 | 28 | 中 |

---

*文档生成时间：基于 commit 69983af6*
