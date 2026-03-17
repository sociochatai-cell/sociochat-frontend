/**
 * BlockPalette Component
 * ======================
 * Compact icon-only palette for dragging fields into steps.
 * Features MacBook dock-style magnification effect on hover.
 */

import { useState, useCallback } from 'react';
import { 
  Type, 
  Mail, 
  Phone, 
  Hash, 
  FileText, 
  List, 
  CircleDot, 
  CheckSquare, 
  Calendar 
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FieldType } from './types';
import { cn } from '@/lib/utils';

interface BlockPaletteProps {
  onDragStart?: (type: FieldType) => void;
  onBlockClick?: (type: FieldType) => void;
  className?: string;
}

interface BlockItem {
  type: FieldType;
  label: string;
  icon: React.ReactNode;
  description: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
}

const BLOCKS: BlockItem[] = [
  { 
    type: 'text', 
    label: 'Text', 
    icon: <Type />, 
    description: 'Short text input',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600'
  },
  { 
    type: 'email', 
    label: 'Email', 
    icon: <Mail />, 
    description: 'Email address',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-600'
  },
  { 
    type: 'phone', 
    label: 'Phone', 
    icon: <Phone />, 
    description: 'Phone number',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600'
  },
  { 
    type: 'number', 
    label: 'Number', 
    icon: <Hash />, 
    description: 'Numeric input',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconColor: 'text-orange-600'
  },
  { 
    type: 'textarea', 
    label: 'Long Text', 
    icon: <FileText />, 
    description: 'Multi-line text',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    iconColor: 'text-cyan-600'
  },
  { 
    type: 'dropdown', 
    label: 'Dropdown', 
    icon: <List />, 
    description: 'Select from list',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    iconColor: 'text-indigo-600'
  },
  { 
    type: 'radio', 
    label: 'Single Choice', 
    icon: <CircleDot />, 
    description: 'Pick one option',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    iconColor: 'text-pink-600'
  },
  { 
    type: 'checkbox', 
    label: 'Multi Choice', 
    icon: <CheckSquare />, 
    description: 'Pick multiple',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    iconColor: 'text-teal-600'
  },
  { 
    type: 'date', 
    label: 'Date', 
    icon: <Calendar />, 
    description: 'Date picker',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600'
  },
];

// Calculate scale based on distance from hovered item (MacBook dock effect)
function getScale(index: number, hoveredIndex: number | null): number {
  if (hoveredIndex === null) return 1;
  const distance = Math.abs(index - hoveredIndex);
  if (distance === 0) return 1.4; // Hovered item
  if (distance === 1) return 1.2; // Adjacent items
  if (distance === 2) return 1.08; // Items 2 away
  return 1; // Far items
}

export function BlockPalette({ onDragStart, onBlockClick, className }: BlockPaletteProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseEnter = useCallback((index: number) => {
    setHoveredIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div 
        className={cn(
          "flex flex-col items-center gap-1 p-2 bg-gradient-to-b from-gray-50 to-gray-100 border-r",
          className
        )}
        onMouseLeave={handleMouseLeave}
      >
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
          Fields
        </div>
        
        <div className="flex flex-col items-center gap-1">
          {BLOCKS.map((block, index) => {
            const scale = getScale(index, hoveredIndex);
            const isHovered = hoveredIndex === index;
            
            return (
              <Tooltip key={block.type}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center justify-center rounded-xl border-2",
                      "cursor-grab active:cursor-grabbing",
                      "shadow-sm",
                      isHovered 
                        ? `${block.bgColor} ${block.borderColor} shadow-lg` 
                        : "bg-white border-transparent hover:shadow-md",
                      isHovered && block.iconColor
                    )}
                    style={{
                      width: 40,
                      height: 40,
                      transform: `scale(${scale})`,
                      transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
                      transformOrigin: 'center center',
                      zIndex: isHovered ? 10 : 1,
                    }}
                    draggable
                    onMouseEnter={() => handleMouseEnter(index)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('field-type', block.type);
                      e.dataTransfer.effectAllowed = 'copy';
                      onDragStart?.(block.type);
                    }}
                    onClick={() => onBlockClick?.(block.type)}
                  >
                    <div className={cn(
                      "transition-all duration-150",
                      isHovered ? "w-5 h-5" : "w-4 h-4"
                    )}>
                      {block.icon}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-0.5 py-2">
                  <span className="font-semibold">{block.label}</span>
                  <span className="text-xs text-gray-400">{block.description}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

// Horizontal version for tablet/mobile with dock magnification
export function BlockPaletteHorizontal({ onDragStart, onBlockClick, className }: BlockPaletteProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseEnter = useCallback((index: number) => {
    setHoveredIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div 
        className={cn(
          "flex items-center gap-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 border-t overflow-x-auto",
          className
        )}
        onMouseLeave={handleMouseLeave}
      >
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
          Fields
        </div>
        
        <div className="flex items-center gap-1 py-2">
          {BLOCKS.map((block, index) => {
            const scale = getScale(index, hoveredIndex);
            const isHovered = hoveredIndex === index;
            
            return (
              <Tooltip key={block.type}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center justify-center rounded-xl border-2 flex-shrink-0",
                      "cursor-grab active:cursor-grabbing",
                      "shadow-sm",
                      isHovered 
                        ? `${block.bgColor} ${block.borderColor} shadow-lg` 
                        : "bg-white border-transparent hover:shadow-md",
                      isHovered && block.iconColor
                    )}
                    style={{
                      width: 36,
                      height: 36,
                      transform: `scale(${scale})`,
                      transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
                      transformOrigin: 'center center',
                      zIndex: isHovered ? 10 : 1,
                    }}
                    draggable
                    onMouseEnter={() => handleMouseEnter(index)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('field-type', block.type);
                      e.dataTransfer.effectAllowed = 'copy';
                      onDragStart?.(block.type);
                    }}
                    onClick={() => onBlockClick?.(block.type)}
                  >
                    <div className={cn(
                      "transition-all duration-150",
                      isHovered ? "w-5 h-5" : "w-4 h-4"
                    )}>
                      {block.icon}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="flex flex-col gap-0.5 py-2">
                  <span className="font-semibold">{block.label}</span>
                  <span className="text-xs text-gray-400">{block.description}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BlockPalette;
