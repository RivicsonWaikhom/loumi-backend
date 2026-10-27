import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Microscope,
  Sparkles,
  AlertTriangle,
  Activity,
  ListChecks,
  ShieldQuestion,
  MapPin,
  CheckCircle2,
  BookmarkCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Info,
  ShoppingBag,
  Store,
  ArrowRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ImageUploader from '@/components/ImageUploader';
import LoadingState from '@/components/LoadingState';
import ErrorMessage from '@/components/ErrorMessage';
import ServiceUnavailable from '@/components/ServiceUnavailable';
import ResultCard, { ResultList } from '@/components/ResultCard';
import { Button } from '@/components/ui/Button';
import { TextareaField } from '@/components/ui/FormField';
import { analyzeImage, isDiseaseServiceUnreachable } from '@/services/diseaseDetectionService';
import { recordBackendObservation } from '@/services/farmPlannerService';
import { fetchRecommendations } from '@/services/marketplaceService';
import { API_ENDPOINTS } from '@/config/api';
import { ApiError } from '@/services/apiClient';
import type {
  DiseaseDetectionResponse,
  DiseaseResult,
  RankedClass,
  DiseaseSource,
  ImageValidationDetails,
  ValidationCategory,
} from '@/types/disease';
import type { MarketplaceRecommendation } from '@/types/marketplace';
import type { Farm, Plant, Observation } from '@/pages/farm-planner/types';
import { createInitialFarms } from '@/pages/farm-planner/geometry';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'success'; data: DiseaseDetectionResponse };

const STORAGE_KEY = 'loumi_smart_farm_planner_farms';

const classBadge: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  diseased: 'bg-red-100 text-red-800 ring-red-200',
  uncertain: 'bg-amber-100 text-amber-800 ring-amber-200',
};

export default function DiseaseDetection() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  // Farm integration state
  const [searchParams] = useSearchParams();
  const queryFarmId = searchParams.get('farmId');
  const queryPlantId = searchParams.get('plantId');

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [savedObservationSuccess, setSavedObservationSuccess] = useState<string | null>(null);

  // Load farms from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFarms(parsed);
          return;
        }
      }
      // Fallback to initial farms if none exists
      const initial = createInitialFarms();
      setFarms(initial);
    } catch (e) {
      console.warn('Failed to load farms in Disease Detection:', e);
      setFarms(createInitialFarms());
    }
  }, []);

  // Pre-select farm and plant if passed in query params
  useEffect(() => {
    if (queryFarmId && farms.some((f) => f.id === queryFarmId)) {
      setSelectedFarmId(queryFarmId);
      if (queryPlantId) {
        setSelectedPlantId(queryPlantId);
      }
    }
  }, [queryFarmId, queryPlantId, farms]);

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) || null,
    [farms, selectedFarmId]
  );

  const selectedPlant = useMemo(
    () => (selectedFarm?.plants || []).find((p) => p.id === selectedPlantId) || null,
    [selectedFarm, selectedPlantId]
  );

  const handleFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setState({ status: 'idle' });
    setSavedObservationSuccess(null);
  };

  const clear = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setState({ status: 'idle' });
    setSavedObservationSuccess(null);
  };

  const analyze = async () => {
    if (!file) return;
    setState({ status: 'loading' });
    setSavedObservationSuccess(null);
    try {
      const data = await analyzeImage(file, {
        notes: notes.trim() || undefined,
        farmId: selectedFarmId || undefined,
        plantId: selectedPlantId || undefined,
      });
      setState({ status: 'success', data });
    } catch (err) {
      if (isDiseaseServiceUnreachable(err)) {
        setState({
          status: 'unavailable',
          message:
            'The disease detection backend is not connected yet. Once your trained model is served at the configured endpoint, results will appear here automatically.',
        });
      } else {
        const message =
          err instanceof ApiError ? err.message : 'Analysis failed unexpectedly.';
        setState({ status: 'error', message });
      }
    }
  };

  // Save observation to selected farm and plant without overwriting existing observations
  const handleSaveObservation = (overrideFarmId?: string, overridePlantId?: string) => {
    if (state.status !== 'success' || !state.data.result) return;

    const farmId = overrideFarmId || selectedFarmId;
    const plantId = overridePlantId || selectedPlantId;

    if (!farmId || !plantId) return;

    try {
      const savedStr = localStorage.getItem(STORAGE_KEY);
      const curFarms: Farm[] = savedStr ? JSON.parse(savedStr) : farms;

      const targetFarmIndex = curFarms.findIndex((f) => f.id === farmId);
      if (targetFarmIndex === -1) return;

      const targetFarm = { ...curFarms[targetFarmIndex] };
      const plantIndex = (targetFarm.plants || []).findIndex((p) => p.id === plantId);
      if (plantIndex === -1) return;

      const targetPlant = { ...targetFarm.plants[plantIndex] };

      const isUncertain = state.data.isUncertain || state.data.result.classification === 'uncertain';
      const obsStatus =
        state.data.result.classification === 'healthy'
          ? 'healthy'
          : isUncertain
          ? 'suspected'
          : 'disease';

      const newObs: Observation = {
        id: `obs-${Date.now()}`,
        farm_id: farmId,
        plant_id: plantId,
        observed_at: new Date().toISOString().split('T')[0],
        status: obsStatus,
        condition: state.data.result.diseaseName,
        notes: `AI diagnosis: ${state.data.result.diseaseName} (${Math.round(
          (state.data.result.confidence ?? 0) * 100
        )}% confidence). ${notes.trim() ? `Notes: ${notes.trim()}` : ''}`.trim(),
      };

      // Prepend observation, preserving all existing observations
      const existingObs = Array.isArray(targetPlant.observations) ? targetPlant.observations : [];
      targetPlant.observations = [newObs, ...existingObs];
      targetPlant.status = obsStatus;

      targetFarm.plants = [
        ...targetFarm.plants.slice(0, plantIndex),
        targetPlant,
        ...targetFarm.plants.slice(plantIndex + 1),
      ];

      const updatedFarms = [
        ...curFarms.slice(0, targetFarmIndex),
        targetFarm,
        ...curFarms.slice(targetFarmIndex + 1),
      ];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFarms));
      setFarms(updatedFarms);
      setSavedObservationSuccess(
        `Saved observation to plant ${plantId} in ${targetFarm.name}! Previous observations preserved.`
      );

      // Persist to backend database if user is authenticated
      recordBackendObservation(farmId, plantId, {
        status: obsStatus,
        condition: state.data.result.diseaseName,
        confidence: state.data.result.confidence,
        notes: newObs.notes ?? undefined,
        observed_at: newObs.observed_at,
      }).catch((e) => {
        console.warn('Backend observation save notice:', e);
      });
    } catch (err) {
      console.error('Failed to save observation:', err);
    }
  };

  return (
    <div>
      <PageHeader
        icon={Microscope}
        title="Disease Detection"
        description="Upload or capture a photo of a pineapple plant or leaf. Loumi diagnoses the condition using your trained YOLOv8n-cls model, provides evidence-based agricultural advice, and allows linking to your farm plant records."
      />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Section 1: Upload & Farm Selection */}
          <section className="space-y-6">
            <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
              <h2 className="font-display text-lg font-semibold text-forest-900">
                1. Add a photo
              </h2>
              <p className="mt-1 text-sm text-forest-600">
                For best results, photograph a single leaf in daylight, filling the frame (minimum 224x224 px).
              </p>
              <div className="mt-5">
                <ImageUploader
                  previewUrl={previewUrl}
                  onFileSelected={handleFile}
                  onClear={clear}
                  disabled={state.status === 'loading'}
                />
              </div>

              <div className="mt-5">
                <TextareaField
                  label="Field Notes (optional)"
                  id="notes"
                  placeholder="e.g. leaves yellowing at the edges, observed near furrow, ant activity noted"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Farm & Plant Association Card */}
            <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-forest-700" />
                <h3 className="font-display text-base font-semibold text-forest-900">
                  Farm &amp; Plant Association (Optional)
                </h3>
              </div>
              <p className="mt-1 text-xs text-forest-600">
                Associate this scan with a specific pineapple plant in your farm layout to maintain health observation records.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="farm-select" className="block text-xs font-semibold text-forest-800">
                    Select Farm Plot
                  </label>
                  <select
                    id="farm-select"
                    value={selectedFarmId}
                    onChange={(e) => {
                      setSelectedFarmId(e.target.value);
                      setSelectedPlantId('');
                    }}
                    className="mt-1.5 w-full rounded-xl border border-forest-200 bg-white px-3 py-2 text-xs font-medium text-forest-900 shadow-xs focus:border-forest-500 focus:outline-hidden focus:ring-1 focus:ring-forest-500"
                  >
                    <option value="">-- None (General Leaf Scan) --</option>
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.variety || 'Pineapple'}, {f.plants?.length || 0} plants)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="plant-select" className="block text-xs font-semibold text-forest-800">
                    Select Plant Node
                  </label>
                  <select
                    id="plant-select"
                    value={selectedPlantId}
                    disabled={!selectedFarm}
                    onChange={(e) => setSelectedPlantId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-forest-200 bg-white px-3 py-2 text-xs font-medium text-forest-900 shadow-xs focus:border-forest-500 focus:outline-hidden focus:ring-1 focus:ring-forest-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">-- Select a plant --</option>
                    {(selectedFarm?.plants || []).slice(0, 300).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} (Row {p.row}, Col {p.pos} - Status: {p.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedPlant && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-forest-50/70 p-3 text-xs text-forest-700">
                  <div>
                    <span className="font-semibold text-forest-900">{selectedPlant.id}</span>
                    <span className="ml-2">
                      Row {selectedPlant.row}, Pos {selectedPlant.pos}
                    </span>
                    <span className="ml-2 font-mono text-forest-500">
                      ({selectedPlant.x.toFixed(1)}m, {selectedPlant.y.toFixed(1)}m)
                    </span>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-forest-200">
                    Status: {selectedPlant.status}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={analyze}
              disabled={!file || state.status === 'loading'}
              size="lg"
              className="w-full sm:w-auto"
            >
              <Sparkles className="h-5 w-5" /> Analyze Leaf Image
            </Button>
          </section>

          {/* Section 2: Results & Diagnosis */}
          <section className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold text-forest-900">
              2. Diagnosis &amp; Recommendations
            </h2>

            {state.status === 'idle' && (
              <div className="mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-forest-200 bg-forest-50/40 p-8 text-center">
                <Microscope className="h-8 w-8 text-forest-400" />
                <p className="text-sm text-forest-600">
                  Select a photo and tap <strong>Analyze Leaf Image</strong> to receive diagnosis, class probabilities, and agricultural management guidance.
                </p>
              </div>
            )}

            {state.status === 'loading' && (
              <LoadingState
                label="Analyzing leaf photo with YOLOv8n-cls…"
                description="Evaluating leaf patterns against Pineapple Leaf Blight, Fusarium, Mealybug Wilt, and Healthy Pineapple."
                className="mt-5"
              />
            )}

            {state.status === 'unavailable' && (
              <div className="mt-5 space-y-4">
                <ServiceUnavailable
                  message={state.message}
                  endpoint={API_ENDPOINTS.diseaseDetection}
                />
              </div>
            )}

            {state.status === 'error' && (
              <div className="mt-5">
                <ErrorMessage
                  title="Analysis failed"
                  message={state.message}
                  onRetry={() => analyze()}
                />
              </div>
            )}

            {state.status === 'success' && (
              <div className="mt-5 space-y-6">
                {/* Image preview thumbnail in results */}
                {previewUrl && (
                  <div className="flex items-center gap-4 rounded-xl border border-forest-100 bg-forest-50/30 p-3">
                    <img
                      src={previewUrl}
                      alt="Analyzed leaf"
                      className="h-16 w-16 rounded-lg object-cover ring-1 ring-forest-200"
                    />
                    <div className="text-xs text-forest-700">
                      <p className="font-semibold text-forest-900">{file?.name || 'leaf.jpg'}</p>
                      <p className="text-forest-500">
                        {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                        Model: {state.data.modelVersion || 'YOLOv8n-cls'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Validation feedback if image was not recognized as a valid pineapple leaf */}
                {state.data.validation && !state.data.validation.is_valid_leaf ? (
                  <ValidationFeedbackView
                    validation={state.data.validation}
                    onReset={clear}
                  />
                ) : state.data.result ? (
                  <>
                    {/* Farm plant association confirmation if selected */}
                    {selectedFarm && selectedPlant && (
                      <div className="rounded-xl border border-forest-200 bg-forest-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BookmarkCheck className="h-5 w-5 text-forest-700" />
                            <div>
                              <p className="text-xs font-semibold text-forest-900">
                                Associate result with {selectedPlant.id} ({selectedFarm.name})
                              </p>
                              <p className="text-xs text-forest-600">
                                Will record an observation without overwriting existing history.
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSaveObservation()}
                          >
                            Save Observation
                          </Button>
                        </div>

                        {savedObservationSuccess && (
                          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-100 p-2.5 text-xs font-medium text-emerald-800">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{savedObservationSuccess}</span>
                            </div>
                            <Link
                              to="/farm-planner"
                              className="inline-flex items-center gap-1 font-semibold text-emerald-900 underline hover:text-emerald-950"
                            >
                              View Map <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Main Disease Result Card */}
                    <DiseaseResultView
                      data={state.data}
                      result={state.data.result}
                      warnings={state.data.warnings}
                    />
                  </>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DiseaseResultView({
  data,
  result,
  warnings,
}: {
  data: DiseaseDetectionResponse;
  result?: DiseaseResult | null;
  warnings?: string[];
}) {
  if (!result) return null;

  const isUncertain = data.isUncertain || result.classification === 'uncertain';
  const tone =
    result.classification === 'healthy'
      ? 'success'
      : isUncertain
      ? 'warning'
      : 'error';

  const hasConfidence = typeof result.confidence === 'number';
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <>
      {/* Uncertainty Caution Alert */}
      {isUncertain && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-xs">
            <p className="font-bold text-amber-900">Uncertain Prediction (&lt; 60% confidence)</p>
            <p className="mt-1 text-amber-800">
              The model confidence is below the diagnostic threshold. AI predictions are preliminary and not a confirmed diagnosis. Please do not apply chemical treatments without physically verifying with an agricultural extension officer (KVK Manipur).
            </p>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && !isUncertain && (
        <div className="flex items-start gap-3 rounded-xl border border-pineapple-200 bg-pineapple-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-pineapple-700" />
          <div>
            <p className="text-xs font-semibold text-pineapple-900">Advisory notice</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-pineapple-800">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ResultCard tone={tone} title={result.diseaseName}>
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${classBadge[result.classification]}`}
          >
            <Activity className="h-3.5 w-3.5" />
            {result.classification === 'healthy'
              ? 'Healthy'
              : result.classification === 'diseased'
              ? 'Diseased'
              : 'Uncertain'}
          </span>
          {hasConfidence && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-forest-700 ring-1 ring-forest-200">
              Confidence: {Math.round((result.confidence ?? 0) * 100)}%
            </span>
          )}
        </div>

        {/* Probability Breakdown across all 4 classes */}
        {data.rankedClasses && data.rankedClasses.length > 0 && (
          <div className="mt-6 rounded-xl border border-forest-100 bg-forest-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-forest-700">
              Class Probability Distribution
            </p>
            <div className="mt-3 space-y-2.5">
              {data.rankedClasses.map((item: RankedClass) => {
                const isTop = item.className === data.topClass;
                return (
                  <div key={item.className} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className={isTop ? 'font-bold text-forest-900' : 'text-forest-700'}>
                        {item.displayName}
                        {isTop && ' (Top Prediction)'}
                      </span>
                      <span className="font-mono text-forest-600">{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-forest-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.className === 'Pineapple_healthy'
                            ? 'bg-emerald-500'
                            : isTop && isUncertain
                            ? 'bg-amber-500'
                            : isTop
                            ? 'bg-red-500'
                            : 'bg-forest-400'
                        }`}
                        style={{ width: `${Math.max(item.percentage, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Symptoms */}
        {result.symptoms.length > 0 && (
          <div className="mt-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest-800">
              <ListChecks className="h-4 w-4" /> Visible symptoms (Agricultural Guide)
            </p>
            <div className="mt-2">
              <ResultList items={result.symptoms} />
            </div>
          </div>
        )}

        {/* Recommended Next Steps */}
        {result.nextSteps.length > 0 && (
          <div className="mt-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest-800">
              <ShieldQuestion className="h-4 w-4" /> Recommended Next Steps (Non-Chemical / Field Actions)
            </p>
            <div className="mt-2">
              <ResultList items={result.nextSteps} ordered />
            </div>
          </div>
        )}

        {/* Prevention */}
        {result.prevention.length > 0 && (
          <div className="mt-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest-800">
              <ShieldQuestion className="h-4 w-4" /> Prevention &amp; Management
            </p>
            <div className="mt-2">
              <ResultList items={result.prevention} />
            </div>
          </div>
        )}

        {/* Citations / Sources Accordion */}
        {data.sources && Object.keys(data.sources).length > 0 && (
          <div className="mt-5 border-t border-forest-100 pt-4">
            <button
              type="button"
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex w-full items-center justify-between text-xs font-semibold text-forest-800 hover:text-forest-900"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-forest-600" />
                Agricultural Literature &amp; Sources ({Object.keys(data.sources).length})
              </span>
              {sourcesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {sourcesOpen && (
              <div className="mt-3 space-y-2 rounded-xl bg-forest-50/50 p-3 text-xs text-forest-700">
                {Object.entries(data.sources).slice(0, 5).map(([key, src]: [string, DiseaseSource]) => (
                  <div key={key} className="border-b border-forest-100 pb-2 last:border-0 last:pb-0">
                    <p className="font-semibold text-forest-900">
                      [{key}] {src.title}
                    </p>
                    {src.org && <p className="text-forest-600">{src.org}</p>}
                    {src.quality && (
                      <p className="text-xs text-forest-500">Evidence Quality: {src.quality}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ResultCard>

      {/* Smart Contextual Agricultural Inputs from Loumi Marketplace */}
      <ContextualRecommendationsView
        diseaseClass={data.topClass || (result.classification === 'healthy' ? 'Pineapple_healthy' : undefined)}
        displayName={data.displayName || result.diseaseName}
      />

      <div className="rounded-xl border border-forest-100 bg-white p-3 text-xs text-forest-500">
        <p className="font-semibold text-forest-700">Agricultural Guidance Disclaimer</p>
        <p className="mt-0.5">
          {data.limitationText ||
            'Model scores are uncalibrated and provide a preliminary AI-assisted assessment only, not a confirmed diagnosis. Always verify with an agricultural expert before chemical application.'}
        </p>
      </div>
    </>
  );
}

function ContextualRecommendationsView({
  diseaseClass,
  displayName,
}: {
  diseaseClass?: string | null;
  displayName?: string | null;
}) {
  const [data, setData] = useState<MarketplaceRecommendation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchRecommendations('Pineapple', diseaseClass || undefined);
        if (active) setData(res);
      } catch (e) {
        console.error('Failed to load marketplace recommendations:', e);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [diseaseClass]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-forest-100 bg-white p-4 text-center text-xs text-forest-600">
        Loading agricultural input recommendations...
      </div>
    );
  }

  if (!data || data.recommendations.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-b from-emerald-50/50 via-white to-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-forest-900">
              Recommended Agricultural Inputs for Manipur
            </h4>
            <p className="text-[11px] text-forest-600">
              Verified bio-protectants &amp; inputs suited for {displayName || 'this diagnosed condition'}
            </p>
          </div>
        </div>

        <Link
          to={`/marketplace?crop=Pineapple`}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
        >
          <span>View All in Marketplace</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {data.advisory_notes.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-forest-700 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
          <p className="font-bold text-emerald-950 text-[11px]">Agronomic Advisory Guidance:</p>
          {data.advisory_notes.map((note, idx) => (
            <p key={idx} className="flex items-start gap-1.5 text-[11px]">
              <span className="text-emerald-600 font-bold">•</span>
              <span>{note}</span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.recommendations.map((rec) => (
          <div
            key={rec.product.id}
            className="flex flex-col justify-between rounded-xl border border-forest-100 bg-white p-3.5 shadow-2xs hover:border-emerald-300 transition"
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                  {rec.application_priority}
                </span>
                <span className="text-[11px] font-semibold text-forest-500">
                  {rec.product.package_size}
                </span>
              </div>

              <h5 className="mt-2 font-display text-xs font-bold text-forest-900 line-clamp-1">
                {rec.product.name}
              </h5>
              <p className="mt-1 text-[11px] text-forest-600 line-clamp-2 leading-tight">
                {rec.relevance_reason}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-forest-50 pt-2">
              <span className="font-display text-sm font-extrabold text-forest-900">
                ₹{rec.product.price.toFixed(0)}
              </span>

              <div className="flex items-center gap-1.5">
                <Link
                  to={`/marketplace/product/${rec.product.id}#offline-shops`}
                  className="rounded-full border border-forest-200 bg-white p-1 text-forest-600 hover:bg-forest-50"
                  title="Find in nearby Manipur shops"
                >
                  <Store className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to={`/marketplace/product/${rec.product.id}`}
                  className="rounded-full bg-forest-800 px-3 py-1 text-[11px] font-bold text-white hover:bg-forest-900"
                >
                  Details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-forest-500 italic">
        {data.disclaimer}
      </p>
    </div>
  );
}

function ValidationFeedbackView({
  validation,
  onReset,
}: {
  validation: ImageValidationDetails;
  onReset: () => void;
}) {
  const isFruit = validation.category === 'fruit';
  const isPlant = validation.category === 'plant';

  const toneConfig = isFruit
    ? {
        border: 'border-amber-300',
        bg: 'bg-amber-50/60',
        badgeBg: 'bg-amber-100 text-amber-800 ring-amber-300',
        title: 'Pineapple Fruit Recognized',
        subtitle: 'Valid Pineapple Part — Not a Leaf',
        icon: Info,
        iconColor: 'text-amber-600',
        tip: 'The disease detection model is specifically trained to diagnose leaf conditions (Leaf Blight, Fusarium, Mealybug Wilt). For leaf health checks, please capture or upload an image of a pineapple leaf.',
      }
    : isPlant
    ? {
        border: 'border-teal-300',
        bg: 'bg-teal-50/60',
        badgeBg: 'bg-teal-100 text-teal-800 ring-teal-300',
        title: 'Whole Pineapple Plant Recognized',
        subtitle: 'Wide Plantation/Plant View Detected',
        icon: Info,
        iconColor: 'text-teal-600',
        tip: 'For an accurate disease diagnosis, please photograph a single leaf up close filling the center of the frame in good lighting.',
      }
    : {
        border: 'border-red-300',
        bg: 'bg-red-50/60',
        badgeBg: 'bg-red-100 text-red-800 ring-red-300',
        title: 'Non-Pineapple Image Detected',
        subtitle: 'Image Filtered by Pre-Inference Validation',
        icon: AlertTriangle,
        iconColor: 'text-red-600',
        tip: 'Our pre-inference validation filters out unrelated objects (bicycles, vehicles, buildings, people, or other non-pineapple crop species) to prevent false disease diagnoses. Please upload a clear photo of a pineapple leaf.',
      };

  const IconComponent = toneConfig.icon;

  const categoryLabels: Record<ValidationCategory, string> = {
    leaf: 'Pineapple Leaf',
    fruit: 'Pineapple Fruit',
    plant: 'Whole Pineapple Plant',
    invalid: 'Non-Pineapple / Unrelated',
  };

  return (
    <div className={`rounded-2xl border ${toneConfig.border} ${toneConfig.bg} p-6 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2.5 shadow-xs ring-1 ring-forest-100">
          <IconComponent className={`h-6 w-6 ${toneConfig.iconColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneConfig.badgeBg}`}
            >
              Category: {validation.category.toUpperCase()}
            </span>
            <span className="text-xs text-forest-500 font-mono">
              CLIP Pre-Validation
            </span>
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-forest-900">
            {toneConfig.title}
          </h3>
          <p className="text-xs text-forest-600">{toneConfig.subtitle}</p>
        </div>
      </div>

      <p className="mt-4 text-xs font-medium leading-relaxed text-forest-800">
        {validation.message}
      </p>

      {/* Validation Confidence Scores */}
      {validation.category_scores && (
        <div className="mt-5 rounded-xl border border-forest-100 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-forest-700">
            Image Validation Confidence Breakdown
          </p>
          <div className="mt-3 space-y-2.5">
            {(['leaf', 'fruit', 'plant', 'invalid'] as ValidationCategory[]).map((cat) => {
              const score = validation.category_scores[cat] ?? 0;
              const isSelected = validation.category === cat;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className={isSelected ? 'font-bold text-forest-900' : 'text-forest-700'}>
                      {categoryLabels[cat]} {isSelected && '(Detected)'}
                    </span>
                    <span className="font-mono text-forest-600">
                      {(score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isSelected
                          ? cat === 'leaf'
                            ? 'bg-emerald-600'
                            : cat === 'fruit'
                            ? 'bg-amber-500'
                            : cat === 'plant'
                            ? 'bg-teal-600'
                            : 'bg-red-500'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, score * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tip Banner */}
      <div className="mt-4 rounded-xl border border-forest-100 bg-white/70 p-3 text-xs text-forest-700">
        <p className="font-semibold text-forest-900">Guidance:</p>
        <p className="mt-0.5">{toneConfig.tip}</p>
      </div>

      <div className="mt-5 flex gap-3">
        <Button size="sm" variant="outline" onClick={onReset} className="w-full sm:w-auto">
          Upload Another Photo
        </Button>
      </div>
    </div>
  );
}
