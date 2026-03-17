// Export Buttons - Download CSV/PDF
// Clean export options for analytics data

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '@/config';

interface ExportButtonsProps {
    workspaceId: string | null;
    period: string;
    startDate?: string;
    endDate?: string;
}

export function ExportButtons({ 
    workspaceId, 
    period, 
    startDate, 
    endDate 
}: ExportButtonsProps) {
    const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
    const [exportSuccess, setExportSuccess] = useState<'csv' | 'pdf' | null>(null);
    
    const handleExportCSV = async () => {
        if (!workspaceId) return;
        
        setExporting('csv');
        try {
            // Build query params
            let queryParams = `workspace_id=${workspaceId}&format=csv`;
            if (period === 'custom' && startDate && endDate) {
                queryParams += `&start_date=${startDate}&end_date=${endDate}`;
            } else if (period === 'all') {
                queryParams += '&days=365';
            } else {
                queryParams += `&days=${period}`;
            }
            
            const response = await fetch(
                `${API_BASE_URL}/api/whatsapp/analytics/export?${queryParams}`,
                {
                    credentials: 'include',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );
            
            if (!response.ok) {
                throw new Error('Export failed');
            }
            
            // Get the blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `whatsapp_analytics_${period}days.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            setExportSuccess('csv');
            setTimeout(() => setExportSuccess(null), 2000);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(null);
        }
    };
    
    const handleExportPDF = async () => {
        if (!workspaceId) return;
        
        setExporting('pdf');
        try {
            // For PDF, we'll use the browser's print functionality
            // Create a printable version of the analytics
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                throw new Error('Popup blocked');
            }
            
            // Get current analytics content (simplified version)
            const content = document.querySelector('.analytics-content');
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp Analytics Report</title>
                    <style>
                        body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                        h1 { color: #1a1a1a; border-bottom: 2px solid #25D366; padding-bottom: 10px; }
                        .header { margin-bottom: 30px; }
                        .date { color: #666; font-size: 14px; }
                        .section { margin-bottom: 30px; }
                        .section h2 { color: #333; font-size: 18px; margin-bottom: 15px; }
                        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                        .metric { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
                        .metric-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
                        .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
                        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
                        @media print { body { padding: 20px; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>📊 WhatsApp Analytics Report</h1>
                        <p class="date">Generated on ${new Date().toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}</p>
                        <p class="date">Period: ${period === 'all' ? 'All time' : `Last ${period} days`}</p>
                    </div>
                    <div class="section">
                        <p>Please use the browser's Print function (Ctrl+P / Cmd+P) to save as PDF.</p>
                    </div>
                    <div class="footer">
                        <p>Generated by Sociovia WhatsApp Analytics</p>
                    </div>
                </body>
                </html>
            `;
            
            printWindow.document.write(html);
            printWindow.document.close();
            
            // Trigger print dialog after content loads
            printWindow.onload = () => {
                printWindow.print();
            };
            
            setExportSuccess('pdf');
            setTimeout(() => setExportSuccess(null), 2000);
        } catch (error) {
            console.error('PDF export failed:', error);
        } finally {
            setExporting(null);
        }
    };
    
    const isDisabled = !workspaceId;
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isDisabled}
                    className="gap-2"
                >
                    {exporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : exportSuccess ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                    onClick={handleExportCSV}
                    disabled={exporting === 'csv'}
                    className="cursor-pointer"
                >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {exporting === 'csv' ? 'Exporting...' : 'Download CSV'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                    onClick={handleExportPDF}
                    disabled={exporting === 'pdf'}
                    className="cursor-pointer"
                >
                    <FileText className="w-4 h-4 mr-2" />
                    {exporting === 'pdf' ? 'Preparing...' : 'Export as PDF'}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default ExportButtons;
