// src/components/ui/location-picker-exports.ts
// Export both location pickers for easy switching

// Original Leaflet-based picker (interactive map with click-to-select)
// Pros: Full interactive map, click anywhere to select
// Cons: May have rendering issues in some browsers (Safari, older Firefox)
export { LocationPicker } from './location-picker';

// Simple picker with static map preview (more browser compatible)
// Pros: Works reliably across all browsers, uses static images
// Cons: Cannot click on map to select, only search-based selection
export { LocationPickerSimple } from './location-picker-simple';

// Usage in your component:
// 
// Option 1: Use the original Leaflet picker (default)
// import { LocationPicker } from '@/components/ui/location-picker';
//
// Option 2: Use the simple picker for better browser compatibility
// import { LocationPickerSimple as LocationPicker } from '@/components/ui/location-picker-simple';
//
// Option 3: Let users choose which one to use
// import { LocationPicker, LocationPickerSimple } from '@/components/ui/location-picker-exports';
