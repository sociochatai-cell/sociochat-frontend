import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon in React Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Location {
    lat: number;
    lng: number;
    name?: string;
}

interface MapPickerProps {
    onLocationSelect: (loc: Location) => void;
    className?: string;
}

function LocationMarker({ onSelect }: { onSelect: (loc: Location) => void }) {
    const [position, setPosition] = useState<L.LatLng | null>(null);
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
            onSelect({ lat: e.latlng.lat, lng: e.latlng.lng, name: `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}` });
        },
    });

    return position === null ? null : (
        <Marker position={position}>
            <Popup>Selected Location</Popup>
        </Marker>
    );
}

export default function MapPicker({ onLocationSelect, className }: MapPickerProps) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // Default India
    const [mapKey, setMapKey] = useState(0); // Force re-render on center change
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close suggestions on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query || query.length < 3) {
                setSuggestions([]);
                return;
            }

            setIsSearching(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await res.json();
                setSuggestions(data || []);
                setShowSuggestions(true);
            } catch (e) {
                console.error("Geocoding error:", e);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelectSuggestion = (item: any) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const name = item.display_name;

        setMapCenter([lat, lng]);
        setMapKey(p => p + 1);
        setQuery(name); // Set full name to input
        setShowSuggestions(false); // Hide list

        onLocationSelect({ lat, lng, name });
    };

    const handleManualSearch = async () => {
        // Force search if user hits enter
        if (!query) return;
        setIsSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                handleSelectSuggestion(data[0]);
            }
        } catch (e) { console.error(e); }
        finally { setIsSearching(false); }
    };

    return (
        <div ref={wrapperRef} className={`relative w-full h-[300px] rounded-lg overflow-hidden border ${className}`}>
            <div className="absolute top-2 left-2 right-2 z-[1000] flex flex-col gap-1">
                <div className="relative flex gap-2">
                    <Input
                        placeholder="Search city, region or address..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                        className="bg-white/95 backdrop-blur shadow-sm pr-10"
                        onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                    />
                    <div className="absolute right-12 top-2.5">
                        {isSearching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <Button size="icon" onClick={handleManualSearch} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                        <Search className="w-4 h-4" />
                    </Button>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="bg-white rounded-md shadow-lg border border-slate-200 mt-1 max-h-[200px] overflow-y-auto w-full">
                        {suggestions.map((item, i) => (
                            <div
                                key={i}
                                className="p-2 text-sm hover:bg-slate-100 cursor-pointer border-b last:border-0 flex items-start gap-2"
                                onClick={() => handleSelectSuggestion(item)}
                            >
                                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{item.display_name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <MapContainer
                key={mapKey}
                center={mapCenter}
                zoom={10}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker onSelect={onLocationSelect} />
            </MapContainer>
        </div>
    );
}
