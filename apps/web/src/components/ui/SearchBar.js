import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Search } from 'lucide-react';
import { useState } from 'react';
export function SearchBar({ placeholder = 'Pesquisar...', onSearch }) {
    const [query, setQuery] = useState('');
    const handleChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        onSearch?.(value);
    };
    return (_jsxs("div", { className: "relative w-full max-w-md", children: [_jsx(Search, { size: 18, className: "absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" }), _jsx("input", { type: "text", value: query, onChange: handleChange, placeholder: placeholder, className: "h-11 w-full rounded-full border border-border bg-surface2 pl-11 pr-4\n                   text-sm text-text placeholder:text-text-muted\n                   focus:border-success focus:outline-none\n                   transition-all duration-200" })] }));
}
