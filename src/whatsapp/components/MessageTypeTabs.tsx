// Message Type Tabs
// ==================
// Tab selector for message type

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, FileText, Image, MousePointer } from 'lucide-react';
import type { MessageType } from '../types';

interface MessageTypeTabsProps {
  value: MessageType;
  onChange: (value: MessageType) => void;
}

export default function MessageTypeTabs({ value, onChange }: MessageTypeTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as MessageType)} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="text" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Text</span>
        </TabsTrigger>
        <TabsTrigger value="template" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Template</span>
        </TabsTrigger>
        <TabsTrigger value="media" className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          <span className="hidden sm:inline">Media</span>
        </TabsTrigger>
        <TabsTrigger value="interactive" className="flex items-center gap-2">
          <MousePointer className="h-4 w-4" />
          <span className="hidden sm:inline">Interactive</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
