use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: r#"
                CREATE TABLE IF NOT EXISTS workspaces (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS pages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    workspace_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(workspace_id) 
                        REFERENCES workspaces(id)
                        ON DELETE CASCADE 
                        ON UPDATE CASCADE
                );

                CREATE TABLE IF NOT EXISTS markdowns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    page_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(page_id) 
                        REFERENCES pages(id)
                        ON DELETE CASCADE 
                        ON UPDATE CASCADE
                );

                -- Create indexes for better performance
                CREATE INDEX IF NOT EXISTS idx_pages_workspace_id 
                    ON pages(workspace_id);
                
                CREATE INDEX IF NOT EXISTS idx_markdowns_page_id 
                    ON markdowns(page_id);
                
                CREATE INDEX IF NOT EXISTS idx_pages_position 
                    ON pages(workspace_id, position);
                
                CREATE INDEX IF NOT EXISTS idx_markdowns_position 
                    ON markdowns(page_id, position);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "Drop initial_schema",
            sql: r#"
                DROP INDEX IF EXISTS idx_markdowns_position;
                DROP INDEX IF EXISTS idx_pages_position;
                DROP INDEX IF EXISTS idx_markdowns_page_id;
                DROP INDEX IF EXISTS idx_pages_workspace_id;
                
                DROP TABLE IF EXISTS markdowns;
                DROP TABLE IF EXISTS pages;
                DROP TABLE IF EXISTS workspaces;
            "#,
            kind: MigrationKind::Down,
        }
    ]
}