import React, { useState, useEffect, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Facebook,
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Instagram
} from 'lucide-react';
import { whatsappApi } from '../api';
import type { LinkedPage } from '../types';

// ============================================================
// Types
// ============================================================

interface SelectPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: SelectedAccount) => void;
  requireWhatsApp?: boolean;
  workspaceId?: string;
}

export interface SelectedAccount {
  page_id: string;
  page_name: string;
  phone_number_id?: string;
  waba_id?: string;
  instagram_account_id?: string;
}

// ============================================================
// Loading Skeleton
// ============================================================

const PageSkeleton: React.FC = () => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ============================================================
// Page Card Component
// ============================================================

const PageCard: React.FC<{
  page: LinkedPage;
  isSelected: boolean;
  onSelect: () => void;
  requireWhatsApp?: boolean;
}> = ({ page, isSelected, onSelect, requireWhatsApp }) => {
  const hasWhatsApp = !!page.waba_id && !!page.phone_number_id;
  const isDisabled = requireWhatsApp && !hasWhatsApp;
  const cardId = useId();

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onSelect()}
      disabled={isDisabled}
      className={`w-full text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg ${
        isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
      aria-pressed={isSelected}
      aria-describedby={isDisabled ? `${cardId}-disabled` : undefined}
    >
      <Card className={`transition-colors ${
        isSelected 
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
          : isDisabled 
            ? 'border-muted' 
            : 'hover:border-muted-foreground/30'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Page Icon */}
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Facebook className="w-6 h-6 text-blue-600" />
            </div>

            {/* Page Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium truncate">{page.page_name}</h4>
                {isSelected && (
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mt-1">
                Page ID: {page.page_id}
              </p>

              {/* Linked Services */}
              <div className="flex flex-wrap gap-2 mt-2">
                {hasWhatsApp && (
                  <Badge variant="secondary" className="text-xs">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    WhatsApp
                  </Badge>
                )}
                
                {page.instagram_account_id && (
                  <Badge variant="secondary" className="text-xs">
                    <Instagram className="w-3 h-3 mr-1" />
                    Instagram
                  </Badge>
                )}
                
                {page.phone_number_id && (
                  <Badge variant="outline" className="text-xs">
                    <Phone className="w-3 h-3 mr-1" />
                    {page.phone_number_id}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* WhatsApp Required Warning */}
          {isDisabled && (
            <div 
              id={`${cardId}-disabled`}
              className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md"
            >
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                WhatsApp Business Account not linked to this page
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
};

// ============================================================
// Main Component
// ============================================================

export const SelectPageModal: React.FC<SelectPageModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  requireWhatsApp = false,
  workspaceId,
}) => {
  const [pages, setPages] = useState<LinkedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<LinkedPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalId = useId();

  // ============================================================
  // Fetch Linked Pages
  // ============================================================

  const fetchPages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First, try to get existing WABA and phone numbers
      const wabaResponse = await whatsappApi.getWABA(workspaceId);

      if (!wabaResponse.success) {
        // If no WABA linked, show appropriate message
        if (wabaResponse.error?.includes('not linked') || wabaResponse.error?.includes('not found')) {
          setPages([]);
          setError('No WhatsApp Business Account linked. Please connect your account first.');
          return;
        }
        throw new Error(wabaResponse.error || 'Failed to fetch WABA info');
      }

      // Get phone numbers associated with the WABA
      const phoneResponse = await whatsappApi.getPhoneNumbers(workspaceId);

      // Convert WABA + phone numbers to LinkedPage format for compatibility
      const linkedPages: LinkedPage[] = [];
      
      if (wabaResponse.waba && phoneResponse.phone_numbers) {
        phoneResponse.phone_numbers.forEach((phone) => {
          linkedPages.push({
            page_id: phone.id,
            page_name: phone.verified_name || phone.display_phone_number,
            waba_id: wabaResponse.waba?.waba_id,
            phone_number_id: phone.id,
            display_phone_number: phone.display_phone_number,
          });
        });
      }

      setPages(linkedPages);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr?.status === 401) {
        setError('Session expired. Please log in again.');
      } else if (apiErr?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load linked accounts';
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isOpen) {
      fetchPages();
      setSelectedPage(null);
    }
  }, [isOpen, fetchPages]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleSelectPage = useCallback((page: LinkedPage) => {
    setSelectedPage(page);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedPage) return;

    const selection: SelectedAccount = {
      page_id: selectedPage.page_id,
      page_name: selectedPage.page_name,
      phone_number_id: selectedPage.phone_number_id,
      waba_id: selectedPage.waba_id,
      instagram_account_id: selectedPage.instagram_account_id,
    };

    onSelect(selection);
    onClose();
  }, [selectedPage, onSelect, onClose]);

  const handleClose = useCallback(() => {
    setSelectedPage(null);
    setError(null);
    onClose();
  }, [onClose]);

  // ============================================================
  // Render
  // ============================================================

  const hasValidPages = pages.length > 0;
  const hasWhatsAppPages = pages.some((p) => p.waba_id && p.phone_number_id);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-lg max-h-[85vh] flex flex-col"
        aria-describedby={`${modalId}-description`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="w-5 h-5 text-blue-600" />
            Select Account
          </DialogTitle>
          <DialogDescription id={`${modalId}-description`}>
            {requireWhatsApp 
              ? 'Choose a Facebook Page with a linked WhatsApp Business Account'
              : 'Choose a Facebook Page or Instagram account to post with'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchPages}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <PageSkeleton />
              <PageSkeleton />
              <PageSkeleton />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !hasValidPages && (
            <div className="text-center py-8">
              <Facebook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium">No linked accounts</h4>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Connect your Facebook Page to get started
              </p>
              <Button variant="outline" asChild>
                <a href="/dashboard/whatsapp/setup" className="inline-flex items-center gap-2">
                  Connect Account
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          )}

          {/* WhatsApp Required but None Available */}
          {!isLoading && !error && hasValidPages && requireWhatsApp && !hasWhatsAppPages && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>WhatsApp Not Linked</AlertTitle>
              <AlertDescription>
                None of your Facebook Pages have a WhatsApp Business Account linked. 
                Please use the Embedded Signup to connect WhatsApp, or link your Page 
                to WhatsApp in your Facebook Business settings.
                <Button variant="link" asChild className="px-0 mt-2 h-auto">
                  <a href="/dashboard/whatsapp/setup">
                    Set up WhatsApp Business
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Page List */}
          {!isLoading && !error && hasValidPages && (
            <div className="space-y-3" role="listbox" aria-label="Available accounts">
              {pages.map((page) => (
                <PageCard
                  key={page.page_id}
                  page={page}
                  isSelected={selectedPage?.page_id === page.page_id}
                  onSelect={() => handleSelectPage(page)}
                  requireWhatsApp={requireWhatsApp}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedPage || (requireWhatsApp && !selectedPage.phone_number_id)}
          >
            {selectedPage ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Select {selectedPage.page_name}
              </>
            ) : (
              'Select Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SelectPageModal;
