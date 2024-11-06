import Database from '@tauri-apps/plugin-sql';
import { Workspace, Page, Markdown, WorkspaceExport } from './types';

class DatabaseService {
  private db: Database | null = null;
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return this.db;

    try {
      this.db = await Database.load('sqlite:ekandata.db');
      this.initialized = true;
      return this.db;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async getDb() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.db!;
  }

  // Workspace operations
  async createWorkspace(name: string): Promise<number> {
    const db = await this.getDb();
    const result = await db.execute(
      'INSERT INTO workspaces (name) VALUES ($1) RETURNING id',
      [name]
    );
    return result.lastInsertId;
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const db = await this.getDb();
    const result = await db.select<Workspace[]>(
      'SELECT id, name FROM workspaces ORDER BY id'
    );
    return result;
  }

  async getAWorkspace(workspaceId: number): Promise<Workspace> {
    const db = await this.getDb();
    const resultArray = await db.select<Workspace[]>(
      'SELECT id, name FROM workspaces WHERE id=$1', [workspaceId]
    );
    const result = resultArray[0];
    return result;
  }

  async deleteWorkspace(workspaceId: number): Promise<void> {
    const db = await this.getDb();
    // No need for manual cascade deletion since it's handled by the database
    await db.execute('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
  }

  // Page operations
  async createPage(title: string, workspaceId: number): Promise<number> {
    const db = await this.getDb();
    
    // Get next position
    const posResult = await db.select<[{ next_pos: number }]>(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM pages WHERE workspace_id = $1',
      [workspaceId]
    );
    const position = posResult[0].next_pos;
    
    const result = await db.execute(
      'INSERT INTO pages (title, position, workspace_id) VALUES ($1, $2, $3) RETURNING id',
      [title, position, workspaceId]
    );
    return result.lastInsertId;
  }

  async getPages(workspaceId: number): Promise<Page[]> {
    const db = await this.getDb();
    const result = await db.select<Page[]>(
      'SELECT id, title, position, workspace_id FROM pages WHERE workspace_id = $1 ORDER BY position',
      [workspaceId]
    );
    return result;
  }

  async getPage(pageId: number): Promise<Page> {
    const db = await this.getDb();
    const result = await db.select<Page[]>(
      'SELECT id, title, position, workspace_id FROM pages WHERE id = $1',
      [pageId]
    );
    if (result.length === 0) {
      throw new Error('Page not found');
    }
    return result[0];
  }

  async deletePage(pageId: number): Promise<void> {
    const db = await this.getDb();
    // No need for manual cascade deletion since it's handled by the database
    await db.execute('DELETE FROM pages WHERE id = $1', [pageId]);
  }

  // Markdown operations
  async addMarkdown(content: string, pageId: number): Promise<number> {
    const db = await this.getDb();
    
    // Get next position
    const posResult = await db.select<[{ next_pos: number }]>(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM markdowns WHERE page_id = $1',
      [pageId]
    );
    const position = posResult[0].next_pos;
    
    const result = await db.execute(
      'INSERT INTO markdowns (content, position, page_id) VALUES ($1, $2, $3) RETURNING id',
      [content, position, pageId]
    );
    return result.lastInsertId;
  }

  async getMarkdowns(pageId: number): Promise<Markdown[]> {
    const db = await this.getDb();
    const result = await db.select<Markdown[]>(
      'SELECT id, content, position, page_id FROM markdowns WHERE page_id = $1 ORDER BY position',
      [pageId]
    );
    return result;
  }

  // Export/Import operations
  async exportWorkspace(workspaceId: number): Promise<WorkspaceExport> {
    const workspaceResult = await (await this.getDb()).select<Workspace[]>(
      'SELECT id, name FROM workspaces WHERE id = $1',
      [workspaceId]
    );

    if (workspaceResult.length === 0) {
      throw new Error('Workspace not found');
    }

    const workspace: Workspace = workspaceResult[0];
    const pages = await this.getPages(workspaceId);
    const pageExports = await Promise.all(
      pages.map(async (page) => ({
        page,
        markdowns: await this.getMarkdowns(page.id)
      }))
    );

    return {
      workspace: workspace,
      pages: pageExports
    };
  }

  async importWorkspace(workspaceExport: WorkspaceExport): Promise<number> {
    const db = await this.getDb();
    
    try {
      await db.execute('BEGIN TRANSACTION');

      // Create workspace
      const workspaceResult = await db.execute(
        'INSERT INTO workspaces (name) VALUES ($1) RETURNING id',
        [workspaceExport.workspace.name]
      );
      const workspaceId = workspaceResult.lastInsertId;

      // Import pages and markdowns
      for (const pageExport of workspaceExport.pages) {
        const pageResult = await db.execute(
          'INSERT INTO pages (title, position, workspace_id) VALUES ($1, $2, $3) RETURNING id',
          [pageExport.page.title, pageExport.page.position, workspaceId]
        );
        const pageId = pageResult.lastInsertId;

        for (const markdown of pageExport.markdowns) {
          await db.execute(
            'INSERT INTO markdowns (content, position, page_id) VALUES ($1, $2, $3)',
            [markdown.content, markdown.position, pageId]
          );
        }
      }

      await db.execute('COMMIT');
      return workspaceId;
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  }

  // Navigation helpers
  async getNextPage(currentPageId: number): Promise<Page | null> {
    const currentPage = await this.getPage(currentPageId);
    const pages = await this.getPages(currentPage.workspace_id);
    const currentIndex = pages.findIndex(p => p.id === currentPageId);
    return currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;
  }

  async getPreviousPage(currentPageId: number): Promise<Page | null> {
    const currentPage = await this.getPage(currentPageId);
    const pages = await this.getPages(currentPage.workspace_id);
    const currentIndex = pages.findIndex(p => p.id === currentPageId);
    return currentIndex > 0 ? pages[currentIndex - 1] : null;
  }
}

// Export a singleton instance
export const db = new DatabaseService();