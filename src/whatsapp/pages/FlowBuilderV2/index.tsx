/**
 * FlowBuilderV2 - Main Component
 * ==============================
 * The next-generation WhatsApp Flow Builder.
 * 
 * Features:
 * - Templates-first approach
 * - Visual canvas with step cards
 * - Drag & drop fields
 * - Real-time preview
 * - Zero JSON exposure
 * - Auto-routing
 * - Inline validation
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  EyeOff,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Pencil
} from 'lucide-react';
import { API_BASE_URL } from '@/config';

import { StepCard } from './StepCard';
import { BlockPalette, BlockPaletteHorizontal } from './BlockPalette';
import { LivePreview } from './LivePreview';
import { TemplateSelector } from './TemplateSelector';
import { createFlowFromTemplate, FLOW_TEMPLATES } from './templates';
import {
  generateId,
  createDefaultStep,
  createDefaultField,
  validateFlow,
  hasErrors,
  autoFixIssues,
  visualToMetaJSON,
  metaJSONToVisual
} from './utils';
import type {
  FlowBuilderState,
  Step,
  Field,
  FieldType,
  ValidationHint
} from './types';
import { cn } from '@/lib/utils';

const API_BASE = API_BASE_URL;

// =============================================================================
// Main Component
// =============================================================================

export function FlowBuilderV2() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const templateParam = searchParams.get('template');

  // ==========================================================================
  // STATE
  // ==========================================================================

  // Flow state
  const [state, setState] = useState<FlowBuilderState>({
    name: '',
    category: 'custom',
    steps: [],
    selectedStepId: null,
    isDirty: false,
    status: 'draft'
  });

  // UI state
  const [view, setView] = useState<'template-select' | 'builder'>('builder');
  const [showPreview, setShowPreview] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validationHints, setValidationHints] = useState<ValidationHint[]>([]);

  // Drag & drop state for steps
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null);

  // Account state
  const [accountId, setAccountId] = useState<number | null>(null);
  const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id') ||
    sessionStorage.getItem('sv_whatsapp_workspace_id');

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  // Fetch WhatsApp account
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

  // Load existing flow if editing
  useEffect(() => {
    // Check for flow ID from route param (:id) OR query param (?edit=)
    const editId = searchParams.get('edit');
    const flowIdToLoad = id || editId;

    if (flowIdToLoad) {
      loadFlow(parseInt(flowIdToLoad));
    } else if (templateParam) {
      // Initialize from template param
      initFromTemplate(templateParam);
    } else {
      // Show template selector for new flows
      setView('template-select');
    }
  }, [id, searchParams.get('edit'), templateParam]);

  const loadFlow = async (flowId: number) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/flows/${flowId}`);
      const data = await res.json();

      if (data.success && data.flow) {
        const flow = data.flow;

        // Convert Meta JSON to visual model
        const visualState = metaJSONToVisual(flow.flow_json, {
          id: flow.id,
          name: flow.name,
          category: flow.category,
          status: flow.status,
          meta_flow_id: flow.meta_flow_id,
          account_id: flow.account_id
        });

        setState(visualState);
        setView('builder');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load flow',
        variant: 'destructive'
      });
      navigate('/dashboard/flows');
    } finally {
      setLoading(false);
    }
  };

  const initFromTemplate = (templateId: string) => {
    const template = FLOW_TEMPLATES.find(t => t.id === templateId);
    const steps = createFlowFromTemplate(templateId);

    setState(prev => ({
      ...prev,
      name: template?.name || 'New Flow',
      category: template?.category || 'custom',
      steps,
      isDirty: true
    }));
    setView('builder');
  };

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  // Auto-validate on changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      const hints = validateFlow(state);
      setValidationHints(hints);
    }, 300);
    return () => clearTimeout(timeout);
  }, [state.steps, state.name]);

  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================

  const addStep = (isFinal: boolean = false) => {
    const newStep = createDefaultStep(false, isFinal);

    // If adding final step, update previous final steps
    let updatedSteps = state.steps.map(s => ({
      ...s,
      isFinal: isFinal ? false : s.isFinal
    }));

    // Add new step
    updatedSteps = [...updatedSteps, newStep];

    setState(prev => ({
      ...prev,
      steps: updatedSteps,
      selectedStepId: newStep.id,
      isDirty: true
    }));
  };

  const updateStep = (stepId: string, updates: Partial<Step>) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(s =>
        s.id === stepId ? { ...s, ...updates } : s
      ),
      isDirty: true
    }));
  };

  const deleteStep = (stepId: string) => {
    const stepIndex = state.steps.findIndex(s => s.id === stepId);
    const step = state.steps[stepIndex];

    // Don't delete if it's the only step
    if (state.steps.length <= 1) {
      toast({
        title: 'Cannot delete',
        description: 'Flow needs at least one step',
        variant: 'destructive'
      });
      return;
    }

    // If deleting final step, mark previous as final
    let updatedSteps = state.steps.filter(s => s.id !== stepId);
    if (step.isFinal && updatedSteps.length > 0) {
      updatedSteps[updatedSteps.length - 1].isFinal = true;
    }

    setState(prev => ({
      ...prev,
      steps: updatedSteps,
      selectedStepId: prev.selectedStepId === stepId
        ? (updatedSteps[0]?.id || null)
        : prev.selectedStepId,
      isDirty: true
    }));

    toast({
      title: 'Step deleted',
      description: 'Undo not available yet',
    });
  };

  const duplicateStep = (stepId: string) => {
    const step = state.steps.find(s => s.id === stepId);
    if (!step) return;

    const newStep: Step = {
      ...step,
      id: generateId(),
      title: `${step.title} (copy)`,
      isFinal: false, // Duplicated step is not final
      fields: step.fields.map(f => ({ ...f, id: generateId() }))
    };

    const stepIndex = state.steps.findIndex(s => s.id === stepId);
    const newSteps = [
      ...state.steps.slice(0, stepIndex + 1),
      newStep,
      ...state.steps.slice(stepIndex + 1)
    ];

    setState(prev => ({
      ...prev,
      steps: newSteps,
      selectedStepId: newStep.id,
      isDirty: true
    }));
  };

  const addFieldToStep = (stepId: string, field: Field) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(s =>
        s.id === stepId
          ? { ...s, fields: [...s.fields, field] }
          : s
      ),
      isDirty: true
    }));
  };

  // ==========================================================================
  // DRAG & DROP HANDLERS
  // ==========================================================================

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropOnStep = (e: React.DragEvent, stepId: string) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData('field-type') as FieldType;
    if (fieldType) {
      const newField = createDefaultField(fieldType);
      addFieldToStep(stepId, newField);
    }
  };

  // ==========================================================================
  // STEP DRAG & DROP (REORDERING)
  // ==========================================================================

  const handleStepDragStart = (e: React.DragEvent, stepId: string) => {
    e.dataTransfer.setData('step-id', stepId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedStepId(stepId);

    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleStepDragEnd = (e: React.DragEvent) => {
    setDraggedStepId(null);
    setDragOverStepId(null);
    setDragPosition(null);

    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleStepDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Only handle if we're dragging a step
    if (!draggedStepId || draggedStepId === stepId) {
      setDragOverStepId(null);
      setDragPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    setDragOverStepId(stepId);
    setDragPosition(position);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleStepDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the actual element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStepId(null);
      setDragPosition(null);
    }
  };

  const handleStepDrop = (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedId = e.dataTransfer.getData('step-id');
    if (!draggedId || draggedId === targetStepId) {
      setDraggedStepId(null);
      setDragOverStepId(null);
      setDragPosition(null);
      return;
    }

    // Find indices
    const draggedIndex = state.steps.findIndex(s => s.id === draggedId);
    const targetIndex = state.steps.findIndex(s => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Calculate new position
    let newIndex = dragPosition === 'above' ? targetIndex : targetIndex + 1;

    // Adjust if dragging from above the target
    if (draggedIndex < newIndex) {
      newIndex--;
    }

    // Reorder steps
    const newSteps = [...state.steps];
    const [removed] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(newIndex, 0, removed);

    // Update state
    setState(prev => ({
      ...prev,
      steps: newSteps,
      isDirty: true
    }));

    // Clear drag state
    setDraggedStepId(null);
    setDragOverStepId(null);
    setDragPosition(null);

    toast({
      title: 'Step moved',
      description: `"${removed.title}" moved to position ${newIndex + 1}`
    });
  };

  // ==========================================================================
  // SAVE & PUBLISH
  // ==========================================================================

  const saveDraft = async () => {
    if (!state.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a flow name',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      // Convert visual model to Meta JSON (screen IDs sanitized for Meta)
      const { flowJson, entryScreenId } = visualToMetaJSON(state);

      const payload = {
        account_id: accountId,
        name: state.name,
        category: state.category.toUpperCase(),
        flow_json: flowJson,
        entry_screen_id: entryScreenId
      };

      const url = state.id
        ? `${API_BASE}/api/whatsapp/flows/${state.id}`
        : `${API_BASE}/api/whatsapp/flows`;
      const method = state.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          id: data.flow.id,
          isDirty: false
        }));

        toast({
          title: 'Saved!',
          description: 'Flow saved as draft'
        });

        // Update URL if new flow
        if (!state.id && data.flow.id) {
          navigate(`/dashboard/flows/${data.flow.id}/edit`, { replace: true });
        }
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const publishFlow = async () => {
    // Validate first
    const hints = validateFlow(state);
    if (hasErrors(hints)) {
      toast({
        title: 'Cannot publish',
        description: 'Please fix the issues first',
        variant: 'destructive'
      });
      return;
    }

    // Save first if dirty
    if (state.isDirty || !state.id) {
      await saveDraft();
    }

    if (!state.id) {
      toast({
        title: 'Save required',
        description: 'Please save the flow first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setPublishing(true);

      const res = await fetch(`${API_BASE}/api/whatsapp/flows/${state.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          status: 'published',
          metaFlowId: data.flow.meta_flow_id
        }));

        toast({
          title: 'Published! 🎉',
          description: 'Your flow is now live on WhatsApp'
        });

        // Redirect to flows list
        setTimeout(() => {
          navigate('/dashboard/flows');
        }, 1500);
      } else {
        throw new Error(data.error || 'Publish failed');
      }
    } catch (err: any) {
      toast({
        title: 'Publish failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive'
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleAutoFix = () => {
    const fixed = autoFixIssues(state);
    setState(fixed);
    toast({
      title: 'Issues fixed',
      description: 'Automatic fixes applied'
    });
  };

  // ==========================================================================
  // RENDER: TEMPLATE SELECTOR
  // ==========================================================================

  if (view === 'template-select') {
    return (
      <TemplateSelector
        onSelectTemplate={initFromTemplate}
        onBack={() => navigate('/dashboard/flows')}
      />
    );
  }

  // ==========================================================================
  // RENDER: LOADING STATE
  // ==========================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  // ==========================================================================
  // RENDER: BUILDER
  // ==========================================================================

  const errorCount = validationHints.filter(h => h.type === 'error').length;
  const warningCount = validationHints.filter(h => h.type === 'warning').length;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/flows')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Flows
          </Button>

          {/* Flow Name */}
          <div className="flex items-center gap-2">
            <Input
              value={state.name}
              onChange={(e) => setState(prev => ({ ...prev, name: e.target.value, isDirty: true }))}
              className="w-48 h-8 font-medium border-0 hover:bg-gray-100 focus-visible:ring-1"
              placeholder="Flow name..."
            />
            <Pencil className="w-3 h-3 text-gray-400" />
          </div>

          {/* Status Badge */}
          {state.status === 'published' && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              Published
            </Badge>
          )}
          {state.isDirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Unsaved
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Validation Status */}
          {errorCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {errorCount} issue{errorCount > 1 ? 's' : ''}
            </Badge>
          )}
          {errorCount === 0 && warningCount === 0 && state.steps.length > 0 && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
              <CheckCircle className="w-3 h-3" />
              Ready
            </Badge>
          )}

          {/* Preview Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="hidden md:flex"
          >
            {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            Preview
          </Button>

          {/* Save */}
          <Button
            variant="outline"
            size="sm"
            onClick={saveDraft}
            disabled={saving || !state.isDirty}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>

          {/* Publish */}
          <Button
            size="sm"
            onClick={publishFlow}
            disabled={publishing || errorCount > 0 || state.status === 'published'}
            className="bg-green-600 hover:bg-green-700"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Publish
          </Button>
        </div>
      </header>

      {/* ================================================================== */}
      {/* MAIN CONTENT */}
      {/* ================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Block Palette (Desktop) */}
        <BlockPalette
          className="hidden md:flex w-14"
          onBlockClick={(type) => {
            const selectedStep = state.steps.find(s => s.id === state.selectedStepId);
            if (selectedStep && !selectedStep.isFinal) {
              addFieldToStep(selectedStep.id, createDefaultField(type));
            } else {
              toast({
                title: 'Select a step',
                description: 'Click on a step first to add fields',
              });
            }
          }}
        />

        {/* Canvas */}
        <div
          className="flex-1 overflow-auto p-6"
          onClick={() => setState(prev => ({ ...prev, selectedStepId: null }))}
          onDragOver={handleDragOver}
        >
          <div className="max-w-md mx-auto space-y-10">
            {/* Steps */}
            {state.steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "relative transition-all duration-200",
                  draggedStepId === step.id && "opacity-50 scale-95"
                )}
                draggable
                onDragStart={(e) => handleStepDragStart(e, step.id)}
                onDragEnd={handleStepDragEnd}
                onDragOver={(e) => {
                  // Handle both field drops and step reordering
                  handleDragOver(e);
                  handleStepDragOver(e, step.id);
                }}
                onDragLeave={handleStepDragLeave}
                onDrop={(e) => {
                  // Check if it's a step being dropped
                  const stepId = e.dataTransfer.getData('step-id');
                  if (stepId) {
                    handleStepDrop(e, step.id);
                  } else {
                    handleDropOnStep(e, step.id);
                  }
                }}
              >
                {/* Drop indicator - above */}
                {dragOverStepId === step.id && dragPosition === 'above' && draggedStepId !== step.id && (
                  <div className="absolute -top-5 left-0 right-0 h-2 bg-green-500 rounded-full animate-pulse" />
                )}

                <StepCard
                  step={step}
                  isSelected={state.selectedStepId === step.id}
                  isFirst={index === 0}
                  allSteps={state.steps}
                  showConnector={index < state.steps.length - 1}
                  onSelect={() => setState(prev => ({ ...prev, selectedStepId: step.id }))}
                  onUpdate={(updated) => updateStep(step.id, updated)}
                  onDelete={() => deleteStep(step.id)}
                  onDuplicate={() => duplicateStep(step.id)}
                  onAddField={(field) => addFieldToStep(step.id, field)}
                />

                {/* Drop indicator - below */}
                {dragOverStepId === step.id && dragPosition === 'below' && draggedStepId !== step.id && (
                  <div className="absolute -bottom-5 left-0 right-0 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            ))}

            {/* Add Step Button */}
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addStep(false)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </Button>
              {!state.steps.some(s => s.isFinal) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addStep(true)}
                  className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Add Final Step
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview (Desktop) */}
        {showPreview && (
          <div className="hidden md:block w-[320px] border-l bg-gray-100">
            <LivePreview
              steps={state.steps}
              businessName="Your Business"
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Block Palette (Mobile) */}
      <BlockPaletteHorizontal
        className="md:hidden"
        onBlockClick={(type) => {
          const selectedStep = state.steps.find(s => s.id === state.selectedStepId);
          if (selectedStep && !selectedStep.isFinal) {
            addFieldToStep(selectedStep.id, createDefaultField(type));
          }
        }}
      />

      {/* Validation Hints */}
      {validationHints.length > 0 && (
        <div className="border-t bg-white p-3">
          <div className="max-w-3xl mx-auto">
            {errorCount > 0 && (
              <Alert variant="destructive" className="mb-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    {validationHints.find(h => h.type === 'error')?.message}
                  </span>
                  {validationHints.some(h => h.autoFixable) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoFix}
                      className="ml-4"
                    >
                      Fix automatically
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FlowBuilderV2;
