/**
 * Flow Templates
 * ==============
 * Pre-built, Meta-compliant flow templates.
 * Users start here for 80% of use cases.
 */

import type { FlowTemplate, Step } from './types';

// Generate unique ID (self-contained to avoid circular import)
let idCounter = 0;
const generateId = (): string => {
  idCounter++;
  return `${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
};

// Generate steps with IDs for templates
const createTemplateSteps = (steps: Omit<Step, 'id'>[]): Step[] => {
  return steps.map(step => ({
    ...step,
    id: generateId(),
    fields: step.fields.map(field => ({
      ...field,
      id: generateId()
    }))
  }));
};

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'leads',
    name: 'Lead Capture',
    description: 'Collect contact information from interested customers',
    icon: '👤',
    category: 'leads',
    steps: [
      {
        title: 'Welcome',
        message: "Hi! 👋 We'd love to know more about you.",
        fields: [
          { id: '', type: 'text', label: 'Full Name', required: true }
        ],
        button: { label: 'Continue →', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Contact Info',
        message: 'How can we reach you?',
        fields: [
          { id: '', type: 'email', label: 'Email Address', required: true },
          { id: '', type: 'phone', label: 'Phone Number', required: false }
        ],
        button: { label: 'Submit', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Thank You! ✨',
        message: "Thanks for your interest! We'll be in touch soon.",
        fields: [],
        button: { label: 'Done', goesToStepId: null },
        isFinal: true
      }
    ]
  },
  {
    id: 'booking',
    name: 'Appointment Booking',
    description: 'Let customers book appointments or consultations',
    icon: '📅',
    category: 'booking',
    steps: [
      {
        title: 'Book Appointment',
        message: "Let's schedule your visit! 📆",
        fields: [
          { id: '', type: 'text', label: 'Your Name', required: true },
          { 
            id: '', 
            type: 'dropdown', 
            label: 'Service Type', 
            required: true,
            options: ['Consultation', 'Follow-up', 'New Service', 'Other']
          }
        ],
        button: { label: 'Next →', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Select Date & Time',
        message: 'When would you like to visit?',
        fields: [
          { id: '', type: 'date', label: 'Preferred Date', required: true },
          {
            id: '',
            type: 'radio',
            label: 'Preferred Time',
            required: true,
            options: ['Morning (9-12)', 'Afternoon (12-5)', 'Evening (5-8)']
          }
        ],
        button: { label: 'Confirm Booking', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Booking Confirmed! 🎉',
        message: "You're all set! We'll send you a reminder before your appointment.",
        fields: [],
        button: { label: 'Done', goesToStepId: null },
        isFinal: true
      }
    ]
  },
  {
    id: 'feedback',
    name: 'Customer Feedback',
    description: 'Collect ratings and feedback from customers',
    icon: '⭐',
    category: 'feedback',
    steps: [
      {
        title: 'Your Feedback',
        message: 'We value your opinion! How was your experience?',
        fields: [
          {
            id: '',
            type: 'radio',
            label: 'Overall Rating',
            required: true,
            options: ['⭐ Poor', '⭐⭐ Fair', '⭐⭐⭐ Good', '⭐⭐⭐⭐ Very Good', '⭐⭐⭐⭐⭐ Excellent']
          }
        ],
        button: { label: 'Continue →', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Tell Us More',
        message: 'Any additional feedback?',
        fields: [
          { id: '', type: 'textarea', label: 'Your Comments', placeholder: 'What did you like? What can we improve?', required: false }
        ],
        button: { label: 'Submit Feedback', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Thank You! 💝',
        message: 'Your feedback helps us serve you better. Thank you!',
        fields: [],
        button: { label: 'Done', goesToStepId: null },
        isFinal: true
      }
    ]
  },
  {
    id: 'support',
    name: 'Support Request',
    description: 'Help customers report issues or ask questions',
    icon: '🎫',
    category: 'support',
    steps: [
      {
        title: 'How Can We Help?',
        message: "We're here to help! 🤝",
        fields: [
          { id: '', type: 'text', label: 'Your Name', required: true },
          {
            id: '',
            type: 'dropdown',
            label: 'Issue Type',
            required: true,
            options: ['Order Issue', 'Technical Problem', 'Billing Question', 'General Inquiry', 'Other']
          }
        ],
        button: { label: 'Next →', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Describe Your Issue',
        message: 'Please provide details so we can help you faster.',
        fields: [
          { id: '', type: 'textarea', label: 'Description', placeholder: 'Please describe your issue...', required: true },
          { id: '', type: 'email', label: 'Email for Follow-up', required: true }
        ],
        button: { label: 'Submit Request', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Request Submitted! 📬',
        message: "We've received your request. Our team will get back to you within 24 hours.",
        fields: [],
        button: { label: 'Done', goesToStepId: null },
        isFinal: true
      }
    ]
  },
  {
    id: 'custom',
    name: 'Start from Scratch',
    description: 'Create your own custom flow',
    icon: '🎨',
    category: 'custom',
    steps: [
      {
        title: 'Welcome',
        message: 'Enter your message here...',
        fields: [],
        button: { label: 'Continue →', goesToStepId: null },
        isFinal: false
      },
      {
        title: 'Thank You',
        message: 'Your completion message...',
        fields: [],
        button: { label: 'Done', goesToStepId: null },
        isFinal: true
      }
    ]
  }
];

export const getTemplateById = (id: string): FlowTemplate | undefined => {
  return FLOW_TEMPLATES.find(t => t.id === id);
};

export const createFlowFromTemplate = (templateId: string): Step[] => {
  const template = getTemplateById(templateId);
  if (!template) {
    // Default to custom template
    return createTemplateSteps(FLOW_TEMPLATES[FLOW_TEMPLATES.length - 1].steps);
  }
  return createTemplateSteps(template.steps);
};

export default FLOW_TEMPLATES;
