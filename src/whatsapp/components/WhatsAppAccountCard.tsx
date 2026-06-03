// WhatsApp Account Card Component
// =================================
// Displays connected WhatsApp account information with Manage dropdown

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

interface WhatsAppAccount {
  id: number;
  workspace_id: string | null;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_score: string | null;
  messaging_limit: number | null;
  token_type: string;
  is_active: boolean;
  onboarding_status?: string | null;
  onboarding_error?: string | null;
  created_at: string;
}

interface WhatsAppAccountCardProps {
  account: WhatsAppAccount;
  onUpdate?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
  onRelink?: () => void;
  onPopupTrigger?: (
    variant: 'connect' | 'unlink' | 'delete' | 'error',
    title: string,
    subtitle: string,
    accountName?: string,
    accountNumber?: string,
    onClosed?: () => void
  ) => void;
}

export function WhatsAppAccountCard({
  account,
  onUpdate,
  onSync,
  isSyncing = false,
  onRelink,
  onPopupTrigger
}: WhatsAppAccountCardProps) {
  const navigate = useNavigate();
  const [unlinking, setUnlinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newName, setNewName] = useState(account.verified_name || '');

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'N/A';
    return phone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
  };

  const formatMessagingLimit = (limit: number | null) => {
    if (!limit) return 'Unknown';
    if (limit >= 1000000) return 'Unlimited';
    if (limit >= 1000) return `${limit / 1000}K`;
    return limit.toString();
  };

  const handleUnlinkClick = () => {
    setDropdownOpen(false);
    setUnlinkDialogOpen(true);
  };

  const handleUnlinkConfirm = async () => {
    setUnlinkDialogOpen(false);
    setUnlinking(true);
    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/accounts/${account.id}/unlink`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to unlink account');
      }

      toast({
        title: 'Account Deactivated',
        description: 'WhatsApp account is now inactive. You can re-link it anytime.',
      });

      onUpdate?.();
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unlink',
        variant: 'destructive',
      });
    } finally {
      setUnlinking(false);
    }
  };

  const handleRelink = () => {
    setDropdownOpen(false);
    if (onRelink) {
      onRelink();
      return;
    }
    const reconnectBtn = document.querySelector('[data-reconnect-whatsapp]') as HTMLButtonElement;
    const connectButton = document.querySelector('[data-connect-whatsapp]') as HTMLButtonElement;
    if (reconnectBtn) {
      reconnectBtn.scrollIntoView({ behavior: 'smooth' });
      reconnectBtn.click();
    } else if (connectButton) {
      connectButton.click();
    } else {
      toast({
        title: 'Re-link Account',
        description: 'Use the "Reconnect WhatsApp" button above to reconnect this account.',
      });
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      toast({ title: 'Error', description: 'Name cannot be empty', variant: 'destructive' });
      return;
    }

    setRenaming(true);
    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/accounts/${account.id}/rename`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rename account');
      }

      toast({
        title: 'Account Renamed',
        description: `Account is now named "${newName.trim()}"`,
      });

      setRenameDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to rename',
        variant: 'destructive',
      });
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteClick = () => {
    setDropdownOpen(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/accounts/${account.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete account');
      }

      toast({
        title: 'Account Deleted',
        description: 'WhatsApp account and all data permanently deleted.',
      });

      onUpdate?.();
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const StatusBadge = () => (
    <ConnectionStatusBadge
      isActive={account.is_active}
      tokenType={account.token_type}
      onboardingStatus={account.onboarding_status}
    />
  );

  return (
    <>
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 ${account.is_active
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20'
                : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20'
                }`}>
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg truncate">
                  {account.verified_name || 'WhatsApp Business Account'}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {formatPhoneNumber(account.display_phone_number)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Status Badge with Tooltip */}
              <StatusBadge />

              {/* Manage Dropdown */}
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                    disabled={unlinking || deleting || renaming}
                  >
                    {(unlinking || deleting || renaming) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Settings2 className="w-4 h-4" />
                    )}
                    Manage
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 animate-in fade-in-0 zoom-in-95 duration-200"
                >
                  {/* Sync Option */}
                  {onSync && (
                    <DropdownMenuItem
                      onClick={() => {
                        setDropdownOpen(false);
                        onSync();
                      }}
                      className="cursor-pointer"
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync Account'}
                    </DropdownMenuItem>
                  )}

                  {/* View Analytics Option */}
                  <DropdownMenuItem
                    onClick={() => {
                      setDropdownOpen(false);
                      window.location.href = '/dashboard/analytics';
                    }}
                    className="cursor-pointer"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Analytics
                  </DropdownMenuItem>

                  {/* Rename Option */}
                  <DropdownMenuItem
                    onClick={() => {
                      setNewName(account.verified_name || '');
                      setRenameDialogOpen(true);
                      setDropdownOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename Account
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {account.is_active ? (
                    <DropdownMenuItem
                      onClick={handleUnlinkClick}
                      className="text-orange-600 focus:text-orange-600 focus:bg-orange-50 cursor-pointer"
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Unlink Account
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleRelink}
                      className="text-green-600 focus:text-green-600 focus:bg-green-50 cursor-pointer"
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Re-link Account
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Permanently
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">WABA ID:</span>
              <span className="font-mono text-xs">{account.waba_id}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Phone Number ID:</span>
              <span className="font-mono text-xs">{account.phone_number_id}</span>
            </div>

            {account.quality_score && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Quality Score:</span>
                <Badge
                  variant={
                    account.quality_score === 'GREEN'
                      ? 'default'
                      : account.quality_score === 'YELLOW'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {account.quality_score}
                </Badge>
              </div>
            )}

            {account.messaging_limit && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Messaging Limit:</span>
                <span className="font-semibold">{formatMessagingLimit(account.messaging_limit)}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
            <span>Connected {new Date(account.created_at).toLocaleDateString()}</span>
            <div className="flex items-center gap-2">
              {account.token_type === 'permanent' ? (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  Permanent Token
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  Temporary Token
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Rename Account
            </DialogTitle>
            <DialogDescription>
              Enter a new display name for this WhatsApp Business account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter account name..."
              className="w-full"
              maxLength={128}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !renaming) {
                  handleRename();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Max 128 characters. This name will be displayed in the settings and inbox.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renaming || !newName.trim()}
            >
              {renaming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Name'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Unlink className="w-5 h-5" />
              Unlink Account
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will deactivate <strong>"{account.verified_name || account.display_phone_number}"</strong>. All messaging, templates, and flows will be paused.
              <br /><br />
              You can re-link it later from the settings page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setUnlinkDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnlinkConfirm}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              <Unlink className="w-4 h-4" />
              Yes, Unlink Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Permanently
            </DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-semibold text-destructive">⚠️ This action cannot be undone.</span>
              <br /><br />
              Permanently delete <strong>"{account.verified_name || account.display_phone_number}"</strong> and all associated conversations, messages, and data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Yes, Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
