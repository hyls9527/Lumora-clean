-- Images table
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    file_size_kb INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    format TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    rating INTEGER DEFAULT 0,
    favorite INTEGER DEFAULT 0,
    llm_json TEXT,
    clip_vector BLOB,
    metadata_json TEXT
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES tags(id),
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Image-tag association
CREATE TABLE IF NOT EXISTS image_tags (
    image_id INTEGER NOT NULL REFERENCES images(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (image_id, tag_id)
);

-- App configuration
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
    file_path,
    metadata_json,
    llm_json,
    content='images',
    content_rowid='id'
);

-- FTS5 sync triggers
CREATE TRIGGER IF NOT EXISTS images_ai AFTER INSERT ON images BEGIN
    INSERT INTO images_fts(rowid, file_path, metadata_json, llm_json)
    VALUES (new.id, new.file_path, new.metadata_json, new.llm_json);
END;

CREATE TRIGGER IF NOT EXISTS images_ad AFTER DELETE ON images BEGIN
    INSERT INTO images_fts(images_fts, rowid, file_path, metadata_json, llm_json)
    VALUES ('delete', old.id, old.file_path, old.metadata_json, old.llm_json);
END;

CREATE TRIGGER IF NOT EXISTS images_au AFTER UPDATE ON images BEGIN
    INSERT INTO images_fts(images_fts, rowid, file_path, metadata_json, llm_json)
    VALUES ('delete', old.id, old.file_path, old.metadata_json, old.llm_json);
    INSERT INTO images_fts(rowid, file_path, metadata_json, llm_json)
    VALUES (new.id, new.file_path, new.metadata_json, new.llm_json);
END;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_images_file_hash ON images(file_hash);
CREATE INDEX IF NOT EXISTS idx_images_rating ON images(rating) WHERE deleted = 0;
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at) WHERE deleted = 0;
CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id);
