/**
 * WhatsApp Automation Module
 * 
 * This module provides all the components and functionality needed for 
 * WhatsApp Business integration and Click-to-WhatsApp (CTWA) ad creation.
 */

// API Client
export * from './api';

// Types
export * from './types';

// Disambiguate members exported by BOTH ./api and ./types — the ./api
// definitions are canonical (used by the API functions), so re-export them
// explicitly to resolve the star-export ambiguity.
export type {
    CreateCampaignRequest,
    CreateCampaignResponse,
    LinkMetaResponse,
} from './api';

// Components
export * from './components';

// Pages
export * from './pages';
