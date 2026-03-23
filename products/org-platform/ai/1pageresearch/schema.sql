CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    intervention TEXT NOT NULL,
    outcome TEXT NOT NULL,
    source_communities TEXT NOT NULL,
    sample_size INTEGER,
    effect_summary TEXT NOT NULL,
    p_value REAL,
    p_value_display TEXT,
    effect_size REAL,
    effect_size_label TEXT,
    confidence_interval TEXT,
    stats_json TEXT NOT NULL DEFAULT '[]',
    report_markdown TEXT NOT NULL,
    tags TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS free_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    report_slug TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paid_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    report_slug TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
