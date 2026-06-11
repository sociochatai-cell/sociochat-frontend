/**
 * Knowledge Base Management Component
 * ====================================
 * 
 * UI for managing AI knowledge base:
 * - Auto-index workspace DNA
 * - Upload files (PDF, DOCX, TXT)
 * - Add URLs for scraping
 * - View knowledge stats
 * - Test RAG responses
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import logo from "@/assets/sociovia_logo.png";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Brain,
    Upload,
    Link,
    FileText,
    Trash2,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Database,
    Sparkles,
    MessageCircle,
    ChevronDown,
    Globe,
    Zap,
    BarChart3,
    BookOpen,
    Send,
    Eye,
    Info,
    HelpCircle,
} from 'lucide-react';
import { API_BASE_URL } from '@/config';

const API_BASE = API_BASE_URL;

interface KnowledgeDocument {
    id: number;
    doc_id?: string;  // Qdrant doc_id for deletion
    source_type: string;
    title: string;
    name?: string;  // Alias for title
    filename?: string;
    url?: string;  // Source URL for web sources
    source?: string;  // Alternative source identifier
    status: string;
    chunk_count: number;
    content_length: number;
    created_at?: string;
    indexed_at?: string;
    error_message?: string;
}

interface KnowledgeStats {
    total_documents: number;
    indexed_documents: number;
    failed_documents: number;
    total_chunks: number;
    by_source: Record<string, number>;
    usage?: {
        today?: {
            query_count: number;
            estimated_cost_inr: number;
            rag_hit_count: number;
            rag_miss_count: number;
        };
        week_total?: {
            queries: number;
            cost_inr: number;
            rag_hits: number;
            rag_misses: number;
        };
    };
}

interface RAGTestResult {
    message: string;
    intent: string;
    used_rag: boolean;
    success: boolean;
    error?: string;

    // Timing breakdown
    timing?: {
        intent_ms: number;
        embed_ms: number;
        search_ms: number;
        generate_ms: number;
        total_ms: number;
    };

    // Token breakdown
    tokens?: {
        embedding: number;
        context: number;
        generation: number;
        total: number;
    };

    // RAG details
    rag?: {
        chunks_searched: number;
        chunks_used: number;
        chunk_ids?: number[];
        top_similarity: number;
        confidence_met: boolean;
        source_types: string[];
    };

    // Cost
    cost_inr?: number;

    // Fallback
    fallback_used?: boolean;
    fallback_type?: string;

    // Legacy fields for backwards compat
    context_chunks?: number;
    top_similarity?: number;
    confidence_met?: boolean;
    response_time_ms?: number;
}

interface KnowledgeBaseSectionProps {
    workspaceId: string | number;
}

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
    workspace_profile: <Database className="w-4 h-4" />,
    uploaded_file: <FileText className="w-4 h-4" />,
    website: <Globe className="w-4 h-4" />,
    url: <Link className="w-4 h-4" />,
    manual_text: <BookOpen className="w-4 h-4" />,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
    workspace_profile: 'Business Profile',
    uploaded_file: 'Uploaded File',
    website: 'Website',
    url: 'Web Page',
    manual_text: 'Manual Entry',
};

// Priority hints for each source type - how much weight AI gives to each
const SOURCE_PRIORITY_HINTS: Record<string, { priority: string; description: string }> = {
    workspace_profile: {
        priority: 'Highest (40%)',
        description: 'Your business name, description & USPs are weighted highest for brand-related questions'
    },
    uploaded_file: {
        priority: 'High (30%)',
        description: 'PDFs, docs contain detailed product/service info - great for specific questions'
    },
    url: {
        priority: 'Medium (20%)',
        description: 'Website content provides context about offerings and policies'
    },
    manual_text: {
        priority: 'Flexible (10%)',
        description: 'Quick custom entries for FAQs or specific topics'
    },
};

// Pending upload item interface
interface PendingUpload {
    id: string;
    title: string;
    source_type: string;
    progress: number;
    startTime: number;
    jobId?: string;  // For crawl jobs
    status?: string; // running, completed, failed
}

export default function KnowledgeBaseSection({ workspaceId }: KnowledgeBaseSectionProps) {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [stats, setStats] = useState<KnowledgeStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(true);

    // Upload states
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [uploadType, setUploadType] = useState<'file' | 'website' | 'text'>('file');
    const [textContent, setTextContent] = useState('');
    const [textTitle, setTextTitle] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    // Pending uploads state - shows loading tiles
    const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

    // Animate progress for pending uploads (0-90% in 30 seconds, then slow to 95%)
    useEffect(() => {
        if (pendingUploads.length === 0) return;

        const interval = setInterval(() => {
            setPendingUploads(prev => prev.map(upload => {
                const elapsed = Date.now() - upload.startTime;
                const elapsedSec = elapsed / 1000;

                // 0-90% in first 30 seconds (fast)
                // 90-95% slowly over next 60 seconds
                let newProgress: number;
                if (elapsedSec < 30) {
                    // Fast phase: 0 to 90% in 30 seconds
                    newProgress = Math.min(90, (elapsedSec / 30) * 90);
                } else {
                    // Slow phase: 90 to 95% over next 60 seconds
                    const slowElapsed = elapsedSec - 30;
                    newProgress = Math.min(95, 90 + (slowElapsed / 60) * 5);
                }

                return { ...upload, progress: newProgress };
            }));
        }, 200); // Update every 200ms for smooth animation

        return () => clearInterval(interval);
    }, [pendingUploads.length]);

    // Indexing states
    const [indexing, setIndexing] = useState(false);
    const [indexSuccess, setIndexSuccess] = useState(false);

    // Test RAG states
    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState<RAGTestResult | null>(null);
    const [testing, setTesting] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // URL Preview states
    const [urlPreview, setUrlPreview] = useState<any>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [useJsRendering, setUseJsRendering] = useState(true); // AI Browser on by default

    // Chunks viewer states
    const [showChunksDialog, setShowChunksDialog] = useState(false);
    const [chunks, setChunks] = useState<any[]>([]);
    const [chunksLoading, setChunksLoading] = useState(false);
    const [chunkSearch, setChunkSearch] = useState('');
    const [selectedDocTitle, setSelectedDocTitle] = useState('');

    // Crawl states
    const [crawlUrl, setCrawlUrl] = useState('');
    const [crawlMaxPages, setCrawlMaxPages] = useState(20);
    const [crawlJobId, setCrawlJobId] = useState<string | null>(null);
    const [crawlProgress, setCrawlProgress] = useState<any>(null);
    const [crawling, setCrawling] = useState(false);

    // Poll crawl progress
    useEffect(() => {
        if (!crawlJobId || !crawling) return;

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/api/whatsapp/knowledge/crawl/${crawlJobId}`,
                    { credentials: 'include' }
                );
                if (res.ok) {
                    const data = await res.json();
                    setCrawlProgress(data);

                    // Update progress on the pending upload tile
                    const progressPercent = data.progress_percent || 0;
                    setPendingUploads(prev => prev.map(u =>
                        u.jobId === crawlJobId
                            ? { ...u, progress: progressPercent, status: data.status }
                            : u
                    ));

                    if (data.status === 'completed' || data.status === 'failed') {
                        setCrawling(false);
                        clearInterval(pollInterval);
                        // Remove the pending upload tile
                        setPendingUploads(prev => prev.filter(u => u.jobId !== crawlJobId));
                        await loadData(); // Refresh documents list
                    }
                }
            } catch (err) {
                console.error('Failed to poll crawl progress:', err);
            }
        }, 1500); // Poll every 1.5s

        return () => clearInterval(pollInterval);
    }, [crawlJobId, crawling]);

    // Start crawl job
    const handleStartCrawl = async () => {
        if (!crawlUrl.trim() || !workspaceId) return;

        // Create pending upload ID and close dialog immediately
        const pendingId = `pending-crawl-${Date.now()}`;
        const pendingUpload: PendingUpload = {
            id: pendingId,
            title: `🌐 ${crawlUrl.trim().replace(/^https?:\/\//, '').slice(0, 40)}...`,
            source_type: 'website',
            progress: 0,
            startTime: Date.now(),
        };

        // Close dialog and add loading tile immediately
        setShowUploadDialog(false);
        setPendingUploads(prev => [...prev, pendingUpload]);
        setCrawling(true);
        setCrawlProgress(null);
        setUploadError('');

        const urlToCrawl = crawlUrl.trim(); // Store before clearing
        const maxPages = crawlMaxPages;
        setCrawlUrl('');

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/knowledge/crawl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    url: urlToCrawl,
                    max_pages: maxPages,
                    use_playwright: false,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Handle SYNC crawl (no job_id, immediate completion)
                if (data.indexed_chunks > 0 || data.chunks_processed > 0) {
                    console.log(`✅ Crawl completed: ${data.indexed_chunks || data.chunks_processed} chunks indexed`);
                    // Remove pending tile immediately
                    setPendingUploads(prev => prev.filter(u => u.id !== pendingId));
                    setCrawling(false);
                    // Refresh data to show new chunks
                    await loadData();
                } else if (data.job_id) {
                    // Handle ASYNC crawl (has job_id for polling)
                    setCrawlJobId(data.job_id);
                    setPendingUploads(prev => prev.map(u =>
                        u.id === pendingId ? { ...u, jobId: data.job_id } : u
                    ));
                } else {
                    // Success but no chunks - still remove pending
                    setPendingUploads(prev => prev.filter(u => u.id !== pendingId));
                    setCrawling(false);
                    await loadData();
                }
            } else {
                // Remove pending on error
                setPendingUploads(prev => prev.filter(u => u.id !== pendingId));
                console.error(data.error || 'Failed to start crawl');
                setCrawling(false);
            }
        } catch (err) {
            // Remove pending on error
            setPendingUploads(prev => prev.filter(u => u.id !== pendingId));
            console.error('Failed to start crawl');
            setCrawling(false);
        }
    };

    // Load data
    const loadData = useCallback(async () => {
        if (!workspaceId) return;

        try {
            setLoading(true);

            // Fetch documents
            const docsRes = await fetch(
                `${API_BASE}/api/whatsapp/knowledge?workspace_id=${workspaceId}`,
                { credentials: 'include' }
            );
            if (docsRes.ok) {
                const data = await docsRes.json();
                setDocuments(data.documents || []);
            }

            // Fetch stats
            const statsRes = await fetch(
                `${API_BASE}/api/whatsapp/knowledge/stats?workspace_id=${workspaceId}`,
                { credentials: 'include' }
            );
            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to load knowledge base:', err);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-index workspace
    const handleAutoIndex = async () => {
        if (!workspaceId) return;

        setIndexing(true);
        setIndexSuccess(false);

        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/knowledge/index-workspace`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ workspace_id: workspaceId, force: true }),
                }
            );

            if (res.ok) {
                setIndexSuccess(true);
                await loadData();
                setTimeout(() => setIndexSuccess(false), 3000);
            }
        } catch (err) {
            console.error('Failed to index workspace:', err);
        } finally {
            setIndexing(false);
        }
    };

    // Upload file(s) - supports multiple file selection
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !workspaceId) return;

        // Close dialog immediately
        setShowUploadDialog(false);
        setUploadError('');

        // Create pending uploads for all selected files
        const pendingIds: string[] = [];
        const newPendingUploads: PendingUpload[] = [];

        Array.from(files).forEach((file, index) => {
            const pendingId = `pending-${Date.now()}-${index}`;
            pendingIds.push(pendingId);
            newPendingUploads.push({
                id: pendingId,
                title: file.name,
                source_type: 'uploaded_file',
                progress: 0,
                startTime: Date.now(),
            });
        });

        // Add all loading tiles immediately
        setPendingUploads(prev => [...prev, ...newPendingUploads]);

        // Upload files sequentially to avoid overwhelming the server
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const pendingId = pendingIds[i];

            try {
                // Update progress for current file
                setPendingUploads(prev => prev.map(u =>
                    u.id === pendingId ? { ...u, progress: 50 } : u
                ));

                const formData = new FormData();
                formData.append('file', file);
                formData.append('workspace_id', String(workspaceId));

                const res = await fetch(`${API_BASE}/api/whatsapp/knowledge`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });

                const data = await res.json();

                // Remove this pending upload
                setPendingUploads(prev => prev.filter(u => u.id !== pendingId));

                if (!res.ok || !data.success) {
                    console.error(`Upload failed for ${file.name}:`, data.message || 'Upload failed');
                }
            } catch (err) {
                // Remove pending upload on error
                setPendingUploads(prev => prev.filter(u => u.id !== pendingId));
                console.error(`Upload failed for ${file.name}. Please try again.`);
            }
        }

        // Refresh data after all uploads complete
        await loadData();

        // Reset the file input so the same files can be selected again
        e.target.value = '';
    };

    // Add URL
    const handleUrlAdd = async () => {
        if (!urlInput.trim() || !workspaceId) return;

        // Create pending upload ID and close dialog immediately
        const pendingId = `pending-${Date.now()}`;
        const pendingUpload: PendingUpload = {
            id: pendingId,
            title: urlInput.trim().replace(/^https?:\/\//, '').slice(0, 40),
            source_type: 'url',
            progress: 0,
            startTime: Date.now(),
        };

        // Close dialog and add loading tile immediately
        setShowUploadDialog(false);
        setPendingUploads(prev => [...prev, pendingUpload]);
        const urlToAdd = urlInput.trim(); // Store before clearing
        const usePlaywright = useJsRendering;
        setUrlInput('');
        setUrlPreview(null);
        setUploadError('');

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    url: urlToAdd,
                    use_playwright: usePlaywright,
                }),
            });

            const data = await res.json();

            // Remove pending upload
            setPendingUploads(prev => prev.filter(u => u.id !== pendingId));

            if (res.ok && data.success) {
                await loadData();
            } else {
                console.error('Failed to add URL:', data.message || data.error);
            }
        } catch (err) {
            // Remove pending upload on error
            setPendingUploads(prev => prev.filter(u => u.id !== pendingId));
            console.error('Failed to add URL. Please try again.');
        }
    };

    // Preview URL content before adding
    const handlePreviewUrl = async () => {
        if (!urlInput.trim()) return;

        setPreviewLoading(true);
        setUrlPreview(null);
        setUploadError('');

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/knowledge/preview-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    url: urlInput.trim(),
                    use_playwright: useJsRendering  // Pass JS rendering flag for preview
                }),
            });

            const data = await res.json();
            setUrlPreview(data);

            if (!data.success) {
                setUploadError(data.error || 'Failed to preview URL');
            }
        } catch (err) {
            setUploadError('Failed to preview URL. Please try again.');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Add text content directly
    const handleTextAdd = async () => {
        if (!textContent.trim() || !workspaceId) return;

        // Create pending upload ID and close dialog immediately
        const pendingId = `pending-${Date.now()}`;
        const titleToUse = textTitle.trim() || 'Manual Entry';
        const contentToAdd = textContent.trim();
        const pendingUpload: PendingUpload = {
            id: pendingId,
            title: titleToUse.slice(0, 40),
            source_type: 'manual_text',
            progress: 0,
            startTime: Date.now(),
        };

        // Close dialog and add loading tile immediately
        setShowUploadDialog(false);
        setPendingUploads(prev => [...prev, pendingUpload]);
        setTextContent('');
        setTextTitle('');
        setUploadError('');

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    content: contentToAdd,
                    title: titleToUse,
                }),
            });

            const data = await res.json();

            // Remove pending upload
            setPendingUploads(prev => prev.filter(u => u.id !== pendingId));

            if (res.ok && data.success) {
                await loadData();
            } else {
                console.error('Failed to add content:', data.message || data.error);
            }
        } catch (err) {
            // Remove pending upload on error
            setPendingUploads(prev => prev.filter(u => u.id !== pendingId));
            console.error('Failed to add content. Please try again.');
        }
    };

    // Delete document by doc_id (from Qdrant)
    const handleDelete = async (docId: string | number) => {
        if (!confirm('Delete this document and all its chunks from knowledge base?')) return;

        try {
            // Use the new /doc/:doc_id endpoint for Qdrant doc_id
            const endpoint = typeof docId === 'string' && docId.includes('-')
                ? `${API_BASE}/api/whatsapp/knowledge/doc/${docId}?workspace_id=${workspaceId}`
                : `${API_BASE}/api/whatsapp/knowledge/${docId}?workspace_id=${workspaceId}`;

            const res = await fetch(endpoint, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                await loadData();
            } else {
                console.error('Delete failed:', await res.text());
            }
        } catch (err) {
            console.error('Failed to delete document:', err);
        }
    };

    // Delete individual chunk
    const handleDeleteChunk = async (chunkId: number) => {
        if (!confirm('Delete this chunk? This cannot be undone.')) return;

        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/knowledge/chunk/${chunkId}?workspace_id=${workspaceId}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );

            if (res.ok) {
                // Remove from local state
                setChunks(prev => prev.filter(c => c.id !== chunkId));
                // Also refresh the main data to update chunk counts
                await loadData();
            }
        } catch (err) {
            console.error('Failed to delete chunk:', err);
        }
    };

    // Test RAG
    const handleTestRAG = async () => {
        if (!testMessage.trim() || !workspaceId) return;

        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/knowledge/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    message: testMessage,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setTestResult(data);
            }
        } catch (err) {
            console.error('Failed to test RAG:', err);
        } finally {
            setTesting(false);
        }
    };

    // Load chunks for debugging
    const handleViewChunks = async (docTitle?: string) => {
        setChunksLoading(true);
        setShowChunksDialog(true);
        setSelectedDocTitle(docTitle || 'All Documents');
        setChunks([]);

        try {
            const searchParam = chunkSearch ? `&search=${encodeURIComponent(chunkSearch)}` : '';
            const res = await fetch(
                `${API_BASE}/api/whatsapp/knowledge/debug/chunks?workspace_id=${workspaceId}&limit=200${searchParam}`,
                { credentials: 'include' }
            );

            if (res.ok) {
                const data = await res.json();
                setChunks(data.chunks || []);
            }
        } catch (err) {
            console.error('Failed to load chunks:', err);
        } finally {
            setChunksLoading(false);
        }
    };

    // Helper to get timing values
    const getTiming = (result: RAGTestResult) => result.timing?.total_ms || result.response_time_ms || 0;
    const getSimilarity = (result: RAGTestResult) => {
        // Check multiple possible field names and formats
        const raw = result.rag?.top_similarity ?? result.top_similarity ?? (result as any).similarity ?? 0;
        // If similarity is already a percentage (>1), divide by 100
        return raw > 1 ? raw / 100 : raw;
    };
    const getConfidence = (result: RAGTestResult) => result.rag?.confidence_met ?? result.confidence_met ?? false;
    const getChunks = (result: RAGTestResult) => result.rag?.chunks_used ?? result.context_chunks ?? 0;
    const getCost = (result: RAGTestResult) => result.cost_inr ?? 0;

    const hasWorkspaceProfile = documents.some(d => d.source_type === 'workspace_profile');

    if (loading) {
        return <Skeleton className="h-64 w-full rounded-xl" />;
    }

    return (
        <>
            <Card className="border shadow-sm bg-gradient-to-br from-blue-50/50 via-white to-cyan-50/30">
                <CardHeader
                    className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md">
                                <Brain className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    AI Knowledge Base
                                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                                        {stats?.total_chunks || 0} chunks
                                    </Badge>
                                    {stats && stats.indexed_documents > 0 && (
                                        <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Teach your AI about your business with documents and URLs
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setShowUploadDialog(true); }}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <Upload className="w-4 h-4 mr-1" /> Add Knowledge
                            </Button>
                            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </CardHeader>

                {isOpen && (
                    <CardContent className="border-t pt-4 space-y-6">
                        {/* Auto-Index Section */}
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <Sparkles className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-purple-900">Auto-Learn Business DNA</p>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="w-4 h-4 text-purple-400 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs">
                                                        <p className="font-semibold text-green-600">🎯 Priority: Highest (40%)</p>
                                                        <p className="text-xs mt-1">Your business name, description & USPs are weighted highest for brand-related questions</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <p className="text-sm text-purple-700">
                                            {hasWorkspaceProfile
                                                ? 'Your business info is indexed. Click to refresh.'
                                                : 'Index your business name, description & USP automatically.'}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleAutoIndex}
                                    disabled={indexing}
                                    variant={hasWorkspaceProfile ? 'outline' : 'default'}
                                    className={hasWorkspaceProfile ? '' : 'bg-purple-600 hover:bg-purple-700'}
                                >
                                    {indexing ? (
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    ) : hasWorkspaceProfile ? (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    ) : (
                                        <Zap className="w-4 h-4 mr-2" />
                                    )}
                                    {hasWorkspaceProfile ? 'Refresh' : 'Learn Now'}
                                </Button>
                            </div>
                            {indexSuccess && (
                                <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    Business knowledge updated successfully!
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        {stats && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-gray-900">{stats.total_documents}</p>
                                    <p className="text-xs text-muted-foreground">Documents</p>
                                </div>
                                <div
                                    className="p-3 bg-gray-50 rounded-lg text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleViewChunks()}
                                    title="Click to view all chunks"
                                >
                                    <p className="text-2xl font-bold text-gray-900">{stats.total_chunks}</p>
                                    <p className="text-xs text-muted-foreground">Knowledge Chunks 🔍</p>
                                </div>
                            </div>
                        )}

                        {/* Document List */}
                        {(documents.length > 0 || pendingUploads.length > 0) && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Knowledge Sources ({documents.length}{pendingUploads.length > 0 ? ` + ${pendingUploads.length} loading` : ''})
                                </Label>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {/* Pending uploads - show at top with loading animation */}
                                    {pendingUploads.map((pending) => (
                                        <div
                                            key={pending.id}
                                            className="relative p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 overflow-hidden"
                                        >
                                            {/* Progress bar background */}
                                            <div
                                                className="absolute inset-0 bg-gradient-to-r from-blue-100 to-green-100 transition-all duration-300 ease-out"
                                                style={{ width: `${pending.progress}%`, opacity: 0.8 }}
                                            />
                                            <div className="relative flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg border animate-pulse">
                                                    {SOURCE_TYPE_ICONS[pending.source_type] || <FileText className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{pending.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            {SOURCE_TYPE_LABELS[pending.source_type] || pending.source_type}
                                                        </Badge>
                                                        <Badge className="bg-blue-100 text-blue-700 text-xs animate-pulse">
                                                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                                            Processing... {Math.round(pending.progress)}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Existing documents */}
                                    {documents.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg border">
                                                    {SOURCE_TYPE_ICONS[doc.source_type] || <FileText className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{doc.title || doc.name}</p>
                                                    {/* Show source URL or filename */}
                                                    {(doc.url || doc.source || doc.filename) && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-[300px]" title={doc.url || doc.source || doc.filename}>
                                                            {doc.url || doc.source || doc.filename}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            {SOURCE_TYPE_LABELS[doc.source_type] || doc.source_type}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {doc.chunk_count} chunks
                                                        </span>
                                                        {doc.status === 'indexed' ? (
                                                            <Badge className="bg-green-100 text-green-700 text-xs">Ready</Badge>
                                                        ) : doc.status === 'processing' ? (
                                                            <Badge className="bg-yellow-100 text-yellow-700 text-xs">Processing</Badge>
                                                        ) : doc.status === 'failed' ? (
                                                            <Badge className="bg-red-100 text-red-700 text-xs">Failed</Badge>
                                                        ) : (
                                                            <Badge className="bg-gray-100 text-gray-700 text-xs">Pending</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Delete button for all documents including workspace_profile */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(doc.doc_id || doc.id)}
                                                title={doc.source_type === 'workspace_profile' ? 'Delete business profile knowledge' : 'Delete document'}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {documents.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>No knowledge added yet.</p>
                                <p className="text-sm mt-1">Click "Auto-Learn" or "Add Knowledge" to start.</p>
                            </div>
                        )}

                        {/* Test RAG Section */}
                        <div className="border-t pt-4">
                            <Label className="flex items-center gap-2 mb-3">
                                <MessageCircle className="w-4 h-4" />
                                Test AI Knowledge
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ask a question about your business..."
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleTestRAG()}
                                />
                                <Button onClick={handleTestRAG} disabled={testing || !testMessage.trim()}>
                                    {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                            </div>

                            {testResult && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-3">
                                    {/* Summary row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge className={testResult.used_rag ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                                {testResult.used_rag ? 'RAG' : 'Direct'}
                                            </Badge>
                                            <Badge variant="outline">{testResult.intent}</Badge>
                                            {testResult.fallback_used && (
                                                <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                                    {testResult.fallback_type || 'Fallback'}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span>{getTiming(testResult)}ms</span>
                                            {getCost(testResult) > 0 && (
                                                <span className="font-medium">₹{getCost(testResult).toFixed(4)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick metrics for RAG */}
                                    {testResult.used_rag && (
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span>Chunks: {getChunks(testResult)}</span>
                                            <span>Similarity: {(getSimilarity(testResult) * 100).toFixed(1)}%</span>
                                            <span className={getConfidence(testResult) ? 'text-green-600' : 'text-yellow-600'}>
                                                {getConfidence(testResult) ? '✓ Confident' : '⚠ Low'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Response */}
                                    <div className="p-3 bg-white rounded-lg border">
                                        <p className="text-sm">{testResult.message}</p>
                                    </div>

                                    {/* Advanced toggle */}
                                    <button
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        {showAdvanced ? '▲ Hide' : '▼ Show'} technical details
                                    </button>

                                    {/* Advanced metrics panel */}
                                    {showAdvanced && testResult.timing && (
                                        <div className="bg-white rounded-lg border p-3 space-y-3">
                                            {/* Timing breakdown */}
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">⏱ Timing Breakdown</p>
                                                <div className="grid grid-cols-5 gap-2 text-xs">
                                                    <div className="p-2 bg-gray-50 rounded text-center">
                                                        <p className="font-mono">{testResult.timing.intent_ms}ms</p>
                                                        <p className="text-muted-foreground">Intent</p>
                                                    </div>
                                                    <div className="p-2 bg-gray-50 rounded text-center">
                                                        <p className="font-mono">{testResult.timing.embed_ms}ms</p>
                                                        <p className="text-muted-foreground">Embed</p>
                                                    </div>
                                                    <div className="p-2 bg-gray-50 rounded text-center">
                                                        <p className="font-mono">{testResult.timing.search_ms}ms</p>
                                                        <p className="text-muted-foreground">Search</p>
                                                    </div>
                                                    <div className="p-2 bg-gray-50 rounded text-center">
                                                        <p className="font-mono">{testResult.timing.generate_ms}ms</p>
                                                        <p className="text-muted-foreground">Generate</p>
                                                    </div>
                                                    <div className="p-2 bg-blue-50 rounded text-center">
                                                        <p className="font-mono font-bold">{testResult.timing.total_ms}ms</p>
                                                        <p className="text-muted-foreground">Total</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Token breakdown */}
                                            {testResult.tokens && (
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">🔤 Token Breakdown</p>
                                                    <div className="grid grid-cols-4 gap-2 text-xs">
                                                        <div className="p-2 bg-gray-50 rounded text-center">
                                                            <p className="font-mono">{testResult.tokens.embedding}</p>
                                                            <p className="text-muted-foreground">Embed</p>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 rounded text-center">
                                                            <p className="font-mono">{testResult.tokens.context}</p>
                                                            <p className="text-muted-foreground">Context</p>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 rounded text-center">
                                                            <p className="font-mono">{testResult.tokens.generation}</p>
                                                            <p className="text-muted-foreground">Output</p>
                                                        </div>
                                                        <div className="p-2 bg-blue-50 rounded text-center">
                                                            <p className="font-mono font-bold">{testResult.tokens.total}</p>
                                                            <p className="text-muted-foreground">Total</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* RAG details */}
                                            {testResult.rag && testResult.used_rag && (
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">📚 RAG Details</p>
                                                    <div className="text-xs space-y-1">
                                                        <p>
                                                            Chunks: {testResult.rag.chunks_used} used / {testResult.rag.chunks_searched} searched
                                                            {testResult.rag.chunk_ids && testResult.rag.chunk_ids.length > 0 && (
                                                                <span className="ml-2 text-blue-600">
                                                                    (IDs: {testResult.rag.chunk_ids.join(', ')})
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p>Top similarity: {(testResult.rag.top_similarity * 100).toFixed(2)}%</p>
                                                        {testResult.rag.source_types?.length > 0 && (
                                                            <p>Sources: {testResult.rag.source_types.join(', ')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Cost */}
                                            {getCost(testResult) > 0 && (
                                                <div className="pt-2 border-t flex justify-between text-xs">
                                                    <span className="text-muted-foreground">Estimated cost</span>
                                                    <span className="font-medium">₹{getCost(testResult).toFixed(6)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Upload Dialog */}
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Knowledge</DialogTitle>
                        <DialogDescription>
                            Upload a file or add a URL to teach your AI
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-2 mb-4">
                        <Button
                            variant={uploadType === 'file' ? 'default' : 'outline'}
                            onClick={() => setUploadType('file')}
                            size="sm"
                        >
                            <Upload className="w-4 h-4 mr-1" />
                            File
                        </Button>
                        <Button
                            variant={uploadType === 'website' ? 'default' : 'outline'}
                            onClick={() => setUploadType('website')}
                            size="sm"
                            className={uploadType === 'website' ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0" : ""}
                        >
                            <Globe className="w-4 h-4 mr-1" />
                            Website
                        </Button>
                        <Button
                            variant={uploadType === 'text' ? 'default' : 'outline'}
                            onClick={() => setUploadType('text')}
                            size="sm"
                        >
                            <BookOpen className="w-4 h-4 mr-1" />
                            Paste Text
                        </Button>
                    </div>

                    {uploadType === 'file' ? (
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-purple-300 transition-colors">
                                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm text-muted-foreground mb-1">
                                    Drag & drop or click to select files
                                </p>
                                <p className="text-xs text-muted-foreground mb-2">
                                    Supported: PDF, DOCX, TXT, CSV, MD
                                </p>
                                <p className="text-xs text-green-600 font-medium mb-3">
                                    📁 Select multiple files at once
                                </p>
                                <input
                                    type="file"
                                    accept=".pdf,.docx,.doc,.txt,.csv,.md"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="file-upload"
                                    disabled={uploading}
                                    multiple
                                />
                                <Button asChild disabled={uploading}>
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        {uploading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                        Choose Files
                                    </label>
                                </Button>
                            </div>
                        </div>
                    ) : uploadType === 'website' ? (
                        <div className="space-y-4">
                            <div>
                                <Label>Website or Page URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="https://example.com/blog"
                                        value={crawlUrl}
                                        onChange={(e) => setCrawlUrl(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Enter any URL to index correctly.
                                </p>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <Label>Pages to Index</Label>
                                    <span className="text-sm font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                        {crawlMaxPages} {crawlMaxPages === 1 ? 'Page' : 'Pages'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        step="1"
                                        value={crawlMaxPages}
                                        onChange={(e) => setCrawlMaxPages(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                    />
                                    <Input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={crawlMaxPages}
                                        onChange={(e) => setCrawlMaxPages(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                                        className="w-16 text-center"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {crawlMaxPages === 1
                                        ? "Only this specific page will be indexed."
                                        : "We'll follow links to index up to " + crawlMaxPages + " pages from this site."}
                                </p>
                            </div>

                            <div className="flex items-center space-x-2 border p-3 rounded-md bg-gray-50">
                                <Checkbox
                                    id="js-mode"
                                    checked={useJsRendering}
                                    onCheckedChange={(checked) => setUseJsRendering(checked === true)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label
                                        htmlFor="js-mode"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Use AI Browser (Slower but better)
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                        Required for modern sites (React, Next.js). Turn off for speed on static sites.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : uploadType === 'text' ? (
                        /* Text paste section */
                        <div className="space-y-4">
                            <div>
                                <Label>Title (optional)</Label>
                                <Input
                                    placeholder="e.g., About Us Page"
                                    value={textTitle}
                                    onChange={(e) => setTextTitle(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Content</Label>
                                <textarea
                                    placeholder="Paste the page content here...

Example:
About Us
We are Adtomate Solutions...

Our Team
Founded by passionate innovators..."
                                    value={textContent}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    className="w-full mt-1 p-3 border rounded-lg text-sm min-h-[200px] resize-y"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {textContent.length} characters • Copy text from web pages, documents, or type directly
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {uploadError && (
                        <Alert variant="destructive">
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription>{uploadError}</AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                            Cancel
                        </Button>
                        {uploadType === 'website' && !crawling && !crawlProgress && (
                            <Button
                                onClick={handleStartCrawl}
                                disabled={crawling || !crawlUrl.trim()}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                            >
                                {crawling ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                                {crawlMaxPages === 1 ? 'Index Single Page' : 'Start Crawl'}
                            </Button>
                        )}
                        {uploadType === 'text' && (
                            <Button onClick={handleTextAdd} disabled={uploading || !textContent.trim()}>
                                {uploading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <BookOpen className="w-4 h-4 mr-2" />}
                                Add Content
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Chunks Viewer Dialog */}
            <Dialog open={showChunksDialog} onOpenChange={setShowChunksDialog}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Database className="w-5 h-5" />
                            Knowledge Chunks ({chunks.length})
                        </DialogTitle>
                        <DialogDescription>
                            View all stored text chunks from your knowledge base
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search chunks..."
                            value={chunkSearch}
                            onChange={(e) => setChunkSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleViewChunks()}
                            className="flex-1"
                        />
                        <Button onClick={() => handleViewChunks()} disabled={chunksLoading}>
                            {chunksLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🔍 Search'}
                        </Button>
                    </div>

                    {/* Chunks List */}
                    <div className="flex-1 overflow-y-auto space-y-3 mt-4 pr-2">
                        {chunksLoading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                                Loading chunks...
                            </div>
                        ) : chunks.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>No chunks found</p>
                            </div>
                        ) : (
                            chunks.map((chunk, idx) => (
                                <div
                                    key={chunk.id}
                                    className="p-4 bg-gray-50 rounded-lg border hover:border-blue-300 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant="outline" className="text-xs">
                                                    #{chunk.chunk_index}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs bg-blue-50">
                                                    {chunk.source_type}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {chunk.text_length} chars
                                                </span>
                                                {chunk.has_embedding && (
                                                    <Badge className="text-xs bg-green-100 text-green-700">
                                                        ✓ Embedded
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                {chunk.text_preview}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                ID: {chunk.id}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteChunk(chunk.id)}
                                                title="Delete this chunk"
                                                className="h-7 w-7 p-0"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setShowChunksDialog(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
