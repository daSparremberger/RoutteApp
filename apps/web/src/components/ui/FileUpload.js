import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
export function FileUpload({ value, onChange, onUpload, accept = 'image/*', label = 'Upload', preview = true }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    async function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setError(null);
        setUploading(true);
        try {
            const result = await onUpload(file);
            onChange(result.url);
        }
        catch (err) {
            setError(err?.message || 'Erro no upload');
        }
        setUploading(false);
        if (inputRef.current)
            inputRef.current.value = '';
    }
    function handleRemove() {
        onChange(undefined);
    }
    return (_jsxs("div", { className: "space-y-2", children: [preview && value && (_jsxs("div", { className: "relative inline-block", children: [_jsx("img", { src: value, alt: "Preview", className: "h-24 w-24 rounded-xl border border-border object-cover" }), _jsx("button", { type: "button", onClick: handleRemove, className: "absolute -right-2 -top-2 rounded-full bg-danger p-1 text-white shadow", children: _jsx(X, { size: 12 }) })] })), _jsxs("label", { className: "flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent", children: [_jsx(Upload, { size: 16 }), _jsx("span", { children: uploading ? 'Enviando...' : label }), _jsx("input", { ref: inputRef, type: "file", accept: accept, onChange: handleFile, disabled: uploading, className: "hidden" })] }), error && _jsx("p", { className: "text-xs text-danger", children: error })] }));
}
