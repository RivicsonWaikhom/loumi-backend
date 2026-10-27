import { useCallback, useRef, useState } from 'react';
import { Camera, UploadCloud, ImageIcon, X } from 'lucide-react';

interface ImageUploaderProps {
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
  onCapture?: () => void;
}

export default function ImageUploader({
  previewUrl,
  onFileSelected,
  onClear,
  disabled = false,
  onCapture,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith('image/')) return;
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload image by clicking or dragging a file here"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          isDragging
            ? 'border-forest-500 bg-forest-50'
            : 'border-forest-200 bg-forest-50/40 hover:border-forest-400 hover:bg-forest-50/70'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {previewUrl ? (
          <div className="relative w-full">
            <img
              src={previewUrl}
              alt="Selected pineapple plant preview"
              className="mx-auto max-h-[320px] w-auto rounded-xl object-contain shadow-sm"
            />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="absolute -right-2 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest-900 text-white shadow-md transition hover:bg-forest-800"
                aria-label="Remove selected image"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-forest-600 shadow-sm ring-1 ring-forest-100">
              <UploadCloud className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <p className="font-display text-base font-semibold text-forest-800">
                Drag &amp; drop a pineapple plant photo
              </p>
              <p className="mt-1 text-sm text-forest-600">
                or click to browse — JPG, PNG up to ~10MB
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-forest-500">
              <ImageIcon className="h-3.5 w-3.5" /> Clear, well-lit leaves give the best results
            </span>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            onCapture?.();
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" /> Upload Image
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full border border-forest-300 bg-white px-5 py-2.5 text-sm font-semibold text-forest-700 transition hover:bg-forest-50 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" /> Capture Image
        </button>
      </div>
    </div>
  );
}
