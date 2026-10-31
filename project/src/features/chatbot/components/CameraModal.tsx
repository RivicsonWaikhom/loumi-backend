import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedDataUrl(null);
      setError(null);
      return;
    }
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported by your browser.');
        return;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera device was found on your computer or phone.');
      } else {
        setError(`Unable to start camera: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedDataUrl(dataUrl);
    }
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  const handleConfirm = () => {
    if (!capturedDataUrl) return;
    // Convert dataURL to File
    const arr = capturedDataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const file = new File([u8arr], `camera_leaf_${Date.now()}.jpg`, { type: mime });
    onCapture(file);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-loumi-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Capture Plant / Leaf Photo</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-center p-6 text-white max-w-sm">
              <p className="text-red-400 font-medium mb-2">Camera Unavailable</p>
              <p className="text-xs text-gray-300 leading-relaxed mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition"
              >
                Retry Camera
              </button>
            </div>
          ) : capturedDataUrl ? (
            <img src={capturedDataUrl} alt="Captured preview" className="w-full h-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Controls */}
        <div className="px-5 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
          {capturedDataUrl ? (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-white text-xs font-medium transition"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-5 py-2 bg-loumi-600 hover:bg-loumi-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Check className="w-4 h-4" />
                Use Photo
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                disabled={!!error}
                onClick={handleSnap}
                className="flex items-center gap-2 px-6 py-2.5 bg-loumi-600 hover:bg-loumi-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-semibold shadow transition"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
