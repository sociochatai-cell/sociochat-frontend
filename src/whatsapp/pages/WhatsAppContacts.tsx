import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Search, Plus, User, FileText, MessageCircle, Inbox, BarChart3, Clock, MessageSquare } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

// API Base URL from environment
const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').toString().replace(/\/$/, '');

export default function WhatsAppContacts() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    // Get base path from current location (agent or dashboard)
    const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';

    // Get workspace ID from storage (standard pattern in this app for now)
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        localStorage.getItem('sv_whatsapp_workspace_id') || localStorage.getItem('sv_selected_workspace_id')
    );

    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Add Contact State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newPhone, setNewPhone] = useState("");
    const [newName, setNewName] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch contacts
    useEffect(() => {
        if (!workspaceId) return;
        fetchContacts();
    }, [workspaceId, page, debouncedSearch]);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/workspaces/${workspaceId}/contacts?page=${page}&q=${debouncedSearch}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setContacts(data.data);
                // Backend returns flat 'pages' or we fallback to 1
                setTotalPages(data.pages || (data.pagination && data.pagination.pages) || 1);
            } else {
                toast({
                    title: "Error fetching contacts",
                    description: data.error || "Unknown error",
                    variant: "destructive"
                });
            }
        } catch (e) {
            console.error(e);
            toast({
                title: "Network Error",
                description: "Failed to connect to server",
                variant: "destructive"
            });
        }
        finally { setLoading(false); }
    }

    const handleAddContact = async () => {
        if (!newPhone) {
            toast({ title: "Phone number required", variant: "destructive" });
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/workspaces/${workspaceId}/contacts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    phone: newPhone,
                    name: newName
                })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Contact added", description: `${data.data.name || data.data.phone_normalized} added successfully.` });
                setIsAddOpen(false);
                setNewPhone("");
                setNewName("");
                fetchContacts();
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to add contact", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    if (!workspaceId) {
        return <div className="p-8 text-center text-muted-foreground">Please select a workspace.</div>;
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 min-w-0 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <User className="h-6 w-6 text-green-600 shrink-0" /> WhatsApp Contacts
                    </h1>
                    <p className="text-muted-foreground text-sm">Manage your unified contact profiles.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" /> Add Contact
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Contact</DialogTitle>
                            <DialogDescription>
                                Add a new contact to your workspace. Phone number will be normalized.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1234567890" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name (Optional)</Label>
                                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Doe" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddContact} disabled={submitting}>
                                {submitting ? "Adding..." : "Add Contact"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <div className="flex gap-2 sm:gap-4 items-center">
                <div className="relative flex-1 min-w-0 sm:max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or phone..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" onClick={() => fetchContacts()} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>24hr Window</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contacts.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No contacts found.
                                </TableCell>
                            </TableRow>
                        )}
                        <TooltipProvider>
                            {contacts.map(c => (
                                <TableRow key={c.id} className="relative">
                                    <TableCell className="font-medium">
                                        {/* Unread message indicator overlay */}
                                        {c.unread_count > 0 && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l" />
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="truncate max-w-[200px]" title={c.name || "Unknown"}>{c.name || "Unknown"}</span>
                                            {c.unread_count > 0 && (
                                                <Badge className="bg-green-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] flex items-center justify-center rounded-full">
                                                    {c.unread_count}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{c.phone_display || c.phone_normalized || c.phone}</TableCell>
                                    <TableCell>
                                        <Badge variant={c.opt_in_status === 'opted_in' ? 'default' : 'secondary'}
                                            className={c.opt_in_status === 'opted_in' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}>
                                            {c.opt_in_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {c.has_conversation ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge
                                                        variant={c.window_open ? 'default' : 'secondary'}
                                                        className={c.window_open
                                                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-help'
                                                            : 'bg-gray-100 text-gray-600 cursor-help'
                                                        }
                                                    >
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {c.window_open ? 'Open' : 'Closed'}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {c.window_open
                                                        ? `Expires: ${new Date(c.session_expires_at || Date.now()).toLocaleString()}`
                                                        : 'Use template to re-open conversation'
                                                    }
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">No chat</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {c.has_conversation && (
                                                <>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                                onClick={() => navigate(`${basePath}/inbox`)}
                                                            >
                                                                <Inbox className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Open in Inbox</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                                                onClick={() => navigate(`${basePath}/analytics?conversation=${c.conversation_id || c.id}`)}
                                                            >
                                                                <BarChart3 className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>View Analytics</TooltipContent>
                                                    </Tooltip>
                                                </>
                                            )}
                                            {!c.has_conversation && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-green-600 hover:text-green-800 hover:bg-green-50"
                                                            onClick={() => navigate(`${basePath}/inbox?startNew=${encodeURIComponent(c.phone_normalized || c.phone)}&name=${encodeURIComponent(c.name || '')}`)}
                                                        >
                                                            <MessageSquare className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Start Conversation</TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TooltipProvider>
                    </TableBody>
                </Table>
                </div>
            </Card>

            {/* Simple Pagination */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>Page {page} of {totalPages}</div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                </div>
            </div>
        </div>
    );
}
