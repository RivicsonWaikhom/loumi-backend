import { useState } from 'react';
import {
  CloudSun,
  Sparkles,
  LocateFixed,
  Search,
  MapPin,
  Thermometer,
  Droplets,
  CloudRain,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  BookOpen,
  Calendar,
  Layers,
  CheckCircle2,
  X,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorMessage from '@/components/ErrorMessage';
import ServiceUnavailable from '@/components/ServiceUnavailable';
import ResultCard, { ResultList } from '@/components/ResultCard';
import { Button } from '@/components/ui/Button';
import {
  FormGrid,
  TextField,
  NumberField,
  SelectField,
} from '@/components/ui/FormField';
import {
  predictDiseaseRisk,
  fetchWeather,
  geocodePlace,
  isWeatherApiConfigured,
  type GeocodeResult,
} from '@/services/weatherDiseaseService';
import { API_ENDPOINTS } from '@/config/api';
import { ApiError } from '@/services/apiClient';
import type {
  WeatherDiseaseRequest,
  WeatherDiseaseResponse,
  DiseaseRisk,
  RiskLevel,
  WeatherConditions,
} from '@/types/weatherDisease';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'success'; data: WeatherDiseaseResponse };

const riskMeta: Record<
  RiskLevel,
  {
    label: string;
    tone: 'success' | 'warning' | 'error' | 'neutral' | 'info';
    icon: typeof ShieldCheck;
    barColor: string;
    score: number;
  }
> = {
  low: { label: 'Low risk', tone: 'success', icon: ShieldCheck, barColor: 'bg-emerald-500', score: 18 },
  moderate: { label: 'Moderate risk', tone: 'warning', icon: AlertTriangle, barColor: 'bg-amber-500', score: 55 },
  high: { label: 'High risk', tone: 'error', icon: ShieldAlert, barColor: 'bg-red-500', score: 92 },
  insufficient_data: { label: 'Insufficient data', tone: 'neutral', icon: Info, barColor: 'bg-gray-300', score: 0 },
  not_assessable: { label: 'Cannot be assessed from weather', tone: 'neutral', icon: Info, barColor: 'bg-gray-300', score: 0 },
};

const initialForm: WeatherDiseaseRequest = {
  state: 'Manipur',
  district: 'Imphal West',
  village: '',
  latitude: 24.817,
  longitude: 93.936,
  flower_induction_date: '',
  drainage: '',
  forecastDays: 7,
  weather: {
    temperatureC: undefined,
    humidity: undefined,
    rainfallMm: undefined,
  },
};

export default function WeatherDiseasePrediction() {
  const [form, setForm] = useState<WeatherDiseaseRequest>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<State>({ status: 'idle' });
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherSuccess, setWeatherSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [selectedPlaceName, setSelectedPlaceName] = useState('Imphal, Manipur');

  const update = <K extends keyof WeatherDiseaseRequest>(
    key: K,
    value: WeatherDiseaseRequest[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const updateWeather = (key: keyof WeatherConditions, value: number | undefined) => {
    setForm((f) => ({ ...f, weather: { ...f.weather, [key]: value } }));
    setWeatherSuccess(null);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setWeatherError('Geolocation is not supported by your browser.');
      return;
    }
    setWeatherError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        setForm((f) => ({
          ...f,
          latitude: lat,
          longitude: lon,
        }));
        setSelectedPlaceName(`GPS (${lat}°, ${lon}°)`);
      },
      () => setWeatherError('Location access was denied. You can search for your place below.')
    );
  };

  const handleSearchPlace = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setWeatherError(null);
    try {
      const results = await geocodePlace(q);
      setSearchResults(results);
      if (results.length === 0) {
        setWeatherError(`No matching places found for "${q}". Try a district or city name.`);
      } else if (results.length === 1) {
        selectGeocodeResult(results[0]);
      }
    } catch (err) {
      setWeatherError(err instanceof ApiError ? err.message : 'Geocoding failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectGeocodeResult = (r: GeocodeResult) => {
    const lat = Number(r.latitude.toFixed(4));
    const lon = Number(r.longitude.toFixed(4));
    const label = [r.name, r.admin, r.country].filter(Boolean).join(', ');
    setForm((f) => ({
      ...f,
      latitude: lat,
      longitude: lon,
      district: r.name,
      state: r.admin ?? f.state,
    }));
    setSelectedPlaceName(label);
    setSearchResults([]);
    setSearchQuery('');
  };

  const fetchLiveWeather = async () => {
    if (!isWeatherApiConfigured()) {
      setWeatherError('Weather service is not configured.');
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      setWeatherError('Please specify latitude & longitude or search a place first.');
      return;
    }
    setWeatherError(null);
    setWeatherSuccess(null);
    try {
      const w = await fetchWeather(form.latitude, form.longitude);
      setForm((f) => ({
        ...f,
        weather: {
          temperatureC: w.temperatureC,
          humidity: w.humidity,
          rainfallMm: w.rainfallMm,
          observed: true,
          source: w.source,
          timezone: w.timezone,
        },
      }));
      setWeatherSuccess(`Loaded: ${w.temperatureC}°C, ${w.humidity}% humidity, ${w.rainfallMm}mm rain (Open-Meteo)`);
    } catch (err) {
      setWeatherError(err instanceof ApiError ? err.message : 'Could not fetch live weather.');
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (form.latitude == null || form.longitude == null) {
      if (!form.state?.trim() && !form.district?.trim()) {
        next.state = 'Provide coordinates or select a location.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setState({ status: 'loading' });
    try {
      const data = await predictDiseaseRisk(form);
      setState({ status: 'success', data });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'network_error' || err.status === 0)) {
        setState({
          status: 'unavailable',
          message:
            'The weather disease prediction backend is not connected yet. Please ensure the backend is running at http://localhost:8000.',
        });
      } else {
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : 'Prediction failed.',
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-forest-50/30 pb-16">
      <PageHeader
        icon={CloudSun}
        title="Weather Disease Early Warning"
        description="Evidence-based pineapple disease early warning model. Uses local 7-day past and 3-day forecast weather from Open-Meteo, crop growth stage, and drainage to estimate disease favorability."
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] items-start">
          {/* Left Form: Combined into a Single Cohesive Card */}
          <section className="rounded-2xl border border-forest-100 bg-white p-5 sm:p-7 shadow-card space-y-6">
            {/* Section 1: Farm Location */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-forest-100">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-forest-100 text-forest-700 font-semibold text-xs sm:text-sm">
                    1
                  </span>
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-semibold text-forest-900">
                      Farm Location
                    </h2>
                    <p className="text-xs text-forest-500">
                      Coordinates or place name for weather lookup
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={useMyLocation}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-forest-50/50 px-3 py-1.5 text-xs font-semibold text-forest-700 shadow-2xs transition hover:bg-forest-100/70 hover:border-forest-300"
                >
                  <LocateFixed className="h-3.5 w-3.5 text-forest-600" />
                  <span>Use GPS</span>
                </button>
              </div>

              {/* Geocoding place search bar */}
              <div className="mt-4 space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest-700">
                  Search Place / Town
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search place, e.g. Imphal, Churachandpur"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchPlace();
                        }
                      }}
                      className="w-full rounded-xl border border-forest-200 bg-forest-50/30 px-3.5 py-2.5 text-xs sm:text-sm text-forest-900 placeholder:text-forest-400 focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchPlace}
                    disabled={isSearching || !searchQuery.trim()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-forest-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Search</span>
                  </button>
                </div>

                {/* Dropdown search results */}
                {searchResults.length > 0 && (
                  <div className="rounded-xl border border-forest-200 bg-white p-2 shadow-lg space-y-1">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-forest-500">
                        Matching Places:
                      </span>
                      <button
                        type="button"
                        onClick={() => setSearchResults([])}
                        className="text-forest-400 hover:text-forest-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {searchResults.map((r, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectGeocodeResult(r)}
                        className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-forest-900 transition hover:bg-forest-50 flex items-center justify-between"
                      >
                        <span className="font-medium text-forest-800">
                          {r.name}{r.admin ? `, ${r.admin}` : ''} ({r.country})
                        </span>
                        <span className="text-[11px] text-forest-500 font-mono">
                          {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}°
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Current Selected Location Indicator */}
                {selectedPlaceName && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3.5 py-2 text-xs text-emerald-950 border border-emerald-200/80">
                    <MapPin className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span className="font-medium truncate">
                      Active: <strong>{selectedPlaceName}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Coordinates & Region Grid */}
              <div className="mt-4 pt-4 border-t border-forest-100">
                <FormGrid>
                  <TextField
                    label="State"
                    id="state"
                    placeholder="e.g. Manipur"
                    value={form.state ?? ''}
                    onChange={(e) => update('state', e.target.value)}
                  />
                  <TextField
                    label="District"
                    id="district"
                    placeholder="e.g. Imphal West"
                    value={form.district ?? ''}
                    onChange={(e) => update('district', e.target.value)}
                  />
                  <NumberField
                    label="Latitude"
                    id="lat"
                    unit="°"
                    step="0.0001"
                    value={form.latitude ?? ''}
                    onChange={(e) =>
                      update('latitude', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                  <NumberField
                    label="Longitude"
                    id="lon"
                    unit="°"
                    step="0.0001"
                    value={form.longitude ?? ''}
                    onChange={(e) =>
                      update('longitude', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </FormGrid>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-forest-100" />

            {/* Section 2: Crop Growth Stage & Soil Drainage */}
            <div>
              <div className="flex items-center gap-2.5 pb-3.5 border-b border-forest-100">
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-forest-100 text-forest-700 font-semibold text-xs sm:text-sm">
                  2
                </span>
                <div>
                  <h3 className="font-display text-base sm:text-lg font-semibold text-forest-900">
                    Crop Parameters
                  </h3>
                  <p className="text-xs text-forest-500">
                    Flower induction date & soil drainage
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="flower_induction_date"
                    className="mb-1.5 block text-sm font-medium text-forest-800"
                  >
                    Flower Induction Date <span className="text-xs font-normal text-forest-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    id="flower_induction_date"
                    value={form.flower_induction_date ?? ''}
                    onChange={(e) => update('flower_induction_date', e.target.value)}
                    className="w-full rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-sm text-forest-900 transition focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
                  />
                  <p className="mt-1 text-[11px] text-forest-500 leading-tight">
                    Required for fruitlet core rot & fusariosis stage windows.
                  </p>
                </div>

                <div>
                  <SelectField
                    label="Soil Drainage"
                    id="drainage"
                    optional
                    value={form.drainage ?? ''}
                    onChange={(e) => update('drainage', (e.target.value as 'poor' | 'good' | '') || '')}
                  >
                    <option value="">Unknown / Standard</option>
                    <option value="good">Good (well-drained raised beds)</option>
                    <option value="poor">Poor (waterlogged / restricted)</option>
                  </SelectField>
                  <p className="mt-1 text-[11px] text-forest-500 leading-tight">
                    Poor drainage elevates Phytophthora root/heart rot risk.
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-forest-100" />

            {/* Section 3: Weather Conditions */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-forest-100">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-forest-100 text-forest-700 font-semibold text-xs sm:text-sm">
                    3
                  </span>
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-semibold text-forest-900">
                      Local Weather
                    </h3>
                    <p className="text-xs text-forest-500">
                      Open-Meteo 7d past & 3d forecast model data
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchLiveWeather}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-forest-200 bg-forest-50/50 px-3.5 py-1.5 text-xs font-semibold text-forest-700 shadow-2xs transition hover:bg-forest-100/70 hover:border-forest-300 self-start sm:self-auto cursor-pointer"
                >
                  <CloudRain className="h-3.5 w-3.5 text-forest-600" />
                  <span>Fetch Live Weather</span>
                </button>
              </div>

              {/* Weather Input Fields: Responsive Grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <NumberField
                  label="Temperature"
                  id="temp"
                  optional
                  unit="°C"
                  value={form.weather?.temperatureC ?? ''}
                  onChange={(e) =>
                    updateWeather('temperatureC', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
                <NumberField
                  label="Humidity"
                  id="humidity"
                  optional
                  unit="%"
                  value={form.weather?.humidity ?? ''}
                  onChange={(e) =>
                    updateWeather('humidity', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
                <NumberField
                  label="Rainfall (7d)"
                  id="rainfall"
                  optional
                  unit="mm"
                  value={form.weather?.rainfallMm ?? ''}
                  onChange={(e) =>
                    updateWeather('rainfallMm', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>

              {/* Success / Error Banners for Weather */}
              {weatherSuccess && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-900 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>{weatherSuccess}</span>
                </div>
              )}

              {weatherError && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 border border-red-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span>{weatherError}</span>
                </div>
              )}
            </div>

            {/* Divider & Submit Action Button */}
            <div className="border-t border-forest-100 pt-2">
              <Button
                onClick={submit}
                disabled={state.status === 'loading'}
                size="lg"
                className="w-full justify-center text-sm sm:text-base py-3.5 shadow-md cursor-pointer"
              >
                <Sparkles className="h-5 w-5" />
                <span>Assess Weather Disease Risk</span>
              </Button>
            </div>
          </section>

          {/* Right Panel: Disease Risk Assessment Results */}
          <section className="rounded-2xl border border-forest-100 bg-white p-5 sm:p-7 shadow-card">
            <h2 className="font-display text-lg font-semibold text-forest-900">
              Early Warning Assessment
            </h2>

            {state.status === 'idle' && (
              <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-forest-200 bg-forest-50/40 p-10 text-center">
                <div className="rounded-full bg-forest-100 p-3 text-forest-700">
                  <CloudSun className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-forest-900">
                    Ready to Evaluate Environmental Favorability
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-forest-600 max-w-md leading-relaxed">
                    Set your farm location and parameters on the left, then click <strong>Assess Weather Disease Risk</strong> to view evidence-based risk levels for 6 pineapple diseases.
                  </p>
                </div>
              </div>
            )}

            {state.status === 'loading' && (
              <LoadingState
                label="Retrieving local weather & assessing disease favorability…"
                description="The evidence-based risk engine is analyzing recent rain persistence, temperature windows, and drainage."
                className="mt-6"
              />
            )}

            {state.status === 'unavailable' && (
              <div className="mt-6">
                <ServiceUnavailable
                  title="Weather Disease Service Unavailable"
                  message={state.message}
                  endpoint={API_ENDPOINTS.weatherDisease}
                />
              </div>
            )}

            {state.status === 'error' && (
              <div className="mt-6">
                <ErrorMessage
                  title="Assessment Failed"
                  message={state.message}
                  onRetry={submit}
                />
              </div>
            )}

            {state.status === 'success' && <RiskView data={state.data} />}
          </section>
        </div>
      </div>
    </div>
  );
}

function RiskView({ data }: { data: WeatherDiseaseResponse }) {
  const w = data.weather;
  const s = data.summary;

  return (
    <div className="mt-5 space-y-6">
      {/* Weather conditions card */}
      <ResultCard tone="info" title="Observed & Forecast Weather" icon={CloudSun}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {w.temperatureC != null && (
            <Stat icon={Thermometer} label="Temperature" value={`${w.temperatureC}°C`} />
          )}
          {w.humidity != null && (
            <Stat icon={Droplets} label="Humidity" value={`${w.humidity}%`} />
          )}
          {s?.rain_7d_mm != null && (
            <Stat icon={CloudRain} label="Past 7d Rain" value={`${s.rain_7d_mm} mm`} />
          )}
          {s?.rain_fcst_3d_mm != null && (
            <Stat icon={CloudRain} label="Forecast 3d Rain" value={`${s.rain_fcst_3d_mm} mm`} />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-forest-600 border-t border-forest-100/80 pt-2.5">
          <span>{w.source ?? 'Weather data by Open-Meteo.com (forecast/model data)'}</span>
          {s?.wet_run_days != null && (
            <span className="font-semibold text-forest-800">
              Consecutive wet days: {s.wet_run_days}
            </span>
          )}
        </div>
      </ResultCard>

      {/* Disease Risks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-forest-900">
            Disease Favorability Breakdown ({data.risks.length} Conditions)
          </h3>
          <span className="text-[11px] text-forest-500">
            Engine version: {data.engine_version ?? '0.1.0'}
          </span>
        </div>

        {data.risks.map((risk, i) => (
          <DiseaseCard key={i} risk={risk} />
        ))}
      </div>

      {/* Bottom Metadata & Scientific Notice */}
      <div className="rounded-xl border border-forest-100 bg-forest-50/50 p-4 text-xs text-forest-600 space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-forest-800">
          <Info className="h-4 w-4 text-forest-700" />
          <span>Integrity & Scientific Scope:</span>
        </div>
        <p className="leading-relaxed">
          {data.note ?? 'Environmental favourability only; not a confirmed diagnosis.'}
          Favourable weather indicates that temperature and moisture conditions match published literature for pathogen activity, but does not guarantee infection or outbreak.
        </p>
        <p className="leading-relaxed text-forest-500">
          For diseases marked <em>"Cannot be assessed from weather"</em> (e.g. Mealybug wilt, Leaf blight), environmental conditions alone cannot establish risk; visual scouting and image diagnosis are required.
        </p>
        {data.predictionTimestamp && (
          <div className="flex items-center gap-1 text-[11px] text-forest-400 pt-1">
            <Clock className="h-3 w-3" />
            <span>Assessed at: {new Date(data.predictionTimestamp).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DiseaseCard({ risk }: { risk: DiseaseRisk }) {
  const meta = riskMeta[risk.riskLevel] ?? riskMeta.insufficient_data;
  const Icon = meta.icon;

  return (
    <ResultCard tone={meta.tone} title={risk.disease} icon={Icon}>
      <div className="space-y-3">
        {/* Risk Level Badge and Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold uppercase tracking-wider text-forest-700">
              {meta.label}
            </span>
            {meta.score > 0 && (
              <span className="font-semibold text-forest-500">
                Favorability Score: {meta.score}/100
              </span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-forest-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${meta.barColor}`}
              style={{ width: `${meta.score}%` }}
            />
          </div>
        </div>

        {/* Contributing Conditions */}
        {risk.contributingConditions.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-forest-800 uppercase tracking-wide">
              Observed Environmental Conditions:
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {risk.contributingConditions.map((cond, i) => (
                <span
                  key={i}
                  className="rounded-md border border-forest-200/80 bg-white px-2.5 py-1 text-xs text-forest-800 font-medium"
                >
                  {cond}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Preventive Actions */}
        {risk.preventiveActions.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-forest-100">
            <p className="text-xs font-semibold text-forest-800 uppercase tracking-wide mb-1.5">
              Recommended Agronomic Checks:
            </p>
            <ResultList items={risk.preventiveActions} />
          </div>
        )}

        {/* Evidence Sources & Scientific Limitations */}
        {risk.evidenceSources && risk.evidenceSources.length > 0 && (
          <div className="mt-2 text-[11px] text-forest-600 bg-white/80 p-2.5 rounded-lg border border-forest-100 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-forest-800">
              <BookOpen className="h-3 w-3 text-forest-600" />
              <span>Evidence Basis:</span>
            </div>
            {risk.evidenceSources.map((ev, idx) => (
              <p key={idx} className="italic text-forest-700">
                &bull; {ev.claim} — <span className="font-medium not-italic">{ev.src} (p. {ev.page})</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </ResultCard>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-forest-50/80 p-3">
      <Icon className="h-4 w-4 text-forest-600" />
      <p className="mt-1.5 font-display text-base font-semibold text-forest-900">{value}</p>
      <p className="text-xs text-forest-500">{label}</p>
    </div>
  );
}
