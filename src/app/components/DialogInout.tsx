// DialogInput.tsx
import { FC } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

interface DialogInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  submitText?: string;
  value: string;
  setValue: (value: string) => void;
}

export const DialogInput: FC<DialogInputProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = 'Enter name...',
  submitText = 'Create',
  value,
  setValue,
}) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 flex w-screen items-center justify-center">
        <DialogPanel className="max-w-lg space-y-2 border bg-zinc-900 px-6 py-2 rounded border-zinc-800 shadow-md shadow-slate-800/50">
          <DialogTitle className="font-bold text-sm mb-4">{title}</DialogTitle>
          <div>
            <input 
              type="text" 
              onChange={e => setValue(e.target.value)} 
              value={value} 
              placeholder={placeholder}
              className='text-xs px-3 py-1 bg-black border rounded border-zinc-800 text-zinc-400 w-full'
              autoFocus
            />
          </div>
          <div className="flex gap-2 w-full pt-2 pb-1 justify-end">
            <button 
              onClick={onClose}
              className='text-xs px-3 py-1 border rounded-sm border-zinc-800 bg-zinc-800 hover:bg-zinc-800/70'
            >
              Cancel
            </button>
            <button 
              onClick={() => onSubmit(value)}
              disabled={!value.trim()}
              className='text-xs px-3 py-1 border rounded-sm border-green-800 bg-green-800 hover:bg-green-800/70 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {submitText}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};