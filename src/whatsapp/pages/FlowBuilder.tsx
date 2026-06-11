// FlowBuilder.tsx
// =================
// WhatsApp Flow Builder - Create interactive flows for data collection
// Features: Visual screen editor, component palette, live preview, validation

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import {
    Plus, Trash2, ArrowUp, ArrowDown, Save, Send, Eye, ArrowLeft,
    Type, ListOrdered, CheckSquare, Calendar, Layout, Settings,
    AlertTriangle, CheckCircle, XCircle, Loader2, Copy, Smartphone,
    MessageCircle, FileText, Sparkles, GripVertical
} from 'lucide-react';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

// Types
interface FlowComponent {
    type: string;
    text?: string;
    name?: string;
    label?: string;
    required?: boolean;
    'input-type'?: string;
    'data-source'?: Array<{ id: string; title: string }>;
    'on-click-action'?: {
        name: string;
        next?: { type: string; name: string };
        payload?: Record<string, string>;
    };
    children?: FlowComponent[];  // For Form wrapper component
}

interface FlowScreen {
    id: string;
    title: string;
    terminal: boolean;
    success?: boolean;  // Required for terminal screens (Meta)
    data?: Record<string, { type: string; __example__?: string }>;  // For receiving data from prev screens
    layout: {
        type: string;
        children: FlowComponent[];
    };
}

interface FlowJSON {
    version: string;
    data_api_version?: string;
    screens: FlowScreen[];
    routing_model: Record<string, string[]>;
}

interface ValidationResult {
    valid: boolean;
    errors: Array<{ message: string; screen_id?: string; component?: string }>;
    warnings: Array<{ message: string; screen_id?: string; component?: string }>;
    screen_count: number;
    component_count: number;
}

interface Flow {
    id?: number;
    account_id: number;
    name: string;
    category: string;
    flow_version: number;
    flow_json: FlowJSON;
    entry_screen_id: string;
    status: string;
    meta_flow_id?: string;
}

// Component Types Available
const COMPONENT_TYPES = [
    { type: 'TextHeading', label: 'Heading', icon: Type, description: 'Section title' },
    { type: 'TextBody', label: 'Text', icon: FileText, description: 'Paragraph text' },
    { type: 'TextInput', label: 'Text Input', icon: Type, description: 'Single line field' },
    { type: 'TextArea', label: 'Text Area', icon: FileText, description: 'Multi-line field' },
    { type: 'Dropdown', label: 'Dropdown', icon: ListOrdered, description: 'Select one option' },
    { type: 'RadioButtonsGroup', label: 'Radio Buttons', icon: CheckSquare, description: 'Choose one' },
    { type: 'CheckboxGroup', label: 'Checkboxes', icon: CheckSquare, description: 'Choose multiple' },
    { type: 'DatePicker', label: 'Date Picker', icon: Calendar, description: 'Select a date' },
];

// Flow Categories - Must match Meta's accepted values
const FLOW_CATEGORIES = [
    { value: 'LEAD_GENERATION', label: 'Lead Generation' },
    { value: 'SURVEY', label: 'Survey / Feedback' },
    { value: 'APPOINTMENT_BOOKING', label: 'Appointment Booking' },
    { value: 'CUSTOMER_SUPPORT', label: 'Customer Support' },
    { value: 'CONTACT_US', label: 'Contact Us' },
    { value: 'SIGN_UP', label: 'Sign Up' },
    { value: 'SIGN_IN', label: 'Sign In' },
    { value: 'OTHER', label: 'Other' },
];

// Build routing_model from screen navigation (required by v7.3)
function buildRoutingModel(screens: FlowScreen[]): Record<string, string[]> {
    const model: Record<string, Set<string>> = {};

    // Initialize all screens with empty sets
    screens.forEach(screen => {
        model[screen.id] = new Set();
    });

    // Traverse each screen and find navigation targets
    screens.forEach(screen => {
        const traverseChildren = (children: FlowComponent[]) => {
            children.forEach(child => {
                // Check for on-click-action with navigate
                if (child['on-click-action']?.name === 'navigate' && child['on-click-action']?.next?.name) {
                    const targetScreen = child['on-click-action'].next.name;
                    // Only add if target screen exists
                    if (screens.some(s => s.id === targetScreen)) {
                        model[screen.id].add(targetScreen);
                    }
                }
            });
        };

        if (screen.layout?.children) {
            traverseChildren(screen.layout.children);
        }
    });

    // Terminal screens must have empty array
    screens.forEach(screen => {
        if (screen.terminal) {
            model[screen.id] = new Set(); // Clear any navigation for terminal screens
        }
    });

    // Convert sets to arrays
    const finalModel: Record<string, string[]> = {};
    Object.keys(model).forEach(key => {
        finalModel[key] = Array.from(model[key]);
    });

    return finalModel;
}

// Generate unique ID - Meta requires ONLY alphabetic characters and underscores (NO NUMBERS)
const generateId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let id = 'SCREEN_';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
};

// Default empty screen - Flat structure for UI compatibility
const createEmptyScreen = (id?: string): FlowScreen => ({
    id: id || generateId(),
    title: 'New Screen',
    terminal: false, // Default to non-terminal so user can select next screen
    data: {},
    layout: {
        type: 'SingleColumnLayout',
        children: [
            { type: 'TextSubheading', text: 'Enter your details' },
            {
                type: 'Footer',
                label: 'Continue',
                'on-click-action': {
                    name: 'navigate',
                    next: { type: 'screen', name: '' },  // Empty - user selects target
                    payload: {}
                }
            }
        ]
    }
});

// Default Flow - Matching Meta requirements (flat structure for UI compatibility)
// - Labels must be ≤ 20 characters
// - Payload passes form data between screens
// - data: {} property on screens receiving data
// Note: Form wrapper is optional - only needed when using ${form.fieldname} refs
const createDefaultFlow = (): FlowJSON => {
    const screens: FlowScreen[] = [
        {
            id: 'WELCOME',
            title: 'Get Started',
            terminal: false,
            data: {},
            layout: {
                type: 'SingleColumnLayout',
                children: [
                    { type: 'TextSubheading', text: 'Welcome! Enter your info.' },
                    {
                        type: 'TextInput',
                        name: 'full_name',
                        label: 'Your Name',  // ≤20 chars
                        'input-type': 'text',
                        required: true
                    },
                    {
                        type: 'Footer',
                        label: 'Continue',
                        'on-click-action': {
                            name: 'navigate',
                            next: { type: 'screen', name: 'CONFIRMATION' },
                            payload: {}
                        }
                    }
                ]
            }
        },
        {
            id: 'CONFIRMATION',
            title: 'Complete',
            terminal: true,
            success: true,
            data: {},
            layout: {
                type: 'SingleColumnLayout',
                children: [
                    { type: 'TextSubheading', text: 'Thanks!' },
                    { type: 'TextBody', text: 'We\'ll be in touch.' },
                    {
                        type: 'Footer',
                        label: 'Done',
                        'on-click-action': {
                            name: 'complete',
                            payload: {}
                        }
                    }
                ]
            }
        }
    ];

    return {
        version: '7.3',
        data_api_version: '4.0',
        screens,
        routing_model: buildRoutingModel(screens)
    };
};

// Component Editor
function ComponentEditor({
    component,
    onChange,
    onDelete,
    screenIds
}: {
    component: FlowComponent;
    onChange: (c: FlowComponent) => void;
    onDelete: () => void;
    screenIds: string[];
}) {
    const renderEditor = () => {
        switch (component.type) {
            case 'TextHeading':
            case 'TextBody':
                return (
                    <Input
                        value={component.text || ''}
                        onChange={(e) => onChange({ ...component, text: e.target.value })}
                        placeholder="Enter text..."
                    />
                );

            case 'TextInput':
            case 'TextArea':
                return (
                    <div className="space-y-2">
                        <Input
                            value={component.name || ''}
                            onChange={(e) => onChange({ ...component, name: e.target.value })}
                            placeholder="Field name (e.g., email)"
                        />
                        <Input
                            value={component.label || ''}
                            onChange={(e) => onChange({ ...component, label: e.target.value })}
                            placeholder="Label (e.g., Email Address)"
                        />
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={component.required || false}
                                onCheckedChange={(checked) => onChange({ ...component, required: checked })}
                            />
                            <Label className="text-sm">Required</Label>
                        </div>
                    </div>
                );

            case 'Dropdown':
            case 'RadioButtonsGroup':
            case 'CheckboxGroup':
                const options = component['data-source'] || [];
                const addOption = () => {
                    const newOptions = [...options, { id: String(Date.now()), title: `Option ${options.length + 1}` }];
                    onChange({ ...component, 'data-source': newOptions });
                };
                const updateOption = (idx: number, title: string) => {
                    const newOptions = [...options];
                    newOptions[idx] = { ...newOptions[idx], title };
                    onChange({ ...component, 'data-source': newOptions });
                };
                const removeOption = (idx: number) => {
                    const newOptions = options.filter((_: any, i: number) => i !== idx);
                    onChange({ ...component, 'data-source': newOptions });
                };

                return (
                    <div className="space-y-2">
                        <Input
                            value={component.name || ''}
                            onChange={(e) => onChange({ ...component, name: e.target.value })}
                            placeholder="Field name (e.g., preference)"
                        />
                        <Input
                            value={component.label || ''}
                            onChange={(e) => onChange({ ...component, label: e.target.value })}
                            placeholder="Label (e.g., Your Preference)"
                        />
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Options:</Label>
                            {options.map((opt: any, idx: number) => (
                                <div key={opt.id || idx} className="flex items-center gap-1">
                                    <Input
                                        value={opt.title || ''}
                                        onChange={(e) => updateOption(idx, e.target.value)}
                                        placeholder={`Option ${idx + 1}`}
                                        className="h-7 text-sm"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => removeOption(idx)}
                                    >
                                        <XCircle className="w-3 h-3 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addOption}
                                className="w-full mt-1"
                            >
                                <Plus className="w-3 h-3 mr-1" /> Add Option
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={component.required || false}
                                onCheckedChange={(checked) => onChange({ ...component, required: checked })}
                            />
                            <Label className="text-sm">Required</Label>
                        </div>
                    </div>
                );

            case 'DatePicker':
                return (
                    <div className="space-y-2">
                        <Input
                            value={component.name || ''}
                            onChange={(e) => onChange({ ...component, name: e.target.value })}
                            placeholder="Field name (e.g., appointment_date)"
                        />
                        <Input
                            value={component.label || ''}
                            onChange={(e) => onChange({ ...component, label: e.target.value })}
                            placeholder="Label (e.g., Select Date)"
                        />
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={component.required || false}
                                onCheckedChange={(checked) => onChange({ ...component, required: checked })}
                            />
                            <Label className="text-sm">Required</Label>
                        </div>
                    </div>
                );

            case 'Footer':
                return (
                    <div className="space-y-2">
                        <Input
                            value={component.label || ''}
                            onChange={(e) => onChange({ ...component, label: e.target.value })}
                            placeholder="Button label (e.g., Continue)"
                        />
                        {component['on-click-action']?.name === 'navigate' && (
                            <Select
                                value={component['on-click-action']?.next?.name || ''}
                                onValueChange={(value) => onChange({
                                    ...component,
                                    'on-click-action': {
                                        name: 'navigate',
                                        next: { type: 'screen', name: value }
                                    }
                                })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Navigate to screen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {screenIds.map(id => (
                                        <SelectItem key={id} value={id}>{id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                );

            default:
                return (
                    <div className="text-sm text-muted-foreground">
                        Configure {component.type}
                    </div>
                );
        }
    };

    const getIcon = () => {
        const comp = COMPONENT_TYPES.find(c => c.type === component.type);
        return comp?.icon || Settings;
    };

    const Icon = getIcon();

    return (
        <div className="flex items-start gap-2 p-3 border rounded-lg bg-card hover:border-primary/50 transition-colors">
            <GripVertical className="w-4 h-4 text-muted-foreground mt-1 cursor-grab" />
            <Icon className="w-4 h-4 text-primary mt-1" />
            <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{component.type}</span>
                    <Button variant="ghost" size="icon" onClick={onDelete} className="h-6 w-6">
                        <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                </div>
                {renderEditor()}
            </div>
        </div>
    );
}

// Screen Editor
function ScreenEditor({
    screen,
    onChange,
    onDelete,
    isFirst,
    allScreenIds
}: {
    screen: FlowScreen;
    onChange: (s: FlowScreen) => void;
    onDelete: () => void;
    isFirst: boolean;
    allScreenIds: string[];
}) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const addComponent = (type: string) => {
        const newComponent: FlowComponent = { type };

        // Generate unique name suffix - Meta requires only alphabetic characters
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let uniqueId = '';
        for (let i = 0; i < 6; i++) {
            uniqueId += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Set defaults based on type (Labels must be ≤ 20 characters for Meta)
        if (type === 'TextHeading' || type === 'TextSubheading') {
            newComponent.text = 'Your heading here';
        } else if (type === 'TextBody') {
            newComponent.text = 'Your text here';
        } else if (type === 'TextInput') {
            // TextInput - supports input-type
            newComponent.name = `input_${uniqueId}`;
            newComponent.label = 'Your input';  // 10 chars
            newComponent['input-type'] = 'text';
            newComponent.required = false;
        } else if (type === 'TextArea') {
            // TextArea - does NOT support input-type (Meta schema)
            newComponent.name = `input_${uniqueId}`;
            newComponent.label = 'Your message';  // 12 chars
            newComponent.required = false;
        } else if (type === 'Dropdown' || type === 'RadioButtonsGroup' || type === 'CheckboxGroup') {
            // Meta requires name to have at least 1 character and only alphabets/underscores
            newComponent.name = `select_${uniqueId}`;
            newComponent.label = 'Choose option';  // 13 chars
            newComponent.required = true;
            newComponent['data-source'] = [
                { id: 'opt_one', title: 'Option 1' },
                { id: 'opt_two', title: 'Option 2' }
            ];
        } else if (type === 'DatePicker') {
            newComponent.name = `date_${uniqueId}`;
            newComponent.label = 'Select a date';
        }

        // Insert before Footer
        const children = [...screen.layout.children];
        const footerIndex = children.findIndex(c => c.type === 'Footer');
        if (footerIndex !== -1) {
            children.splice(footerIndex, 0, newComponent);
        } else {
            children.push(newComponent);
        }

        onChange({
            ...screen,
            layout: { ...screen.layout, children }
        });
    };

    const updateComponent = (index: number, component: FlowComponent) => {
        const children = [...screen.layout.children];
        children[index] = component;
        onChange({ ...screen, layout: { ...screen.layout, children } });
    };

    const deleteComponent = (index: number) => {
        const children = screen.layout.children.filter((_, i) => i !== index);
        onChange({ ...screen, layout: { ...screen.layout, children } });
    };

    // Move component up/down
    const moveComponent = (index: number, direction: 'up' | 'down') => {
        const children = [...screen.layout.children];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        // Don't move beyond bounds or swap with Footer
        if (newIndex < 0 || newIndex >= children.length) return;
        if (children[newIndex].type === 'Footer' || children[index].type === 'Footer') return;

        [children[index], children[newIndex]] = [children[newIndex], children[index]];
        onChange({ ...screen, layout: { ...screen.layout, children } });
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (screen.layout.children[index].type === 'Footer') return;
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        if (screen.layout.children[index].type === 'Footer') return;
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === dropIndex) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }

        const children = [...screen.layout.children];
        const [draggedItem] = children.splice(dragIndex, 1);

        // Don't drop after Footer
        const footerIndex = children.findIndex(c => c.type === 'Footer');
        const actualDropIndex = footerIndex !== -1 && dropIndex >= footerIndex ? footerIndex : dropIndex;

        children.splice(actualDropIndex, 0, draggedItem);
        onChange({ ...screen, layout: { ...screen.layout, children } });

        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setDragOverIndex(null);
    };

    return (
        <Card className={`${screen.terminal ? 'border-green-500/50' : ''}`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layout className="w-4 h-4 text-primary" />
                        <Input
                            value={screen.id}
                            onChange={(e) => onChange({
                                ...screen,
                                id: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'SCREEN'
                            })}
                            className="w-32 h-7 text-sm font-mono"
                            placeholder="SCREEN_ID"
                        />
                        {isFirst && <Badge variant="secondary">Entry</Badge>}
                        {screen.terminal && <Badge variant="outline" className="border-green-500 text-green-600">Terminal</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <Switch
                                checked={screen.terminal}
                                onCheckedChange={(checked) => onChange({ ...screen, terminal: checked })}
                            />
                            <Label className="text-xs">Terminal</Label>
                        </div>
                        {!isFirst && (
                            <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7">
                                <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                        )}
                    </div>
                </div>
                <Input
                    value={screen.title}
                    onChange={(e) => onChange({ ...screen, title: e.target.value })}
                    placeholder="Screen Title"
                    className="text-lg font-semibold"
                />
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Components with drag-drop */}
                {screen.layout.children.map((component, idx) => (
                    <div
                        key={idx}
                        draggable={component.type !== 'Footer'}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`relative transition-all ${dragOverIndex === idx ? 'ring-2 ring-primary ring-offset-2' : ''
                            } ${dragIndex === idx ? 'opacity-50' : ''}`}
                    >
                        <div className="absolute right-0 top-0 flex gap-1 z-10">
                            {component.type !== 'Footer' && idx > 0 && screen.layout.children[idx - 1]?.type !== 'Footer' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => moveComponent(idx, 'up')}
                                >
                                    <ArrowUp className="w-3 h-3" />
                                </Button>
                            )}
                            {component.type !== 'Footer' && idx < screen.layout.children.length - 1 && screen.layout.children[idx + 1]?.type !== 'Footer' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => moveComponent(idx, 'down')}
                                >
                                    <ArrowDown className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                        <ComponentEditor
                            component={component}
                            onChange={(c) => updateComponent(idx, c)}
                            onDelete={() => deleteComponent(idx)}
                            screenIds={allScreenIds}
                        />
                    </div>
                ))}

                {/* Add Component */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {COMPONENT_TYPES.map(({ type, label, icon: Icon }) => (
                        <Button
                            key={type}
                            variant="outline"
                            size="sm"
                            onClick={() => addComponent(type)}
                            className="gap-1 text-xs"
                        >
                            <Icon className="w-3 h-3" />
                            {label}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}


// Live Preview Component
function FlowPreview({ flowJson }: { flowJson: FlowJSON }) {
    const [currentScreenId, setCurrentScreenId] = useState<string>('');
    const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

    // Get entry screen (first screen or the one marked as entry)
    const getEntryScreenId = useCallback(() => {
        if (flowJson.screens.length === 0) return '';
        return flowJson.screens[0]?.id || '';
    }, [flowJson.screens]);

    // Compute the navigation path by following footer links
    const computeNavigationPath = useCallback((): FlowScreen[] => {
        const path: FlowScreen[] = [];
        const visited = new Set<string>();

        let currentId = getEntryScreenId();
        const maxIterations = flowJson.screens.length + 1; // Prevent infinite loops
        let iterations = 0;

        while (currentId && iterations < maxIterations) {
            iterations++;

            // Find the screen
            const screen = flowJson.screens.find(s => s.id === currentId);
            if (!screen || visited.has(currentId)) break;

            visited.add(currentId);
            path.push(screen);

            // If terminal, stop
            if (screen.terminal) break;

            // Find the footer and get next screen
            const footer = screen.layout.children.find(c => c.type === 'Footer');
            if (footer?.['on-click-action']?.name === 'navigate') {
                currentId = footer['on-click-action']?.next?.name || '';
            } else {
                break;
            }
        }

        // Add any screens not in the path (orphaned screens)
        flowJson.screens.forEach(s => {
            if (!visited.has(s.id)) {
                path.push(s);
            }
        });

        return path;
    }, [flowJson.screens, getEntryScreenId]);

    // Reset to entry screen when flow structure changes significantly
    useEffect(() => {
        const entryId = getEntryScreenId();
        if (!currentScreenId || !flowJson.screens.find(s => s.id === currentScreenId)) {
            setCurrentScreenId(entryId);
            setNavigationHistory([]);
        }
    }, [flowJson.screens, getEntryScreenId, currentScreenId]);

    // Find current screen by ID
    const screen = flowJson.screens.find(s => s.id === currentScreenId) || flowJson.screens[0];
    const navigationPath = computeNavigationPath();
    const currentPathIndex = navigationPath.findIndex(s => s.id === screen?.id);

    if (!screen) return <div className="p-4 text-center text-muted-foreground">No screens</div>;

    // Navigate to screen via footer action
    const handleFooterClick = (component: FlowComponent) => {
        if (component['on-click-action']?.name === 'navigate') {
            const nextScreenName = component['on-click-action']?.next?.name;
            if (nextScreenName) {
                const nextScreen = flowJson.screens.find(s => s.id === nextScreenName);
                if (nextScreen) {
                    setNavigationHistory(prev => [...prev, screen.id]);
                    setCurrentScreenId(nextScreenName);
                }
            }
        } else if (component['on-click-action']?.name === 'complete') {
            // Show completion message
            alert('Flow Complete! In real WhatsApp, this would submit the form.');
        }
    };

    // Go back in navigation history
    const handleBack = () => {
        if (navigationHistory.length > 0) {
            const prevScreenId = navigationHistory[navigationHistory.length - 1];
            setNavigationHistory(prev => prev.slice(0, -1));
            setCurrentScreenId(prevScreenId);
        }
    };

    // Navigate directly to a screen (via path buttons)
    const handleDirectNavigation = (screenId: string) => {
        if (screenId !== currentScreenId) {
            setNavigationHistory(prev => [...prev, screen.id]);
            setCurrentScreenId(screenId);
        }
    };

    // Get the next screen name from footer
    const getFooterDestination = (component: FlowComponent): string | null => {
        if (component['on-click-action']?.name === 'navigate') {
            return component['on-click-action']?.next?.name || null;
        }
        if (component['on-click-action']?.name === 'complete') {
            return 'Complete';
        }
        return null;
    };

    // Reset to start
    const handleRestart = () => {
        setNavigationHistory([]);
        setCurrentScreenId(getEntryScreenId());
    };

    return (
        <div className="bg-gradient-to-b from-green-600 to-green-700 rounded-3xl p-1 max-w-xs mx-auto shadow-xl">
            <div className="bg-white rounded-[22px] overflow-hidden">
                {/* Header with back button */}
                <div className="bg-green-600 text-white px-4 py-3 flex items-center gap-2">
                    {navigationHistory.length > 0 ? (
                        <button
                            onClick={handleBack}
                            className="hover:bg-green-500 rounded p-1 -ml-1 transition-colors"
                            title="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    ) : (
                        <Smartphone className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium flex-1">{screen.title}</span>
                    <span className="text-xs opacity-70">{screen.id}</span>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3 min-h-[300px]">
                    {screen.layout.children.map((component, idx) => {
                        switch (component.type) {
                            case 'TextHeading':
                                return <h3 key={idx} className="font-bold text-lg">{component.text || 'Heading'}</h3>;
                            case 'TextBody':
                                return <p key={idx} className="text-gray-600">{component.text || 'Body text'}</p>;
                            case 'TextInput':
                            case 'TextArea':
                                return (
                                    <div key={idx} className="space-y-1">
                                        <label className="text-sm font-medium">
                                            {component.label || 'Field'}
                                            {component.required && <span className="text-red-500 ml-1">*</span>}
                                        </label>
                                        <div className="border rounded-lg px-3 py-2 text-gray-400 bg-gray-50">
                                            Enter {component.label?.toLowerCase() || 'value'}...
                                        </div>
                                    </div>
                                );
                            case 'Dropdown':
                                return (
                                    <div key={idx} className="space-y-1">
                                        <label className="text-sm font-medium">{component.label || 'Select'}</label>
                                        <div className="border rounded-lg px-3 py-2 text-gray-400 bg-gray-50 flex justify-between">
                                            <span>Select an option...</span>
                                            <span>▼</span>
                                        </div>
                                    </div>
                                );
                            case 'RadioButtonsGroup':
                                return (
                                    <div key={idx} className="space-y-2">
                                        <label className="text-sm font-medium">{component.label || 'Choose one'}</label>
                                        {(component['data-source'] || [{ id: '1', title: 'Option 1' }, { id: '2', title: 'Option 2' }]).map((opt: any) => (
                                            <div key={opt.id} className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 rounded-full border-gray-300" />
                                                <span className="text-sm">{opt.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            case 'CheckboxGroup':
                                return (
                                    <div key={idx} className="space-y-2">
                                        <label className="text-sm font-medium">{component.label || 'Select all that apply'}</label>
                                        {(component['data-source'] || [{ id: '1', title: 'Option 1' }, { id: '2', title: 'Option 2' }]).map((opt: any) => (
                                            <div key={opt.id} className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 rounded border-gray-300" />
                                                <span className="text-sm">{opt.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            case 'DatePicker':
                                return (
                                    <div key={idx} className="space-y-1">
                                        <label className="text-sm font-medium">{component.label || 'Date'}</label>
                                        <div className="border rounded-lg px-3 py-2 text-gray-400 bg-gray-50 flex justify-between">
                                            <span>Select date...</span>
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                    </div>
                                );
                            case 'Footer':
                                const destination = getFooterDestination(component);
                                return (
                                    <div key={idx} className="mt-4">
                                        <button
                                            onClick={() => handleFooterClick(component)}
                                            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors cursor-pointer"
                                        >
                                            {component.label || 'Continue'}
                                        </button>
                                        {destination && (
                                            <div className="text-xs text-center text-gray-400 mt-1">
                                                → {destination === 'Complete' ? '✓ Submit Form' : destination}
                                            </div>
                                        )}
                                    </div>
                                );
                            default:
                                return <div key={idx} className="text-sm text-gray-400">[{component.type}]</div>;
                        }
                    })}
                </div>

                {/* Flow Path - shows screens in navigation order */}
                <div className="border-t bg-gray-50 p-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">
                            Flow: Step {currentPathIndex + 1} of {navigationPath.length}
                        </span>
                        <button
                            onClick={handleRestart}
                            className="text-xs text-green-600 hover:text-green-700"
                        >
                            Restart
                        </button>
                    </div>
                    {/* Navigation path in flow order */}
                    <div className="flex flex-wrap items-center gap-1 justify-center">
                        {navigationPath.map((s, idx) => (
                            <div key={s.id} className="flex items-center">
                                <button
                                    onClick={() => handleDirectNavigation(s.id)}
                                    className={`text-xs px-2 py-1 rounded transition-all ${s.id === currentScreenId
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        } ${s.terminal ? 'border border-green-400' : ''}`}
                                    title={`${s.title} (${s.id})${s.terminal ? ' - Terminal' : ''}`}
                                >
                                    {s.id.length > 8 ? s.id.substring(0, 8) + '...' : s.id}
                                </button>
                                {idx < navigationPath.length - 1 && (
                                    <span className="text-gray-400 mx-1">→</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}




// Main Flow Builder Component
export function FlowBuilder() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    // Flow state
    const [name, setName] = useState('');
    const [category, setCategory] = useState('LEAD_GEN');
    const [flowJson, setFlowJson] = useState<FlowJSON>(createDefaultFlow());
    const [entryScreenId, setEntryScreenId] = useState('WELCOME');

    // UI state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [activeTab, setActiveTab] = useState('editor');
    const [flowId, setFlowId] = useState<number | null>(null);

    // Account state - fetched based on workspace
    const [accountId, setAccountId] = useState<number | null>(null);

    // Get workspace_id and fetch the active account
    const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id') ||
        sessionStorage.getItem('sv_whatsapp_workspace_id');

    useEffect(() => {
        const fetchAccount = async () => {
            if (!workspaceId) return;
            try {
                const res = await fetch(`${API_BASE}/api/whatsapp/accounts?workspace_id=${workspaceId}`);
                const data = await res.json();
                if (data.success && data.accounts?.length > 0) {
                    setAccountId(data.accounts[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch account:', err);
            }
        };
        fetchAccount();
    }, [workspaceId]);

    // Load flow if editing
    useEffect(() => {
        if (id) {
            loadFlow(parseInt(id));
        }
    }, [id]);

    const loadFlow = async (flowId: number) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/flows/${flowId}`);
            const data = await res.json();

            if (data.success) {
                const flow = data.flow;
                setName(flow.name);
                setCategory(flow.category);
                setFlowJson(flow.flow_json);
                setEntryScreenId(flow.entry_screen_id);
                setFlowId(flow.id);
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to load flow', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    // Validate flow
    const validateFlow = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/flows/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flow_json: flowJson, entry_screen_id: entryScreenId })
            });
            const data = await res.json();
            setValidation(data.validation);
        } catch (err) {
            console.error('Validation error:', err);
        }
    }, [flowJson, entryScreenId]);

    // Auto-validate on changes
    useEffect(() => {
        const timeout = setTimeout(validateFlow, 500);
        return () => clearTimeout(timeout);
    }, [validateFlow]);

    // Update entry screen if first screen changes
    useEffect(() => {
        if (flowJson.screens.length > 0 && !flowJson.screens.find(s => s.id === entryScreenId)) {
            setEntryScreenId(flowJson.screens[0].id);
        }
    }, [flowJson.screens, entryScreenId]);

    // Save draft
    const saveDraft = async () => {
        if (!name.trim()) {
            toast({ title: 'Error', description: 'Please enter a flow name', variant: 'destructive' });
            return;
        }

        try {
            setSaving(true);

            const url = flowId ? `/api/whatsapp/flows/${flowId}` : '/api/whatsapp/flows';
            const method = flowId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: accountId,
                    name,
                    category,
                    flow_json: flowJson,
                    entry_screen_id: entryScreenId
                })
            });

            const data = await res.json();

            if (data.success) {
                setFlowId(data.flow.id);
                toast({ title: 'Saved', description: 'Flow saved as draft' });
            } else {
                toast({ title: 'Error', description: data.error, variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to save flow', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // Publish flow
    const publishFlow = async () => {
        if (!flowId) {
            await saveDraft();
            return;
        }

        if (!validation?.valid) {
            toast({ title: 'Cannot Publish', description: 'Fix validation errors first', variant: 'destructive' });
            return;
        }

        try {
            setPublishing(true);

            // Publish directly to Meta (no demo mode)
            const res = await fetch(`${API_BASE}/api/whatsapp/flows/${flowId}/publish`, {
                method: 'POST'
            });

            const data = await res.json();

            if (data.success) {
                toast({ title: 'Published!', description: 'Flow published to Meta successfully' });
                navigate('/dashboard/flows');
            } else {
                // Show specific error with action hint
                let errorMsg = data.message || data.error || 'Failed to publish';

                if (data.error === 'business_not_verified') {
                    errorMsg += '. Complete verification at business.facebook.com';
                } else if (data.error === 'flows_not_enabled') {
                    errorMsg += '. Contact Meta Support.';
                } else if (data.error === 'token_expired') {
                    errorMsg += '. Please reconnect your WhatsApp account.';
                }

                toast({ title: 'Publish Failed', description: errorMsg, variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to publish flow', variant: 'destructive' });
        } finally {
            setPublishing(false);
        }
    };

    // Screen management
    const addScreen = () => {
        if (flowJson.screens.length >= 10) {
            toast({ title: 'Limit Reached', description: 'Maximum 10 screens allowed', variant: 'destructive' });
            return;
        }

        const newScreen = createEmptyScreen();
        const newScreens = [...flowJson.screens, newScreen];
        setFlowJson({
            ...flowJson,
            screens: newScreens,
            routing_model: buildRoutingModel(newScreens)
        });
    };

    const updateScreen = (index: number, screen: FlowScreen) => {
        const screens = [...flowJson.screens];
        screens[index] = screen;
        setFlowJson({
            ...flowJson,
            screens,
            routing_model: buildRoutingModel(screens)
        });
    };

    const deleteScreen = (index: number) => {
        if (flowJson.screens.length <= 1) {
            toast({ title: 'Cannot Delete', description: 'At least one screen is required', variant: 'destructive' });
            return;
        }

        const screens = flowJson.screens.filter((_, i) => i !== index);
        setFlowJson({
            ...flowJson,
            screens,
            routing_model: buildRoutingModel(screens)
        });
    };

    const allScreenIds = flowJson.screens.map(s => s.id);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold">
                                    {isEditing ? 'Edit Flow' : 'Create Flow'}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Build interactive WhatsApp flows
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {validation && (
                                <Badge variant={validation.valid ? 'default' : 'destructive'} className="gap-1">
                                    {validation.valid ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                    {validation.valid ? 'Valid' : `${validation.errors.length} errors`}
                                </Badge>
                            )}

                            <Button variant="outline" onClick={saveDraft} disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Save Draft
                            </Button>

                            <Button onClick={() => publishFlow()} disabled={publishing || !validation?.valid}>
                                {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                Publish to Meta
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Settings + Screens */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Flow Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    Flow Settings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Flow Name</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Lead Capture Form"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FLOW_CATEGORIES.map(cat => (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    {cat.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Validation Alerts */}
                        {validation && !validation.valid && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Validation Errors</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        {validation.errors.map((err, idx) => (
                                            <li key={idx} className="text-sm">
                                                {err.screen_id && <Badge variant="outline" className="mr-1">{err.screen_id}</Badge>}
                                                {err.message}
                                            </li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Screens */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Screens ({flowJson.screens.length}/10)</h2>
                                <Button onClick={addScreen} disabled={flowJson.screens.length >= 10}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Screen
                                </Button>
                            </div>

                            {flowJson.screens.map((screen, idx) => (
                                <ScreenEditor
                                    key={screen.id + idx}
                                    screen={screen}
                                    onChange={(s) => updateScreen(idx, s)}
                                    onDelete={() => deleteScreen(idx)}
                                    isFirst={idx === 0}
                                    allScreenIds={allScreenIds}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Right: Preview + JSON */}
                    <div className="space-y-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="w-full">
                                <TabsTrigger value="preview" className="flex-1">
                                    <Eye className="w-4 h-4 mr-1" />
                                    Preview
                                </TabsTrigger>
                                <TabsTrigger value="json" className="flex-1">
                                    <FileText className="w-4 h-4 mr-1" />
                                    JSON
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="preview" className="mt-4">
                                <FlowPreview flowJson={flowJson} />
                            </TabsContent>

                            <TabsContent value="json" className="mt-4">
                                <Card>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-[500px]">
                                            <pre className="p-4 text-xs font-mono bg-muted rounded-lg overflow-auto">
                                                {JSON.stringify(flowJson, null, 2)}
                                            </pre>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* Validation Summary */}
                        {validation && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Validation</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Screens</span>
                                        <span className="font-mono">{validation.screen_count}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Components</span>
                                        <span className="font-mono">{validation.component_count}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Status</span>
                                        <Badge variant={validation.valid ? 'default' : 'destructive'}>
                                            {validation.valid ? 'Ready' : 'Fix Errors'}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FlowBuilder;
