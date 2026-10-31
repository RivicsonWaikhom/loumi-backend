import { useCallback, useRef, useState, useEffect } from 'react';
import {
  Camera,
  UploadCloud,
  ImageIcon,
  X,
  RefreshCw,
  AlertCircle,
  VideoOff,
  Sparkles,
  FlipHorizontal,
  CheckCircle2,
} from 'lucide-react';

interface ImageUploaderProps {
  previewUrl: string | null;
  onFileSelected: (file: File, source?: 'upload' | 'camera') => void;
  onClear: () => void;
  disabled?: boolean;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

export default function ImageUploader({
  previewUrl,
  onFileSelected,
  onClear,
  disabled = false,
  onAnalyze,
  isAnalyzing = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [sourceType, setSourceType] = useState<'upload' | 'camera'>('upload');

  // Check if multiple camera devices exist (e.g. mobile front/back)
  useEffect(() => {
    async function checkDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoDevices.length > 1);
        }
      } catch (e) {
        console.warn('Could not enumerate video devices:', e);
      }
    }
    checkDevices();
  }, []);

  // Ensure stream tracks are stopped when component unmounts
  useEffect(() => {
    return () => {
      stopCameraTracks();
    };
  }, []);

  const stopCameraTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping video track:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const stopCamera = useCallback(() => {
    stopCameraTracks();
    setIsCameraActive(false);
    setIsCameraLoading(false);
    setCameraError(null);
  }, []);

  const startCamera = useCallback(
    async (preferredFacing: 'environment' | 'user' = facingMode) => {
      stopCameraTracks();
      setIsCameraActive(true);
      setIsCameraLoading(true);
      setCameraError(null);

      // Check browser support and secure context
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Live camera access is not supported by your browser or requires a secure connection (HTTPS or localhost).'
        );
        setIsCameraLoading(false);
        return;
      }

      // Try preferred facing mode first, fall back to basic video constraint if overconstrained
      const constraintsList: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        },
        {
          video: { facingMode: preferredFacing },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let stream: MediaStream | null = null;
      let lastError: any = null;

      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (err: any) {
          lastError = err;
          // Continue to simpler constraints if OverconstrainedError
          if (err.name !== 'OverconstrainedError' && err.name !== 'ConstraintNotSatisfiedError') {
            break;
          }
        }
      }

      if (!stream) {
        setIsCameraLoading(false);
        if (!lastError) {
          setCameraError('Unable to access camera.');
          return;
        }

        if (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError') {
          setCameraError(
            'Camera permission was denied. Please allow camera permissions in your browser address bar and try again.'
          );
        } else if (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError') {
          setCameraError('No camera device was found on this device. You can upload an image file instead.');
        } else if (lastError.name === 'NotReadableError' || lastError.name === 'TrackStartError') {
          setCameraError('The camera is in use by another application or browser tab. Please close other camera apps.');
        } else if (lastError.name === 'SecurityError') {
          setCameraError('Camera access requires HTTPS or localhost.');
        } else {
          setCameraError(`Camera startup failed: ${lastError.message || lastError.name || 'Unknown error'}`);
        }
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .then(() => {
            setIsCameraLoading(false);
          })
          .catch((e) => {
            console.warn('Video playback error:', e);
            setIsCameraLoading(false);
          });
      } else {
        setIsCameraLoading(false);
      }
    },
    [facingMode]
  );

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleTakePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the current video frame onto canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Convert canvas to JPEG blob
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const filename = `pineapple_leaf_cam_${Date.now()}.jpg`;
        const file = new File([blob], filename, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        // Clean up live stream
        stopCamera();
        setSourceType('camera');
        onFileSelected(file, 'camera');
      },
      'image/jpeg',
      0.92
    );
  };

  const handleRetake = () => {
    onClear();
    startCamera(facingMode);
  };

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith('image/')) return;
      stopCamera();
      setSourceType('upload');
      onFileSelected(file, 'upload');
    },
    [onFileSelected, stopCamera]
  );

  return (
    <div className="w-full">
      {/* 1. Live Camera Viewport */}
      {isCameraActive ? (
        <div className="relative flex min-h-[360px] max-h-[460px] w-full flex-col justify-between overflow-hidden rounded-2xl bg-black text-white shadow-md">
          {/* Top Video Header Overlay */}
          <div className="z-10 flex items-center justify-between bg-linear-to-b from-black/80 via-black/40 to-transparent p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                Live Camera
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Switch front/rear camera"
                  className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/30"
                >
                  <FlipHorizontal className="h-3.5 w-3.5" />
                  <span>{facingMode === 'environment' ? 'Rear' : 'Front'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={stopCamera}
                title="Stop camera"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30"
                aria-label="Close camera"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Video Stream Element or Loading / Error States */}
          {cameraError ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-white">Camera Access Error</h4>
              <p className="mt-1.5 max-w-sm text-xs text-white/80 leading-relaxed">
                {cameraError}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-forest-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try Again
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/30"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {isCameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-400 border-t-transparent" />
                  <p className="mt-2 text-xs text-white/90 font-medium">Initializing camera...</p>
                </div>
              )}

              {/* Viewfinder Target Framing Overlay */}
              {!isCameraLoading && (
                <div className="pointer-events-none absolute inset-6 flex items-center justify-center">
                  <div className="relative h-48 w-48 sm:h-56 sm:w-56 rounded-2xl border-2 border-dashed border-white/60 shadow-inner">
                    {/* Corner Guides */}
                    <span className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-emerald-400" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-emerald-400" />
                    <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-emerald-400" />
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-emerald-400" />
                    <div className="absolute inset-x-0 bottom-2 text-center">
                      <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-xs">
                        Center pineapple leaf here
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Live Camera Control Bar */}
          {!cameraError && (
            <div className="z-10 flex items-center justify-center gap-4 bg-linear-to-t from-black/85 via-black/50 to-transparent p-4">
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/30"
              >
                <VideoOff className="h-4 w-4" /> Stop Camera
              </button>

              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={isCameraLoading}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" /> Take Photo
              </button>
            </div>
          )}
        </div>
      ) : previewUrl ? (
        /* 2. Captured / Uploaded Image Preview Mode */
        <div className="relative flex min-h-[300px] flex-col justify-between rounded-2xl border border-forest-200 bg-forest-50/30 p-5 shadow-xs">
          <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/5 p-2">
            <img
              src={previewUrl}
              alt="Pineapple leaf scan preview"
              className="mx-auto max-h-[300px] w-auto rounded-lg object-contain shadow-xs"
            />

            {/* Source Tag */}
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-forest-900/80 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
              {sourceType === 'camera' ? (
                <>
                  <Camera className="h-3 w-3 text-emerald-400" /> Captured from Camera
                </>
              ) : (
                <>
                  <UploadCloud className="h-3 w-3 text-forest-200" /> Uploaded File
                </>
              )}
            </span>

            {/* Remove / Clear Button */}
            {!disabled && (
              <button
                type="button"
                onClick={onClear}
                className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-forest-900/80 text-white backdrop-blur-xs transition hover:bg-forest-900"
                aria-label="Remove selected image"
                title="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Action Row for Captured Image */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-forest-100 pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 rounded-full border border-forest-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-forest-800 shadow-2xs transition hover:bg-forest-50 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake Photo
              </button>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 rounded-full border border-forest-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-forest-800 shadow-2xs transition hover:bg-forest-50 disabled:opacity-50"
              >
                <UploadCloud className="h-3.5 w-3.5" /> Choose Different
              </button>
            </div>

            {onAnalyze && (
              <button
                type="button"
                onClick={onAnalyze}
                disabled={disabled || isAnalyzing}
                className="inline-flex items-center gap-1.5 rounded-full bg-forest-700 px-4 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-forest-800 active:scale-95 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Detect Disease</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 3. Empty Dropzone State with Action Buttons */
        <div>
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
            className={`relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
              isDragging
                ? 'border-forest-500 bg-forest-50'
                : 'border-forest-200 bg-forest-50/40 hover:border-forest-400 hover:bg-forest-50/70'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-forest-600 shadow-xs ring-1 ring-forest-100">
              <UploadCloud className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-forest-800">
                Drag &amp; drop a pineapple plant photo
              </p>
              <p className="mt-0.5 text-xs text-forest-600">
                or select using the buttons below — JPG, PNG up to ~10MB
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-forest-500">
              <ImageIcon className="h-3 w-3" /> Clear, well-lit leaves give the best detection results
            </span>
          </div>

          {/* Action Buttons: Upload Image & Live Camera Capture */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs transition hover:bg-forest-700 active:scale-95 disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" /> Upload Image
            </button>

            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-full border border-forest-300 bg-white px-5 py-2.5 text-sm font-semibold text-forest-700 shadow-2xs transition hover:border-forest-400 hover:bg-forest-50 active:scale-95 disabled:opacity-50"
            >
              <Camera className="h-4 w-4 text-emerald-600" /> Capture with Camera
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input for Traditional Upload */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
