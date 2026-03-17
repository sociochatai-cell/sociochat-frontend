/**
 * Blog CMS TypeScript Types
 * ==========================
 * 
 * Type definitions for the Visual Blog CMS.
 * Used by the editor, renderer, and API client.
 */

// ============================================================
// Block Types
// ============================================================

export type BlockType =
    | "heading"
    | "paragraph"
    | "image"
    | "section"
    | "columns"
    | "button"
    | "embed"
    | "divider"
    | "quote"
    | "list";

export type EmbedProvider =
    | "youtube"
    | "twitter"
    | "instagram"
    | "vimeo"
    | "spotify"
    | "soundcloud";

export type TextAlign = "left" | "center" | "right" | "justify";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type ListStyle = "bullet" | "numbered";

// ============================================================
// Block Style
// ============================================================

export interface BlockStyle {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: number;
    color?: string;
    backgroundColor?: string;
    padding?: string;
    margin?: string;
    textAlign?: TextAlign;
    borderRadius?: string;
    lineHeight?: string;
    letterSpacing?: string;
}

// ============================================================
// Block Data Types (per block type)
// ============================================================

export interface HeadingData {
    text: string;
    level: HeadingLevel;
}

export interface ParagraphData {
    text: string;
}

export interface ImageData {
    url: string;
    alt: string;
    caption?: string;
    width?: string;
    height?: string;
}

export interface SectionData {
    children: BlogBlock[];
}

export interface ColumnsData {
    columns: number; // 2, 3, or 4
    children: BlogBlock[][];
}

export interface ButtonData {
    text: string;
    url: string;
    variant?: "primary" | "secondary" | "outline";
}

export interface EmbedData {
    provider: EmbedProvider;
    url: string;
    embedId?: string;
}

export interface DividerData {
    style?: "solid" | "dashed" | "dotted";
    thickness?: string;
}

export interface QuoteData {
    text: string;
    attribution?: string;
}

export interface ListData {
    style: ListStyle;
    items: string[];
}

export type BlockData =
    | HeadingData
    | ParagraphData
    | ImageData
    | SectionData
    | ColumnsData
    | ButtonData
    | EmbedData
    | DividerData
    | QuoteData
    | ListData;

// ============================================================
// Blog Block
// ============================================================

export interface BlogBlock {
    id: string;
    type: BlockType;
    style: BlockStyle;
    data: BlockData;
    order: number;
}

// ============================================================
// SEO Meta
// ============================================================

export interface SEOMeta {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    canonicalUrl?: string;
    noIndex?: boolean;
    schemaMarkup?: Record<string, unknown>;
}

// ============================================================
// Blog Post
// ============================================================

export type BlogPostStatus = "draft" | "published" | "archived";

export interface BlogPost {
    id: number;
    workspace_id: number;
    author_id: number | null;
    author_name?: string;
    author_email?: string;
    title: string;
    slug: string;
    excerpt: string | null;
    featured_image: string | null;
    status: BlogPostStatus;
    render_version: number;
    content?: BlogBlock[];
    seo_meta: SEOMeta;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface BlogPostCreate {
    workspace_id: number;
    title: string;
    slug?: string;
    excerpt?: string;
    featured_image?: string;
    content_json?: BlogBlock[];
    seo_meta?: SEOMeta;
}

export interface BlogPostUpdate {
    workspace_id: number;
    title?: string;
    slug?: string;
    excerpt?: string;
    featured_image?: string;
    content_json?: BlogBlock[];
    seo_meta?: SEOMeta;
}

// ============================================================
// API Response Types
// ============================================================

export interface Pagination {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_next?: boolean;
    has_prev?: boolean;
}

export interface BlogListResponse {
    posts: BlogPost[];
    pagination: Pagination;
}

export interface BlogPostResponse {
    post: BlogPost;
}

export interface BlogConfigResponse {
    block_types: BlockType[];
    limits: BlogEditorLimits;
    allowed_fonts: string[];
}

export interface BlogEditorLimits {
    max_blocks_per_post: number;
    max_columns: number;
    max_image_size_mb: number;
    max_video_size_mb: number;
    allowed_fonts: string[];
}

export interface SlugCheckResponse {
    available: boolean;
    slug?: string;
    suggested?: string;
}

export interface UploadResponse {
    url: string;
    filename: string;
    size_mb: number;
}

// ============================================================
// Editor State Types
// ============================================================

export interface EditorState {
    post: BlogPost | null;
    blocks: BlogBlock[];
    selectedBlockId: string | null;
    isDirty: boolean;
    isSaving: boolean;
    isPublishing: boolean;
    previewMode: "desktop" | "mobile";
}

export interface BlockPalette {
    category: string;
    items: {
        type: BlockType;
        label: string;
        icon: string;
        description: string;
    }[];
}

// ============================================================
// Default Block Templates
// ============================================================

export const DEFAULT_BLOCK_STYLE: BlockStyle = {
    fontFamily: "Inter",
    fontSize: "16px",
    fontWeight: 400,
    color: "#111827",
    backgroundColor: "transparent",
    padding: "0",
    margin: "0 0 16px 0",
    textAlign: "left",
};

export const BLOCK_TEMPLATES: Record<BlockType, Partial<BlogBlock>> = {
    heading: {
        type: "heading",
        style: { ...DEFAULT_BLOCK_STYLE, fontSize: "32px", fontWeight: 700 },
        data: { text: "New Heading", level: 2 } as HeadingData,
    },
    paragraph: {
        type: "paragraph",
        style: { ...DEFAULT_BLOCK_STYLE, lineHeight: "1.6" },
        data: { text: "Start writing your content here..." } as ParagraphData,
    },
    image: {
        type: "image",
        style: { ...DEFAULT_BLOCK_STYLE },
        data: { url: "", alt: "Image description" } as ImageData,
    },
    section: {
        type: "section",
        style: { ...DEFAULT_BLOCK_STYLE, padding: "32px", backgroundColor: "#f9fafb" },
        data: { children: [] } as SectionData,
    },
    columns: {
        type: "columns",
        style: { ...DEFAULT_BLOCK_STYLE },
        data: { columns: 2, children: [[], []] } as ColumnsData,
    },
    button: {
        type: "button",
        style: { ...DEFAULT_BLOCK_STYLE },
        data: { text: "Click Here", url: "#", variant: "primary" } as ButtonData,
    },
    embed: {
        type: "embed",
        style: { ...DEFAULT_BLOCK_STYLE },
        data: { provider: "youtube", url: "" } as EmbedData,
    },
    divider: {
        type: "divider",
        style: { ...DEFAULT_BLOCK_STYLE, margin: "32px 0" },
        data: { style: "solid", thickness: "1px" } as DividerData,
    },
    quote: {
        type: "quote",
        style: { ...DEFAULT_BLOCK_STYLE, padding: "16px 24px", borderRadius: "4px" },
        data: { text: "Enter your quote here...", attribution: "" } as QuoteData,
    },
    list: {
        type: "list",
        style: { ...DEFAULT_BLOCK_STYLE },
        data: { style: "bullet", items: ["Item 1", "Item 2", "Item 3"] } as ListData,
    },
};

// ============================================================
// Allowed Fonts
// ============================================================

export const ALLOWED_FONTS = [
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Poppins",
    "Raleway",
    "Oswald",
    "Source Sans Pro",
    "Nunito",
    "Playfair Display",
    "Merriweather",
    "Georgia",
    "Times New Roman",
];

// ============================================================
// Block Palette Categories
// ============================================================

export const BLOCK_PALETTE: BlockPalette[] = [
    {
        category: "Text",
        items: [
            { type: "heading", label: "Heading", icon: "Type", description: "Large title text" },
            { type: "paragraph", label: "Paragraph", icon: "AlignLeft", description: "Rich text content" },
            { type: "quote", label: "Quote", icon: "Quote", description: "Blockquote with attribution" },
            { type: "list", label: "List", icon: "List", description: "Bullet or numbered list" },
        ],
    },
    {
        category: "Media",
        items: [
            { type: "image", label: "Image", icon: "Image", description: "Upload or embed image" },
            { type: "embed", label: "Video/Embed", icon: "Video", description: "YouTube, Twitter, etc." },
        ],
    },
    {
        category: "Layout",
        items: [
            { type: "section", label: "Section", icon: "Square", description: "Container with background" },
            { type: "columns", label: "Columns", icon: "Columns", description: "Multi-column layout" },
            { type: "divider", label: "Divider", icon: "Minus", description: "Horizontal separator" },
        ],
    },
    {
        category: "Interactive",
        items: [
            { type: "button", label: "Button", icon: "MousePointer", description: "Call-to-action button" },
        ],
    },
];
