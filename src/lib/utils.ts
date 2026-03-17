import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Loads an image from a URL (handling proxies/CORS) and converts it to a JPEG Base64 string.
 * This ensures compatibility with Meta APIs that reject WebP or other formats.
 */
export async function convertImageToJpegBase64(imageUrl: string, proxyBaseUrl?: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Determine URL to fetch (use proxy if needed)
      let urlToFetch = imageUrl;
      if (proxyBaseUrl && imageUrl.includes('digitaloceanspaces.com')) {
        urlToFetch = `${proxyBaseUrl.replace(/\/$/, "")}/api/v1/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      }

      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        // Fill white background for transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Force JPEG format
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve(dataUrl);
      };

      img.onerror = () => {
        // If standard loading fails, try fetching as blob and creating object URL
        // This handles some edge cases with headers
        fetch(urlToFetch)
          .then(res => res.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
              }
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
              URL.revokeObjectURL(blobUrl);
              resolve(dataUrl);
            };
            // reset src to blob url
            img.src = blobUrl;
          })
          .catch(e => reject(e));
      };

      // Start loading
      img.src = urlToFetch;

    } catch (error) {
      reject(error);
    }
  });
}
