'use client'

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { ArrowUp, MoveLeft, MoveRight, Plus, Save, Trash2, Upload } from "lucide-react";
import * as dialog from '@tauri-apps/plugin-dialog';
import { db } from '@/lib/db';
import type { Workspace, Page, Markdown } from '@/lib/types';
import { DialogInput } from './components/DialogInout';
import Form from "next/form";

export default function Home() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [markdowns, setMarkdowns] = useState<Markdown[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const [isPageTitleDialogOpen, setIsPageTitleDialogOpen] = useState(false);
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [pageTitleInput, setPageTitleInput] = useState('');

  const inputRef = useRef<HTMLDivElement>(null);

  // Function declarations
  const loadMarkdowns = async (pageId: number) => {
    try {
      const markdownList = await db.getMarkdowns(pageId);
      setMarkdowns(markdownList);
    } catch (error) {
      console.error('Error loading markdowns:', error);
    }
  };

  const loadPages = async (workspaceId: number) => {
    try {
      const pageList = await db.getPages(workspaceId);
      setPages(pageList);
      if (pageList.length > 0) {
        setCurrentPage(pageList[0]);
        await loadMarkdowns(pageList[0].id);
      } else {
        setCurrentPage(null);
        setMarkdowns([]);
      }
    } catch (error) {
      console.error('Error loading pages:', error);
    }
  };

  const loadWorkspaces = async () => {
    try {
      const workspaceList = await db.getWorkspaces();
      setWorkspaces(workspaceList);
      
      if (workspaceList.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(workspaceList[0]);
        await loadPages(workspaceList[0].id);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      throw error;
    }
  };

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await db.initialize();
      await loadWorkspaces();
    } catch (error) {
      console.error('Error initializing app:', error);
      setError('Failed to initialize application. Please try again.');
      
      await dialog.message('Failed to initialize application. Please restart the app.', {
        title: 'Error',
        kind: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers
  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;
    
    try {
      const confirmed = await dialog.ask('Are you sure you would like to delete this workspace?', {
        title: 'Delete Workspace',
        kind: 'warning'
      });

      if (confirmed) {
        await db.deleteWorkspace(currentWorkspace.id);
        setCurrentWorkspace(null);
        setCurrentPage(null);
        setPages([]);
        setMarkdowns([]);
        await loadWorkspaces();

        await dialog.message('Workspace deleted successfully', { 
          title: 'Success',
          kind: 'info'
        });
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      await dialog.message('Error deleting workspace', { 
        title: 'Error',
        kind: 'error'
      });
    }
  };

  const handleDeletePage = async () => {
    if (!currentPage) return;
    
    try {
      const confirmed = await dialog.ask('Are you sure you would like to delete this page?', {
        title: 'Delete Page',
        kind: 'warning'
      });

      if (confirmed) {
        await db.deletePage(currentPage.id);
        setCurrentPage(null);
        setMarkdowns([]);
        
        if (currentWorkspace) {
          await loadPages(currentWorkspace.id);
        }

        await dialog.message('Page deleted successfully', { 
          title: 'Success',
          kind: 'info'
        });
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      await dialog.message('Error deleting page', { 
        title: 'Error',
        kind: 'error'
      });
    }
  };

  const handleNewWorkspace = async (name: string) => {
    try {
      if (name.trim()) {
        const workspaceId = await db.createWorkspace(name);
        await loadWorkspaces();
        
        const workspace = workspaces.find(w => w.id === workspaceId);
        if (workspace) {
          setCurrentWorkspace(workspace);
          await loadPages(workspaceId);
        }
        
        setIsWorkspaceDialogOpen(false);
        setWorkspaceInput('');
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      await dialog.message('Error creating workspace', { 
        title: 'Error',
        kind: 'error'
      });
    }
  };

  const handleNewPage = async (title: string) => {
    if (!currentWorkspace || !title.trim()) return;
    
    try {
      const pageId = await db.createPage(title, currentWorkspace.id);
      await loadPages(currentWorkspace.id);
      
      const newPage = await db.getPage(pageId);
      setCurrentPage(newPage);
      await loadMarkdowns(pageId);
      
      setIsPageTitleDialogOpen(false);
      setPageTitleInput('');
    } catch (error) {
      console.error('Error creating page:', error);
      await dialog.message('Error creating page', { 
        title: 'Error',
        kind: 'error'
      });
    }
  };

  // Effects
  useEffect(() => {
    initializeApp();
  }, []);

  // Loading and error states
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-sm text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  // Navigation handlers
  const handlePreviousPage = async () => {
    if (!currentPage) return;
    try {
      const prevPage = await db.getPreviousPage(currentPage.id);
      if (prevPage) {
        setCurrentPage(prevPage);
        loadMarkdowns(prevPage.id);
      }
    } catch (error) {
      console.error('Error navigating to previous page:', error);
    }
  };

  const handleNextPage = async () => {
    if (!currentPage) return;
    try {
      const nextPage = await db.getNextPage(currentPage.id);
      if (nextPage) {
        setCurrentPage(nextPage);
        loadMarkdowns(nextPage.id);
      }
    } catch (error) {
      console.error('Error navigating to next page:', error);
    }
  };

  // Handle markdown input
  const handleInputChange = () => {
    if (inputRef.current) {
      setInputContent(inputRef.current.textContent || '');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!currentPage || !inputContent.trim()) return;
    try {
      // Note: You'll need to implement markdown processing if needed
      const processedContent = inputContent; // Add processing logic if needed
      await db.addMarkdown(processedContent, currentPage.id);
      await loadMarkdowns(currentPage.id);
      setInputContent('');
      if (inputRef.current) {
        inputRef.current.textContent = '';
      }
    } catch (error) {
      console.error('Error adding markdown:', error);
    }
  };

  // Export/Import handlers
  const handleExportWorkspace = async () => {
    if (!currentWorkspace) return;
    try {
      const exported = await db.exportWorkspace(currentWorkspace.id);
      const suggestedFilename = `${currentWorkspace.name.toLowerCase().replace(/\s+/g, '-')}-workspace.json`;
      
      const filePath = await dialog.save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        defaultPath: suggestedFilename
      });

      if (filePath) {
        const fs = await import('@tauri-apps/plugin-fs');
        await fs.writeFile({
          path: filePath,
          contents: JSON.stringify(exported, null, 2)
        });
      }
    } catch (error) {
      console.error('Error exporting workspace:', error);
    }
  };

  const handleImportWorkspace = async () => {
    try {
      const filePath = await dialog.open({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });
      
      if (filePath) {
        const fs = await import('@tauri-apps/plugin-fs');
        const contents = await fs.readFile(filePath);
        const workspaceExport = JSON.parse(contents);
        const workspaceId = await db.importWorkspace(workspaceExport);
        await loadWorkspaces();
        const workspace = workspaces.find(w => w.id === workspaceId);
        if (workspace) {
          setCurrentWorkspace(workspace);
          loadPages(workspaceId);
        }
      }
    } catch (error) {
      console.error('Error importing workspace:', error);
    }
  };

  return (
    <div className="h-screen font-[family-name:var(--font-geist-sans)] p-3">
      <main className="h-full flex flex-col">
        {/* Workspace Selection */}
        <div className="flex flex-row gap-2 mb-3">
          <select 
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-sm text-xs w-[70px]"
            value={currentWorkspace?.id || ''}
            onChange={(e) => {
              const workspace = workspaces.find(w => w.id === Number(e.target.value));
              if (workspace) {
                setCurrentWorkspace(workspace);
                loadPages(workspace.id);
              }
            }}
          >
            {workspaces.length === 0 ? (
              <option value="">No workspaces</option>
            ) : (
              workspaces.map(workspace => (
                <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
              ))
            )}
          </select>
          <button
            onClick={() => setIsWorkspaceDialogOpen(true)}
            className="p-1 border border-zinc-700 rounded-sm hover:bg-zinc-900"
          >
            <Plus size={14} className="text-zinc-400" />
          </button>
          <button
            onClick={handleExportWorkspace}
            className="p-1 border border-zinc-700 rounded-sm hover:bg-zinc-900"
          >
            <Save size={14} className="text-zinc-400" />
          </button>
          <button
            onClick={handleImportWorkspace}
            className="p-1 border border-zinc-700 rounded-sm hover:bg-zinc-900"
          >
            <Upload size={14} className="text-zinc-400" />
          </button>
          <button
            onClick={handleDeleteWorkspace}
            className="p-1 border border-zinc-700 rounded-sm hover:bg-zinc-900"
          >
            <Trash2 size={14} className="text-zinc-400" />
          </button>
        </div>

        {/* Navigation and Page Title */}
        <div className="flex flex-row gap-2">
          <div className="inline-flex">
            <button 
              onClick={handlePreviousPage}
              className="border border-r size-7 rounded-l-sm flex items-center justify-center border-zinc-700 hover:bg-zinc-900 group"
            >
              <MoveLeft size={15} className="text-zinc-600 group-hover:text-zinc-400"/>
            </button>
            <button 
              onClick={handleNextPage}
              className="border border-l-0 size-7 rounded-r-sm flex items-center justify-center border-zinc-700 hover:bg-zinc-900 group"
            >
              <MoveRight size={15} className="text-zinc-600 group-hover:text-zinc-400"/>
            </button>
          </div>

          <div className="inline-flex w-full">
            <div className="size-7 text-center flex items-center justify-center border rounded-l-sm text-xs font-mono bg-zinc-800 border-zinc-700">
              {currentPage?.position}
            </div>
            <div className="flex items-center px-2 text-start text-xs border border-l-0 w-full rounded-r-sm border-zinc-700 truncate text-nowrap font-semibold">
              {currentPage?.title || 'No page selected'}
            </div>
            <button
              onClick={() => setIsPageTitleDialogOpen(true)}
              className="ml-2 py-1 px-2 border border-zinc-700 rounded-sm hover:bg-zinc-900"
            >
              <Plus size={14} className="text-zinc-400" />
            </button>
            <button
                onClick={handleDeletePage}
                disabled={!currentPage}
                className="ml-1 py-1 px-2 border border-zinc-700 rounded-sm hover:bg-zinc-900 hover:border-red-700 hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Delete Page"
              >
              <Trash2 size={14} className="text-zinc-400 group-hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Dialogs */}
        <DialogInput 
          isOpen={isWorkspaceDialogOpen}
          onClose={() => setIsWorkspaceDialogOpen(false)}
          onSubmit={handleNewWorkspace}
          title="Enter Workspace Name"
          placeholder="Workspace name..."
          submitText="Create Workspace"
          value={workspaceInput}
          setValue={setWorkspaceInput}
        />

        <DialogInput 
          isOpen={isPageTitleDialogOpen}
          onClose={() => setIsPageTitleDialogOpen(false)}
          onSubmit={handleNewPage}
          title="Enter Page Title"
          placeholder="Page title..."
          submitText="Create Page"
          value={pageTitleInput}
          setValue={setPageTitleInput}
        />

        {/* Markdown List */}
        <div className="w-full h-full overflow-y-auto text-xs flex flex-col gap-2 py-2 font-[family-name:var(--font-geist-mono)] font-light">
          {markdowns.map((md) => (
            <div 
              key={md.id}
              dangerouslySetInnerHTML={{ __html: md.content }}
              className="py-1 px-2 border border-zinc-700 rounded-sm hover:bg-slate-800/70 cursor-pointer transition-colors" 
            />
          ))}
          {markdowns.length === 0 && (
            <div className="text-center text-zinc-500 py-4">
              No markdown entries yet
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex items-end relative group justify-items-center p-0">
          <div 
            ref={inputRef}
            contentEditable
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            className="border border-zinc-700 rounded-sm w-full h-full p-1 font-thin overflow-y-auto text-xs max-h-20 min-h-20 inline-block focus-visible:ring-0 focus:border-0 focus-visible:border-0 focus-visible:outline-dashed focus-visible:outline-1 focus-visible:outline-zinc-500 focus-visible:p-1 font-[family-name:var(--font-geist-mono)]"
          />
          <button 
            onClick={handleSubmit}
            className="absolute right-0 p-1 rounded-md bottom-0 opacity-0 group-hover:opacity-100 border m-1 hover:bg-zinc-800 border-zinc-700 transition-opacity duration-500"
          >
            <ArrowUp className="text-zinc-400" size={15}/>
          </button>
        </div>
      </main>
    </div>
  );
}