// src/components/ui/location-picker-simple.tsx
// A simpler, more browser-compatible location picker without Leaflet
// Uses Google Static Maps for preview and Nominatim for geocoding

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, X, Loader2, Globe, Navigation, ZoomIn, ZoomOut, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { Slider } from './slider';
import { cn } from '@/lib/utils';

interface LocationResult {
  lat: number;
  lon: number;
  display_name: string;
  country?: string;
  country_code?: string;
  city?: string;
  state?: string;
  type?: string;
  radius?: number;
  distance_unit?: string;
}

function formatLocationName(location: LocationResult): string {
  const parts: string[] = [];
  if (location.city) parts.push(location.city);
  if (location.state && location.state !== location.city) parts.push(location.state);
  if (location.country && location.country !== location.state) parts.push(location.country);
  if (parts.length === 0) return location.display_name.split(',')[0].trim();
  return parts.join(', ');
}

interface LocationPickerSimpleProps {
  value?: string;
  onChange?: (location: string, details?: LocationResult) => void;
  placeholder?: string;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  defaultRadius?: number;
  initialLocation?: LocationResult;
}

// Generate OpenStreetMap static image URL (no API key needed)
function getStaticMapUrl(lat: number, lon: number, zoom: number = 12): string {
  // Using OpenStreetMap tile server to create a pseudo-static map
  const tileX = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
}

// Generate a proper static map using staticmapmaker or similar
function getMapPreviewUrl(lat: number, lon: number, zoom: number = 10, width: number = 600, height: number = 300): string {
  // Use a free static map service
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${width}x${height}&maptype=osmarenderer&markers=${lat},${lon},red-pushpin`;
}

export function LocationPickerSimple({
  value = '',
  onChange,
  placeholder = 'Search for a location...',
  className,
  defaultCenter = [20, 0],
  defaultZoom = 2,
  defaultRadius = 10,
  initialLocation,
}: LocationPickerSimpleProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(initialLocation || null);
  const [radius, setRadius] = useState(initialLocation?.radius || defaultRadius);
  const [isExpanded, setIsExpanded] = useState(true);
  const [mapZoom, setMapZoom] = useState(10);
  const [mapImageLoading, setMapImageLoading] = useState(false);
  const [mapImageError, setMapImageError] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== searchQuery) {
      setSearchQuery(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
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
    } catch (error) {
      console.error('Location search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = window.setTimeout(() => {
      searchLocations(query);
    }, 400);
  };

  const handleSelectLocation = (location: LocationResult) => {
    const locationWithRadius = { ...location, radius, distance_unit: 'kilometer' };
    setSelectedLocation(locationWithRadius);
    setSearchQuery(formatLocationName(location));
    setShowResults(false);
    setMapZoom(10);
    setMapImageError(false);
    
    if (onChange) {
      onChange(formatLocationName(location), locationWithRadius);
    }
  };

  const handleRadiusChange = (values: number[]) => {
    const newRadius = values[0];
    setRadius(newRadius);
    
    if (selectedLocation) {
      const updated = { ...selectedLocation, radius: newRadius, distance_unit: 'kilometer' };
      setSelectedLocation(updated);
      if (onChange) {
        onChange(formatLocationName(updated), updated);
      }
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSelectedLocation(null);
    setSearchResults([]);
    setShowResults(false);
    setMapImageError(false);
    if (onChange) {
      onChange('', undefined);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await response.json();
          
          const location: LocationResult = {
            lat: latitude,
            lon: longitude,
            display_name: data.display_name,
            country: data.address?.country,
            country_code: data.address?.country_code?.toUpperCase(),
            city: data.address?.city || data.address?.town || data.address?.village,
            state: data.address?.state || data.address?.region,
            radius,
            distance_unit: 'kilometer',
          };
          
          handleSelectLocation(location);
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to retrieve your location');
      }
    );
  };

  const handleZoomIn = () => setMapZoom(prev => Math.min(prev + 1, 18));
  const handleZoomOut = () => setMapZoom(prev => Math.max(prev - 1, 1));

  // Calculate approximate radius circle size in pixels based on zoom level
  const getRadiusInPixels = (radiusKm: number, zoom: number): number => {
    // Approximate calculation: at zoom 10, 1 km ≈ 1.5 pixels
    const metersPerPixel = 156543.03392 * Math.cos(0) / Math.pow(2, zoom);
    const radiusMeters = radiusKm * 1000;
    return radiusMeters / metersPerPixel;
  };

  return (
    <div 
      ref={containerRef} 
      className={cn(
        'space-y-3 p-3 rounded-xl transition-all duration-300',
        isExpanded 
          ? 'border-2 border-primary/30 shadow-md ring-2 ring-primary/10 bg-primary/5' 
          : 'border border-border/50 bg-background',
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
      {selectedLocation && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
          <Globe className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">
              {formatLocationName(selectedLocation)}
            </span>
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
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">⭕ {radius} km radius</span>
            </div>
          </div>
          {selectedLocation.country_code && (
            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full font-mono">
              {selectedLocation.country_code}
            </span>
          )}
        </div>
      )}

      {/* Map Toggle Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`w-full border-2 transition-all ${
          isExpanded 
            ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20' 
            : 'border-primary/30 hover:border-primary/50 hover:bg-primary/5'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
        {isExpanded ? 'Hide Map Preview' : 'Show Map Preview'}
      </Button>

      {/* Radius Slider */}
      {selectedLocation && isExpanded && (
        <div className="px-3 py-2 bg-background border border-border/50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-muted-foreground">Targeting Radius</span>
            <span className="text-xs font-bold text-primary">{radius} km</span>
          </div>
          <Slider
            value={[radius]}
            min={1}
            max={80}
            step={1}
            onValueChange={handleRadiusChange}
            className="py-1"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1 km (precise)</span>
            <span>80 km (broad)</span>
          </div>
        </div>
      )}

      {/* Static Map Preview */}
      {isExpanded && selectedLocation && (
        <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-sm">
          {/* Map Image */}
          <div className="relative bg-muted" style={{ height: '250px' }}>
            {mapImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {!mapImageError ? (
              <img
                src={getMapPreviewUrl(selectedLocation.lat, selectedLocation.lon, mapZoom)}
                alt={`Map of ${formatLocationName(selectedLocation)}`}
                className="w-full h-full object-cover"
                onLoad={() => setMapImageLoading(false)}
                onError={() => {
                  setMapImageError(true);
                  setMapImageLoading(false);
                }}
                style={{ display: mapImageLoading ? 'none' : 'block' }}
              />
            ) : (
              // Fallback: Simple coordinate display with gradient background
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 flex flex-col items-center justify-center">
                <MapPin className="h-12 w-12 text-red-500 mb-2 drop-shadow-lg" />
                <div className="text-center px-4">
                  <p className="font-semibold text-gray-800">{formatLocationName(selectedLocation)}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    📍 {selectedLocation.lat.toFixed(4)}°, {selectedLocation.lon.toFixed(4)}°
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Radius: {radius} km
                  </p>
                </div>
              </div>
            )}
            
            {/* Radius Circle Overlay (CSS-based, browser compatible) */}
            {!mapImageError && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: `${Math.min(getRadiusInPixels(radius, mapZoom) * 2, 200)}px`,
                  height: `${Math.min(getRadiusInPixels(radius, mapZoom) * 2, 200)}px`,
                  borderRadius: '50%',
                  border: '3px solid #f97316',
                  backgroundColor: 'rgba(249, 115, 22, 0.15)',
                  boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.3)',
                }}
              />
            )}
            
            {/* Center Marker */}
            {!mapImageError && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <MapPin className="h-8 w-8 text-red-500 drop-shadow-lg" fill="#ef4444" />
              </div>
            )}

            {/* Zoom Controls */}
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white/90 hover:bg-white shadow-md"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white/90 hover:bg-white shadow-md"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Coordinates Badge */}
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono shadow-sm">
              {selectedLocation.lat.toFixed(4)}°, {selectedLocation.lon.toFixed(4)}°
            </div>
          </div>
        </div>
      )}

      {/* Instructions when no location selected */}
      {isExpanded && !selectedLocation && (
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center">
          <Search className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Search for a location above</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Type a city, state, or country name to see it on the map
          </p>
        </div>
      )}
    </div>
  );
}
