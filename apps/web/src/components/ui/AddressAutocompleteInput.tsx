import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { searchAddresses, type AddressSuggestion } from '../../lib/mapbox';

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Digite o endereço',
  className,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
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
        if (currentId !== requestIdRef.current) return;
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } finally {
        if (currentId === requestIdRef.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 120);
          }}
          placeholder={placeholder}
          className={clsx('w-full ui-input pl-9', className)}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface2 shadow-[0_12px_24px_rgba(16,18,20,0.15)]">
          {loading && <p className="px-3 py-2 text-sm text-text-muted">Buscando endereços...</p>}

          {!loading && suggestions.length === 0 && (
            <p className="px-3 py-2 text-sm text-text-muted">Nenhum endereço encontrado.</p>
          )}

          {!loading && suggestions.map((suggestion) => (
            <button
              key={`${suggestion.lat}-${suggestion.lng}-${suggestion.address}`}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(suggestion);
                setSuggestions([]);
                setIsOpen(false);
              }}
              className="w-full border-b border-border/40 px-3 py-2 text-left text-sm text-text transition-colors last:border-b-0 hover:bg-surface"
            >
              {suggestion.address}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
