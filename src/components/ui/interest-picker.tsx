import { useState, useEffect, useRef, useCallback } from "react";
import { Check, X, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

export interface Interest {
    id: string;
    name: string;
    audience_size?: number;
    path?: string[];
}

interface InterestPickerProps {
    selected: Interest[];
    onChange: (interests: Interest[]) => void;
    className?: string;
    placeholder?: string;
}

export function InterestPicker({ selected = [], onChange, className, placeholder = "Search interests..." }: InterestPickerProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Interest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchTimeout = useRef<NodeJS.Timeout>();
    const { toast } = useToast();

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const res = await apiClient.searchInterests(q);
            if (res.ok && res.data?.success && res.data?.interests) {
                setResults(res.data.interests);
                setShowDropdown(true);
            } else if (res.ok && res.data?.data) {
                // Fallback for legacy response format
                setResults(res.data.data);
                setShowDropdown(true);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error("Interest search failed", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => handleSearch(val), 400);
    };

    const toggleInterest = (interest: Interest) => {
        const createExists = selected.some(i => i.id === interest.id);
        const newSelection = createExists
            ? selected.filter(i => i.id !== interest.id)
            : [...selected, interest];

        onChange(newSelection);
        setQuery(""); // Clear search after selection
        setShowDropdown(false);
    };

    const removeInterest = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        onChange(selected.filter(i => i.id !== id));
    };

    return (
        <div className={cn("space-y-3 overflow-visible", className)} ref={containerRef}>
            {/* Selected Tags */}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 overflow-visible">
                    {selected.map(interest => (
                        <Badge key={interest.id} variant="secondary" className="px-2 py-1 gap-1 flex items-center bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
                            {interest.name}
                            <X
                                className="w-3 h-3 cursor-pointer hover:text-red-500"
                                onClick={(e) => removeInterest(interest.id, e)}
                            />
                        </Badge>
                    ))}
                </div>
            )}

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={onInputChange}
                    placeholder={placeholder}
                    className="pl-9"
                    onFocus={() => {
                        if (results.length > 0) setShowDropdown(true);
                    }}
                />
                {isLoading && (
                    <div className="absolute right-3 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* Dropdown */}
                {showDropdown && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border/60 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        {results.map(interest => {
                            const isSelected = selected.some(s => s.id === interest.id);
                            return (
                                <div
                                    key={interest.id}
                                    onClick={() => toggleInterest(interest)}
                                    className={cn(
                                        "px-4 py-2 cursor-pointer text-sm flex items-center justify-between hover:bg-slate-50 transition-colors",
                                        isSelected && "bg-blue-50/50"
                                    )}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-700">{interest.name}</span>
                                        {interest.audience_size && (
                                            <span className="text-[10px] text-slate-400">
                                                Size: {(interest.audience_size).toLocaleString()} people
                                            </span>
                                        )}
                                        {interest.path && (
                                            <span className="text-[10px] text-slate-400">
                                                {interest.path.join(" > ")}
                                            </span>
                                        )}
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
