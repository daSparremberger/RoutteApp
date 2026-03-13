import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { searchAddresses } from '../../lib/mapbox';
export function AddressAutocompleteInput({ value, onChange, onSelect, placeholder = 'Digite o endereço', className, }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const requestIdRef = useRef(0);
    useEffect(() => {
        const term = value.trim();
        if (term.length < 3) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }
        const currentId = ++requestIdRef.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const results = await searchAddresses(term);
                if (currentId !== requestIdRef.current)
                    return;
                setSuggestions(results);
                setIsOpen(results.length > 0);
            }
            finally {
                if (currentId === requestIdRef.current)
                    setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [value]);
    return (_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative", children: [_jsx(MapPin, { size: 16, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" }), _jsx("input", { value: value, onChange: (event) => {
                            onChange(event.target.value);
                            setIsOpen(true);
                        }, onFocus: () => {
                            if (suggestions.length > 0)
                                setIsOpen(true);
                        }, onBlur: () => {
                            setTimeout(() => setIsOpen(false), 120);
                        }, placeholder: placeholder, className: clsx('w-full ui-input pl-9', className) })] }), isOpen && (_jsxs("div", { className: "absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface2 shadow-[0_12px_24px_rgba(16,18,20,0.15)]", children: [loading && _jsx("p", { className: "px-3 py-2 text-sm text-text-muted", children: "Buscando endere\u00E7os..." }), !loading && suggestions.length === 0 && (_jsx("p", { className: "px-3 py-2 text-sm text-text-muted", children: "Nenhum endere\u00E7o encontrado." })), !loading && suggestions.map((suggestion) => (_jsx("button", { type: "button", onMouseDown: (event) => {
                            event.preventDefault();
                            onSelect(suggestion);
                            setSuggestions([]);
                            setIsOpen(false);
                        }, className: "w-full border-b border-border/40 px-3 py-2 text-left text-sm text-text transition-colors last:border-b-0 hover:bg-surface", children: suggestion.address }, `${suggestion.lat}-${suggestion.lng}-${suggestion.address}`)))] }))] }));
}
