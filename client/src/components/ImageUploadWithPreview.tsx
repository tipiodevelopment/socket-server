import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { Upload, X, Loader2 } from 'lucide-react';

interface ImageUploadWithPreviewProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  testId?: string;
}

export function ImageUploadWithPreview({
  label,
  value,
  onChange,
  placeholder = 'https://example.com/image.jpg',
  testId = 'input-image',
}: ImageUploadWithPreviewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor selecciona un archivo de imagen');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('El archivo es muy grande. Máximo 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Get upload URL from server
      const response = await apiRequest('POST', '/api/objects/upload', {
        fileName: file.name,
      });
      const { uploadURL } = (await response.json()) as { uploadURL: string };

      // Upload file directly to object storage
      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      // Normalize the URL to get the public path
      const normalizeResponse = await apiRequest('PUT', '/api/campaign-logo', {
        logoURL: uploadURL,
      });
      const { objectPath } = (await normalizeResponse.json()) as {
        objectPath: string;
      };

      // Update the value
      onChange(objectPath);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Error al subir el archivo');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          className="flex-1"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          data-testid={`${testId}-file`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          data-testid={`${testId}-upload-button`}
          className="border-0 shrink-0"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            data-testid={`${testId}-remove-button`}
            className="border-0 shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}

      {value && (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">Vista previa:</p>
          <div className="relative w-full aspect-video rounded overflow-hidden bg-background border border-white/10">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-contain"
              onError={(e) => {
                // If image fails to load, show placeholder
                e.currentTarget.src = '';
                e.currentTarget.alt = 'Error al cargar la imagen';
              }}
              data-testid={`${testId}-preview`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
