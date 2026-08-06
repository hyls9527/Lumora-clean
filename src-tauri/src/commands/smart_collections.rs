use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::schema::types::{row_to_record, PaginatedResult};

/// One rule inside a smart collection.
/// Supported combos:
///   model  + equals, format + equals, rating + gte/lte,
///   date + gte/lte, prompt + contains, tag + equals/in (comma-separated names).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartCollectionRule {
    pub field: String,
    pub op: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartCollection {
    pub id: String,
    pub name: String,
    pub rules: Vec<SmartCollectionRule>,
    pub created_at: String,
    /// Number of images currently matching all rules.
    pub count: i64,
}

fn validate_date(value: &str) -> AppResult<()> {
    let v = value.trim();
    let bytes = v.as_bytes();
    let ok = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && v[0..4].chars().all(|c| c.is_ascii_digit())
        && v[5..7].chars().all(|c| c.is_ascii_digit())
        && v[8..10].chars().all(|c| c.is_ascii_digit());
    if !ok {
        return Err(AppError::InvalidInput(
            "日期规则必须是 YYYY-MM-DD 格式".into(),
        ));
    }
    let month: u32 = v[5..7].parse().unwrap_or(0);
    let day: u32 = v[8..10].parse().unwrap_or(0);
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err(AppError::InvalidInput(
            "日期规则必须是 YYYY-MM-DD 格式".into(),
        ));
    }
    Ok(())
}

fn validate_rules(rules: &[SmartCollectionRule]) -> AppResult<()> {
    if rules.is_empty() {
        return Err(AppError::InvalidInput(
            "智能收藏至少需要一条筛选规则".into(),
        ));
    }
    for rule in rules {
        match (rule.field.as_str(), rule.op.as_str()) {
            ("model" | "format", "equals") => {}
            ("rating", "gte" | "lte") => {
                rule.value
                    .trim()
                    .parse::<u32>()
                    .map_err(|_| AppError::InvalidInput("评分规则的值必须是数字".into()))?;
            }
            ("score", "equals") => {
                if !matches!(rule.value.trim(), "夯" | "稳" | "拉") {
                    return Err(AppError::InvalidInput(
                        "审美档规则的值必须是：夯 / 稳 / 拉".into(),
                    ));
                }
            }
            ("date", "gte" | "lte") => validate_date(&rule.value)?,
            ("prompt", "contains") => {}
            ("tag", "equals") => {}
            ("tag", "in") => {
                let names: Vec<&str> = rule
                    .value
                    .split(',')
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .collect();
                if names.is_empty() {
                    return Err(AppError::InvalidInput("标签规则至少需要一个标签名".into()));
                }
            }
            _ => {
                return Err(AppError::InvalidInput(format!(
                    "不支持的筛选规则: {} {}",
                    rule.field, rule.op
                )));
            }
        }
    }
    Ok(())
}

/// Build the WHERE clause (with bound params) for a rule set.
/// Images are referenced as `i` (aliased in the FROM clause).
fn build_where(
    rules: &[SmartCollectionRule],
) -> AppResult<(String, Vec<Box<dyn rusqlite::types::ToSql>>)> {
    let mut conditions = vec!["i.deleted = 0".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    for rule in rules {
        let next = params.len() + 1;
        match (rule.field.as_str(), rule.op.as_str()) {
            ("model", "equals") => {
                conditions.push(format!(
                    "json_extract(i.metadata_json, '$.model') = ?{next}"
                ));
                params.push(Box::new(rule.value.clone()));
            }
            ("format", "equals") => {
                conditions.push(format!("i.format = ?{next}"));
                params.push(Box::new(rule.value.clone()));
            }
            ("rating", "gte") | ("rating", "lte") => {
                let value: u32 = rule
                    .value
                    .trim()
                    .parse()
                    .map_err(|_| AppError::InvalidInput("评分规则的值必须是数字".into()))?;
                let cmp = if rule.op == "gte" { ">=" } else { "<=" };
                conditions.push(format!("i.rating {cmp} ?{next}"));
                params.push(Box::new(value.min(5)));
            }
            ("date", "gte") => {
                validate_date(&rule.value)?;
                conditions.push(format!("i.created_at >= ?{next}"));
                params.push(Box::new(rule.value.trim().to_string()));
            }
            ("date", "lte") => {
                validate_date(&rule.value)?;
                // Half-open range: created_at < (value + 1 day) includes the
                // whole end day, matching list_images_filtered semantics.
                conditions.push(format!("i.created_at < date(?{next}, '+1 day')"));
                params.push(Box::new(rule.value.trim().to_string()));
            }
            ("prompt", "contains") => {
                conditions.push(format!(
                    "instr(lower(COALESCE(json_extract(i.metadata_json, '$.prompt'), '')), lower(?{next})) > 0"
                ));
                params.push(Box::new(rule.value.clone()));
            }
            ("score", "equals") => {
                let value = rule.value.trim();
                if !matches!(value, "夯" | "稳" | "拉") {
                    return Err(AppError::InvalidInput(
                        "审美档规则的值必须是：夯 / 稳 / 拉".into(),
                    ));
                }
                conditions.push(format!("i.score_label = ?{next}"));
                params.push(Box::new(value.to_string()));
            }
            ("tag", "equals") => {
                conditions.push(format!(
                    "EXISTS (SELECT 1 FROM image_tags it JOIN tags tg ON tg.id = it.tag_id \
                     WHERE it.image_id = i.id AND tg.name = ?{next})"
                ));
                params.push(Box::new(rule.value.clone()));
            }
            ("tag", "in") => {
                let names: Vec<String> = rule
                    .value
                    .split(',')
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(String::from)
                    .collect();
                let mut placeholders = Vec::with_capacity(names.len());
                for name in &names {
                    placeholders.push(format!("?{}", params.len() + 1));
                    params.push(Box::new(name.clone()));
                }
                conditions.push(format!(
                    "EXISTS (SELECT 1 FROM image_tags it JOIN tags tg ON tg.id = it.tag_id \
                     WHERE it.image_id = i.id AND tg.name IN ({}))",
                    placeholders.join(",")
                ));
            }
            _ => {
                return Err(AppError::InvalidInput(format!(
                    "不支持的筛选规则: {} {}",
                    rule.field, rule.op
                )));
            }
        }
    }

    Ok((conditions.join(" AND "), params))
}

fn count_matching(conn: &Connection, rules: &[SmartCollectionRule]) -> AppResult<i64> {
    let (where_sql, params) = build_where(rules)?;
    let count = conn.query_row(
        &format!("SELECT COUNT(*) FROM images i WHERE {where_sql}"),
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
        |row| row.get(0),
    )?;
    Ok(count)
}

fn load_rules(conn: &Connection, id: &str) -> AppResult<Vec<SmartCollectionRule>> {
    let rules_json: String = conn
        .query_row(
            "SELECT rules_json FROM smart_collections WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|_| AppError::NotFound(format!("智能收藏不存在: {id}")))?;
    serde_json::from_str(&rules_json).map_err(|_| AppError::External("智能收藏规则数据损坏".into()))
}

fn list_smart_collections_inner(db: &DbHandle) -> AppResult<Vec<SmartCollection>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, rules_json, created_at FROM smart_collections ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?;

    let mut collections = Vec::new();
    for row in rows {
        let (id, name, rules_json, created_at) = row?;
        let rules: Vec<SmartCollectionRule> = serde_json::from_str(&rules_json).unwrap_or_default();
        let count = count_matching(&conn, &rules)?;
        collections.push(SmartCollection {
            id,
            name,
            rules,
            created_at,
            count,
        });
    }
    Ok(collections)
}

fn create_smart_collection_inner(
    db: &DbHandle,
    name: String,
    rules: Vec<SmartCollectionRule>,
) -> AppResult<SmartCollection> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("智能收藏名称不能为空".into()));
    }
    validate_rules(&rules)?;

    let id = uuid::Uuid::new_v4().to_string();
    let rules_json = serde_json::to_string(&rules)?;
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    conn.execute(
        "INSERT INTO smart_collections (id, name, rules_json) VALUES (?1, ?2, ?3)",
        params![id, name, rules_json],
    )?;
    let created_at: String = conn.query_row(
        "SELECT created_at FROM smart_collections WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    let count = count_matching(&conn, &rules)?;
    Ok(SmartCollection {
        id,
        name: name.to_string(),
        rules,
        created_at,
        count,
    })
}

fn update_smart_collection_inner(
    db: &DbHandle,
    id: String,
    name: String,
    rules: Vec<SmartCollectionRule>,
) -> AppResult<SmartCollection> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("智能收藏名称不能为空".into()));
    }
    validate_rules(&rules)?;

    let rules_json = serde_json::to_string(&rules)?;
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let updated = conn.execute(
        "UPDATE smart_collections SET name = ?1, rules_json = ?2 WHERE id = ?3",
        params![name, rules_json, id],
    )?;
    if updated == 0 {
        return Err(AppError::NotFound(format!("智能收藏不存在: {id}")));
    }
    let created_at: String = conn.query_row(
        "SELECT created_at FROM smart_collections WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    let count = count_matching(&conn, &rules)?;
    Ok(SmartCollection {
        id,
        name: name.to_string(),
        rules,
        created_at,
        count,
    })
}

fn delete_smart_collection_inner(db: &DbHandle, id: String) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let deleted = conn.execute("DELETE FROM smart_collections WHERE id = ?1", params![id])?;
    if deleted == 0 {
        return Err(AppError::NotFound(format!("智能收藏不存在: {id}")));
    }
    Ok(())
}

/// Paginated images matching a smart collection's rules.
fn get_smart_collection_images_inner(
    db: &DbHandle,
    id: String,
    page: u32,
    per_page: u32,
) -> AppResult<PaginatedResult> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let rules = load_rules(&conn, &id)?;
    let (where_sql, mut params) = build_where(&rules)?;
    let offset = page.saturating_sub(1) * per_page;

    let total: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM images i WHERE {where_sql}"),
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
        |row| row.get(0),
    )?;

    let data_sql = format!(
        "SELECT i.* FROM images i WHERE {where_sql} \
         ORDER BY i.imported_at DESC LIMIT ?{} OFFSET ?{}",
        params.len() + 1,
        params.len() + 2
    );
    params.push(Box::new(per_page));
    params.push(Box::new(offset));

    let mut stmt = conn.prepare(&data_sql)?;
    let items = stmt
        .query_map(
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
            row_to_record,
        )?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(PaginatedResult {
        items,
        total,
        page,
        per_page,
    })
}

#[tauri::command]
pub fn list_smart_collections(db: tauri::State<'_, DbHandle>) -> AppResult<Vec<SmartCollection>> {
    list_smart_collections_inner(&db)
}

#[tauri::command]
pub fn create_smart_collection(
    db: tauri::State<'_, DbHandle>,
    name: String,
    rules: Vec<SmartCollectionRule>,
) -> AppResult<SmartCollection> {
    create_smart_collection_inner(&db, name, rules)
}

#[tauri::command]
pub fn update_smart_collection(
    db: tauri::State<'_, DbHandle>,
    id: String,
    name: String,
    rules: Vec<SmartCollectionRule>,
) -> AppResult<SmartCollection> {
    update_smart_collection_inner(&db, id, name, rules)
}

#[tauri::command]
pub fn delete_smart_collection(db: tauri::State<'_, DbHandle>, id: String) -> AppResult<()> {
    delete_smart_collection_inner(&db, id)
}

#[tauri::command]
pub fn get_smart_collection_images(
    db: tauri::State<'_, DbHandle>,
    id: String,
    page: u32,
    per_page: u32,
) -> AppResult<PaginatedResult> {
    get_smart_collection_images_inner(&db, id, page, per_page)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> crate::db::DbHandle {
        crate::db::DbHandle::open_memory().unwrap()
    }

    fn insert_image(
        conn: &Connection,
        id: &str,
        format: &str,
        created_at: &str,
        rating: u32,
        metadata_json: Option<&str>,
    ) {
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,rating,metadata_json)
             VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7)",
            params![
                id,
                format!("/{id}.png"),
                format!("hash-{id}"),
                format,
                created_at,
                rating,
                metadata_json,
            ],
        )
        .unwrap();
    }

    fn insert_tag(conn: &Connection, tag_id: &str, name: &str) {
        conn.execute(
            "INSERT INTO tags (id, name) VALUES (?1, ?2)",
            params![tag_id, name],
        )
        .unwrap();
    }

    fn tag_image(conn: &Connection, image_id: &str, tag_id: &str) {
        conn.execute(
            "INSERT INTO image_tags (image_id, tag_id) VALUES (?1, ?2)",
            params![image_id, tag_id],
        )
        .unwrap();
    }

    fn rule(field: &str, op: &str, value: &str) -> SmartCollectionRule {
        SmartCollectionRule {
            field: field.into(),
            op: op.into(),
            value: value.into(),
        }
    }

    #[test]
    fn create_list_update_delete_roundtrip() {
        let db = test_db();
        let created = create_smart_collection_inner(
            &db,
            "High rated".into(),
            vec![rule("rating", "gte", "4")],
        )
        .unwrap();
        assert_eq!(created.name, "High rated");
        assert_eq!(created.count, 0);

        let list = list_smart_collections_inner(&db).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, created.id);

        let updated = update_smart_collection_inner(
            &db,
            created.id.clone(),
            "Renamed".into(),
            vec![rule("rating", "gte", "5")],
        )
        .unwrap();
        assert_eq!(updated.name, "Renamed");
        assert_eq!(updated.rules[0].value, "5");

        delete_smart_collection_inner(&db, created.id.clone()).unwrap();
        assert!(list_smart_collections_inner(&db).unwrap().is_empty());
    }

    #[test]
    fn empty_name_rejected() {
        let db = test_db();
        let err =
            create_smart_collection_inner(&db, "  ".into(), vec![rule("format", "equals", "png")])
                .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn empty_rules_rejected() {
        let db = test_db();
        let err = create_smart_collection_inner(&db, "Empty".into(), vec![]).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn unsupported_rule_rejected() {
        let db = test_db();
        let err =
            create_smart_collection_inner(&db, "Bad".into(), vec![rule("seed", "equals", "42")])
                .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn model_format_rating_rules_match() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(
                &conn,
                "a",
                "png",
                "2025-01-01",
                5,
                Some(r#"{"model":"sd1.5"}"#),
            );
            insert_image(
                &conn,
                "b",
                "jpg",
                "2025-01-02",
                3,
                Some(r#"{"model":"sd1.5"}"#),
            );
            insert_image(
                &conn,
                "c",
                "png",
                "2025-01-03",
                4,
                Some(r#"{"model":"flux"}"#),
            );
        }

        let rules = vec![
            rule("model", "equals", "sd1.5"),
            rule("format", "equals", "png"),
            rule("rating", "gte", "4"),
        ];
        let count = count_matching(&db.conn().lock().unwrap(), &rules).unwrap();
        assert_eq!(count, 1);

        let result = get_smart_collection_images_inner(&db, "missing".into(), 1, 40).unwrap_err();
        assert!(matches!(result, AppError::NotFound(_)));
    }

    #[test]
    fn prompt_contains_rule_matches() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(
                &conn,
                "a",
                "png",
                "2025-01-01",
                0,
                Some(r#"{"prompt":"a cat in the moonlight"}"#),
            );
            insert_image(
                &conn,
                "b",
                "png",
                "2025-01-02",
                0,
                Some(r#"{"prompt":"a dog in the park"}"#),
            );
        }
        let count = count_matching(
            &db.conn().lock().unwrap(),
            &[rule("prompt", "contains", "MOONLIGHT")],
        )
        .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn tag_rules_match_equals_and_in() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "a", "png", "2025-01-01", 0, None);
            insert_image(&conn, "b", "png", "2025-01-02", 0, None);
            insert_image(&conn, "c", "png", "2025-01-03", 0, None);
            insert_tag(&conn, "t1", "landscape");
            insert_tag(&conn, "t2", "portrait");
            tag_image(&conn, "a", "t1");
            tag_image(&conn, "b", "t2");
        }

        let count = count_matching(
            &db.conn().lock().unwrap(),
            &[rule("tag", "equals", "landscape")],
        )
        .unwrap();
        assert_eq!(count, 1);

        let count = count_matching(
            &db.conn().lock().unwrap(),
            &[rule("tag", "in", "landscape, portrait")],
        )
        .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn deleted_images_excluded() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "a", "png", "2025-01-01", 0, None);
            insert_image(&conn, "b", "png", "2025-01-02", 0, None);
            conn.execute("UPDATE images SET deleted = 1 WHERE id = 'b'", [])
                .unwrap();
        }
        let count = count_matching(
            &db.conn().lock().unwrap(),
            &[rule("format", "equals", "png")],
        )
        .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn date_rules_match_range_including_end_day() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "a", "png", "2025-01-01T10:00:00", 0, None);
            insert_image(&conn, "b", "png", "2025-01-15T10:00:00", 0, None);
            insert_image(&conn, "c", "png", "2025-02-01T10:00:00", 0, None);
        }
        let count = count_matching(
            &db.conn().lock().unwrap(),
            &[rule("date", "gte", "2025-01-10")],
        )
        .unwrap();
        assert_eq!(count, 2);

        // lte includes the whole end day.
        let count = count_matching(
            &db.conn().lock().unwrap(),
            &[rule("date", "lte", "2025-01-15")],
        )
        .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn invalid_date_rejected() {
        let db = test_db();
        for bad in ["2025-13-01", "2025-01-32", "2025/01/01", "abc"] {
            let err = create_smart_collection_inner(
                &db,
                "Bad date".into(),
                vec![rule("date", "gte", bad)],
            )
            .unwrap_err();
            assert!(matches!(err, AppError::InvalidInput(_)), "value: {bad}");
        }
    }

    #[test]
    fn rating_lte_matches() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "a", "png", "2025-01-01", 3, None);
            insert_image(&conn, "b", "png", "2025-01-02", 4, None);
            insert_image(&conn, "c", "png", "2025-01-03", 5, None);
        }
        let count =
            count_matching(&db.conn().lock().unwrap(), &[rule("rating", "lte", "4")]).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn rating_value_clamped_to_five() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "a", "png", "2025-01-01", 5, None);
            insert_image(&conn, "b", "png", "2025-01-02", 4, None);
        }
        let count =
            count_matching(&db.conn().lock().unwrap(), &[rule("rating", "gte", "7")]).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn tag_in_empty_value_rejected() {
        let db = test_db();
        let err = create_smart_collection_inner(
            &db,
            "Empty tags".into(),
            vec![rule("tag", "in", "  ,  ")],
        )
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn score_rule_matches_tiers() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "a", "png", "2025-01-01", 0, None);
            insert_image(&conn, "b", "png", "2025-01-02", 0, None);
            insert_image(&conn, "c", "png", "2025-01-03", 0, None);
            conn.execute("UPDATE images SET score_label = '夯' WHERE id = 'a'", [])
                .unwrap();
            conn.execute("UPDATE images SET score_label = '拉' WHERE id = 'b'", [])
                .unwrap();
        }
        let conn = db.conn().lock().unwrap();
        let count = count_matching(&conn, &[rule("score", "equals", "夯")]).unwrap();
        assert_eq!(count, 1);
        let count = count_matching(&conn, &[rule("score", "equals", "拉")]).unwrap();
        assert_eq!(count, 1);
        let count = count_matching(&conn, &[rule("score", "equals", "稳")]).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn invalid_score_rule_rejected() {
        let db = test_db();
        let err = create_smart_collection_inner(
            &db,
            "Bad score".into(),
            vec![rule("score", "equals", "神")],
        )
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
        let err =
            create_smart_collection_inner(&db, "Bad op".into(), vec![rule("score", "gte", "夯")])
                .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn update_missing_collection_not_found() {
        let db = test_db();
        let err = update_smart_collection_inner(
            &db,
            "missing".into(),
            "X".into(),
            vec![rule("format", "equals", "png")],
        )
        .unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn delete_missing_collection_not_found() {
        let db = test_db();
        let err = delete_smart_collection_inner(&db, "missing".into()).unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn collection_images_pagination_offset() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            for i in 0..45 {
                insert_image(&conn, &format!("p-{i:02}"), "png", "2025-01-01", 0, None);
            }
        }
        let collection =
            create_smart_collection_inner(&db, "All".into(), vec![rule("format", "equals", "png")])
                .unwrap();
        assert_eq!(collection.count, 45);

        let page1 = get_smart_collection_images_inner(&db, collection.id.clone(), 1, 40).unwrap();
        assert_eq!(page1.total, 45);
        assert_eq!(page1.items.len(), 40);

        let page2 = get_smart_collection_images_inner(&db, collection.id, 2, 40).unwrap();
        assert_eq!(page2.total, 45);
        assert_eq!(page2.items.len(), 5);
    }
}
