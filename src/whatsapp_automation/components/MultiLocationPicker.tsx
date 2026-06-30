import React, { useState, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Map as MapIcon,
  Info,
  AlertCircle,
  GripVertical
} from 'lucide-react';
import type { AudienceLocation } from '../types';
import { useCampaignStore } from '@/store/campaignStore';

// ============================================================
// Constants
// ============================================================

const MAX_LOCATIONS = 10;
const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 25;

// ============================================================
// Types
// ============================================================

interface MultiLocationPickerProps {
  locations: AudienceLocation[];
  onChange: (locations: AudienceLocation[]) => void;
  maxLocations?: number;
  className?: string;
}

// ============================================================
// Utility Functions
// ============================================================

const generateId = () => `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const kmToMeters = (km: number) => km * 1000;
const metersToKm = (meters: number) => meters / 1000;

// ============================================================
// Map Preview Component (Placeholder)
// ============================================================

/**
 * NOTE: For a full implementation, integrate Leaflet for map preview.
 * Install: npm install leaflet react-leaflet @types/leaflet
 * This is a stub component that can be replaced with actual map integration.
 */
const MapPreviewModal: React.FC<{
  location: AudienceLocation;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedLocation: AudienceLocation) => void;
}> = ({ location, isOpen, onClose, onSave }) => {
  const [radius, setRadius] = useState(
    location.radius_meters ? metersToKm(location.radius_meters) : DEFAULT_RADIUS_KM
  );
  const mapId = useId();

  const handleSave = () => {
    onSave({
      ...location,
      radius_meters: kmToMeters(radius),
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Location Radius</DialogTitle>
          <DialogDescription>
            Adjust the targeting radius for "{location.query}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Map Placeholder - Replace with Leaflet integration */}
          <div 
            id={mapId}
            className="w-full h-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/30"
            role="img"
            aria-label={`Map showing ${location.query} with ${radius}km radius`}
          >
            <div className="text-center text-muted-foreground">
              <MapIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Map Preview</p>
              <p className="text-xs">
                {location.lat && location.lon 
                  ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`
                  : 'Location coordinates not available'}
              </p>
              {/* 
                TODO: Integrate Leaflet map here
                Example:
                <MapContainer center={[location.lat, location.lon]} zoom={10}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Circle center={[location.lat, location.lon]} radius={radius * 1000} />
                </MapContainer>
              */}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="radius-slider">Targeting Radius</Label>
              <span className="text-sm font-medium">{radius} km</span>
            </div>
            <Slider
              id="radius-slider"
              value={[radius]}
              onValueChange={([value]) => setRadius(value)}
              min={1}
              max={MAX_RADIUS_KM}
              step={1}
              aria-label="Radius in kilometers"
            />
            <p className="text-xs text-muted-foreground">
              <Info className="w-3 h-3 inline mr-1" />
              Radius will be used to draw a circle on the map and used in targeting payload.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Radius
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// Location Item Component
// ============================================================

const LocationItem: React.FC<{
  location: AudienceLocation;
  index: number;
  onUpdate: (id: string, updates: Partial<AudienceLocation>) => void;
  onRemove: (id: string) => void;
  onOpenMap: (location: AudienceLocation) => void;
}> = ({ location, index, onUpdate, onRemove, onOpenMap }) => {
  const inputId = useId();
  
  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle (visual only for now) */}
          <div 
            className="flex items-center justify-center w-6 h-6 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          
          <div className="flex-1 space-y-3">
            {/* Location Query Input */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Label htmlFor={`${inputId}-query`} className="sr-only">
                Location {index + 1}
              </Label>
              <Input
                id={`${inputId}-query`}
                value={location.query}
                onChange={(e) => onUpdate(location.id, { query: e.target.value })}
                placeholder="Enter city, region, or country"
                className="flex-1"
                aria-describedby={`${inputId}-help`}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Radius Display & Edit */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Radius: {location.radius_meters 
                    ? `${metersToKm(location.radius_meters)} km` 
                    : `${DEFAULT_RADIUS_KM} km (default)`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenMap(location)}
                  aria-label={`Open map to set radius for ${location.query}`}
                >
                  <MapIcon className="w-3 h-3 mr-1" />
                  Set on Map
                </Button>
              </div>
              
              {/* Include/Exclude Toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${inputId}-included`}
                  checked={location.included}
                  onCheckedChange={(checked) => 
                    onUpdate(location.id, { included: checked === true })
                  }
                  aria-describedby={`${inputId}-included-desc`}
                />
                <Label 
                  htmlFor={`${inputId}-included`}
                  className="text-sm cursor-pointer"
                >
                  {location.included ? 'Include' : 'Exclude'}
                </Label>
                <span id={`${inputId}-included-desc`} className="sr-only">
                  {location.included 
                    ? 'This location is included in targeting' 
                    : 'This location is excluded from targeting'}
                </span>
              </div>
            </div>
            
            <p id={`${inputId}-help`} className="sr-only">
              Enter a city, region, or country name for location {index + 1}
            </p>
          </div>
          
          {/* Remove Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(location.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Remove location ${location.query || index + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove location</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// Main Component
// ============================================================

export const MultiLocationPicker: React.FC<MultiLocationPickerProps> = ({
  locations,
  onChange,
  maxLocations = MAX_LOCATIONS,
  className = '',
}) => {
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<AudienceLocation | null>(null);
  const componentId = useId();

  const canAddMore = locations.length < maxLocations;

  const handleAddLocation = useCallback(() => {
    if (!canAddMore) return;
    
    const newLocation: AudienceLocation = {
      id: generateId(),
      query: '',
      type: 'city',
      included: true,
      radius_meters: kmToMeters(DEFAULT_RADIUS_KM),
    };
    
    onChange([...locations, newLocation]);
  }, [locations, onChange, canAddMore]);

  const handleUpdateLocation = useCallback((id: string, updates: Partial<AudienceLocation>) => {
    onChange(
      locations.map((loc) => 
        loc.id === id ? { ...loc, ...updates } : loc
      )
    );
  }, [locations, onChange]);

  const handleRemoveLocation = useCallback((id: string) => {
    onChange(locations.filter((loc) => loc.id !== id));
  }, [locations, onChange]);

  const handleOpenMap = useCallback((location: AudienceLocation) => {
    setSelectedLocation(location);
    setMapModalOpen(true);
  }, []);

  const handleSaveMapLocation = useCallback((updatedLocation: AudienceLocation) => {
    handleUpdateLocation(updatedLocation.id, updatedLocation);
    setSelectedLocation(null);
  }, [handleUpdateLocation]);

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-labelledby={`${componentId}-title`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 id={`${componentId}-title`} className="text-lg font-medium">
            Target Locations
          </h3>
          <p className="text-sm text-muted-foreground">
            Add up to {maxLocations} locations for your audience targeting
          </p>
        </div>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {locations.length} / {maxLocations}
        </span>
      </div>
      
      {locations.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            At least one location is required for targeting. Add a location to continue.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-3" role="list" aria-label="Target locations">
        {locations.map((location, index) => (
          <div key={location.id} role="listitem">
            <LocationItem
              location={location}
              index={index}
              onUpdate={handleUpdateLocation}
              onRemove={handleRemoveLocation}
              onOpenMap={handleOpenMap}
            />
          </div>
        ))}
      </div>
      
      <Button
        variant="outline"
        onClick={handleAddLocation}
        disabled={!canAddMore}
        className="w-full"
        aria-describedby={!canAddMore ? `${componentId}-max-reached` : undefined}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add another location
      </Button>
      
      {!canAddMore && (
        <p 
          id={`${componentId}-max-reached`} 
          className="text-sm text-muted-foreground text-center"
        >
          Maximum of {maxLocations} locations reached
        </p>
      )}
      
      {/* Map Modal */}
      {selectedLocation && (
        <MapPreviewModal
          location={selectedLocation}
          isOpen={mapModalOpen}
          onClose={() => {
            setMapModalOpen(false);
            setSelectedLocation(null);
          }}
          onSave={handleSaveMapLocation}
        />
      )}
    </div>
  );
};

// ============================================================
// Connected Component (with Zustand store)
// ============================================================

export const ConnectedMultiLocationPicker: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { audience, setAudience } = useCampaignStore();
  
  // Convert existing store locations to AudienceLocation format
  const locations: AudienceLocation[] = (audience.locations || []).map((loc, index) => ({
    id: `loc_${index}`,
    query: loc.city || loc.region || loc.country || '',
    type: loc.city ? 'city' : loc.region ? 'region' : 'country',
    city: loc.city,
    region: loc.region,
    country: loc.country,
    country_code: loc.country_code,
    lat: loc.latitude,
    lon: loc.longitude,
    radius_meters: loc.radius ? loc.radius * 1000 : undefined,
    included: true,
  }));

  const handleChange = useCallback((newLocations: AudienceLocation[]) => {
    setAudience({
      locations: newLocations.map((loc) => ({
        country: loc.country || '',
        country_code: loc.country_code,
        region: loc.region,
        city: loc.city,
        latitude: loc.lat,
        longitude: loc.lon,
        radius: loc.radius_meters ? loc.radius_meters / 1000 : undefined,
        distance_unit: 'kilometer',
      })),
    });
  }, [setAudience]);

  return (
    <MultiLocationPicker
      locations={locations}
      onChange={handleChange}
      className={className}
    />
  );
};

export default MultiLocationPicker;
