/**
 * Link Tracking Analytics Page
 * ============================
 * 
 * Displays all tracking records (bulk + inbox) with filtering and stats.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINT } from '@/config';

interface TrackingRecord {
    source: 'inbox' | 'bulk';
    id: number;
    tracking_id: string;
    phone_number: string;
    name?: string;
    template_name?: string;
    campaign_name?: string;
    target_url: string;
    click_count: number;
    first_clicked_at?: string;
    last_clicked_at?: string;
    created_at: string;
    source_type?: string;
    wamid?: string;
}

interface TrackingSummary {
    inbox_records: number;
    bulk_records: number;
    total: number;
}

interface TrackingResponse {
    success: boolean;
    summary: TrackingSummary;
    records: TrackingRecord[];
    filter: {
        source: string;
        phone: string | null;
        limit: number;
        offset: number;
    };
}

interface DebugStats {
    inbox: { total: number; clicked: number; ctr: number };
    bulk: { total: number; clicked: number; ctr: number };
}

interface DebugResponse {
    success: boolean;
    workspace_id: string;
    config: { app_base_url: string; tracking_enabled: boolean };
    stats: DebugStats;
    recent_inbox: Array<{
        tracking_id: string;
        phone: string;
        template: string;
        clicks: number;
        created: string;
    }>;
}

const TrackingAnalytics: React.FC = () => {
    const [records, setRecords] = useState<TrackingRecord[]>([]);
    const [summary, setSummary] = useState<TrackingSummary | null>(null);
    const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [sourceFilter, setSourceFilter] = useState<'all' | 'inbox' | 'bulk'>('all');
    const [phoneFilter, setPhoneFilter] = useState('');
    const [searchPhone, setSearchPhone] = useState('');

    // Get workspace ID from storage
    const getWorkspaceId = () => {
        return localStorage.getItem('sv_whatsapp_workspace_id') ||
            sessionStorage.getItem('sv_whatsapp_workspace_id') ||
            '4'; // Default fallback
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const workspaceId = getWorkspaceId();
            const params = new URLSearchParams({
                source: sourceFilter,
                limit: '100',
            });
            if (searchPhone) {
                params.append('phone', searchPhone);
            }

            // Fetch tracking records
            const response = await fetch(
                `${API_ENDPOINT}/v1/tracking/all?${params.toString()}`,
                {
                    headers: {
                        'X-Workspace-ID': workspaceId,
                    },
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data: TrackingResponse = await response.json();

            if (data.success) {
                setRecords(data.records);
                setSummary(data.summary);
            } else {
                throw new Error('Failed to fetch tracking data');
            }

            // Fetch debug stats
            const debugResponse = await fetch(
                `${API_ENDPOINT}/v1/tracking/debug`,
                {
                    headers: {
                        'X-Workspace-ID': workspaceId,
                    },
                    credentials: 'include',
                }
            );

            if (debugResponse.ok) {
                const debugData: DebugResponse = await debugResponse.json();
                if (debugData.success) {
                    setDebugStats(debugData.stats);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [sourceFilter, searchPhone]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = () => {
        setSearchPhone(phoneFilter);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                    📊 Link Tracking Analytics
                </h1>
                <p style={{ color: '#666' }}>
                    Track all links sent via WhatsApp messages (bulk campaigns + inbox)
                </p>
            </div>

            {/* Stats Cards */}
            {summary && debugStats && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '20px',
                        borderRadius: '12px'
                    }}>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.total}</div>
                        <div style={{ opacity: 0.9 }}>Total Tracked Links</div>
                    </div>

                    <div style={{
                        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                        color: 'white',
                        padding: '20px',
                        borderRadius: '12px'
                    }}>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.inbox_records}</div>
                        <div style={{ opacity: 0.9 }}>Inbox Messages</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                            CTR: {debugStats.inbox.ctr}%
                        </div>
                    </div>

                    <div style={{
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        color: 'white',
                        padding: '20px',
                        borderRadius: '12px'
                    }}>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.bulk_records}</div>
                        <div style={{ opacity: 0.9 }}>Bulk Campaign</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                            CTR: {debugStats.bulk.ctr}%
                        </div>
                    </div>

                    <div style={{
                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        color: 'white',
                        padding: '20px',
                        borderRadius: '12px'
                    }}>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                            {debugStats.inbox.clicked + debugStats.bulk.clicked}
                        </div>
                        <div style={{ opacity: 0.9 }}>Total Clicks</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as 'all' | 'inbox' | 'bulk')}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        minWidth: '150px',
                    }}
                >
                    <option value="all">All Sources</option>
                    <option value="inbox">Inbox Only</option>
                    <option value="bulk">Bulk Only</option>
                </select>

                <input
                    type="text"
                    placeholder="Filter by phone number..."
                    value={phoneFilter}
                    onChange={(e) => setPhoneFilter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        minWidth: '200px',
                    }}
                />

                <button
                    onClick={handleSearch}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                    }}
                >
                    Search
                </button>

                <button
                    onClick={fetchData}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                    }}
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                }}>
                    ❌ {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
                    Loading tracking data...
                </div>
            )}

            {/* Data Table */}
            {!loading && records.length > 0 && (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Source</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Recipient</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Template/Campaign</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Target URL</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Clicks</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Last Click</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record) => (
                                <tr key={`${record.source}-${record.id}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            background: record.source === 'inbox' ? '#dbeafe' : '#fce7f3',
                                            color: record.source === 'inbox' ? '#1e40af' : '#9d174d',
                                        }}>
                                            {record.source}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: '500' }}>{record.name || '-'}</div>
                                        <div style={{ fontSize: '13px', color: '#666' }}>{record.phone_number}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', maxWidth: '200px' }}>
                                        <div style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {record.template_name || record.campaign_name || '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', maxWidth: '250px' }}>
                                        <a
                                            href={record.target_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: '#4f46e5',
                                                textDecoration: 'none',
                                                display: 'block',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {record.target_url}
                                        </a>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            minWidth: '40px',
                                            padding: '4px 12px',
                                            borderRadius: '16px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            background: record.click_count > 0 ? '#dcfce7' : '#f3f4f6',
                                            color: record.click_count > 0 ? '#166534' : '#6b7280',
                                        }}>
                                            {record.click_count}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                                        {formatDate(record.last_clicked_at)}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                                        {formatDate(record.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Empty State */}
            {!loading && records.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '48px',
                    background: '#f9fafb',
                    borderRadius: '12px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                    <h3 style={{ marginBottom: '8px' }}>No tracking records yet</h3>
                    <p style={{ color: '#666' }}>
                        Send a template message with a URL to start tracking
                    </p>
                </div>
            )}
        </div>
    );
};

export default TrackingAnalytics;
