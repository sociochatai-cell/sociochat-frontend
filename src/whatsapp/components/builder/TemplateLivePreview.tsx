// Template Live Preview Component
// ================================
// WhatsApp-style message bubble preview that updates in real-time

import { TemplateState } from '../../utils/templateUtils';
import { Image, Phone, ExternalLink, FileText, Video, MapPin, Workflow, Copy, PhoneCall, Store } from 'lucide-react';

interface TemplateLivePreviewProps {
    state: TemplateState;
}

export function TemplateLivePreview({ state }: TemplateLivePreviewProps) {
    // Replace variables with styled placeholders
    const formatBodyWithVariables = (text: string) => {
        return text.replace(/\{\{(\d+)\}\}/g, (_, num) => {
            return `[Variable ${num}]`;
        });
    };

    // Proxy external images through backend to bypass CORS
    // But base64 data URLs and blob URLs can be used directly
    const getProxiedImageUrl = (url: string) => {
        if (!url) return '';
        // Base64 data URLs and blob URLs don't need proxying
        if (url.startsWith('data:') || url.startsWith('blob:')) {
            return url;
        }
        // Use backend proxy for external URLs
        return `/api/whatsapp/image-proxy?url=${encodeURIComponent(url)}`;
    };

    const hasContent = state.header.type !== 'none' || state.body || state.footer || state.buttons.length > 0;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 rounded-t-lg">
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 text-sm font-medium">U</span>
                </div>
                <div>
                    <p className="font-semibold">User</p>
                    <p className="text-xs opacity-80">Online</p>
                </div>
            </div>

            {/* Chat area with WhatsApp background */}
            <div
                className="flex-1 p-4 overflow-y-auto"
                style={{
                    backgroundColor: '#E5DDD5',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23D8D8D8\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                }}
            >
                {!hasContent ? (
                    // Empty state
                    <div className="flex items-center justify-center h-full">
                        <div className="bg-white/80 rounded-lg px-6 py-4 text-center">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-gray-500 text-sm">Start typing to see your template preview</p>
                        </div>
                    </div>
                ) : (
                    // Message bubble (outgoing style - right aligned, green)
                    <div className="flex justify-end">
                        <div className="max-w-[85%] bg-[#DCF8C6] rounded-lg shadow-sm overflow-hidden">
                            {/* Header */}
                            {state.header.type === 'text' && state.header.text && (
                                <div className="px-3 pt-2 pb-1 font-semibold text-gray-900 border-b border-gray-200/50">
                                    {state.header.text}
                                </div>
                            )}

                            {state.header.type === 'image' && (
                                <div className="bg-gray-200 h-40 flex items-center justify-center relative overflow-hidden">
                                    {state.header.imageUrl ? (
                                        <>
                                            <img
                                                src={getProxiedImageUrl(state.header.imageUrl)}
                                                alt="Header"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const fallback = target.nextElementSibling as HTMLElement;
                                                    if (fallback) fallback.style.display = 'flex';
                                                }}
                                                onLoad={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'block';
                                                    const fallback = target.nextElementSibling as HTMLElement;
                                                    if (fallback) fallback.style.display = 'none';
                                                }}
                                            />
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-1" style={{ display: 'none' }}>
                                                <Image className="w-8 h-8" />
                                                <span className="text-xs">Failed to load image</span>
                                                <span className="text-[10px] max-w-[80%] truncate opacity-60">{state.header.imageUrl}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-gray-400">
                                            <Image className="w-8 h-8" />
                                            <span className="text-xs">Enter image URL</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {state.header.type === 'video' && (
                                <div className="bg-gray-200 h-40 flex items-center justify-center relative overflow-hidden">
                                    <div className="flex flex-col items-center gap-2 text-gray-600">
                                        <Video className="w-8 h-8" />
                                        <span className="text-xs">Video header</span>
                                    </div>
                                </div>
                            )}

                            {state.header.type === 'document' && (
                                <div className="bg-gray-100 h-24 flex items-center justify-center gap-2 text-gray-700 border-b border-gray-200/50">
                                    <FileText className="w-5 h-5" />
                                    <span className="text-sm font-medium">Document header</span>
                                </div>
                            )}

                            {state.header.type === 'location' && (
                                <div className="bg-gray-100 h-24 flex items-center justify-center gap-2 text-gray-700 border-b border-gray-200/50">
                                    <MapPin className="w-5 h-5" />
                                    <span className="text-sm font-medium">Location header</span>
                                </div>
                            )}

                            {/* Body */}
                            {state.body && (
                                <div className="px-3 py-2">
                                    <p className="text-gray-900 whitespace-pre-wrap break-words text-sm">
                                        {formatBodyWithVariables(state.body)}
                                    </p>
                                </div>
                            )}

                            {/* Footer */}
                            {state.footer && (
                                <div className="px-3 pb-2">
                                    <p className="text-xs text-gray-500">{state.footer}</p>
                                </div>
                            )}

                            {/* Timestamp */}
                            <div className="px-3 pb-2 flex justify-end">
                                <span className="text-[10px] text-gray-500">
                                    {new Date().toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    })}
                                </span>
                            </div>

                            {/* Buttons */}
                            {state.buttons.length > 0 && state.category !== 'AUTHENTICATION' && (
                                <div className="border-t border-gray-200">
                                    {state.buttons.map((btn, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-center gap-2 py-2.5 border-b border-gray-200 last:border-b-0 text-[#00A5F4] font-medium text-sm hover:bg-gray-50 cursor-pointer"
                                        >
                                            {btn.type === 'url' && <ExternalLink className="w-4 h-4" />}
                                            {btn.type === 'phone' && <Phone className="w-4 h-4" />}
                                            {btn.type === 'flow' && <Workflow className="w-4 h-4" />}
                                            {btn.type === 'copy_code' && <Copy className="w-4 h-4" />}
                                            {btn.type === 'voice_call' && <PhoneCall className="w-4 h-4" />}
                                            {btn.type === 'catalog' && <Store className="w-4 h-4" />}
                                            {btn.text || (btn.type === 'copy_code' ? 'Copy code' : btn.type === 'catalog' ? 'View catalog' : 'Button')}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Status indicator */}
            <div className="bg-white border-t px-4 py-2 rounded-b-lg">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Template Preview</span>
                    <span
                        className={`px-2 py-0.5 rounded-full font-medium ${state.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                            state.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                state.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                    'bg-red-100 text-red-700'
                            }`}
                    >
                        {state.status}
                    </span>
                </div>
            </div>
        </div>
    );
}
