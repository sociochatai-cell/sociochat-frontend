/**
 * Blog API Client
 * ================
 * 
 * API client functions for the Visual Blog CMS.
 * Handles all blog-related API calls with proper typing.
 */

import apiClient from "./apiClient";
import { API_ENDPOINT } from "@/config";
import type {
    BlogPost,
    BlogPostCreate,
    BlogPostUpdate,
    BlogListResponse,
    BlogPostResponse,
    BlogConfigResponse,
    SlugCheckResponse,
    UploadResponse,
    Pagination,
} from "./blogTypes";

// ============================================================
// Blog Post CRUD
// ============================================================

/**
 * List blog posts for a workspace
 */
export async function listBlogPosts(
    workspaceId: number,
    options?: {
        status?: "draft" | "published" | "archived";
        search?: string;
        page?: number;
        perPage?: number;
    }
): Promise<{ ok: boolean; data?: BlogListResponse; error?: string }> {
    const params: Record<string, string | number> = {
        workspace_id: workspaceId,
    };

    if (options?.status) params.status = options.status;
    if (options?.search) params.search = options.search;
    if (options?.page) params.page = options.page;
    if (options?.perPage) params.per_page = options.perPage;

    const res = await apiClient.get<BlogListResponse>("/blog/posts", params);

    if (!res.ok) {
        return { ok: false, error: res.error?.message || "Failed to fetch posts" };
    }

    return { ok: true, data: res.data };
}

/**
 * Get a single blog post by ID
 */
export async function getBlogPost(
    postId: number,
    workspaceId: number
): Promise<{ ok: boolean; data?: BlogPost; error?: string }> {
    const res = await apiClient.get<BlogPostResponse>(
        `/blog/posts/${postId}`,
        { workspace_id: workspaceId }
    );

    if (!res.ok) {
        return { ok: false, error: res.error?.message || "Post not found" };
    }

    return { ok: true, data: res.data?.post };
}

/**
 * Create a new blog post
 */
export async function createBlogPost(
    data: BlogPostCreate
): Promise<{ ok: boolean; data?: BlogPost; error?: string }> {
    const res = await apiClient.post<BlogPostResponse>("/blog/posts", data);

    if (!res.ok) {
        return { ok: false, error: res.error?.message || res.error?.error || "Failed to create post" };
    }

    return { ok: true, data: res.data?.post };
}

/**
 * Update an existing blog post
 */
export async function updateBlogPost(
    postId: number,
    data: BlogPostUpdate
): Promise<{ ok: boolean; data?: BlogPost; error?: string }> {
    const res = await apiClient.put<BlogPostResponse>(`/blog/posts/${postId}`, data);

    if (!res.ok) {
        return { ok: false, error: res.error?.message || res.error?.error || "Failed to update post" };
    }

    return { ok: true, data: res.data?.post };
}

/**
 * Delete a blog post
 */
export async function deleteBlogPost(
    postId: number,
    workspaceId: number
): Promise<{ ok: boolean; error?: string }> {
    const res = await apiClient.del(`/blog/posts/${postId}?workspace_id=${workspaceId}`);

    if (!res.ok) {
        return { ok: false, error: res.error?.message || "Failed to delete post" };
    }

    return { ok: true };
}

// ============================================================
// Publish / Unpublish
// ============================================================

/**
 * Publish a blog post
 */
export async function publishBlogPost(
    postId: number,
    workspaceId: number
): Promise<{ ok: boolean; data?: BlogPost; error?: string }> {
    const res = await apiClient.post<BlogPostResponse>(
        `/blog/posts/${postId}/publish`,
        { workspace_id: workspaceId }
    );

    if (!res.ok) {
        return { ok: false, error: res.error?.message || res.error?.error || "Failed to publish" };
    }

    return { ok: true, data: res.data?.post };
}

/**
 * Unpublish a blog post
 */
export async function unpublishBlogPost(
    postId: number,
    workspaceId: number
): Promise<{ ok: boolean; data?: BlogPost; error?: string }> {
    const res = await apiClient.post<BlogPostResponse>(
        `/blog/posts/${postId}/unpublish`,
        { workspace_id: workspaceId }
    );

    if (!res.ok) {
        return { ok: false, error: res.error?.message || "Failed to unpublish" };
    }

    return { ok: true, data: res.data?.post };
}

/**
 * Duplicate a blog post
 */
export async function duplicateBlogPost(
    postId: number,
    workspaceId: number
): Promise<{ ok: boolean; data?: BlogPost; error?: string }> {
    const res = await apiClient.post<BlogPostResponse>(
        `/blog/posts/${postId}/duplicate`,
        { workspace_id: workspaceId }
    );

    if (!res.ok) {
        return { ok: false, error: res.error?.message || "Failed to duplicate" };
    }

    return { ok: true, data: res.data?.post };
}

// ============================================================
// Public Blog
// ============================================================

/**
 * Get a public published blog post by slug
 */
export async function getPublicBlogPost(
    slug: string,
    workspaceId: number
): Promise<{ ok: boolean; data?: BlogPost; error?: string }> {
    const res = await apiClient.get<BlogPostResponse>(
        `/blog/public/${slug}`,
        { workspace_id: workspaceId }
    );

    if (!res.ok) {
        return { ok: false, error: "Post not found" };
    }

    return { ok: true, data: res.data?.post };
}

/**
 * List public published blog posts
 */
export async function listPublicBlogPosts(
    workspaceId: number,
    options?: { page?: number; perPage?: number }
): Promise<{ ok: boolean; data?: BlogListResponse; error?: string }> {
    const params: Record<string, string | number> = {
        workspace_id: workspaceId,
    };

    if (options?.page) params.page = options.page;
    if (options?.perPage) params.per_page = options.perPage;

    const res = await apiClient.get<BlogListResponse>("/blog/public/list", params);

    if (!res.ok) {
        return { ok: false, error: "Failed to fetch posts" };
    }

    return { ok: true, data: res.data };
}

// ============================================================
// Utilities
// ============================================================

/**
 * Get blog editor configuration
 */
export async function getBlogConfig(): Promise<{ ok: boolean; data?: BlogConfigResponse; error?: string }> {
    const res = await apiClient.get<BlogConfigResponse>("/blog/config");

    if (!res.ok) {
        return { ok: false, error: "Failed to fetch config" };
    }

    return { ok: true, data: res.data };
}

/**
 * Check if a slug is available
 */
export async function checkSlugAvailability(
    workspaceId: number,
    slug: string,
    excludeId?: number
): Promise<{ ok: boolean; data?: SlugCheckResponse; error?: string }> {
    const params: Record<string, string | number> = {
        workspace_id: workspaceId,
        slug,
    };

    if (excludeId) params.exclude_id = excludeId;

    const res = await apiClient.get<SlugCheckResponse>("/blog/check-slug", params);

    if (!res.ok) {
        return { ok: false, error: "Failed to check slug" };
    }

    return { ok: true, data: res.data };
}

/**
 * Upload media for blog posts
 */
export async function uploadBlogMedia(
    workspaceId: number,
    file: File
): Promise<{ ok: boolean; data?: UploadResponse; error?: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspace_id", workspaceId.toString());

    try {
        const res = await fetch(`${API_ENDPOINT}/blog/upload`, {
            method: "POST",
            credentials: "include",
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            return { ok: false, error: data.error || "Upload failed" };
        }

        return { ok: true, data };
    } catch (error) {
        return { ok: false, error: "Upload failed" };
    }
}

// ============================================================
// Export all functions
// ============================================================

const blogApi = {
    listBlogPosts,
    getBlogPost,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
    publishBlogPost,
    unpublishBlogPost,
    duplicateBlogPost,
    getPublicBlogPost,
    listPublicBlogPosts,
    getBlogConfig,
    checkSlugAvailability,
    uploadBlogMedia,
};

export default blogApi;
