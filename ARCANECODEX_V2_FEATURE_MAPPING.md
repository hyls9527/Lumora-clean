# ArcaneCodex V2 → Lumora Feature-to-Architecture Mapping

> **Generated**: 2026-06-13
> **Source**: `D:\Personal\Desktop\2` (ArcaneCodex V2.2.0)
> **Target**: `D:\Personal\Desktop\Lumora` (Tauri 2 + React 19 + shadcn/ui + Tailwind v4 + SQLite FTS5)

---

## 1. TAURI COMMANDS (140 total, grouped by module)

### 1.1 image.rs (11 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `list_images` | `(limit?, offset?, sort?) → Vec<ImageRecord>` | List all images (full, with llm_json) |
| `list_images_summary` | `(limit?, offset?, sort?) → Vec<ImageSummary>` | List images (no llm_json, for grid) |
| `get_image` | `(id) → ImageRecord` | Get single image by ID |
| `update_rating` | `(id, rating) → ()` | Set star rating (0-5) |
| `toggle_favorite` | `(id) → bool` | Toggle favorite flag |
| `delete_image` | `(id) → ()` | Soft-delete to trash |
| `batch_delete` | `(ids) → usize` | Batch soft-delete (emits progress) |
| `batch_set_rating` | `(ids, rating) → usize` | Batch set rating |
| `batch_toggle_favorite` | `(ids) → usize` | Batch toggle favorites |
| `extract_metadata` | `(id) → ImageRecord` | Extract PNG/JPEG/WebP metadata |
| `update_llm_json` | `(id, llm_json) → ()` | Update analysis JSON + re-index Tantivy |

### 1.2 search.rs (5 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `search_images` | `(query, limit?) → Vec<ImageRecord>` | BM25 full-text search (Tantivy) |
| `get_filter_tags` | `() → Vec<DimensionTagSet>` | Get 7 dimension tag sets for filter chips |
| `search_structured` | `(request: SearchRequest) → SearchStructuredResponse` | Structured dimension:tag search with SQL filters |
| `search_natural_language` | `(text, limit?, offset?) → SearchStructuredResponse` | NL→filters (LM Studio) + Tantivy fallback |
| `search_semantic` | `(text, limit?) → SearchStructuredResponse` | CLIP vector cosine similarity search |

### 1.3 import.rs (5 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `import_folder` | `(folder_path) → usize` | Import directory (emits import-progress events) |
| `import_files` | `(paths_json) → usize` | Import files/dirs from picker/drag-drop |
| `cancel_import` | `() → ()` | Cancel in-progress import |
| `import_clipboard` | `(base64_data, format) → i64` | Import from clipboard paste |
| `get_import_progress` | `() → ImportProgress` | Poll-based progress fallback |

### 1.4 export.rs (9 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `export_images` | `(request: ExportImagesRequest) → usize` | Batch export with format conversion |
| `export_preview` | `(ids, rename_template?, preset?) → ExportPreviewResult` | Preview filenames/size/ETA |
| `get_export_presets` | `() → Vec<ExportPreset>` | Get built-in export presets |
| `export_by_folder` | `(folder_path, dest_dir, format, preset?) → usize` | Export all in a folder |
| `export_by_tag` | `(tag_id, dest_dir, format, preset?) → usize` | Export by tag |
| `embed_image` | `(id) → ()` | CLIP embed single image |
| `embed_batch` | `(ids, batch_size?) → usize` | Batch CLIP embed |
| `embed_unindexed` | `() → usize` | Embed all un-embedded images |
| `get_clip_status` | `() → ClipStatus` | CLIP model/index status |

### 1.5 analysis.rs (8 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `analyze_image` | `(id) → ImageRecord` | Analyze single image via LLM |
| `prioritize_image` | `(id, priority) → ()` | Set queue priority |
| `pause_queue` | `() → ()` | Pause background analysis |
| `resume_queue` | `() → ()` | Resume background analysis |
| `get_queue_status` | `(db_state, queue_state) → QueueStatus` | Queue stats + ETA |
| `retry_failed_tasks` | `() → i64` | Retry all failed LLM tasks |
| `re_analyze_all` | `() → i64` | Queue all images for re-analysis |
| `re_analyze_selected` | `(ids) → i64` | Queue selected images for re-analysis |

### 1.6 curation.rs (18 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `compute_scores_batch` | `(ids) → Vec<ScoreResult>` | Compute 6-dimension scores |
| `list_profiles` | `() → Vec<WeightProfileRecord>` | List weight profiles |
| `save_profile` | `(id?, name, weights) → ()` | Create/update weight profile |
| `rebuild_histogram` | `() → Value` | Rebuild scoring histogram |
| `run_score_benchmark` | `() → BenchmarkResult` | Run scoring performance benchmark |
| `get_calibration_data` | `() → CalibrationData` | Get all rules + profiles |
| `get_benchmark_history` | `() → Vec<BenchmarkResult>` | Get past benchmark results |
| `create_session` | `(source_dir) → i64` | Create curation session |
| `complete_session` | `(session_id, image_count) → ()` | Complete curation session |
| `record_decision` | `(image_id, session_id, decision?, rating?) → ()` | Record curation decision |
| `get_session_history` | `() → Vec<SessionSummary>` | List past sessions |
| `get_session_stats` | `(session_id) → SessionStats` | Get session statistics |
| `get_pending_maybe_count` | `() → i64` | Count pending maybe decisions |
| `list_decisions` | `(session_id) → Vec<Decision>` | List decisions in session |
| `record_decision_v2` | `(image_id, decision?, rating?) → ()` | Record decision (auto-session) |
| `get_combined_score` | `(image_id, ai_weight?) → Option<f64>` | Get combined AI+user score |
| `get_ai_weight` | `() → f64` | Get current AI weight (0-1) |
| `set_ai_weight` | `(weight) → ()` | Set AI weight |

### 1.7 tags.rs (15 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `create_tag` | `(name, color?, parent_id?) → TagRecord` | Create tag |
| `delete_tag` | `(tag_id) → ()` | Delete tag |
| `merge_tag` | `(source_id, target_id) → ()` | Merge tags |
| `rename_tag` | `(tag_id, new_name) → ()` | Rename tag |
| `set_tag_color` | `(tag_id, color?) → ()` | Set tag color |
| `get_tag_tree` | `() → Vec<TagTreeNode>` | Get full tag hierarchy |
| `get_tag_display_color` | `(tag_id) → Option<String>` | Get inherited color |
| `add_tag_to_image` | `(image_id, tag_id, source?) → ()` | Tag an image |
| `remove_tag_from_image` | `(image_id, tag_id) → ()` | Untag image |
| `get_image_tags` | `(image_id) → Vec<TagRecord>` | Get image's tags |
| `search_images_by_tag` | `(tag_id) → Vec<i64>` | Search images by tag |
| `accept_tag_suggestion` | `(suggestion_id) → TagRecord` | Accept AI tag suggestion |
| `reject_tag_suggestion` | `(suggestion_id) → ()` | Reject AI tag suggestion |
| `get_pending_suggestions` | `(image_id) → Vec<SuggestionRecord>` | Get pending suggestions |
| `batch_accept_suggestions` | `(image_id) → Vec<TagRecord>` | Accept all suggestions for image |

### 1.8 collections.rs (7 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `create_collection` | `(name) → i64` | Create collection |
| `rename_collection` | `(id, name) → ()` | Rename collection |
| `delete_collection` | `(id) → ()` | Delete collection |
| `add_to_collection` | `(collection_id, image_id) → ()` | Add image to collection |
| `remove_from_collection` | `(collection_id, image_id) → ()` | Remove from collection |
| `list_collections` | `() → Vec<Collection>` | List all collections |
| `list_collection_images` | `(collection_id) → Vec<ImageRecord>` | Images in collection |

### 1.9 smart_folders.rs (4 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `create_smart_folder` | `(name, rules_json) → i64` | Create smart folder |
| `update_smart_folder_rules` | `(id, rules_json) → ()` | Update smart folder rules |
| `test_smart_folder_rules` | `(rules_json) → TestResult` | Test rules (count + samples) |
| `get_smart_folder_images_count` | `(id) → i64` | Get match count (rebuilds) |

### 1.10 trash.rs (9 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `restore_image` | `(trash_id) → ()` | Restore from trash |
| `permanently_delete` | `(trash_id) → ()` | Permanently delete (DB + file) |
| `list_trash` | `() → Vec<TrashRecord>` | List trashed images |
| `list_reject_bin` | `(sort_by?) → Vec<RejectBinRecord>` | List rejected images |
| `restore_from_reject_bin` | `(reject_id) → ()` | Restore rejected image |
| `permanently_delete_from_reject_bin` | `(reject_id) → ()` | Permanently delete rejected |
| `empty_reject_bin` | `() → i64` | Empty entire reject bin |
| `get_reject_bin_retention` | `() → i64` | Get retention days |
| `set_reject_bin_retention` | `(days) → ()` | Set retention days |

### 1.11 variants.rs (10 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `run_variant_detection` | `() → Value` | Run 3-tier variant detection |
| `get_variant_groups` | `() → Vec<VariantGroup>` | List all groups |
| `get_variant_group_for_image` | `(image_id) → Option<VariantGroup>` | Get group for image |
| `get_variant_group_members` | `(group_id) → Vec<VariantGroupMemberInfo>` | Get members with metadata |
| `add_images_to_variant_group` | `(group_id, image_ids) → usize` | Add to group |
| `remove_images_from_variant_group` | `(group_id, image_ids) → usize` | Remove from group |
| `create_variant_group` | `(name, image_ids) → i64` | Create manual group |
| `delete_variant_group` | `(group_id) → ()` | Delete group |
| `auto_select_cover` | `(group_id) → i64` | Auto-select best cover |
| `set_cover_image` | `(group_id, image_id) → ()` | Manual cover selection |

### 1.12 dedup.rs (8 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `find_duplicates` | `() → DuplicateScanResponse` | dHash duplicate scan |
| `dismiss_duplicate_group` | `(group_id) → ()` | Dismiss duplicate group |
| `get_near_duplicates` | `(status?, limit?, offset?) → Vec<NearDuplicate>` | CLIP near-duplicates |
| `dismiss_near_duplicate` | `(id) → ()` | Dismiss near-duplicate |
| `find_generation_batches` | `() → Vec<GenerationBatch>` | Group by gen params |
| `batch_mark_by_score` | `(ids, threshold, operator, decision, ai_weight?) → BatchMarkResult` | Batch mark by score |
| `batch_keep_best_in_group` | `(group_id, keep_count?, ai_weight?) → KeepBestResult` | Keep best in group |
| `batch_keep_best_in_all_groups` | `(keep_count?, ai_weight?) → Vec<KeepBestResult>` | Keep best all groups |

### 1.13 compare.rs (3 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `compare_images_diff` | `(path_a, path_b) → DiffResult` | Pixel-level diff heatmap |
| `compare_images_ssim` | `(path_a, path_b) → SSIMResult` | SSIM structural similarity |
| `compare_metadata` | `(id_a, id_b) → MetadataDiff` | Side-by-side metadata diff |

### 1.14 backup.rs (7 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `create_backup` | `(dest_dir?) → BackupResult` | Create full backup |
| `list_backups` | `() → Vec<BackupInfo>` | List all backups |
| `delete_backup` | `(path) → ()` | Delete a backup |
| `restore_backup` | `(path) → ()` | Restore from backup (restarts) |
| `restore_validate` | `(path) → ValidationResult` | Validate backup before restore |
| `get_backup_config` | `() → BackupScheduleConfig` | Get backup schedule |
| `set_backup_config` | `(interval, retention_count) → ()` | Set backup schedule |

### 1.15 stats.rs (2 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `get_library_stats` | `() → LibraryStats` | Total images, storage, ratings, formats |
| `get_memory_stats` | `() → MemoryStats` | RSS, vector index, pool size |

### 1.16 misc.rs (19 commands)
| Command | Signature | Description |
|---------|-----------|-------------|
| `check_llm_backend` | `() → BackendStatus` | Check LLM endpoint connectivity |
| `get_llm_config` | `() → Value` | Get LLM endpoint/model/retries |
| `set_llm_config` | `(endpoint, model, max_retries?) → ()` | Set LLM config (SSRF-validated) |
| `list_available_models` | `() → Value` | List models from LLM backend |
| `seed_demo_data` | `() → usize` | Seed demo images |
| `start_comfyui` | `(script_path, watch_dir?) → ComfyStatus` | Start ComfyUI process |
| `stop_comfyui` | `() → ComfyStatus` | Stop ComfyUI process |
| `get_comfyui_status` | `() → ComfyStatus` | Get ComfyUI status |
| `get_keybindings` | `(mode) → Vec<KeyBinding>` | Get keyboard shortcuts |
| `set_keybinding` | `(action, key, mode, modifiers) → ()` | Set shortcut |
| `reset_keybindings` | `(mode) → ()` | Reset to defaults |
| `check_conflict` | `(mode, key, exclude_action) → Option<String>` | Check shortcut conflict |
| `check_gpu_available` | `() → Value` | Check ONNX GPU providers |
| `get_speed_profile` | `() → String` | Get worker speed profile |
| `set_speed_profile` | `(profile) → ()` | Set speed profile |
| `get_gpu_info` | `() → GpuInfo` | Get GPU name/VRAM/driver |
| `suggest_speed_profile` | `() → String` | Auto-suggest from VRAM |
| `check_for_updates` | `() → Value` | Check GitHub releases |
| `find_similar_images` | `(image_id, top_k?) → Vec<SimilarImage>` | CLIP vector similar images |

---

## 2. FRONTEND COMPONENTS (grouped by feature)

### 2.1 Gallery (`src/features/gallery/`)
- `GalleryPage.tsx` — Main gallery page
- `GalleryEngine.tsx` — Virtual scroll + grid rendering engine
- `GalleryGrid.tsx` — Grid layout for images
- `GalleryToolbar.tsx` — Sort/filter toolbar
- `GallerySettings.tsx` — Gallery display preferences
- `ImageCard.tsx` — Individual image thumbnail card
- `ImageDetailPanel.tsx` — Image detail overlay/panel
- `ImageDetailHelpers.tsx` — Detail panel helper components
- `ImageInfoSection.tsx` — Image metadata display
- `ImageActionsSection.tsx` — Image action buttons (rate, fav, delete)
- `MetadataPanel.tsx` — Generation parameter display
- `ThumbnailStrip.tsx` — Thumbnail navigation strip
- `GalleryEngine.tsx` — Virtualized rendering engine
- `CompareSlider.tsx` — Side-by-side image comparison slider
- `DiffOverlay.tsx` — Diff heatmap overlay
- `CmodeComparison.tsx` — C-mode comparison view
- `DmodeOverlay.tsx` — D-mode overlay
- `BmodeView.tsx` — B-mode detail view
- `SsimScore.tsx` — SSIM score display
- `EmptyState.tsx` — Empty gallery state

### 2.2 Curation (`src/features/curation/`)
- `CurationPage.tsx` — Main curation page
- `CurationLayout.tsx` — D/B/C mode layout
- `CurationToolbar.tsx` — Decision buttons + mode switcher
- `CurationFilterBar.tsx` — Decision filter (all/keep/maybe/reject)
- `DmodeOverlay.tsx` — Grid view overlay
- `ScoreBreakdown.tsx` — 6-dimension score display
- `WeightTemplateEditor.tsx` — Weight profile editor
- `BenchmarkPanel.tsx` — Scoring benchmark UI
- `CalibrationSandbox.tsx` — Calibration sandbox (rule testing)

### 2.3 Search (`src/features/search/`)
- `SearchBar.tsx` — Search input (NL/structured/semantic modes)
- `FilterChips.tsx` — Active filter chip display
- `DimensionGrid.tsx` — 7-dimension tag selection grid

### 2.4 Import/Export (`src/features/import/`)
- `ImportButton.tsx` — Import trigger button
- `ImportProgress.tsx` — Import progress bar
- `DropZone.tsx` — Drag-and-drop zone
- `BatchMarkDialog.tsx` — Batch mark by score dialog
- `BatchActionToolbar.tsx` — Batch action toolbar (decision, rating, tag)
- `ExportDialog.tsx` — Export dialog (multi-step)
- `ExportFormatSection.tsx` — Format selection
- `ExportNamingSection.tsx` — Rename template
- `ExportPreviewSection.tsx` — Preview filenames/size
- `ExportStepIndicator.tsx` — Step progress indicator
- `ExportActionsSection.tsx` — Export action buttons

### 2.5 Tags (`src/features/tags/`)
- `TagPanel.tsx` — Tag management sidebar panel
- `TagTree.tsx` — Hierarchical tag tree
- `CollectionPanel.tsx` — Collections list
- `SmartFolderEditorPanel.tsx` — Smart folder rule editor
- `RuleBuilder.tsx` — Visual rule builder for smart folders

### 2.6 Analysis (`src/features/analysis/`)
- `AnalysisPanel.tsx` — Analysis queue status panel
- `DuplicateFinder.tsx` — Duplicate detection UI
- `VariantGroupPanel.tsx` — Variant group management

### 2.7 Dashboard (`src/features/dashboard/`)
- `DashboardPage.tsx` — Library health dashboard
- `LibraryDashboard.tsx` — Stats overview
- `FormatChart.tsx` — Format distribution chart
- `RatingChart.tsx` — Rating distribution chart
- `CoverageBar.tsx` — Analysis coverage bar

### 2.8 Trash (`src/features/trash/`)
- `TrashPage.tsx` — Trash + reject bin page (tabbed)

### 2.9 Settings (`src/features/settings/`)
- `SettingsPage.tsx` — Settings container (tabs)
- `ThemeSettings.tsx` — Theme customization
- `SpeedProfileSettings.tsx` — Worker speed profile

### 2.10 Shared Components (`src/components/`)
- `ErrorToast.tsx` — Error notification toast
- `DropZone.tsx` — Global drag-drop handler
- `SidebarPanel.tsx` — Sidebar panel container
- `UpdateBanner.tsx` — Update notification banner
- `ActiveFilterBar.tsx` — Active filter display bar
- `ToolbarOverflow.tsx` — Toolbar overflow menu

### 2.11 Shared UI Primitives (`src/shared/ui/`)
- `Badge.tsx`, `EmptyState.tsx`, `Panel.tsx`, `Toolbar.tsx`, `Tooltip.tsx`

---

## 3. ZUSTAND STORES (7 stores)

### 3.1 `useImageStore` (`src/stores/imageStore.ts`)
| Key | Type | Description |
|-----|------|-------------|
| `images` | `ImageRecord[]` | Current image list |
| `selectedIndex` | `number \| null` | Fullscreen lightbox index |
| `isFullscreen` | `boolean` | Lightbox open state |
| `detailImageId` | `number \| null` | Detail panel image ID |
| `lightboxIndex` | `number` | Lightbox navigation index |
| `selectedIds` | `Set<number>` | Multi-select IDs |
| `selectMode` | `boolean` | Select mode active |
| **Actions** | | `setImages`, `selectImage`, `closeFullscreen`, `openDetail`, `closeDetail`, `setLightboxIndex`, `toggleSelectMode`, `toggleSelect`, `clearSelection`, `updateImage`, `removeImage`, `removeImages` |

### 3.2 `useFilterStore` (`src/stores/filterStore.ts`)
| Key | Type | Description |
|-----|------|-------------|
| `activeFilters` | `ActiveFilter[]` | Active dimension:tag filters |
| `filterTags` | `DimensionTags[]` | Available filter tags (7 dimensions) |
| `searchQuery` | `string` | Current search text |
| `searchTotal` | `number` | Total search result count |
| `filterMode` | `"AND" \| "OR"` | Filter combination mode |
| `searchActive` | `boolean` | Search mode active |
| **Actions** | | `setActiveFilters`, `addFilter`, `removeFilter`, `clearFilters`, `setFilterTags`, `setSearchQuery`, `setSearchTotal`, `toggleFilterMode`, `setSearchActive` |

### 3.3 `useCurationStore` (`src/stores/curationStore.ts`)
| Key | Type | Description |
|-----|------|-------------|
| `curationMode` | `boolean` | Curation mode active |
| `keybindings` | `{ browse: KeyBinding[], curate: KeyBinding[] }` | Keyboard shortcuts |
| `aiWeight` | `number` | AI score weight (0-1) |
| `curationViewMode` | `"D" \| "B" \| "C"` | Grid/Inspect/Compare |
| `decisionFilter` | `"all" \| "keep" \| "maybe" \| "reject"` | Decision filter |
| `dScrollOffset` | `number` | D-mode scroll position |
| `bScrollOffset` | `number` | B-mode scroll position |
| `cTransform` | `{ scale, translateX, translateY }` | C-mode pan/zoom state |
| `compareMode` | `"side-by-side" \| "slider" \| "diff"` | Compare view mode |
| **Actions** | | `setCurationMode`, `setKeybindings`, `setAiWeight`, `setImageDecision`, `setImageRating`, `setCurationViewMode`, `setDecisionFilter`, `setDScrollOffset`, `setBScrollOffset`, `setCTransform`, `setCompareMode` |

### 3.4 `useTagStore` (`src/stores/tagStore.ts`)
| Key | Type | Description |
|-----|------|-------------|
| `tagTree` | `TagTreeNode[]` | Tag hierarchy tree |
| `tagPanelOpen` | `boolean` | Tag panel visible |
| `selectedTagId` | `number \| null` | Active tag filter |
| `pendingSuggestions` | `Record<number, SuggestionRecord[]>` | Pending tag suggestions by image |
| **Actions** | | `setTagTree`, `setTagPanelOpen`, `setSelectedTagId`, `setPendingSuggestions`, `clearTagFilter` |

### 3.5 `useScoringStore` (`src/stores/scoringStore.ts`)
| Key | Type | Description |
|-----|------|-------------|
| `scoringProgress` | `ScoringProgress \| null` | Batch scoring progress |
| `benchmarkResult` | `BenchmarkResult \| null` | Latest benchmark result |
| `profiles` | `WeightProfileRecord[]` | Weight profiles list |
| `calibrationData` | `CalibrationData \| null` | Calibration sandbox data |
| **Actions** | | `setScoringProgress`, `setBenchmarkResult`, `setProfiles`, `setCalibrationData` |

### 3.6 `useUiStore` (`src/stores/uiStore.ts`)
| Key | Type | Description |
|-----|------|-------------|
| `activePanel` | `string \| null` | Currently open sidebar panel |
| `backendStatus` | `BackendStatus \| null` | LLM backend status |
| `appReady` | `boolean` | App initialization complete |
| `importProgress` | `ImportProgress \| null` | Import progress state |
| `queueProgress` | `QueueProgress \| null` | Analysis queue progress |
| `analysisStatuses` | `Record<number, AnalysisStatus>` | Per-image analysis status |
| `smartFolderPanelOpen` | `boolean` | Smart folder panel visible |
| `activeSmartFolderId` | `number \| null` | Active smart folder |
| `variantPanelOpen` | `boolean` | Variant panel visible |
| `activeVariantGroupId` | `number \| null` | Active variant group |
| `variantDetectionRunning` | `boolean` | Detection in progress |
| `variantDetectionResult` | `VariantDetectionResult \| null` | Detection results |
| `cModeVariantGroupIds` | `number[] \| null` | Variant groups in C-mode |
| `errorQueue` | `QueuedError[]` | Error toast queue (max 3) |
| **Actions** | | `addError`, `dismissError`, `clearErrors`, `openPanel`, `closePanel`, `togglePanel`, `setBackendStatus`, `setAppReady`, `setImportProgress`, `setQueueProgress`, `setAnalysisStatus`, `setSmartFolderPanelOpen`, `setActiveSmartFolderId`, `setVariantPanelOpen`, `setActiveVariantGroupId`, `setVariantDetectionRunning`, `setVariantDetectionResult`, `setCModeVariantGroupIds` |

### 3.7 `useThemeStore` (`src/stores/themeStore.ts`) — **Persisted**
| Key | Type | Description |
|-----|------|-------------|
| `themeId` | `ThemeId` | Current theme (light/dark/midnight/sakura/forest/ocean/custom) |
| `customPrimary` | `string` | Custom primary color (oklch) |
| **Actions** | | `setTheme`, `setCustomPrimary` |

---

## 4. DATABASE SCHEMA (21 tables, migrations 1-21)

### 4.1 `images` (main table)
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | INTEGER PK | AUTOINCREMENT | |
| `file_path` | TEXT NOT NULL | | Original file path |
| `file_hash` | TEXT NOT NULL UNIQUE | | SHA-256 content hash |
| `format` | TEXT NOT NULL | | jpeg/png/webp/gif/bmp/tiff/heic/avif |
| `dimensions` | TEXT | NULL | e.g. "1024x768" |
| `file_size_kb` | INTEGER NOT NULL | | File size in KB |
| `thumbnail_path` | TEXT | NULL | Generated thumbnail path |
| `unified_number` | TEXT UNIQUE | NULL | ComfyUI unified number |
| `llm_json` | TEXT | NULL | LLM analysis JSON |
| `rating` | INTEGER | 0 | Star rating (0-5) |
| `color_label` | TEXT | NULL | Color label |
| `favorite` | INTEGER | 0 | Boolean flag |
| `created_at` | TEXT | datetime('now') | Import timestamp |
| `updated_at` | TEXT | datetime('now') | Last modification |
| `clip_vector` | BLOB | NULL | CLIP embedding (512 × f32) |
| `deleted` | INTEGER | 0 | Soft delete flag |
| `perceptual_hash` | TEXT | NULL | dHash for dedup |
| `composite_score` | REAL | NULL | Weighted composite score |
| `score_composition` | REAL | NULL | Composition dimension score |
| `score_technical` | REAL | NULL | Technical quality score |
| `score_subject` | REAL | NULL | Subject interest score |
| `score_style` | REAL | NULL | Style coherence score |
| `score_color` | REAL | NULL | Color harmony score |
| `score_novelty` | REAL | NULL | Novelty score |
| `score_explanation_cache` | TEXT | NULL | Cached score explanations |
| `session_id` | INTEGER | NULL | FK → sessions |
| `decision` | TEXT | NULL | keep/maybe/reject |
| `user_rating` | INTEGER | NULL | User star rating (1-5) |

**Indexes**: `idx_images_hash`, `idx_images_rating`, `idx_images_format`

### 4.2 `trash`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `image_id` | INTEGER NOT NULL FK→images | |
| `original_path` | TEXT NOT NULL | File path before deletion |
| `trash_path` | TEXT NOT NULL | Trash file location |
| `deleted_at` | TEXT | Deletion timestamp |
| `restored` | INTEGER | 0=pending, 1=restored |

### 4.3 `task_queue`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `image_id` | INTEGER NOT NULL FK→images | |
| `task_type` | TEXT | 'llm_analysis' |
| `status` | TEXT | pending/processing/completed/failed |
| `priority` | INTEGER | Higher = sooner |
| `error_message` | TEXT | Failure reason |
| `created_at` / `updated_at` | TEXT | Timestamps |

### 4.4 `collections`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Collection name |
| `description` | TEXT | Optional description |
| `is_smart` | INTEGER | 1 = smart folder |
| `smart_rules` | TEXT | JSON rule definition |
| `created_at` | TEXT | |

### 4.5 `collection_images`
| Column | Type | Description |
|--------|------|-------------|
| `collection_id` | INTEGER FK→collections | CASCADE DELETE |
| `image_id` | INTEGER FK→images | CASCADE DELETE |
| `added_at` | TEXT | |

**PK**: `(collection_id, image_id)`

### 4.6 `lineage`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `parent_id` | INTEGER FK→images | Parent image |
| `child_id` | INTEGER FK→images | Child/derived image |
| `derivation_type` | TEXT | Type of derivation |
| `created_at` | TEXT | |

### 4.7 `app_config` (key-value store)
| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PK | Config key |
| `value` | TEXT NOT NULL | Config value |
| `updated_at` | TEXT | |

### 4.8 `nl_cache`
| Column | Type | Description |
|--------|------|-------------|
| `query_text` | TEXT PK | Natural language query |
| `filters_json` | TEXT NOT NULL | Cached parsed filters |
| `created_at` | TEXT | |

### 4.9 `near_duplicates`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `image_id_a` / `image_id_b` | INTEGER FK→images | Pair |
| `similarity` | REAL | Cosine similarity (0-1) |
| `method` | TEXT | 'clip' |
| `status` | TEXT | pending/dismissed |
| `created_at` | TEXT | |

### 4.10 `scoring_rules`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `dimension` | TEXT | composition/technical_quality/subject_interest/style_coherence/color_harmony/novelty |
| `field` | TEXT | JSON field path |
| `condition_json` | TEXT | Condition definition |
| `score` | REAL | Score (1.0-10.0) |
| `weight` | REAL | Rule weight (≥0) |
| `explanation_template` | TEXT | Explanation template |
| `is_active` | INTEGER | Enabled flag |
| `created_at` / `updated_at` | TEXT | |

### 4.11 `weight_profiles`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Profile name |
| `is_preset` | INTEGER | Built-in flag |
| `composition` | REAL | Weight (0-1) |
| `technical` | REAL | Weight |
| `subject` | REAL | Weight |
| `style` | REAL | Weight |
| `color` | REAL | Weight |
| `novelty` | REAL | Weight |
| `created_at` / `updated_at` | TEXT | |

### 4.12 `benchmarks`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `p50_us` / `p99_us` / `mean_us` | REAL | Latency metrics |
| `images_per_sec` | REAL | Throughput |
| `sample_size` | INTEGER | Images scored |
| `rule_version` | TEXT | Rule file version |
| `dataset_size` | INTEGER | Total dataset size |
| `created_at` | TEXT | |

### 4.13 `sessions`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `source_dir` | TEXT NOT NULL | Import directory |
| `image_count` | INTEGER | Images in session |
| `status` | TEXT | active/completed |
| `created_at` / `updated_at` | TEXT | |

### 4.14 `curation_decisions`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `image_id` | INTEGER FK→images | |
| `session_id` | INTEGER FK→sessions | |
| `decision` | TEXT | keep/maybe/reject |
| `rating` | INTEGER | User rating (1-5) |
| `decided_at` / `updated_at` | TEXT | |

### 4.15 `keybindings`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `action` | TEXT NOT NULL | Action identifier |
| `key` | TEXT NOT NULL | Key binding |
| `mode` | TEXT | browse/curate |
| `modifiers` | TEXT | none/ctrl/shift/alt |
| `updated_at` | TEXT | |

### 4.16 `tags`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Tag name |
| `color` | TEXT | Hex color |
| `parent_id` | INTEGER FK→tags | Parent tag |
| `materialized_path` | TEXT | /root/child/grandchild |
| `created_at` / `updated_at` | TEXT | |

### 4.17 `tags_closure`
| Column | Type | Description |
|--------|------|-------------|
| `ancestor_id` | INTEGER FK→tags | |
| `descendant_id` | INTEGER FK→tags | |
| `depth` | INTEGER | Tree depth |

**PK**: `(ancestor_id, descendant_id)`

### 4.18 `image_tags`
| Column | Type | Description |
|--------|------|-------------|
| `image_id` | INTEGER FK→images | CASCADE |
| `tag_id` | INTEGER FK→tags | CASCADE |
| `added_at` | TEXT | |
| `source` | TEXT | auto/suggestion/manual |

**PK**: `(image_id, tag_id)`

### 4.19 `tag_suggestions`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `image_id` | INTEGER FK→images | CASCADE |
| `tag_name` | TEXT NOT NULL | Suggested tag name |
| `parent_id` | INTEGER FK→tags | Suggested parent |
| `status` | TEXT | pending/accepted/rejected |
| `created_at` | TEXT | |

### 4.20 `variant_groups`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Group name |
| `detection_method` | TEXT | generation/dhash/clip/manual |
| `cover_image_id` | INTEGER FK→images | Cover image |
| `created_at` / `updated_at` | TEXT | |

### 4.21 `variant_group_members`
| Column | Type | Description |
|--------|------|-------------|
| `group_id` | INTEGER FK→variants | CASCADE |
| `image_id` | INTEGER FK→images | CASCADE |
| `added_at` | TEXT | |

**PK**: `(group_id, image_id)`

### 4.22 `reject_bin`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `image_id` | INTEGER UNIQUE FK→images | CASCADE |
| `rejected_at` | TEXT | |
| `reject_reason` | TEXT | |
| `batch_id` | INTEGER | Batch operation ID |

---

## 5. FEATURE → COMMANDS / COMPONENTS / STORES MAPPING

### 5.1 IMAGE MANAGEMENT
| Layer | Items |
|-------|-------|
| **Commands** | `list_images`, `list_images_summary`, `get_image`, `update_rating`, `toggle_favorite`, `delete_image`, `batch_delete`, `batch_set_rating`, `batch_toggle_favorite`, `extract_metadata`, `update_llm_json` |
| **Components** | `GalleryPage`, `GalleryEngine`, `GalleryGrid`, `ImageCard`, `ImageDetailPanel`, `ImageInfoSection`, `ImageActionsSection`, `MetadataPanel`, `GalleryToolbar`, `GallerySettings` |
| **Stores** | `imageStore` (images, selection, detail), `uiStore` (panel state) |
| **API Layer** | `src/lib/api/images.ts` |

### 5.2 SEARCH & FILTERING
| Layer | Items |
|-------|-------|
| **Commands** | `search_images`, `search_structured`, `search_natural_language`, `search_semantic`, `get_filter_tags` |
| **Components** | `SearchBar`, `FilterChips`, `DimensionGrid`, `ActiveFilterBar` |
| **Stores** | `filterStore` (filters, query, mode) |
| **API Layer** | `src/lib/api/search.ts` |

### 5.3 IMPORT
| Layer | Items |
|-------|-------|
| **Commands** | `import_folder`, `import_files`, `cancel_import`, `import_clipboard`, `get_import_progress` |
| **Components** | `ImportButton`, `ImportProgress`, `DropZone` (features/import), `DropZone` (components) |
| **Stores** | `uiStore` (importProgress) |
| **API Layer** | `src/lib/api/import.ts` |

### 5.4 EXPORT
| Layer | Items |
|-------|-------|
| **Commands** | `export_images`, `export_preview`, `get_export_presets`, `export_by_folder`, `export_by_tag`, `embed_image`, `embed_batch`, `embed_unindexed`, `get_clip_status` |
| **Components** | `ExportDialog`, `ExportFormatSection`, `ExportNamingSection`, `ExportPreviewSection`, `ExportStepIndicator`, `ExportActionsSection` |
| **Stores** | `uiStore` (clip status) |
| **API Layer** | `src/lib/api/export.ts` |

### 5.5 ANALYSIS & QUEUE
| Layer | Items |
|-------|-------|
| **Commands** | `analyze_image`, `prioritize_image`, `pause_queue`, `resume_queue`, `get_queue_status`, `retry_failed_tasks`, `re_analyze_all`, `re_analyze_selected` |
| **Components** | `AnalysisPanel` |
| **Stores** | `uiStore` (queueProgress, analysisStatuses) |
| **API Layer** | `src/lib/api/queue.ts` |

### 5.6 CURATION & SCORING
| Layer | Items |
|-------|-------|
| **Commands** | `compute_scores_batch`, `list_profiles`, `save_profile`, `rebuild_histogram`, `run_score_benchmark`, `get_calibration_data`, `get_benchmark_history`, `create_session`, `complete_session`, `record_decision`, `get_session_history`, `get_session_stats`, `get_pending_maybe_count`, `list_decisions`, `record_decision_v2`, `get_combined_score`, `get_ai_weight`, `set_ai_weight` |
| **Components** | `CurationPage`, `CurationLayout`, `CurationToolbar`, `CurationFilterBar`, `DmodeOverlay`, `ScoreBreakdown`, `WeightTemplateEditor`, `BenchmarkPanel`, `CalibrationSandbox` |
| **Stores** | `curationStore` (mode, view, decisions, AI weight), `scoringStore` (profiles, benchmarks) |
| **API Layer** | `src/lib/api/curation.ts` |

### 5.7 TAGS & SMART TAGS
| Layer | Items |
|-------|-------|
| **Commands** | `create_tag`, `delete_tag`, `merge_tag`, `rename_tag`, `set_tag_color`, `get_tag_tree`, `get_tag_display_color`, `add_tag_to_image`, `remove_tag_from_image`, `get_image_tags`, `search_images_by_tag`, `accept_tag_suggestion`, `reject_tag_suggestion`, `get_pending_suggestions`, `batch_accept_suggestions` |
| **Components** | `TagPanel`, `TagTree` |
| **Stores** | `tagStore` (tree, panel, suggestions) |
| **API Layer** | `src/lib/api/tags.ts` |

### 5.8 COLLECTIONS
| Layer | Items |
|-------|-------|
| **Commands** | `create_collection`, `rename_collection`, `delete_collection`, `add_to_collection`, `remove_from_collection`, `list_collections`, `list_collection_images` |
| **Components** | `CollectionPanel` |
| **Stores** | `tagStore` (implied via collections) |
| **API Layer** | `src/lib/api/collections.ts` |

### 5.9 SMART FOLDERS
| Layer | Items |
|-------|-------|
| **Commands** | `create_smart_folder`, `update_smart_folder_rules`, `test_smart_folder_rules`, `get_smart_folder_images_count` |
| **Components** | `SmartFolderEditorPanel`, `RuleBuilder` |
| **Stores** | `uiStore` (smartFolderPanelOpen, activeSmartFolderId) |
| **API Layer** | `src/lib/api/smartFolders.ts` |

### 5.10 TRASH & REJECT BIN
| Layer | Items |
|-------|-------|
| **Commands** | `restore_image`, `permanently_delete`, `list_trash`, `list_reject_bin`, `restore_from_reject_bin`, `permanently_delete_from_reject_bin`, `empty_reject_bin`, `get_reject_bin_retention`, `set_reject_bin_retention` |
| **Components** | `TrashPage` (tabbed: Trash + Reject Bin) |
| **Stores** | `imageStore` (removeImage) |
| **API Layer** | `src/lib/api/trash.ts`, `src/lib/api/rejectBin.ts` |

### 5.11 VARIANT DETECTION
| Layer | Items |
|-------|-------|
| **Commands** | `run_variant_detection`, `get_variant_groups`, `get_variant_group_for_image`, `get_variant_group_members`, `add_images_to_variant_group`, `remove_images_from_variant_group`, `create_variant_group`, `delete_variant_group`, `auto_select_cover`, `set_cover_image` |
| **Components** | `VariantGroupPanel` |
| **Stores** | `uiStore` (variantPanelOpen, activeVariantGroupId, variantDetectionRunning, variantDetectionResult, cModeVariantGroupIds) |
| **API Layer** | `src/lib/api/variants.ts` |

### 5.12 DUPLICATE DETECTION
| Layer | Items |
|-------|-------|
| **Commands** | `find_duplicates`, `dismiss_duplicate_group`, `get_near_duplicates`, `dismiss_near_duplicate`, `find_generation_batches`, `batch_mark_by_score`, `batch_keep_best_in_group`, `batch_keep_best_in_all_groups` |
| **Components** | `DuplicateFinder`, `BatchMarkDialog`, `BatchActionToolbar` |
| **Stores** | `curationStore` (aiWeight) |
| **API Layer** | `src/lib/api/dedup.ts` |

### 5.13 IMAGE COMPARISON
| Layer | Items |
|-------|-------|
| **Commands** | `compare_images_diff`, `compare_images_ssim`, `compare_metadata` |
| **Components** | `CompareSlider`, `DiffOverlay`, `CmodeComparison`, `SsimScore` |
| **Stores** | `curationStore` (compareMode) |
| **API Layer** | `src/lib/api/compare.ts` |

### 5.14 BACKUP & RESTORE
| Layer | Items |
|-------|-------|
| **Commands** | `create_backup`, `list_backups`, `delete_backup`, `restore_backup`, `restore_validate`, `get_backup_config`, `set_backup_config` |
| **Components** | `SettingsPage` (data management tab) |
| **Stores** | none (direct API calls) |
| **API Layer** | `src/lib/api/backup.ts` |

### 5.15 DASHBOARD & STATS
| Layer | Items |
|-------|-------|
| **Commands** | `get_library_stats`, `get_memory_stats` |
| **Components** | `DashboardPage`, `LibraryDashboard`, `FormatChart`, `RatingChart`, `CoverageBar` |
| **Stores** | none (component-local state) |
| **API Layer** | `src/lib/api/stats.ts` |

### 5.16 SETTINGS & CONFIGURATION
| Layer | Items |
|-------|-------|
| **Commands** | `check_llm_backend`, `get_llm_config`, `set_llm_config`, `list_available_models`, `check_gpu_available`, `get_speed_profile`, `set_speed_profile`, `get_gpu_info`, `suggest_speed_profile`, `check_for_updates`, `get_keybindings`, `set_keybinding`, `reset_keybindings`, `check_conflict`, `start_comfyui`, `stop_comfyui`, `get_comfyui_status`, `seed_demo_data` |
| **Components** | `SettingsPage`, `ThemeSettings`, `SpeedProfileSettings`, `UpdateBanner` |
| **Stores** | `themeStore` (theme, custom color), `uiStore` (backendStatus) |
| **API Layer** | `src/lib/api/misc.ts`, `src/lib/api/keyboard.ts`, `src/lib/api/comfyui.ts` |

### 5.17 SIMILAR IMAGE SEARCH
| Layer | Items |
|-------|-------|
| **Commands** | `find_similar_images` |
| **Components** | Image detail panel (similar images section) |
| **Stores** | `imageStore` |
| **API Layer** | `src/lib/api/misc.ts` |

---

## 6. RUST BACKEND MODULES (not in commands/)

| Module | File(s) | Purpose |
|--------|---------|---------|
| `import` | `import.rs` | Directory scan, format detection, thumbnail gen, DB insert |
| `analysis` | `analysis/mod.rs`, `pipeline.rs`, `scoring.rs`, `tests.rs` | Background worker pool, LLM+CLIP processing |
| `search` | `search.rs` | Tantivy FTS index management |
| `nl_search` | `nl_search.rs` | NL→filters via LLM |
| `clip` | `clip.rs` | Chinese-CLIP ONNX model + inference |
| `bert_tokenizer` | `bert_tokenizer.rs` | BERT tokenizer for CLIP |
| `curation` | `curation.rs` (not commands) | Session/decision DB operations |
| `scoring_integration` | `scoring_integration.rs` | scoring-engine ↔ backend bridge |
| `smart_tags` | `smart_tags/mod.rs`, `evaluator.rs`, `mapping.rs`, `tests.rs` | Tag CRUD, hierarchy, suggestions |
| `smart_folders` | `smart_folders/types.rs`, `parser.rs`, `evaluator.rs`, `builder.rs` | Rule parsing & evaluation |
| `variants` | `variants.rs` | 3-tier variant detection pipeline |
| `dedup` | `dedup.rs` | dHash dedup, near-duplicates, generation batches |
| `batch_ops` | `batch_ops.rs` | Batch mark/keep operations |
| `export` | `export/mod.rs`, `rename.rs` | Export pipeline with presets |
| `backup` | `backup/mod.rs`, `export/mod.rs`, `restore.rs` | Backup/restore logic |
| `reject_bin` | `reject_bin.rs` | Reject bin with retention |
| `comfy` | `comfy.rs` | ComfyUI process management |
| `metadata` | `metadata.rs` | PNG/JPEG/WebP metadata extraction |
| `keybindings` | `keybindings.rs` | Shortcut persistence |
| `ssim` | `ssim.rs` | SSIM image comparison |
| `llm_client` | `llm_client.rs` | LM Studio HTTP client |
| `llm_schema` | `llm_schema.rs` | LLM response JSON schemas |
| `state` | `state.rs` | App state types |
| `db` | `db.rs` | SQLite init + migrations |
| `pool` | `pool.rs` | r2d2 connection pool |
| `error` | `error.rs` | Centralized error type |
| `gpu_info` | `gpu_info.rs` | GPU detection |
| `gpu_provider` | `gpu_provider.rs` | ONNX provider selection |
| `rank_eval` | `rank_eval.rs` | Search quality evaluation |
| `demo` | `demo.rs` | Demo data seeding |
| `schema_fixup` | `schema_fixup.rs` | Migration fixups |

---

## 7. ARCHITECTURE NOTES FOR LUMORA MIGRATION

### 7.1 Key Technology Changes
| Aspect | ArcaneCodex V2 | Lumora |
|--------|---------------|--------|
| React | 18 | 19 |
| CSS | Tailwind 3 | Tailwind v4 |
| Components | Custom shadcn/ui | shadcn/ui (latest) |
| FTS | Tantivy (Rust) | SQLite FTS5 |
| Search modes | 4 (text, structured, NL, semantic) | TBD — FTS5 replaces Tantivy |
| State | Zustand 5 | TBD (Zustand or alternatives) |
| Build | Vite 5 | Vite (latest) |
| Scoring | WASM crate (scoring-engine) | TBD — can reuse or inline |

### 7.2 Gaps to Address
1. **Tantivy → FTS5 migration**: The entire search pipeline (BM25, NL search, structured search) currently runs through Tantivy. FTS5 is simpler but less feature-rich. Chinese tokenizer support (cangjie) needs an alternative.
2. **CLIP/ONNX**: The CLIP embedding + HNSW vector search pipeline is complex. Decide whether to keep or simplify.
3. **Scoring Engine**: The separate WASM crate can be kept as-is or inlined.
4. **ComfyUI integration**: Process management is platform-specific. May need rework.
5. **21 DB tables**: Full schema must be recreated with FTS5 virtual tables added.
6. **140 Tauri commands**: All IPC contracts must be ported (or simplified).

### 7.3 Event System (Backend → Frontend)
| Event | Purpose |
|-------|---------|
| `import-progress` | Import progress updates |
| `batch-progress` | Batch operation progress |
| `export-progress` | Export progress |
| `backup-progress` | Backup progress |
| `backup-complete` | Backup finished |
| `restore-complete` | Restore finished |
| `crash-recovery` | Stale task count after crash |
| `first-run` | First-run detection |
| `startup-complete` | Init done |
| `integrity-warning` | Missing files detected |
| `pending-maybe-reminder` | Pending curation decisions |
| `scoring-progress` | Batch scoring progress |

---

*End of mapping document.*
