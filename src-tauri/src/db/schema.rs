/// Raw SQL for all v1 tables, indices, and triggers.
pub const V1_CREATE_IMAGES: &str = "CREATE TABLE IF NOT EXISTS images (
    id            TEXT PRIMARY KEY,
    file_path     TEXT NOT NULL UNIQUE,
    file_hash     TEXT NOT NULL,
    file_size_kb  INTEGER NOT NULL,
    width         INTEGER,
    height        INTEGER,
    format        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    imported_at   TEXT NOT NULL DEFAULT (datetime('now')),
    deleted       INTEGER DEFAULT 0,
    rating        INTEGER DEFAULT 0,
    favorite      INTEGER DEFAULT 0,
    metadata_json TEXT
);";

pub const V1_INDEX_HASH: &str =
    "CREATE INDEX IF NOT EXISTS idx_images_file_hash ON images(file_hash);";

pub const V1_INDEX_RATING: &str =
    "CREATE INDEX IF NOT EXISTS idx_images_rating ON images(rating) WHERE deleted = 0;";

pub const V1_INDEX_CREATED: &str =
    "CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at) WHERE deleted = 0;";

pub const V1_FTS5: &str = "CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
    file_path,
    metadata_json,
    content='images',
    content_rowid='rowid'
);";

pub const V1_TRIGGER_INSERT: &str =
    "CREATE TRIGGER IF NOT EXISTS images_ai AFTER INSERT ON images BEGIN
    INSERT INTO images_fts(rowid, file_path, metadata_json)
    VALUES (new.rowid, new.file_path, new.metadata_json);
END;";

pub const V1_TRIGGER_DELETE: &str =
    "CREATE TRIGGER IF NOT EXISTS images_ad AFTER DELETE ON images BEGIN
    INSERT INTO images_fts(images_fts, rowid, file_path, metadata_json)
    VALUES ('delete', old.rowid, old.file_path, old.metadata_json);
END;";

pub const V1_TRIGGER_UPDATE: &str =
    "CREATE TRIGGER IF NOT EXISTS images_au AFTER UPDATE ON images BEGIN
    INSERT INTO images_fts(images_fts, rowid, file_path, metadata_json)
    VALUES ('delete', old.rowid, old.file_path, old.metadata_json);
    INSERT INTO images_fts(rowid, file_path, metadata_json)
    VALUES (new.rowid, new.file_path, new.metadata_json);
END;";

// ---------------------------------------------------------------------------
// V2 — Tags
// ---------------------------------------------------------------------------

pub const V2_CREATE_TAGS: &str = "CREATE TABLE IF NOT EXISTS tags (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);";

pub const V2_CREATE_IMAGE_TAGS: &str = "CREATE TABLE IF NOT EXISTS image_tags (
    image_id TEXT NOT NULL REFERENCES images(id),
    tag_id   TEXT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (image_id, tag_id)
);";

pub const V2_INDEX_IMAGE_TAGS_IMAGE: &str =
    "CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags(image_id);";

pub const V2_INDEX_IMAGE_TAGS_TAG: &str =
    "CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id);";

// ---------------------------------------------------------------------------
// V3 — deleted_at column for trash
// ---------------------------------------------------------------------------

pub const V3_ADD_DELETED_AT: &str = "ALTER TABLE images ADD COLUMN deleted_at TEXT;";

pub const V3_INDEX_DELETED_AT: &str =
    "CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at) WHERE deleted = 1;";

// ---------------------------------------------------------------------------
// V4 — Embeddings for vector search
// ---------------------------------------------------------------------------

pub const V4_CREATE_EMBEDDINGS: &str = "CREATE TABLE IF NOT EXISTS embeddings (
    image_id     TEXT PRIMARY KEY REFERENCES images(id),
    embedding    BLOB NOT NULL,
    dimensions   INTEGER NOT NULL DEFAULT 512,
    status       TEXT NOT NULL DEFAULT 'embedded' CHECK(status IN ('embedded', 'pending', 'error')),
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);";

pub const V4_CREATE_VEC_TABLE: &str =
    "CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
    image_id TEXT PRIMARY KEY,
    embedding float[768]
);";

// ---------------------------------------------------------------------------
// V5 — AI Analysis history
// ---------------------------------------------------------------------------

pub const V5_CREATE_ANALYSIS_HISTORY: &str = "CREATE TABLE IF NOT EXISTS analysis_history (
    id           TEXT PRIMARY KEY,
    image_id     TEXT NOT NULL REFERENCES images(id),
    result_json  TEXT NOT NULL,
    analyzed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);";

pub const V5_INDEX_ANALYSIS_IMAGE: &str =
    "CREATE INDEX IF NOT EXISTS idx_analysis_history_image ON analysis_history(image_id);";

// ---------------------------------------------------------------------------
// V6 — Variant groups (images sharing the same SD prompt)
// ---------------------------------------------------------------------------

pub const V6_CREATE_VARIANT_GROUPS: &str = "CREATE TABLE IF NOT EXISTS variant_groups (
    id         TEXT PRIMARY KEY,
    prompt     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);";

pub const V6_ADD_VARIANT_GROUP_ID: &str =
    "ALTER TABLE images ADD COLUMN variant_group_id TEXT REFERENCES variant_groups(id);";
