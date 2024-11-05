'use client'

import { useState, useRef, KeyboardEvent, useEffect, FC } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowUp, MoveLeft, MoveRight, Plus, Save, Upload } from "lucide-react";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { db } from '@/lib/db';
// import type { Workspace, Page, Markdown } from '@/lib/types';


interface Workspace {
  id: number;
  name: string;
}

interface Page {
  id: number;
  title: string;
  position: number;
  workspace_id: number;
}

interface Markdown {
  id: number;
  content: string;
  position: number;
  page_id: number;
}

export default function Home() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [markdowns, setMarkdowns] = useState<Markdown[]>([]);
  const [inputContent, setInputContent] = useState('');
  const inputRef = useRef<HTMLDivElement>(null);

  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);

  // const dbRef = useRef<DatabaseService>(null);
  // Initialize app
  useEffect(() => {
    loadWorkspaces();
    (async ()=>{
      const workspaceId = await db.createWorkspace('test');
      console.log(workspaceId);
    })()
  }, []);

  // Load workspaces
  const loadWorkspaces = async () => {
    try {
      const workspaceList = await invoke<Workspace[]>('get_workspaces');
      setWorkspaces(workspaceList);
      if (workspaceList.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(workspaceList[0]);
        loadPages(workspaceList[0].id);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  // Load pages for workspace
  const loadPages = async (workspaceId: number) => {
    try {
      const pageList = await invoke<Page[]>('get_pages', { workspaceId });
      setPages(pageList);
      if (pageList.length > 0) {
        setCurrentPage(pageList[0]);
        loadMarkdowns(pageList[0].id);
      }
    } catch (error) {
      console.error('Error loading pages:', error);
    }
  };

  // Load markdowns for page
  const loadMarkdowns = async (pageId: number) => {
    try {
      const markdownList = await invoke<Markdown[]>('get_markdowns', { pageId });
      setMarkdowns(markdownList);
    } catch (error) {
      console.error('Error loading markdowns:', error);
    }
  };

  // Navigation handlers
  const handlePreviousPage = () => {
    if (!currentPage || pages.length === 0) return;
    const currentIndex = pages.findIndex(p => p.id === currentPage.id);
    if (currentIndex > 0) {
      const prevPage = pages[currentIndex - 1];
      setCurrentPage(prevPage);
      loadMarkdowns(prevPage.id);
    }
  };

  const handleNextPage = () => {
    if (!currentPage || pages.length === 0) return;
    const currentIndex = pages.findIndex(p => p.id === currentPage.id);
    if (currentIndex < pages.length - 1) {
      const nextPage = pages[currentIndex + 1];
      setCurrentPage(nextPage);
      loadMarkdowns(nextPage.id);
    }
  };

  // Create new page
  const handleNewPage = async () => {
    if (!currentWorkspace) return;
    try {
      const title = await dialog.ask('Enter page title:', { title: 'New Page', kind: 'info' });
      if (title) {
        const pageId = await invoke<number>('create_page', { 
          title: title || 'New Page', 
          workspaceId: currentWorkspace.id 
        });
        await loadPages(currentWorkspace.id);
        const newPage = await invoke<Page>('get_page', { pageId });
        setCurrentPage(newPage);
        loadMarkdowns(pageId);
      }
    } catch (error) {
      console.error('Error creating new page:', error);
    }
  };

  // Create new workspace
  const handleNewWorkspace = async (name: string) => {
    try {
      if (name.trim()) {
        const workspaceId = await db.createWorkspace(name);
        await loadWorkspaces();
        const workspace = workspaces.find(w => w.id === workspaceId);
        if (workspace) {
          setCurrentWorkspace(workspace);
          loadPages(workspaceId);
        }
        setIsWorkspaceDialogOpen(false);
      } else {
        await dialog.message('Name is empty', { title: 'Ekan', kind: 'error'});
      }
    } catch (error) {
      console.error('Error creating new workspace:', error);
      await dialog.message('Error creating workspace', { title: 'Ekan', kind: 'error'});
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
      const processedContent = await invoke<string>('process_markdown', { md: inputContent });
      await invoke<number>('add_markdown', { 
        content: processedContent, 
        pageId: currentPage.id 
      });
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
      const exported = await invoke('export_workspace', { workspaceId: currentWorkspace.id });
      const suggestedFilename = `${currentWorkspace.name.toLowerCase().replace(/\s+/g, '-')}-workspace.json`;
      
      await dialog.save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        defaultPath: suggestedFilename
      }).then(async (filePath) => {
        if (filePath) {
          await invoke('plugin:fs|write_file', {
            path: filePath,
            contents: JSON.stringify(exported, null, 2)
          });
        }
      });
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
        const contents = await invoke('plugin:fs|read_file', { path: filePath });
        const workspaceExport = JSON.parse(contents as string);
        const workspaceId = await invoke<number>('import_workspace', { workspaceExport });
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

  const AddWorkspaceComponent: FC = () => {
    const [workspaceName, setWorkspaceName] = useState('');
    return (
      <>
        <button
            onClick={() => setIsWorkspaceDialogOpen(true)}
            className="p-1 border border-zinc-700 rounded-sm hover:bg-zinc-900"
          >
            <Plus size={14} className="text-zinc-400" />
          </button>

        <Dialog
          open={isWorkspaceDialogOpen}
          onClose={() => setIsWorkspaceDialogOpen(false)} className="relative z-50"
        >
          <div className="fixed inset-0 flex w-screen items-center justify-center">
            <DialogPanel className="max-w-lg space-y-2 border bg-zinc-900 px-6 py-2 rounded border-zinc-800 shadow-md shadow-slate-800/50">
              <DialogTitle className="font-bold text-sm mb-4">Enter Workspace Name:</DialogTitle>
              {/* <Description className=" text-xs mt-1">Please create workspace to start</Description> */}
              <div>
                <input 
                  type="text" 
                  onChange={e => setWorkspaceName(e.target.value)} 
                  value={workspaceName} 
                  placeholder='Name here ...'
                  className='text-xs px-3 py-1 bg-black border rounded border-zinc-800 text-zinc-400'
                  />
              </div>
              <div className="flex gap-2 w-full pt-2 pb-1 justify-end">
                <button 
                  onClick={() => setIsWorkspaceDialogOpen(false)}
                  className='text-xs px-3 py-1 border rounded-sm border-zinc-800 bg-zinc-800 hover:bg-zinc-800/70'
                  >Cancel</button>
                <button 
                  onClick={() => handleNewWorkspace(workspaceName)}
                  className='text-xs px-3 py-1 border rounded-sm border-green-800 bg-green-800 hover:bg-green-800/70'
                  >Create</button>
              </div>
            </DialogPanel>
        </div>
        </Dialog>
      </>
    )
  }

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
            {workspaces.map(workspace => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
          
          <AddWorkspaceComponent />

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
              onClick={handleNewPage}
              className="ml-2 p-1 border border-zinc-700 rounded-sm hover:bg-zinc-900"
            >
              <Plus size={14} className="text-zinc-400" />
            </button>
          </div>
        </div>

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
        <div className="min-h-16 text-xs flex items-center relative group">
          <div 
            ref={inputRef}
            contentEditable
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            className="border border-zinc-700 rounded w-full h-full p-1"
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