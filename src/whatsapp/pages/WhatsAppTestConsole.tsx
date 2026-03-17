// WhatsApp Test Console
// ======================
// Internal developer tool for testing WhatsApp Cloud API

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Send, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  TokenConfigPanel,
  MessageTargetForm,
  MessageTypeTabs,
  TextComposer,
  TemplateComposer,
  MediaComposer,
  InteractiveComposer,
  ApiResponseViewer,
} from '../components';

import {
  sendTextMessage,
  sendTemplateMessage,
  sendTemplateAdvanced,
  sendMediaMessage,
  sendInteractiveMessage,
} from '../api';

import type {
  WhatsAppConfig,
  MessageType,
  MediaType,
  InteractiveType,
  WhatsAppApiResponse,
  InteractiveButton,
  ListSection,
} from '../types';

interface BodyVariable {
  key: string;
  value: string;
}

export default function WhatsAppTestConsole() {
  // Config state
  const [config, setConfig] = useState<WhatsAppConfig>({
    accessToken: '',
    phoneNumberId: '',
    wabaId: '',
    apiVersion: 'v22.0',
  });

  // Message target
  const [toNumber, setToNumber] = useState('');

  // Message type
  const [messageType, setMessageType] = useState<MessageType>('text');

  // Text message state
  const [textContent, setTextContent] = useState('');
  const [previewUrl, setPreviewUrl] = useState(false);

  // Template message state
  const [templateName, setTemplateName] = useState('hello_world');
  const [templateLanguage, setTemplateLanguage] = useState('en_US');
  const [headerType, setHeaderType] = useState<'none' | 'text' | 'image'>('none');
  const [headerValue, setHeaderValue] = useState('');
  const [bodyVariables, setBodyVariables] = useState<BodyVariable[]>([]);

  // Media message state
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');

  // Interactive message state
  const [interactiveType, setInteractiveType] = useState<InteractiveType>('button');
  const [interactiveHeader, setInteractiveHeader] = useState('');
  const [interactiveBody, setInteractiveBody] = useState('');
  const [interactiveFooter, setInteractiveFooter] = useState('');
  const [interactiveButtons, setInteractiveButtons] = useState<InteractiveButton[]>([]);
  const [interactiveSections, setInteractiveSections] = useState<ListSection[]>([]);

  // API response state
  const [response, setResponse] = useState<WhatsAppApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [timestamp, setTimestamp] = useState<string | undefined>();

  // Validation
  const canSend = () => {
    if (!config.accessToken || !config.phoneNumberId || !toNumber) {
      return false;
    }

    switch (messageType) {
      case 'text':
        return textContent.trim().length > 0;
      case 'template':
        return templateName.trim().length > 0;
      case 'media':
        return mediaUrl.trim().length > 0;
      case 'interactive':
        return interactiveBody.trim().length > 0 && 
          (interactiveType === 'button' ? interactiveButtons.length > 0 : interactiveSections.length > 0);
      default:
        return false;
    }
  };

  // Send message handler
  const handleSend = async () => {
    if (!canSend()) return;

    setIsLoading(true);
    setResponse(null);
    setHttpStatus(undefined);

    try {
      let result: WhatsAppApiResponse;

      switch (messageType) {
        case 'text':
          result = await sendTextMessage(config.accessToken, {
            to: toNumber,
            text: textContent,
            preview_url: previewUrl,
          });
          break;

        case 'template': {
          const params = bodyVariables.map(v => v.value).filter(v => v);
          const hasImageHeader = headerType === 'image' && headerValue;
          
          // Use advanced endpoint if we have image header, otherwise use simple endpoint
          if (hasImageHeader) {
            result = await sendTemplateAdvanced(config.accessToken, {
              to: toNumber,
              template_name: templateName,
              language: templateLanguage,
              header_image_url: headerValue,
              body_params: params.length > 0 ? params : undefined,
            });
          } else {
            result = await sendTemplateMessage(config.accessToken, {
              to: toNumber,
              template_name: templateName,
              language: templateLanguage,
              params: params.length > 0 ? params : undefined,
            });
          }
          break;
        }

        case 'media':
          result = await sendMediaMessage(config.accessToken, {
            to: toNumber,
            media_type: mediaType,
            media_url: mediaUrl,
            caption: mediaCaption || undefined,
            filename: mediaFilename || undefined,
          });
          break;

        case 'interactive':
          result = await sendInteractiveMessage(config.accessToken, {
            to: toNumber,
            interactive: {
              type: interactiveType,
              body: interactiveBody,
              header: interactiveHeader || undefined,
              footer: interactiveFooter || undefined,
              buttons: interactiveType === 'button' ? interactiveButtons : undefined,
              button: interactiveType === 'list' ? 'View Options' : undefined,
              sections: interactiveType === 'list' ? interactiveSections : undefined,
            },
          });
          break;

        default:
          result = { success: false, error: 'Unknown message type' };
      }

      setResponse(result);
      setHttpStatus(result.success ? 200 : 400);
      setTimestamp(new Date().toLocaleTimeString());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setResponse({
        success: false,
        error: errorMessage,
      });
      setHttpStatus(0);
      setTimestamp(new Date().toLocaleTimeString());
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setTextContent('');
    setPreviewUrl(false);
    setTemplateName('hello_world');
    setTemplateLanguage('en_US');
    setHeaderType('none');
    setHeaderValue('');
    setBodyVariables([]);
    setMediaUrl('');
    setMediaCaption('');
    setMediaFilename('');
    setInteractiveHeader('');
    setInteractiveBody('');
    setInteractiveFooter('');
    setInteractiveButtons([]);
    setInteractiveSections([]);
    setResponse(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">WhatsApp Test Console</h1>
                <p className="text-sm text-muted-foreground">
                  Internal tool for testing WhatsApp Cloud API
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Form
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Configuration & Composer */}
          <div className="space-y-6">
            {/* Section 1: Auth Config */}
            <TokenConfigPanel config={config} onConfigChange={setConfig} />

            {/* Section 2: Message Target */}
            <MessageTargetForm
              phoneNumberId={config.phoneNumberId}
              toNumber={toNumber}
              onToNumberChange={setToNumber}
            />

            {/* Section 3: Message Type */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">✉️ Message Type</CardTitle>
              </CardHeader>
              <CardContent>
                <MessageTypeTabs value={messageType} onChange={setMessageType} />
              </CardContent>
            </Card>

            {/* Section 4: Message Composer (dynamic based on type) */}
            {messageType === 'text' && (
              <TextComposer
                text={textContent}
                previewUrl={previewUrl}
                onTextChange={setTextContent}
                onPreviewUrlChange={setPreviewUrl}
              />
            )}

            {messageType === 'template' && (
              <TemplateComposer
                templateName={templateName}
                language={templateLanguage}
                headerType={headerType}
                headerValue={headerValue}
                bodyVariables={bodyVariables}
                onTemplateNameChange={setTemplateName}
                onLanguageChange={setTemplateLanguage}
                onHeaderTypeChange={setHeaderType}
                onHeaderValueChange={setHeaderValue}
                onBodyVariablesChange={setBodyVariables}
              />
            )}

            {messageType === 'media' && (
              <MediaComposer
                mediaType={mediaType}
                mediaUrl={mediaUrl}
                caption={mediaCaption}
                filename={mediaFilename}
                onMediaTypeChange={setMediaType}
                onMediaUrlChange={setMediaUrl}
                onCaptionChange={setMediaCaption}
                onFilenameChange={setMediaFilename}
              />
            )}

            {messageType === 'interactive' && (
              <InteractiveComposer
                interactiveType={interactiveType}
                headerText={interactiveHeader}
                bodyText={interactiveBody}
                footerText={interactiveFooter}
                buttons={interactiveButtons}
                sections={interactiveSections}
                onInteractiveTypeChange={setInteractiveType}
                onHeaderTextChange={setInteractiveHeader}
                onBodyTextChange={setInteractiveBody}
                onFooterTextChange={setInteractiveFooter}
                onButtonsChange={setInteractiveButtons}
                onSectionsChange={setInteractiveSections}
              />
            )}

            {/* Section 5: Send Action */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  onClick={handleSend}
                  disabled={!canSend() || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
                
                {!canSend() && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {!config.accessToken ? 'Missing access token' :
                     !config.phoneNumberId ? 'Missing phone number ID' :
                     !toNumber ? 'Missing recipient number' :
                     'Complete the form to send'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - Response Viewer */}
          <div className="space-y-6">
            {/* Section 6: API Response */}
            <ApiResponseViewer
              response={response}
              httpStatus={httpStatus}
              isLoading={isLoading}
              timestamp={timestamp}
            />

            {/* Quick reference */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">📚 Quick Reference</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-4">
                <div>
                  <h4 className="font-medium mb-1">Test Template</h4>
                  <code className="text-xs bg-muted px-2 py-1 rounded">hello_world</code>
                  <span className="text-muted-foreground text-xs ml-2">Pre-approved for testing</span>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-1">Common Issues</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• <strong>wamid received but not delivered?</strong> Token may lack permissions</li>
                    <li>• <strong>Template not found?</strong> Check exact name and language code</li>
                    <li>• <strong>Text message failed?</strong> User must message first (24h window)</li>
                    <li>• <strong>Error 10?</strong> Token missing <code>whatsapp_business_messaging</code> permission</li>
                  </ul>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-1">API Endpoints</h4>
                  <ul className="text-xs font-mono text-muted-foreground space-y-1">
                    <li>POST /api/whatsapp/send/text</li>
                    <li>POST /api/whatsapp/send/template</li>
                    <li>POST /api/whatsapp/send/media</li>
                    <li>POST /api/whatsapp/send/interactive</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
