// src/components/ui/location-picker.tsx
import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, X, Loader2, Globe, Navigation } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { Slider } from './slider';
import { Checkbox } from './checkbox';
import { Label } from './label';
import { cn } from '@/lib/utils';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet with bundlers
// Custom marker icon using inline SVG to avoid blocked external resources
const customIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ea580c" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" fill="white" /></svg>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Use the same icon for default markers to ensure consistency
const DefaultIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" fill="white" /></svg>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

L.Marker.prototype.options.icon = DefaultIcon;

export interface LocationResult {
  lat: number;
  lon: number;
  display_name: string;
  country?: string;
  country_code?: string;
  city?: string;
  state?: string;
  type?: string; // 'city', 'state', 'country', etc.
  radius?: number; // in km
  distance_unit?: string; // 'kilometer'
}

// Helper to format location name based on what's selected
function formatLocationName(location: LocationResult): string {
  const parts: string[] = [];

  if (location.city) {
    parts.push(location.city);
  }
  if (location.state && location.state !== location.city) {
    parts.push(location.state);
  }
  if (location.country && location.country !== location.state) {
    parts.push(location.country);
  }

  if (parts.length === 0) {
    // Fallback to first part of display name
    return location.display_name.split(',')[0].trim();
  }

  return parts.join(', ');
}

// Get the primary location value (city > state > country)
function getPrimaryLocation(location: LocationResult): string {
  return location.city || location.state || location.country || location.display_name.split(',')[0].trim();
}

interface LocationPickerProps {
  value?: string;
  onChange?: (location: string, details?: LocationResult) => void;
  placeholder?: string;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  defaultRadius?: number;
  initialLocation?: LocationResult;
  resetAfterSelect?: boolean; // If true, clears picker after location is chosen (tag-input mode)
}

// Component to handle map click events
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to update map view and fix browser compatibility issues
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  // Fix map rendering issues in some browsers
  useEffect(() => {
    // Invalidate map size after a short delay to fix rendering issues
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Also invalidate on window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    map.setView(center, zoom);
    // Invalidate size after view change for better browser compatibility
    setTimeout(() => map.invalidateSize(), 50);
  }, [center, zoom, map]);
  return null;
}

export function LocationPicker({
  value = '',
  onChange,
  placeholder = 'Search for a location...',
  className,
  defaultCenter = [20, 0], // Default to world center
  defaultZoom = 2,
  defaultRadius = 10,
  initialLocation,
  resetAfterSelect = false,
}: LocationPickerProps) {
  // Generate unique key for MapContainer to prevent "already initialized" error
  const mapKey = useId();
  const [mapInstanceKey, setMapInstanceKey] = useState(() => `map-${Date.now()}`);

  const [searchQuery, setSearchQuery] = useState(value);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(initialLocation || null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    (initialLocation && typeof initialLocation.lat === 'number' && typeof initialLocation.lon === 'number')
      ? [initialLocation.lat, initialLocation.lon]
      : defaultCenter
  );
  const [mapZoom, setMapZoom] = useState(initialLocation ? 10 : defaultZoom);
  const [radius, setRadius] = useState(initialLocation?.radius || defaultRadius);
  const [isWholeArea, setIsWholeArea] = useState(!initialLocation?.radius); // If no radius provided initially, assume whole area (unless it's a new pick)
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default — show map on demand
  const [pendingLocation, setPendingLocation] = useState<LocationResult | null>(null); // Staged location awaiting radius confirm
  const searchTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset map instance key when component remounts to avoid "already initialized" error
  useEffect(() => {
    setMapInstanceKey(`map-${Date.now()}`);
  }, []);

  // Sync state when initialLocation changes (e.g. from AI suggestion)
  useEffect(() => {
    if (initialLocation && typeof initialLocation.lat === 'number' && typeof initialLocation.lon === 'number') {
      setSelectedLocation(initialLocation);
      setMapCenter([initialLocation.lat, initialLocation.lon]);
      // Heuristic zoom levels
      const zoom = initialLocation.city ? 12 : initialLocation.state ? 8 : 5;
      setMapZoom(zoom);
      setRadius(initialLocation.radius || defaultRadius);
      setIsWholeArea(!initialLocation.radius);
      setSearchQuery(formatLocationName(initialLocation));
    }
  }, [initialLocation, defaultRadius]);

  // Sync searchQuery with external value prop when it changes
  useEffect(() => {
    if (value !== searchQuery) {
      setSearchQuery(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for locations using Nominatim API (with retry for rate-limit/425)
  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1200;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const timestamp = Date.now();
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&_t=${timestamp}`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'SocioviaLaunchpad/1.0 (contact@sociovia.com)',
            },
          }
        );

        // Handle rate limiting (429) or "Too Early" (425)
        if (response.status === 429 || response.status === 425) {
          console.warn(`Location search rate limit (${response.status}), retry ${attempt + 1}/${MAX_RETRIES} in ${BASE_DELAY * (attempt + 1)}ms`);
          await new Promise(r => setTimeout(r, BASE_DELAY * (attempt + 1)));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Search failed with status: ${response.status}`);
        }

        const data = await response.json();

        const results: LocationResult[] = data.map((item: any) => ({
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          display_name: item.display_name,
          country: item.address?.country,
          country_code: item.address?.country_code?.toUpperCase(),
          city: item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || item.address?.county,
          state: item.address?.state || item.address?.region || item.address?.province,
          type: item.type,
        }));

        setSearchResults(results);
        setShowResults(true);
        setIsSearching(false);
        return;
      } catch (error) {
        console.warn(`Location search attempt ${attempt + 1} failed:`, error);
        if (attempt === MAX_RETRIES - 1) {
          console.error('Location search failed after all retries:', error);
          setSearchResults([]);
        } else {
          await new Promise(r => setTimeout(r, BASE_DELAY));
        }
      }
    }
    setIsSearching(false);
  }, []);

  // Debounced search — 800ms to respect Nominatim rate limit (1 req/sec)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      searchLocations(query);
    }, 800);
  };

  // Reverse geocoding when clicking on map
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'SocioviaLaunchpad/1.0',
          },
        }
      );
      const data = await response.json();

      if (data && data.display_name) {
        const result: LocationResult = {
          lat,
          lon: lng,
          display_name: data.display_name,
          country: data.address?.country,
          country_code: data.address?.country_code?.toUpperCase(),
          city: data.address?.city || data.address?.town || data.address?.village || data.address?.municipality,
          state: data.address?.state || data.address?.region || data.address?.province,
          type: data.type,
          radius: radius,
          distance_unit: 'kilometer',
        };

        setSelectedLocation(result);
        const formattedName = formatLocationName(result);
        setSearchQuery(formattedName);
        onChange?.(formattedName, result);
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [onChange, radius]);

  // Handle location selection from search results
  const handleSelectLocation = (location: LocationResult) => {
    // Determine if it's a country or state, defaulting to whole area if appropriate
    const isRegion = location.type === 'country' || location.type === 'state' || location.type === 'administrative';
    const isCity = !!location.city;

    // Cities always get a default radius; countries/states default to whole area
    const initialWholeArea = isRegion && !isCity;
    setIsWholeArea(initialWholeArea);

    // Always set radius for cities (default 25km) so they get radius targeting
    const effectiveRadius = initialWholeArea ? undefined : (isCity ? (radius || 25) : radius);

    const locationWithRadius: LocationResult = {
      ...location,
      radius: effectiveRadius,
      distance_unit: 'kilometer'
    };

    setSelectedLocation(locationWithRadius);
    const formattedName = formatLocationName(location) + (initialWholeArea ? ' (Entire Area)' : '');
    setSearchQuery(formattedName);
    setMapCenter([location.lat, location.lon]);

    // Zoom level based on location type
    const zoomLevel = location.city ? 12 : location.state ? 7 : 5;
    setMapZoom(zoomLevel);
    setShowResults(false);

    // In tag-input mode: STAGE the location so user can adjust radius before confirming
    if (resetAfterSelect) {
      setPendingLocation(locationWithRadius);
      // Don't call onChange yet — wait for user to confirm
      return;
    }

    // Normal mode: call onChange immediately
    onChange?.(formattedName, locationWithRadius);
  };

  // Confirm pending location (tag-input mode) — called when user clicks "Add Location"
  const confirmPendingLocation = () => {
    if (!pendingLocation) return;
    const formattedName = formatLocationName(pendingLocation) + (isWholeArea ? ' (Entire Area)' : '');
    onChange?.(formattedName, pendingLocation);
    // Reset picker
    setPendingLocation(null);
    setSearchQuery('');
    setSelectedLocation(null);
    setMapCenter(defaultCenter);
    setMapZoom(defaultZoom);
    setIsExpanded(false);
  };

  // Cancel pending location
  const cancelPendingLocation = () => {
    setPendingLocation(null);
    setSelectedLocation(null);
    setSearchQuery('');
  };

  // Handle radius change
  const handleRadiusChange = (newRadius: number[]) => {
    const r = newRadius[0];
    setRadius(r);
    if (selectedLocation) {
      const updated = { ...selectedLocation, radius: r };
      setSelectedLocation(updated);
      onChange?.(formatLocationName(updated), updated);
    }
  };

  // Handle map click
  const handleMapClick = (lat: number, lng: number) => {
    setMapCenter([lat, lng]);
    reverseGeocode(lat, lng);
  };

  // Clear selection
  const handleClear = () => {
    setSearchQuery('');
    setSelectedLocation(null);
    setSearchResults([]);
    setMapCenter(defaultCenter);
    setMapZoom(defaultZoom);
    onChange?.('', undefined);
  };

  // Get current location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        setMapZoom(10);
        reverseGeocode(latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsSearching(false);
      }
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'space-y-3 p-3 rounded-xl transition-all duration-300',
        isExpanded
          ? 'border-2 border-primary/30 shadow-md ring-2 ring-primary/10 bg-primary/5'
          : 'border border-border/50 bg-background hover:border-border/80',
        className
      )}
    >
      {/* Search Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3 text-muted-foreground">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </div>
          <Input
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder={placeholder}
            className="pl-10 pr-20 h-11"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleGetCurrentLocation}
              title="Use current location"
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={`${result.lat}-${result.lon}-${index}`}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3 border-b border-border/50 last:border-0"
                onClick={() => handleSelectLocation(result)}
              >
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {formatLocationName(result)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.display_name}
                  </div>
                  {/* Location type badges */}
                  <div className="flex gap-1 mt-1">
                    {result.city && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">City</span>
                    )}
                    {result.state && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">State</span>
                    )}
                    {result.country && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{result.country_code || 'Country'}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Location Badge */}
      {selectedLocation && !pendingLocation && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
          <Globe className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">
              {formatLocationName(selectedLocation)}
            </span>
            {/* Show details */}
            <div className="flex gap-1 mt-1 flex-wrap">
              {selectedLocation.city && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">📍 {selectedLocation.city}</span>
              )}
              {selectedLocation.state && selectedLocation.state !== selectedLocation.city && (
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">🏛️ {selectedLocation.state}</span>
              )}
              {selectedLocation.country && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">🌍 {selectedLocation.country}</span>
              )}
              {selectedLocation.radius && (
                <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">⭕ {selectedLocation.radius} km</span>
              )}
            </div>
          </div>
          {selectedLocation.country_code && (
            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full font-mono">
              {selectedLocation.country_code}
            </span>
          )}
        </div>
      )}

      {/* Pending Location — Radius Adjustment Panel (tag-input mode) */}
      {pendingLocation && (
        <div className="space-y-3 p-3 bg-amber-50 border-2 border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-900">{formatLocationName(pendingLocation)}</span>
            {pendingLocation.country_code && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded font-mono">{pendingLocation.country_code}</span>
            )}
          </div>

          {/* Whole Area Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`pending-whole-area-${mapInstanceKey}`}
              checked={isWholeArea}
              onCheckedChange={(checked) => {
                const isChecked = checked === true;
                setIsWholeArea(isChecked);
                const updated = { ...pendingLocation, radius: isChecked ? undefined : (radius || 25) };
                setPendingLocation(updated);
                setSelectedLocation(updated);
              }}
            />
            <Label htmlFor={`pending-whole-area-${mapInstanceKey}`} className="text-sm font-medium cursor-pointer text-amber-900">
              Target entire area (no radius limit)
            </Label>
          </div>

          {/* Radius Slider */}
          {!isWholeArea && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-amber-800">Radius</span>
                <span className="text-xs font-bold text-amber-900">{pendingLocation.radius || radius} km</span>
              </div>
              <Slider
                value={[pendingLocation.radius || radius]}
                min={1}
                max={200}
                step={1}
                onValueChange={(val) => {
                  const r = val[0];
                  setRadius(r);
                  const updated = { ...pendingLocation, radius: r };
                  setPendingLocation(updated);
                  setSelectedLocation(updated);
                }}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] text-amber-700">
                <span>1 km</span>
                <span>200 km</span>
              </div>
            </div>
          )}

          {/* Confirm / Cancel Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={confirmPendingLocation}
            >
              <MapPin className="h-3.5 w-3.5 mr-1.5" />
              Add Location
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={cancelPendingLocation}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Map Toggle Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`w-full border-2 transition-all ${isExpanded
          ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-primary/30 hover:border-primary/50 hover:bg-primary/5'
          }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <MapPin className="h-4 w-4 mr-2" />
        {isExpanded ? 'Hide Map' : 'Show Map to Select Location'}
      </Button>

      {/* Radius Controls */}
      {selectedLocation && isExpanded && !pendingLocation && (
        <div className="px-3 py-2 bg-background border border-border/50 rounded-lg space-y-3">

          <div className="flex items-center space-x-2">
            <Checkbox
              id={`whole-area-${mapInstanceKey}`}
              checked={isWholeArea}
              onCheckedChange={(checked) => {
                const isChecked = checked === true;
                setIsWholeArea(isChecked);
                if (selectedLocation) {
                  const updated = { ...selectedLocation, radius: isChecked ? undefined : radius };
                  setSelectedLocation(updated);
                  // Re-format name to update input
                  const baseName = formatLocationName(updated);
                  const newName = baseName + (isChecked ? " (Entire Area)" : "");
                  setSearchQuery(newName);
                  onChange?.(newName, updated);
                }
              }}
            />
            <Label htmlFor={`whole-area-${mapInstanceKey}`} className="text-sm font-medium cursor-pointer">
              Target entire area (no radius limit)
            </Label>
          </div>

          {!isWholeArea && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">Radius</span>
                <span className="text-xs font-bold text-primary">{radius} km</span>
              </div>
              <Slider
                value={[radius]}
                min={1}
                max={1000}
                step={1}
                onValueChange={handleRadiusChange}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1 km</span>
                <span>1000 km</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map Container */}
      {isExpanded && (
        <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <MapContainer
            key={mapInstanceKey}
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '300px', width: '100%', minHeight: '300px' }}
            className="z-0"
            preferCanvas={true}
            renderer={L.canvas()}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              crossOrigin="anonymous"
            />
            <MapViewController center={mapCenter} zoom={mapZoom} />
            <MapClickHandler onLocationSelect={handleMapClick} />
            {selectedLocation && typeof selectedLocation.lat === 'number' && typeof selectedLocation.lon === 'number' && (
              <>
                <Marker
                  position={[selectedLocation.lat, selectedLocation.lon]}
                  icon={customIcon}
                />
                {!isWholeArea && (
                  <Circle
                    center={[selectedLocation.lat, selectedLocation.lon]}
                    radius={radius * 1000}
                    pathOptions={{
                      color: '#f97316',
                      fillColor: '#f97316',
                      fillOpacity: 0.2,
                      weight: 3,
                      opacity: 0.8
                    }}
                  />
                )}
              </>
            )}
          </MapContainer>

          {/* Radius indicator badge */}
          {selectedLocation && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm border border-orange-200">
              <span className="text-xs font-medium text-orange-600">⭕ {radius} km radius</span>
            </div>
          )}

          {/* Map Overlay with Instructions */}
          {!selectedLocation && (
            <div className="absolute bottom-3 left-3 right-3 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50 shadow-sm">
              <p className="text-xs text-muted-foreground text-center">
                Click on the map to select a location, or use the search above
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
