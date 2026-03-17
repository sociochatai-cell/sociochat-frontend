import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Eye, AlertCircle, CheckCircle, ChevronDown, ChevronUp, RefreshCw, Users } from 'lucide-react';
import { API_BASE_URL } from '@/config';

interface VariableMapping {
  key: string;
  source: string;
  field?: string;
  value?: string;
  missing: boolean;
}

interface StepPreview {
  template_name: string;
  language: string;
  resolved: string[];
  mapping: VariableMapping[];
  missing_keys: string[];
}

interface ContactPreview {
  source: string;
  contact_id?: number;
  dataset_row_id?: number;
  phone: string;
  steps: StepPreview[];
}

interface Campaign {
  id: number;
  name: string;
  steps: Array<{
    step_order: number;
    template_name: string;
  }>;
}

interface Props {
  campaign: Campaign;
  accountId: number;
  datasetId?: number;
  contactIds?: number[];
  limit?: number;
}

export function VariablePreviewPanel({ campaign, accountId, datasetId, contactIds, limit = 10 }: Props) {
  const [previews, setPreviews] = useState<ContactPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedContacts, setExpandedContacts] = useState<Set<number>>(new Set());
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadPreview();
  }, [campaign.id, datasetId, contactIds?.join(',')]);

  async function loadPreview() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: limit.toString() });
      if (datasetId) {
        params.set('dataset_id', datasetId.toString());
      }
      if (contactIds && contactIds.length > 0) {
        params.set('contact_ids', contactIds.join(','));
      }

      const res = await fetch(
        `${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/preview?${params}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load preview');
      }

      const data = await res.json();
      setPreviews(data.previews || []);
      setTotalCount(data.total || data.previews?.length || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(index: number) {
    const newExpanded = new Set(expandedContacts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedContacts(newExpanded);
  }

  function getMissingCount(preview: ContactPreview): number {
    return preview.steps.reduce((sum, step) => sum + step.missing_keys.length, 0);
  }

  function getCompleteness(preview: ContactPreview): number {
    const totalVars = preview.steps.reduce((sum, step) => sum + step.mapping.length, 0);
    const missingVars = getMissingCount(preview);
    if (totalVars === 0) return 100;
    return Math.round(((totalVars - missingVars) / totalVars) * 100);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-gray-600">Loading variable preview...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center justify-center py-8">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
          <Button variant="ghost" size="sm" onClick={loadPreview} className="ml-4">
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (previews.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Users className="w-10 h-10 mb-2 opacity-50" />
          <p>No contacts to preview</p>
          <p className="text-xs">Add contacts to the campaign first</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="w-5 h-5 text-blue-600" />
            Variable Preview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {totalCount} contacts • {campaign.steps.length} steps
            </Badge>
            <Button variant="ghost" size="sm" onClick={loadPreview}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Preview how variables will be resolved for each contact across all campaign steps
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12"></TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Completeness</TableHead>
              <TableHead className="text-center">Steps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previews.map((preview, index) => {
              const isExpanded = expandedContacts.has(index);
              const missingCount = getMissingCount(preview);
              const completeness = getCompleteness(preview);

              return (
                <>
                  <TableRow
                    key={`row-${index}`}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpand(index)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{preview.phone || 'No phone'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {preview.source === 'dataset' ? `Dataset Row #${preview.dataset_row_id}` : `Contact #${preview.contact_id}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              completeness === 100 ? 'bg-emerald-500' :
                              completeness >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${completeness}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{completeness}%</span>
                        {missingCount > 0 && (
                          <span className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {missingCount} missing
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        {preview.steps.map((step, sIdx) => (
                          <div
                            key={sIdx}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                              step.missing_keys.length === 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                            title={`Step ${sIdx + 1}: ${step.template_name} ${step.missing_keys.length > 0 ? `(${step.missing_keys.length} missing)` : ''}`}
                          >
                            {sIdx + 1}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`expanded-${index}`} className="bg-gray-50">
                      <TableCell colSpan={5} className="p-4">
                        <div className="space-y-3">
                          {preview.steps.map((step, sIdx) => (
                            <div key={sIdx} className="border-l-4 border-emerald-300 pl-4 py-2">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                  Step {sIdx + 1}
                                </Badge>
                                <span className="font-medium text-sm">{step.template_name}</span>
                                <span className="text-xs text-gray-500">({step.language})</span>
                                {step.missing_keys.length === 0 ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <span className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Missing: {step.missing_keys.join(', ')}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {step.mapping.map((m, mIdx) => (
                                  <div
                                    key={mIdx}
                                    className={`p-2 rounded text-xs ${
                                      m.missing
                                        ? 'bg-red-50 border border-red-200'
                                        : 'bg-white border border-gray-200'
                                    }`}
                                  >
                                    <div className="font-medium text-gray-700">
                                      {m.field || `{{${m.key}}}`}
                                    </div>
                                    <div className={`truncate ${m.missing ? 'text-red-500 italic' : 'text-gray-900'}`}>
                                      {m.value || '(missing)'}
                                    </div>
                                    <div className="text-gray-400 text-[10px]">
                                      source: {m.source}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {step.resolved.length > 0 && (
                                <div className="mt-2 text-xs text-gray-500">
                                  <span className="font-medium">Resolved values:</span>{' '}
                                  {step.resolved.join(' | ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
