// src/components/ui/safe-image.tsx
// A reusable image component that handles broken/expired images gracefully

import { useState, useEffect } from 'react';
import { Loader2, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
  fallbackClassName?: string;
  hideOnError?: boolean;
}

export function SafeImage({ 
  src, 
  alt, 
  className, 
  fallbackText = "Image unavailable", 
  fallbackClassName,
  hideOnError = false,
  onClick,
  ...props 
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  if (!src || hasError) {
    if (hideOnError) return null;
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400",
          fallbackClassName || className
        )}
        onClick={onClick as any}
      >
        <ImageOff className="h-8 w-8 mb-1 opacity-50" />
        <span className="text-[10px] text-center px-2">{fallbackText}</span>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className={cn("flex items-center justify-center bg-gray-100 animate-pulse", className)}>
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(className, isLoading && "hidden")}
        onClick={onClick}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        {...props}
      />
    </>
  );
}

export default SafeImage;
