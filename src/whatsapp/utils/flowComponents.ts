/**
 * Flow Components Library - Phase 6: UX Best Practices
 * =====================================================
 * 
 * Pre-built, tested flow component templates following Meta's UX guidelines.
 * Designed to reduce drop-off and improve completion rates.
 * 
 * Usage:
 *   import { leadCaptureComponents, surveyComponents } from './flowComponents';
 *   const screen = createScreenWithComponents('WELCOME', 'Welcome', leadCaptureComponents.nameField);
 */

// =============================================================================
// UX BEST PRACTICES - Drop-off Reduction Guidelines
// =============================================================================

/**
 * GOLDEN RULES FOR HIGH-COMPLETION FLOWS:
 * 
 * 1. KEEP IT SHORT
 *    - Max 5 screens for optimal completion
 *    - 3-4 input fields per screen maximum
 *    - Total flow should complete in < 2 minutes
 * 
 * 2. CLEAR PROGRESS INDICATION
 *    - Use screen titles like "Step 1 of 3"
 *    - Include progress indicators in headers
 *    - Show estimated time remaining
 * 
 * 3. SMART FIELD ORDERING
 *    - Start with easy fields (name, selection)
 *    - Put sensitive fields later (phone, email)
 *    - End with optional feedback/comments
 * 
 * 4. VALIDATION & ERROR HANDLING
 *    - Use input-type for automatic validation
 *    - Provide clear error messages
 *    - Don't block progress on optional fields
 * 
 * 5. MOBILE-FIRST DESIGN
 *    - Large touch targets (min 48px)
 *    - Avoid horizontal scrolling
 *    - Use native input types (date, phone)
 * 
 * 6. REDUCE COGNITIVE LOAD
 *    - One question/topic per screen
 *    - Use familiar patterns (dropdown vs. radio)
 *    - Provide default values where possible
 */

// =============================================================================
// COMPONENT TEMPLATES
// =============================================================================

export interface FlowComponent {
    type: string;
    [key: string]: any;
}

export interface ScreenTemplate {
    title: string;
    components: FlowComponent[];
    terminal?: boolean;
}

// -----------------------------------------------------------------------------
// HEADER COMPONENTS
// -----------------------------------------------------------------------------

export const headerComponents = {
    /** Simple text heading */
    heading: (text: string): FlowComponent => ({
        type: 'TextHeading',
        text
    }),

    /** Subheading with icon emoji for visual interest */
    subheadingWithEmoji: (emoji: string, text: string): FlowComponent => ({
        type: 'TextSubheading',
        text: `${emoji} ${text}`
    }),

    /** Progress indicator heading */
    progressHeading: (step: number, total: number, text: string): FlowComponent => ({
        type: 'TextHeading',
        text: `Step ${step} of ${total}: ${text}`
    }),
};

// -----------------------------------------------------------------------------
// INPUT FIELD COMPONENTS
// -----------------------------------------------------------------------------

export const inputComponents = {
    /** Name field - Required, text type */
    nameField: (options?: { required?: boolean; label?: string }): FlowComponent => ({
        type: 'TextInput',
        name: 'full_name',
        label: options?.label || 'Your Name',
        'input-type': 'text',
        required: options?.required ?? true,
        'helper-text': 'Enter your full name'
    }),

    /** First name field */
    firstNameField: (): FlowComponent => ({
        type: 'TextInput',
        name: 'first_name',
        label: 'First Name',
        'input-type': 'text',
        required: true
    }),

    /** Last name field */
    lastNameField: (): FlowComponent => ({
        type: 'TextInput',
        name: 'last_name',
        label: 'Last Name',
        'input-type': 'text',
        required: true
    }),

    /** Email field with validation */
    emailField: (options?: { required?: boolean }): FlowComponent => ({
        type: 'TextInput',
        name: 'email',
        label: 'Email Address',
        'input-type': 'email',
        required: options?.required ?? true,
        'helper-text': 'We\'ll send confirmation here'
    }),

    /** Phone field with native keyboard */
    phoneField: (options?: { required?: boolean }): FlowComponent => ({
        type: 'TextInput',
        name: 'phone',
        label: 'Phone Number',
        'input-type': 'phone',
        required: options?.required ?? true,
        'helper-text': 'Include country code'
    }),

    /** Message/feedback textarea */
    messageField: (options?: { label?: string; required?: boolean }): FlowComponent => ({
        type: 'TextArea',
        name: 'message',
        label: options?.label || 'Your Message',
        required: options?.required ?? false,
        'max-length': 500
    }),

    /** Date picker */
    dateField: (name: string, label: string): FlowComponent => ({
        type: 'DatePicker',
        name,
        label,
        required: true,
        'min-date': new Date().toISOString().split('T')[0],
        'unavailable-dates': []
    }),
};

// -----------------------------------------------------------------------------
// SELECTION COMPONENTS
// -----------------------------------------------------------------------------

export const selectionComponents = {
    /** Simple dropdown */
    dropdown: (name: string, label: string, options: Array<{ id: string; title: string }>): FlowComponent => ({
        type: 'Dropdown',
        name,
        label,
        required: true,
        'data-source': options
    }),

    /** Radio buttons for single choice (< 5 options) */
    radioButtons: (name: string, label: string, options: Array<{ id: string; title: string }>): FlowComponent => ({
        type: 'RadioButtonsGroup',
        name,
        label,
        required: true,
        'data-source': options
    }),

    /** Checkboxes for multi-select */
    checkboxGroup: (name: string, label: string, options: Array<{ id: string; title: string }>): FlowComponent => ({
        type: 'CheckboxGroup',
        name,
        label,
        required: false,
        'data-source': options,
        'min-selected-items': 0,
        'max-selected-items': options.length
    }),

    /** Rating scale (1-5 stars) */
    ratingScale: (name: string, label: string): FlowComponent => ({
        type: 'RadioButtonsGroup',
        name,
        label,
        required: true,
        'data-source': [
            { id: '1', title: '⭐ Poor' },
            { id: '2', title: '⭐⭐ Fair' },
            { id: '3', title: '⭐⭐⭐ Good' },
            { id: '4', title: '⭐⭐⭐⭐ Very Good' },
            { id: '5', title: '⭐⭐⭐⭐⭐ Excellent' },
        ]
    }),

    /** Yes/No choice */
    yesNoChoice: (name: string, question: string): FlowComponent => ({
        type: 'RadioButtonsGroup',
        name,
        label: question,
        required: true,
        'data-source': [
            { id: 'yes', title: 'Yes' },
            { id: 'no', title: 'No' },
        ]
    }),
};

// -----------------------------------------------------------------------------
// FOOTER/ACTION COMPONENTS
// -----------------------------------------------------------------------------

export const actionComponents = {
    /** Continue to next screen */
    continueButton: (nextScreen: string, label?: string): FlowComponent => ({
        type: 'Footer',
        label: label || 'Continue',
        'on-click-action': {
            name: 'navigate',
            next: { type: 'screen', name: nextScreen }
        }
    }),

    /** Submit/complete flow */
    submitButton: (payload: Record<string, string>, label?: string): FlowComponent => ({
        type: 'Footer',
        label: label || 'Submit',
        'on-click-action': {
            name: 'complete',
            payload
        }
    }),

    /** Back button (if needed) */
    backButton: (previousScreen: string): FlowComponent => ({
        type: 'Footer',
        label: '← Back',
        'left-caption': true,
        'on-click-action': {
            name: 'navigate',
            next: { type: 'screen', name: previousScreen }
        }
    }),
};

// -----------------------------------------------------------------------------
// INFO/DISPLAY COMPONENTS
// -----------------------------------------------------------------------------

export const displayComponents = {
    /** Body text paragraph */
    bodyText: (text: string): FlowComponent => ({
        type: 'TextBody',
        text
    }),

    /** Caption/small text */
    caption: (text: string): FlowComponent => ({
        type: 'TextCaption',
        text
    }),

    /** Opt-in checkbox (privacy, terms) */
    optInCheckbox: (name: string, text: string): FlowComponent => ({
        type: 'OptIn',
        name,
        label: text,
        required: true, // Usually required for compliance
    }),
};

// =============================================================================
// PRE-BUILT SCREEN TEMPLATES
// =============================================================================

export const screenTemplates = {
    /** Welcome screen with introduction */
    welcome: (nextScreen: string): ScreenTemplate => ({
        title: 'Welcome',
        components: [
            headerComponents.heading('Welcome! 👋'),
            displayComponents.bodyText('We\'d love to learn more about you. This will only take a minute.'),
            actionComponents.continueButton(nextScreen, 'Get Started'),
        ]
    }),

    /** Basic contact info collection */
    contactInfo: (nextScreen: string): ScreenTemplate => ({
        title: 'Your Details',
        components: [
            headerComponents.progressHeading(1, 3, 'Contact Info'),
            inputComponents.nameField(),
            inputComponents.emailField(),
            inputComponents.phoneField({ required: false }),
            actionComponents.continueButton(nextScreen),
        ]
    }),

    /** Single question with options */
    singleChoice: (question: string, options: Array<{ id: string; title: string }>, nextScreen: string): ScreenTemplate => ({
        title: 'Quick Question',
        components: [
            headerComponents.heading(question),
            selectionComponents.radioButtons('choice', 'Select one:', options),
            actionComponents.continueButton(nextScreen),
        ]
    }),

    /** Feedback/rating screen */
    feedback: (nextScreen: string): ScreenTemplate => ({
        title: 'Feedback',
        components: [
            headerComponents.heading('How was your experience?'),
            selectionComponents.ratingScale('rating', 'Rate your experience'),
            inputComponents.messageField({ label: 'Any comments? (optional)', required: false }),
            actionComponents.continueButton(nextScreen),
        ]
    }),

    /** Thank you / completion screen */
    thankYou: (payload: Record<string, string>): ScreenTemplate => ({
        title: 'Thank You!',
        terminal: true,
        components: [
            headerComponents.heading('Thanks for your response! 🎉'),
            displayComponents.bodyText('We appreciate your time. We\'ll be in touch soon.'),
            actionComponents.submitButton(payload, 'Done'),
        ]
    }),

    /** Appointment booking date selection */
    dateSelection: (nextScreen: string): ScreenTemplate => ({
        title: 'Select Date',
        components: [
            headerComponents.heading('Choose a Date'),
            inputComponents.dateField('appointment_date', 'Preferred Date'),
            actionComponents.continueButton(nextScreen),
        ]
    }),
};

// =============================================================================
// COMPLETE FLOW TEMPLATES
// =============================================================================

export const flowTemplates = {
    /** Lead capture flow (3 screens) */
    leadCapture: {
        version: '5.0',
        screens: [
            {
                id: 'WELCOME',
                title: 'Welcome',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.heading('Get in Touch 📬'),
                        displayComponents.bodyText('Share your details and we\'ll reach out shortly.'),
                        actionComponents.continueButton('CONTACT'),
                    ]
                }
            },
            {
                id: 'CONTACT',
                title: 'Your Details',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.progressHeading(1, 2, 'Contact Info'),
                        inputComponents.nameField(),
                        inputComponents.emailField(),
                        inputComponents.phoneField({ required: false }),
                        actionComponents.continueButton('THANK_YOU'),
                    ]
                }
            },
            {
                id: 'THANK_YOU',
                title: 'Thank You',
                terminal: true,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.heading('Thank You! 🎉'),
                        displayComponents.bodyText('We\'ll contact you within 24 hours.'),
                        actionComponents.submitButton({
                            full_name: '${form.full_name}',
                            email: '${form.email}',
                            phone: '${form.phone}'
                        }),
                    ]
                }
            }
        ],
        routing_model: {}
    },

    /** Customer satisfaction survey (4 screens) */
    customerSurvey: {
        version: '5.0',
        screens: [
            {
                id: 'INTRO',
                title: 'Quick Survey',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.heading('We Value Your Feedback 💬'),
                        displayComponents.bodyText('Help us improve by answering a few quick questions.'),
                        displayComponents.caption('Takes less than 1 minute'),
                        actionComponents.continueButton('RATING'),
                    ]
                }
            },
            {
                id: 'RATING',
                title: 'Your Experience',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.progressHeading(1, 3, 'Rating'),
                        selectionComponents.ratingScale('overall_rating', 'How would you rate your overall experience?'),
                        actionComponents.continueButton('RECOMMEND'),
                    ]
                }
            },
            {
                id: 'RECOMMEND',
                title: 'Recommendation',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.progressHeading(2, 3, 'Recommendation'),
                        selectionComponents.yesNoChoice('would_recommend', 'Would you recommend us to a friend?'),
                        inputComponents.messageField({ label: 'Any additional feedback?', required: false }),
                        actionComponents.continueButton('COMPLETE'),
                    ]
                }
            },
            {
                id: 'COMPLETE',
                title: 'Thank You',
                terminal: true,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.heading('Thanks for Your Feedback! 🙏'),
                        displayComponents.bodyText('Your input helps us serve you better.'),
                        actionComponents.submitButton({
                            overall_rating: '${form.overall_rating}',
                            would_recommend: '${form.would_recommend}',
                            feedback: '${form.message}'
                        }),
                    ]
                }
            }
        ],
        routing_model: {}
    },

    /** Appointment booking (5 screens) */
    appointmentBooking: {
        version: '5.0',
        screens: [
            {
                id: 'START',
                title: 'Book Appointment',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.heading('Schedule Your Visit 📅'),
                        displayComponents.bodyText('Book an appointment in just a few steps.'),
                        actionComponents.continueButton('SERVICE'),
                    ]
                }
            },
            {
                id: 'SERVICE',
                title: 'Select Service',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.progressHeading(1, 4, 'Service'),
                        selectionComponents.dropdown('service', 'What service do you need?', [
                            { id: 'consultation', title: 'Consultation' },
                            { id: 'demo', title: 'Product Demo' },
                            { id: 'support', title: 'Technical Support' },
                            { id: 'other', title: 'Other' },
                        ]),
                        actionComponents.continueButton('DATE'),
                    ]
                }
            },
            {
                id: 'DATE',
                title: 'Select Date',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.progressHeading(2, 4, 'Date & Time'),
                        inputComponents.dateField('appointment_date', 'Preferred Date'),
                        selectionComponents.dropdown('time_slot', 'Preferred Time', [
                            { id: 'morning', title: '9:00 AM - 12:00 PM' },
                            { id: 'afternoon', title: '12:00 PM - 5:00 PM' },
                            { id: 'evening', title: '5:00 PM - 8:00 PM' },
                        ]),
                        actionComponents.continueButton('CONTACT'),
                    ]
                }
            },
            {
                id: 'CONTACT',
                title: 'Your Details',
                terminal: false,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.progressHeading(3, 4, 'Contact'),
                        inputComponents.nameField(),
                        inputComponents.phoneField(),
                        inputComponents.emailField({ required: false }),
                        actionComponents.continueButton('CONFIRM'),
                    ]
                }
            },
            {
                id: 'CONFIRM',
                title: 'Booking Confirmed',
                terminal: true,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        headerComponents.heading('Appointment Booked! ✅'),
                        displayComponents.bodyText('We\'ll send you a confirmation message shortly.'),
                        actionComponents.submitButton({
                            service: '${form.service}',
                            date: '${form.appointment_date}',
                            time_slot: '${form.time_slot}',
                            name: '${form.full_name}',
                            phone: '${form.phone}',
                            email: '${form.email}'
                        }),
                    ]
                }
            }
        ],
        routing_model: {}
    }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a screen from a template
 */
export function createScreen(
    id: string,
    title: string,
    components: FlowComponent[],
    terminal: boolean = false
): object {
    return {
        id,
        title,
        terminal,
        layout: {
            type: 'SingleColumnLayout',
            children: components
        }
    };
}

/**
 * Build a complete flow from screens
 */
export function buildFlow(screens: object[]): object {
    return {
        version: '5.0',
        screens,
        routing_model: {}
    };
}

/**
 * Get a pre-built flow template by category
 */
export function getFlowTemplate(category: 'LEAD_GEN' | 'SURVEY' | 'BOOKING'): object {
    switch (category) {
        case 'LEAD_GEN':
            return flowTemplates.leadCapture;
        case 'SURVEY':
            return flowTemplates.customerSurvey;
        case 'BOOKING':
            return flowTemplates.appointmentBooking;
        default:
            return flowTemplates.leadCapture;
    }
}
