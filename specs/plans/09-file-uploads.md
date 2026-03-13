# File Uploads Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file upload infrastructure (photos, documents) to the platform with local storage, multer middleware, and reusable frontend components.

**Architecture:** Multer handles multipart uploads on the app-api, files stored in a configurable local directory (`UPLOAD_DIR`), served via Express static middleware. A generic `POST /uploads` endpoint returns the file URL. Frontend gets a reusable `FileUpload` component used in Motoristas and Alunos pages. The api client gains an `upload()` method for FormData.

**Tech Stack:** multer, Express static, React file input component

---

## File Structure

### Backend (app-api)

| File | Action | Responsibility |
|------|--------|----------------|
| `services/app-api/src/lib/upload.ts` | Create | Multer config + storage setup |
| `services/app-api/src/routes/uploads.ts` | Create | POST /uploads endpoint |
| `services/app-api/src/app.ts` | Modify | Mount uploads router + static serving |

### Frontend (web)

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/lib/api.ts` | Modify | Add upload() method for FormData |
| `apps/web/src/components/ui/FileUpload.tsx` | Create | Reusable file upload component |
| `apps/web/src/pages/Motoristas.tsx` | Modify | Add photo upload to motorista form |
| `apps/web/src/pages/Alunos.tsx` | Modify | Add photo upload to aluno form |

---

## Chunk 1: Backend Upload Infrastructure

### Task 1: Install multer and create upload lib

**Files:**
- Create: `services/app-api/src/lib/upload.ts`

- [ ] **Step 1: Install multer**

```bash
cd services/app-api && pnpm add multer && pnpm add -D @types/multer
```

- [ ] **Step 2: Create upload lib**

```typescript
// services/app-api/src/lib/upload.ts
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, "../../uploads");

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo nao permitido. Use JPEG, PNG, WebP ou PDF."));
    }
  },
});

export { UPLOAD_DIR };
```

- [ ] **Step 3: Commit**

```bash
git add services/app-api/package.json services/app-api/pnpm-lock.yaml services/app-api/src/lib/upload.ts
git commit -m "feat: add multer upload lib with local storage"
```

### Task 2: Create uploads route

**Files:**
- Create: `services/app-api/src/routes/uploads.ts`

- [ ] **Step 1: Create route**

```typescript
// services/app-api/src/routes/uploads.ts
import { Router } from "express";
import { upload } from "../lib/upload";
import { requireAppAuth, requireTenantActive } from "../middleware/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive);

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }

  const url = `/uploads/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename, size: req.file.size });
});

// Error handler for multer errors
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof Error && err.message.includes("Tipo de arquivo")) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Arquivo excede o limite de 5MB" });
  }
  next(err);
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/routes/uploads.ts
git commit -m "feat: add uploads route with file validation"
```

### Task 3: Mount uploads router and static serving in app.ts

**Files:**
- Modify: `services/app-api/src/app.ts`

- [ ] **Step 1: Add imports and mount**

Add at the top of `services/app-api/src/app.ts`, after existing imports:

```typescript
import express from "express";  // already imported
import uploadsRouter from "./routes/uploads";
import { UPLOAD_DIR } from "./lib/upload";
```

Add inside `createApp()`, after `app.use(express.json())`:

```typescript
  app.use("/uploads", express.static(UPLOAD_DIR));
```

Add after the existing route mounts (after `app.use("/motorista", motoristaRouter)`):

```typescript
  app.use("/uploads", uploadsRouter);
```

Note: The static middleware is mounted first so GET requests serve files directly. The router handles POST for upload.

- [ ] **Step 2: Build to verify**

```bash
cd services/app-api && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add services/app-api/src/app.ts
git commit -m "feat: mount uploads route and static file serving"
```

---

## Chunk 2: Frontend Upload Infrastructure

### Task 4: Add upload method to api client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add upload function**

Add a new function after the existing `req()` function in `apps/web/src/lib/api.ts`:

```typescript
async function uploadFile(base: string, path: string, file: File): Promise<{ url: string; filename: string; size: number }> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro no upload');
  }
  return res.json();
}
```

Update `createClient()` to include the upload method:

```typescript
function createClient(base: string) {
  return {
    get: <T>(path: string) => req<T>(base, path),
    post: <T>(path: string, body: unknown) => req<T>(base, path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) => req<T>(base, path, { method: 'PUT', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) => req<T>(base, path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string) => req<T>(base, path, { method: 'DELETE' }),
    upload: (path: string, file: File) => uploadFile(base, path, file),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add upload method to api client"
```

### Task 5: Create FileUpload component

**Files:**
- Create: `apps/web/src/components/ui/FileUpload.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/components/ui/FileUpload.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/FileUpload.tsx
git commit -m "feat: add reusable FileUpload component"
```

---

## Chunk 3: Integrate Upload in Pages

### Task 6: Add photo upload to Motoristas page

**Files:**
- Modify: `apps/web/src/pages/Motoristas.tsx`

- [ ] **Step 1: Add import**

Add at the top of `apps/web/src/pages/Motoristas.tsx`, after existing imports:

```typescript
import { FileUpload } from '../components/ui/FileUpload';
```

- [ ] **Step 2: Extend form state**

Find the form state initialization:

```typescript
const [form, setForm] = useState({ nome: '', telefone: '' });
```

Replace with:

```typescript
const [form, setForm] = useState({ nome: '', telefone: '', foto_url: '' });
```

- [ ] **Step 3: Add FileUpload to modal form**

Inside the modal form (the Modal component that has the nome and telefone inputs), add after the telefone input `<div>`:

```typescript
              <div>
                <label className="block text-sm text-text-muted mb-1">Foto</label>
                <FileUpload
                  value={form.foto_url || undefined}
                  onChange={(url) => setForm({ ...form, foto_url: url || '' })}
                  onUpload={(file) => api.upload('/uploads', file)}
                  label="Enviar foto"
                />
              </div>
```

- [ ] **Step 4: Include foto_url in save payload**

Find where the form data is sent to the API (the `save` or `handleSubmit` function). Ensure `foto_url` is included in the payload sent to `POST /motoristas` or `PUT /motoristas/:id`. The existing API already accepts `foto_url` in the body.

If the save function spreads `form` directly, `foto_url` will already be included. If it picks specific fields, add `foto_url: form.foto_url || undefined`.

- [ ] **Step 5: Load foto_url when editing**

Find where `editing` state is set (when user clicks edit on a motorista). Ensure `foto_url` is loaded into form:

```typescript
setForm({ nome: m.nome, telefone: m.telefone || '', foto_url: m.foto_url || '' });
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Motoristas.tsx
git commit -m "feat: add photo upload to motoristas form"
```

### Task 7: Add photo upload to Alunos page

**Files:**
- Modify: `apps/web/src/pages/Alunos.tsx`

- [ ] **Step 1: Add import**

Add at the top of `apps/web/src/pages/Alunos.tsx`, after existing imports:

```typescript
import { FileUpload } from '../components/ui/FileUpload';
```

- [ ] **Step 2: Add FileUpload to the form**

Find the "Dados Pessoais" section in the aluno form. Add after the "nome" input field:

```typescript
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Foto do Aluno</label>
                    <FileUpload
                      value={form.foto_url || undefined}
                      onChange={(url) => setForm({ ...form, foto_url: url || '' })}
                      onUpload={(file) => api.upload('/uploads', file)}
                      label="Enviar foto"
                    />
                  </div>
```

- [ ] **Step 3: Ensure foto_url is in form state and save payload**

Check that `foto_url` exists in the form state initialization. The Alunos page likely already has a large form object. If `foto_url` is missing from the initial state, add it as `foto_url: ''`. Ensure it's included in the save payload (same pattern as motoristas — the API already accepts it).

- [ ] **Step 4: Build web to verify**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Alunos.tsx
git commit -m "feat: add photo upload to alunos form"
```

---

## Chunk 4: URL Resolution

### Task 8: Handle upload URL resolution in frontend

**Files:**
- Modify: `apps/web/src/lib/api.ts`

The upload endpoint returns relative URLs like `/uploads/1234-abcd.jpg`. The frontend needs to resolve these to absolute URLs when displaying images.

- [ ] **Step 1: Add resolveUrl helper**

Add at the bottom of `apps/web/src/lib/api.ts`:

```typescript
export function resolveUploadUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${APP_BASE}${url}`;
}
```

- [ ] **Step 2: Use resolveUploadUrl in FileUpload usages**

In `Motoristas.tsx` and `Alunos.tsx`, where `FileUpload` is used, update the `value` prop:

```typescript
import { api, resolveUploadUrl } from '../lib/api';

// In the FileUpload component usage:
value={resolveUploadUrl(form.foto_url) || undefined}
```

Also update any `<img>` tags that display `foto_url` to use `resolveUploadUrl()`.

- [ ] **Step 3: Build and verify**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/pages/Motoristas.tsx apps/web/src/pages/Alunos.tsx
git commit -m "feat: add URL resolution for uploaded files"
```

---

## Notes

### Environment variable

Add to `.env.example` (optional):

```
UPLOAD_DIR=./uploads
```

### Security

- Files are tenant-isolated by auth middleware (only authenticated users can upload)
- File type whitelist: JPEG, PNG, WebP, PDF
- File size limit: 5MB
- Random filenames prevent path traversal and collisions

### Future enhancements (not in scope)

- Cloud storage adapter (S3/Firebase Storage) — swap `multer.diskStorage` for cloud adapter
- Image resizing/thumbnails — add sharp middleware
- Per-tenant storage quotas
- File deletion when entity is deleted
