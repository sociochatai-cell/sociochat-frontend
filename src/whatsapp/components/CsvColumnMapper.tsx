import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertTriangle, ArrowRight, FileSpreadsheet, Sparkles } from 'lucide-react';

interface Props {
  csvHeaders: string[];
  requiredFields: string[]; // ['phone', 'name', ...variableFieldNames]
  initialMapping?: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  sampleData?: Record<string, string>[]; // First few rows for preview
}

export function CsvColumnMapper({
  csvHeaders,
  requiredFields,
  initialMapping = {},
  onMappingChange,
  sampleData = []
}: Props) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

  // Auto-detect mappings based on column names
  useEffect(() => {
    if (csvHeaders.length === 0) return;

    const autoMap: Record<string, string> = {};
    
    requiredFields.forEach(field => {
      const lowerField = field.toLowerCase();
      
      // Find exact match first
      const exactMatch = csvHeaders.find(h => h.toLowerCase() === lowerField);
      if (exactMatch) {
        autoMap[field] = exactMatch;
        return;
      }

      // Common aliases for phone
      if (lowerField === 'phone') {
        const phoneMatch = csvHeaders.find(h => {
          const lower = h.toLowerCase();
          return lower === 'phone' || lower === 'phone_number' || lower === 'phonenumber' ||
                 lower === 'mobile' || lower === 'cell' || lower === 'whatsapp' ||
                 lower === 'contact_phone' || lower === 'tel' || lower === 'telephone';
        });
        if (phoneMatch) {
          autoMap[field] = phoneMatch;
          return;
        }
      }

      // Common aliases for name
      if (lowerField === 'name') {
        const nameMatch = csvHeaders.find(h => {
          const lower = h.toLowerCase();
          return lower === 'name' || lower === 'full_name' || lower === 'fullname' ||
                 lower === 'first_name' || lower === 'firstname' || lower === 'contact_name' ||
                 lower === 'customer_name' || lower === 'customer';
        });
        if (nameMatch) {
          autoMap[field] = nameMatch;
          return;
        }
      }

      // Fuzzy match - check if header contains the field name
      const containsMatch = csvHeaders.find(h => 
        h.toLowerCase().includes(lowerField) || lowerField.includes(h.toLowerCase())
      );
      if (containsMatch) {
        autoMap[field] = containsMatch;
      }
    });

    // Merge with any initial mapping, preferring initial values
    const merged = { ...autoMap, ...initialMapping };
    setMapping(merged);
    onMappingChange(merged);
  }, [csvHeaders]);

  function handleFieldMap(field: string, csvHeader: string) {
    const newMapping = { ...mapping };
    if (csvHeader === '__none__') {
      delete newMapping[field];
    } else {
      newMapping[field] = csvHeader;
    }
    setMapping(newMapping);
    onMappingChange(newMapping);
  }

  const mappingStats = useMemo(() => {
    const required = requiredFields.filter(f => f === 'phone');
    const optional = requiredFields.filter(f => f !== 'phone');
    
    const requiredMapped = required.filter(f => mapping[f]).length;
    const optionalMapped = optional.filter(f => mapping[f]).length;
    
    return {
      requiredMapped,
      requiredTotal: required.length,
      optionalMapped,
      optionalTotal: optional.length,
      allRequiredMet: requiredMapped === required.length
    };
  }, [mapping, requiredFields]);

  // Get columns that are already mapped (to avoid duplicate mapping)
  const usedColumns = new Set(Object.values(mapping));

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
            Column Mapping
          </CardTitle>
          <div className="flex items-center gap-2">
            {mappingStats.allRequiredMet ? (
              <Badge className="bg-emerald-100 text-emerald-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Ready to import
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Phone column required
              </Badge>
            )}
            <Badge variant="secondary">
              {mappingStats.optionalMapped}/{mappingStats.optionalTotal} optional
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-3">
          {requiredFields.map((field, index) => {
            const isRequired = field === 'phone';
            const isMapped = !!mapping[field];
            const sampleValue = sampleData[0]?.[mapping[field]] || '';

            return (
              <div
                key={field}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isRequired && !isMapped
                    ? 'border-red-200 bg-red-50'
                    : isMapped
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Field Name */}
                <div className="w-40">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{field}</span>
                    {isRequired && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        Required
                      </Badge>
                    )}
                  </div>
                  {index === 0 && (
                    <span className="text-[10px] text-gray-500">Template variable</span>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className={`w-4 h-4 ${isMapped ? 'text-emerald-500' : 'text-gray-300'}`} />

                {/* CSV Column Selector */}
                <div className="flex-1">
                  <Select
                    value={mapping[field] || '__none__'}
                    onValueChange={(v) => handleFieldMap(field, v)}
                  >
                    <SelectTrigger className={`h-9 ${isMapped ? 'border-emerald-300' : ''}`}>
                      <SelectValue placeholder="Select CSV column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-gray-500">-- Not mapped --</span>
                      </SelectItem>
                      {csvHeaders.map(header => {
                        const isUsed = usedColumns.has(header) && mapping[field] !== header;
                        return (
                          <SelectItem
                            key={header}
                            value={header}
                            disabled={isUsed}
                          >
                            <div className="flex items-center gap-2">
                              {header}
                              {isUsed && <span className="text-xs text-gray-400">(used)</span>}
                              {mapping[field] === header && (
                                <Sparkles className="w-3 h-3 text-amber-500" />
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sample Value Preview */}
                {isMapped && sampleValue && (
                  <div className="w-32 truncate text-xs text-gray-600 bg-white px-2 py-1 rounded border">
                    {sampleValue}
                  </div>
                )}

                {/* Status Icon */}
                <div className="w-6">
                  {isMapped && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unmapped CSV Columns Notice */}
        {csvHeaders.length > Object.keys(mapping).length && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <strong>{csvHeaders.length - usedColumns.size}</strong> CSV columns not mapped:
              <div className="flex flex-wrap gap-1 mt-1">
                {csvHeaders
                  .filter(h => !usedColumns.has(h))
                  .map(h => (
                    <Badge key={h} variant="outline" className="text-xs">
                      {h}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
