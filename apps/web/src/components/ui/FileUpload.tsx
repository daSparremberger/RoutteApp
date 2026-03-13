import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface FileUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  onUpload: (file: File) => Promise<{ url: string }>;
  accept?: string;
  label?: string;
  preview?: boolean;
}

export function FileUpload({ value, onChange, onUpload, accept = 'image/*', label = 'Upload', preview = true }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const result = await onUpload(file);
      onChange(result.url);
    } catch (err: any) {
      setError(err?.message || 'Erro no upload');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleRemove() {
    onChange(undefined);
  }

  return (
    <div className="space-y-2">
      {preview && value && (
        <div className="relative inline-block">
          <img src={value} alt="Preview" className="h-24 w-24 rounded-xl border border-border object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 rounded-full bg-danger p-1 text-white shadow"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent">
        <Upload size={16} />
        <span>{uploading ? 'Enviando...' : label}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
