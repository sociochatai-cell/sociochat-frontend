// Template Message Composer
// =========================

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Info } from 'lucide-react';

type HeaderType = 'none' | 'text' | 'image';

interface BodyVariable {
  key: string;
  value: string;
}

interface TemplateComposerProps {
  templateName: string;
  language: string;
  headerType: HeaderType;
  headerValue: string;
  bodyVariables: BodyVariable[];
  onTemplateNameChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onHeaderTypeChange: (value: HeaderType) => void;
  onHeaderValueChange: (value: string) => void;
  onBodyVariablesChange: (variables: BodyVariable[]) => void;
}

const COMMON_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
];

export default function TemplateComposer({
  templateName,
  language,
  headerType,
  headerValue,
  bodyVariables,
  onTemplateNameChange,
  onLanguageChange,
  onHeaderTypeChange,
  onHeaderValueChange,
  onBodyVariablesChange,
}: TemplateComposerProps) {
  const [customLanguage, setCustomLanguage] = useState('');

  const addVariable = () => {
    const newKey = `{{${bodyVariables.length + 1}}}`;
    onBodyVariablesChange([...bodyVariables, { key: newKey, value: '' }]);
  };

  const removeVariable = (index: number) => {
    const updated = bodyVariables.filter((_, i) => i !== index);
    // Re-index keys
    const reindexed = updated.map((v, i) => ({ ...v, key: `{{${i + 1}}}` }));
    onBodyVariablesChange(reindexed);
  };

  const updateVariableValue = (index: number, value: string) => {
    const updated = [...bodyVariables];
    updated[index] = { ...updated[index], value };
    onBodyVariablesChange(updated);
  };

  const handleLanguageChange = (value: string) => {
    if (value === 'custom') {
      // Don't change yet, let user type custom
      return;
    }
    onLanguageChange(value);
    setCustomLanguage('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">📋 Template Message</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Name */}
        <div className="space-y-2">
          <Label htmlFor="templateName">Template Name *</Label>
          <Input
            id="templateName"
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            placeholder="hello_world"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and underscores only
          </p>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label>Language Code *</Label>
          <div className="flex gap-2">
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label} ({lang.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={customLanguage || language}
              onChange={(e) => {
                setCustomLanguage(e.target.value);
                onLanguageChange(e.target.value);
              }}
              placeholder="Custom"
              className="w-24 font-mono"
            />
          </div>
        </div>

        {/* Header Type */}
        <div className="space-y-2">
          <Label>Header Type</Label>
          <Select value={headerType} onValueChange={(v) => onHeaderTypeChange(v as HeaderType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Header Value (conditional) */}
        {headerType === 'text' && (
          <div className="space-y-2">
            <Label htmlFor="headerText">Header Text</Label>
            <Input
              id="headerText"
              value={headerValue}
              onChange={(e) => onHeaderValueChange(e.target.value)}
              placeholder="Header text content"
            />
          </div>
        )}

        {headerType === 'image' && (
          <div className="space-y-2">
            <Label htmlFor="headerImage">Header Image URL</Label>
            <Input
              id="headerImage"
              value={headerValue}
              onChange={(e) => onHeaderValueChange(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Must be a publicly accessible HTTPS URL
            </p>
          </div>
        )}

        {/* Body Variables */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Body Variables</Label>
            <Button type="button" variant="outline" size="sm" onClick={addVariable}>
              <Plus className="h-4 w-4 mr-1" />
              Add Variable
            </Button>
          </div>

          {bodyVariables.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md text-center">
              No variables. Use "Add Variable" for templates with placeholders like {'{{1}}'}, {'{{2}}'}
            </div>
          ) : (
            <div className="space-y-2">
              {bodyVariables.map((variable, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono shrink-0">
                    {variable.key}
                  </Badge>
                  <Input
                    value={variable.value}
                    onChange={(e) => updateVariableValue(index, e.target.value)}
                    placeholder={`Value for ${variable.key}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariable(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md flex gap-2">
          <Info className="h-4 w-4 shrink-0 text-blue-500" />
          <div>
            <p className="font-medium mb-1">Template Rules</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code className="bg-muted px-1">hello_world</code> is pre-approved for testing</li>
              <li>Templates without variables need NO body parameters</li>
              <li>Custom templates must be approved in Meta Business Suite</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
