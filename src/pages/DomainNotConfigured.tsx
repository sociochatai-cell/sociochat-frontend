// src/pages/DomainNotConfigured.tsx
// Full-screen block shown when the current host is not linked to any tenant
// workspace (backend returned 404 `domain_not_configured`). No links to other
// tenants and no auto-redirect — this is a terminal state for an unknown domain.
import { Globe, AlertTriangle } from "lucide-react";

interface DomainNotConfiguredProps {
    host?: string;
}

export default function DomainNotConfigured({ host }: DomainNotConfiguredProps) {
    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5rem",
                background: "#f1f5f9", // neutral slate-100 (independent of tenant theming)
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "32rem",
                    background: "#ffffff",
                    borderRadius: "1rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                    padding: "2.5rem 2rem",
                    textAlign: "center",
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        width: "4.5rem",
                        height: "4.5rem",
                        margin: "0 auto 1.25rem",
                        borderRadius: "9999px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Globe size={36} color="#64748b" strokeWidth={1.75} />
                    <span
                        style={{
                            position: "absolute",
                            right: "-0.25rem",
                            bottom: "-0.25rem",
                            width: "1.75rem",
                            height: "1.75rem",
                            borderRadius: "9999px",
                            background: "#fef3c7",
                            border: "2px solid #ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <AlertTriangle size={16} color="#b45309" strokeWidth={2} />
                    </span>
                </div>

                <h1
                    style={{
                        margin: "0 0 0.5rem",
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "#0f172a",
                    }}
                >
                    Domain Not Configured
                </h1>

                {host ? (
                    <p
                        style={{
                            margin: "0 0 1rem",
                            fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                            fontSize: "0.9375rem",
                            color: "#334155",
                            wordBreak: "break-all",
                            background: "#f1f5f9",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            display: "inline-block",
                        }}
                    >
                        {host}
                    </p>
                ) : null}

                <p
                    style={{
                        margin: "0.75rem 0 0",
                        fontSize: "0.9375rem",
                        lineHeight: 1.6,
                        color: "#64748b",
                    }}
                >
                    This domain isn&apos;t linked to any workspace. If you&apos;re the
                    administrator, configure it in your provider&apos;s settings.
                </p>
            </div>
        </div>
    );
}
