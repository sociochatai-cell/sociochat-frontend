// Interactive Message Composer
// ============================

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { InteractiveType, InteractiveButton, ListSection, ListRow } from '../types';

interface InteractiveComposerProps {
  interactiveType: InteractiveType;
  headerText: string;
  bodyText: string;
  footerText: string;
  buttons: InteractiveButton[];
  sections: ListSection[];
  onInteractiveTypeChange: (value: InteractiveType) => void;
  onHeaderTextChange: (value: string) => void;
  onBodyTextChange: (value: string) => void;
  onFooterTextChange: (value: string) => void;
  onButtonsChange: (buttons: InteractiveButton[]) => void;
  onSectionsChange: (sections: ListSection[]) => void;
}

export default function InteractiveComposer({
  interactiveType,
  headerText,
  bodyText,
  footerText,
  buttons,
  sections,
  onInteractiveTypeChange,
  onHeaderTextChange,
  onBodyTextChange,
  onFooterTextChange,
  onButtonsChange,
  onSectionsChange,
}: InteractiveComposerProps) {
  
  // Button handlers
  const addButton = () => {
    if (buttons.length >= 3) return;
    const newButton: InteractiveButton = {
      id: `btn_${Date.now()}`,
      title: '',
    };
    onButtonsChange([...buttons, newButton]);
  };

  const updateButton = (index: number, field: 'id' | 'title', value: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    onButtonsChange(updated);
  };

  const removeButton = (index: number) => {
    onButtonsChange(buttons.filter((_, i) => i !== index));
  };

  // Section handlers
  const addSection = () => {
    if (sections.length >= 10) return;
    const newSection: ListSection = {
      title: `Section ${sections.length + 1}`,
      rows: [],
    };
    onSectionsChange([...sections, newSection]);
  };

  const updateSectionTitle = (sectionIndex: number, title: string) => {
    const updated = [...sections];
    updated[sectionIndex] = { ...updated[sectionIndex], title };
    onSectionsChange(updated);
  };

  const removeSection = (sectionIndex: number) => {
    onSectionsChange(sections.filter((_, i) => i !== sectionIndex));
  };

  // Row handlers
  const addRow = (sectionIndex: number) => {
    const section = sections[sectionIndex];
    if (section.rows.length >= 10) return;
    
    const newRow: ListRow = {
      id: `row_${Date.now()}`,
      title: '',
      description: '',
    };
    
    const updated = [...sections];
    updated[sectionIndex] = {
      ...section,
      rows: [...section.rows, newRow],
    };
    onSectionsChange(updated);
  };

  const updateRow = (sectionIndex: number, rowIndex: number, field: keyof ListRow, value: string) => {
    const updated = [...sections];
    const rows = [...updated[sectionIndex].rows];
    rows[rowIndex] = { ...rows[rowIndex], [field]: value };
    updated[sectionIndex] = { ...updated[sectionIndex], rows };
    onSectionsChange(updated);
  };

  const removeRow = (sectionIndex: number, rowIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex] = {
      ...updated[sectionIndex],
      rows: updated[sectionIndex].rows.filter((_, i) => i !== rowIndex),
    };
    onSectionsChange(updated);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">🖱️ Interactive Message</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Interactive Type */}
        <div className="space-y-2">
          <Label>Interactive Type *</Label>
          <Select value={interactiveType} onValueChange={(v) => onInteractiveTypeChange(v as InteractiveType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="button">Reply Buttons (max 3)</SelectItem>
              <SelectItem value="list">List Menu (max 10 sections)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Header Text */}
        <div className="space-y-2">
          <Label htmlFor="headerText">
            Header Text <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="headerText"
            value={headerText}
            onChange={(e) => onHeaderTextChange(e.target.value)}
            placeholder="Header text"
            maxLength={60}
          />
        </div>

        {/* Body Text */}
        <div className="space-y-2">
          <Label htmlFor="bodyText">Body Text *</Label>
          <Textarea
            id="bodyText"
            value={bodyText}
            onChange={(e) => onBodyTextChange(e.target.value)}
            placeholder="Main message body"
            className="min-h-[80px]"
            maxLength={1024}
          />
          <p className="text-xs text-muted-foreground text-right">
            {bodyText.length} / 1024 characters
          </p>
        </div>

        {/* Footer Text */}
        <div className="space-y-2">
          <Label htmlFor="footerText">
            Footer Text <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="footerText"
            value={footerText}
            onChange={(e) => onFooterTextChange(e.target.value)}
            placeholder="Footer text"
            maxLength={60}
          />
        </div>

        {/* Button Type UI */}
        {interactiveType === 'button' && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Reply Buttons ({buttons.length}/3)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addButton}
                disabled={buttons.length >= 3}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Button
              </Button>
            </div>

            {buttons.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md text-center">
                No buttons added. Click "Add Button" to create reply buttons.
              </div>
            ) : (
              <div className="space-y-2">
                {buttons.map((button, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      value={button.id}
                      onChange={(e) => updateButton(index, 'id', e.target.value)}
                      placeholder="Button ID"
                      className="w-32 font-mono text-xs"
                    />
                    <Input
                      value={button.title}
                      onChange={(e) => updateButton(index, 'title', e.target.value)}
                      placeholder="Button Title"
                      className="flex-1"
                      maxLength={20}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeButton(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List Type UI */}
        {interactiveType === 'list' && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>List Sections ({sections.length}/10)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSection}
                disabled={sections.length >= 10}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Section
              </Button>
            </div>

            {sections.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md text-center">
                No sections added. Click "Add Section" to create list menu.
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="border rounded-md p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={section.title}
                        onChange={(e) => updateSectionTitle(sectionIndex, e.target.value)}
                        placeholder="Section Title"
                        className="flex-1 font-medium"
                        maxLength={24}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(sectionIndex)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Rows */}
                    <div className="space-y-2 pl-4">
                      {section.rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex items-start gap-2 p-2 bg-muted/30 rounded">
                          <div className="flex-1 space-y-1">
                            <Input
                              value={row.title}
                              onChange={(e) => updateRow(sectionIndex, rowIndex, 'title', e.target.value)}
                              placeholder="Row Title"
                              className="text-sm"
                              maxLength={24}
                            />
                            <Input
                              value={row.description || ''}
                              onChange={(e) => updateRow(sectionIndex, rowIndex, 'description', e.target.value)}
                              placeholder="Description (optional)"
                              className="text-xs"
                              maxLength={72}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(sectionIndex, rowIndex)}
                            className="text-red-500 hover:text-red-700 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addRow(sectionIndex)}
                        disabled={section.rows.length >= 10}
                        className="w-full justify-center"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Row ({section.rows.length}/10)
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
