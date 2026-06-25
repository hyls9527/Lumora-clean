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

pub const V3_ADD_DELETED_AT: &str =
    "ALTER TABLE images ADD COLUMN deleted_at TEXT;";

pub const V3_INDEX_DELETED_AT: &str =
    "CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at) WHERE deleted = 1;";
