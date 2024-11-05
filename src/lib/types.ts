// src/lib/types.ts
export interface Workspace {
    id: number;
    name: string;
}

export interface Page {
    id: number;
    title: string;
    position: number;
    workspace_id: number;
}

export interface Markdown {
id: number;
content: string;
position: number;
page_id: number;
}

export interface WorkspaceExport {
workspace: Workspace;
pages: PageExport[];
}

export interface PageExport {
page: Page;
markdowns: Markdown[];
}