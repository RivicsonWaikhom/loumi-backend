import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Sparkles,
  MessageSquare,
  ShieldAlert,
  ChevronRight,
  Info,
  AlertOctagon,
  Cpu,
} from 'lucide-react';
import { DiseaseDiagnosisResult } from '../services/types';
import { diagnosePlantImage } from '../services/chatbotApi';
import { CameraModal } from './CameraModal';

interface CheckMyPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat: (diagnosis: DiseaseDiagnosisResult) => void;
}

export const CheckMyPlantModal: React.FC<CheckMyPlantModalProps> = ({
  isOpen,
  onClose,
  onSendToChat,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiseaseDiagnosisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Please select a valid JPG, PNG, or WebP photograph.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Photo exceeds 10MB limit. Please take a slightly smaller photo.');
      return;
    }

    // Immediately clear previous diagnosis and error to prevent stale results
    setErrorMessage(null);
    setDiagnosisResult(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleCameraCapture = (file: File) => {
    // Immediately clear previous diagnosis and error
    setErrorMessage(null);
    setDiagnosisResult(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || isAnalyzing) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setDiagnosisResult(null);

    try {
      const result = await diagnosePlantImage(selectedFile);
      setDiagnosisResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not analyze plant image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setDiagnosisResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleTransferToChat = () => {
    if (diagnosisResult) {
      onSendToChat(diagnosisResult);
      handleClose();
    }
  };

  const isInvalid =
    diagnosisResult &&
    (diagnosisResult.is_valid_leaf === false ||
      diagnosisResult.status === 'invalid' ||
      !diagnosisResult.sections);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-[#fafaf7] rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-emerald-100 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-emerald-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-800/80 border border-emerald-700 flex items-center justify-center text-emerald-200">
              <Camera className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold leading-tight">Check My Plant</h2>
              <p className="text-[11px] text-emerald-200/90">
                Leaf health & disease screening for pineapple crops
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-emerald-300 hover:text-white p-1.5 rounded-full hover:bg-emerald-800/60 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-2xl flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="flex-1 font-medium">{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-600 hover:text-red-900 font-bold p-1"
              >
                ×
              </button>
            </div>
          )}

          {/* STEP 1: Select / Capture Image */}
          {!selectedFile && (
            <div className="space-y-3.5 py-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Camera Button */}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex flex-col items-center justify-center p-5 bg-white hover:bg-emerald-50/70 border-2 border-dashed border-emerald-300 rounded-2xl transition group text-center shadow-xs"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 mb-0.5">
                    Take Photo with Camera
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Point camera directly at the plant leaf
                  </span>
                </button>

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-5 bg-white hover:bg-emerald-50/70 border-2 border-dashed border-emerald-300 rounded-2xl transition group text-center shadow-xs"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 mb-0.5">
                    Upload from Gallery
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Choose a photo saved on your device
                  </span>
                </button>
              </div>

              {/* Farmer Tip Box */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-950 leading-relaxed space-y-0.5">
                  <p className="font-semibold text-emerald-900">Tips for Accurate Screening:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-700">
                    <li>Hold the camera steady in good natural daylight.</li>
                    <li>Photograph an individual pineapple leaf showing spots, drying, or yellowing.</li>
                    <li>Ensure the leaf fills most of the frame without blurry backgrounds.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Confirmation */}
          {selectedFile && !diagnosisResult && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black/5 border border-emerald-200 aspect-[4/3] max-h-64 mx-auto flex items-center justify-center">
                <img
                  src={previewUrl!}
                  alt="Leaf preview"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600 px-1">
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isAnalyzing}
                  className="flex-1 py-2.5 px-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  Retake / Change
                </button>

                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="flex-[2] py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:bg-emerald-400 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing Plant Leaf...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      Examine Plant Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3A: Dedicated Rejection Card for Non-Pineapple Images */}
          {diagnosisResult && isInvalid && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-4 rounded-2xl border bg-red-50/90 border-red-300 text-red-950">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">
                        Pre-Inference Validation Filtered
                      </span>
                      <span className="text-xs font-bold text-red-700">
                        {diagnosisResult.confidence_percent} Match
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-red-950 mt-1">
                      {diagnosisResult.disease_name}
                    </h3>
                  </div>
                </div>

                <div className="mt-3 text-xs text-red-900/90 leading-relaxed bg-white/70 p-3 rounded-xl border border-red-200">
                  <p className="font-semibold text-red-950 mb-1">Notice for Farmers:</p>
                  <p>
                    {diagnosisResult.message ||
                      'This image does not appear to be a pineapple leaf. Loumi disease detection requires a clear, focused photograph of an individual pineapple leaf.'}
                  </p>
                </div>
              </div>

              {/* Pre-Inference Validation Breakdown */}
              {diagnosisResult.category_scores && (
                <div className="p-3.5 bg-white border border-gray-200 rounded-2xl space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-700" />
                    Pre-Inference Validation Breakdown
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { key: 'leaf', label: 'Pineapple Leaf', score: diagnosisResult.category_scores.leaf || 0, color: 'bg-emerald-600' },
                      { key: 'fruit', label: 'Pineapple Fruit', score: diagnosisResult.category_scores.fruit || 0, color: 'bg-amber-500' },
                      { key: 'plant', label: 'Whole Pineapple Plant', score: diagnosisResult.category_scores.plant || 0, color: 'bg-blue-500' },
                      { key: 'invalid', label: 'Non-Pineapple / Unrelated', score: diagnosisResult.category_scores.invalid || 0, color: 'bg-red-500' },
                    ].map((item) => {
                      const pct = Math.round(item.score * 100);
                      return (
                        <div key={item.key} className="space-y-0.5">
                          <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                            <span>{item.label}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${item.color}`}
                              style={{ width: `${Math.max(pct, 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action: Try Again */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-200" />
                  Try Again with a Pineapple Leaf Photo
                </button>
              </div>
            </div>
          )}

          {/* STEP 3B: Complete Structured Diagnosis Report for Valid Leaves */}
          {diagnosisResult && !isInvalid && diagnosisResult.sections && (
            <div className="space-y-3 animate-fade-in">
              {/* Diagnosis Summary Banner */}
              <div
                className={`p-3.5 rounded-2xl border ${
                  diagnosisResult.is_healthy
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  {diagnosisResult.is_healthy ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-white/80 border border-black/10">
                        {diagnosisResult.status === 'healthy' ? 'Healthy Leaf' : 'Issue Detected'}
                      </span>
                      <span className="text-xs font-bold text-gray-700">
                        {diagnosisResult.confidence_percent} Model Confidence
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 mt-0.5">
                      {diagnosisResult.disease_name}
                    </h3>
                  </div>
                </div>

                {/* Model Version Tag */}
                <div className="mt-2 pt-2 border-t border-black/5 flex items-center gap-1.5 text-[10px] text-gray-600">
                  <Cpu className="w-3 h-3 text-emerald-700" />
                  <span>
                    Model: {diagnosisResult.model_version || 'YOLOv8n-cls (pinnapple_disease_yolov8n_best.pt, 224x224)'}
                  </span>
                </div>
              </div>

              {/* Model Classification Probabilities Breakdown */}
              {diagnosisResult.probabilities && diagnosisResult.probabilities.length > 0 && (
                <div className="p-3 bg-white border border-emerald-100 rounded-2xl space-y-1.5">
                  <h4 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                    <span>Softmax Probability Distribution Across 4 Classes</span>
                  </h4>
                  <div className="space-y-1 text-xs">
                    {diagnosisResult.probabilities.map((prob) => {
                      const scorePct = Math.round(prob.score * 100);
                      const isTop = prob.class === diagnosisResult.raw_class;
                      return (
                        <div key={prob.class} className="space-y-0.5">
                          <div className="flex justify-between text-[11px] font-medium text-gray-600">
                            <span className={isTop ? 'font-bold text-emerald-950' : ''}>
                              {prob.display_name}
                            </span>
                            <span className={isTop ? 'font-bold text-emerald-800' : ''}>
                              {prob.percent}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isTop ? 'bg-emerald-600' : 'bg-gray-300'
                              }`}
                              style={{ width: `${Math.max(scorePct, 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Caution Warning */}
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/90 rounded-xl flex items-start gap-2 text-[11px] text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Important Caution:</strong> {diagnosisResult.caution}
                </p>
              </div>

              {/* 4 Compact Structured Farmer Sections */}
              <div className="space-y-2 text-xs text-gray-800">
                {/* 1. What is the problem? */}
                <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-1">
                  <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                      1
                    </span>
                    What is the problem?
                  </h4>
                  <p className="text-gray-700 leading-relaxed pl-5 text-[11px]">
                    {diagnosisResult.sections.what_is_it}
                  </p>
                </div>

                {/* 2. Symptoms */}
                <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-1">
                  <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                      2
                    </span>
                    Symptoms to look for in your field:
                  </h4>
                  <ul className="list-disc pl-8 space-y-0.5 text-gray-700 text-[11px]">
                    {diagnosisResult.sections.symptoms.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Next Steps */}
                <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-1">
                  <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                      3
                    </span>
                    What should I do right now?
                  </h4>
                  <ol className="list-decimal pl-8 space-y-0.5 text-gray-700 font-medium text-[11px]">
                    {diagnosisResult.sections.next_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>

                {/* 4. Prevention */}
                <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-1">
                  <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                      4
                    </span>
                    Long-term prevention & field care:
                  </h4>
                  <ul className="list-disc pl-8 space-y-0.5 text-gray-700 text-[11px]">
                    {diagnosisResult.sections.prevention.map((prev, idx) => (
                      <li key={idx}>{prev}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTransferToChat}
                  className="w-full sm:flex-1 py-2.5 px-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-200" />
                  Save & Ask Loumi in Chat
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto py-2.5 px-4 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl text-xs font-semibold transition"
                >
                  Check Another Plant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Camera Viewfinder Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};

export default CheckMyPlantModal;
