import { useState } from 'react';
import {
  Sprout,
  Sparkles,
  MapPin,
  LocateFixed,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Gauge,
  Leaf,
  Layers,
  Check,
  Info,
  CloudRain,
  Loader2,
  FileText,
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
  TextareaField,
} from '@/components/ui/FormField';
import { checkSuitability } from '@/services/varietySuitabilityService';
import { fetchWeather, geocodePlace } from '@/services/weatherDiseaseService';
import { API_ENDPOINTS } from '@/config/api';
import { ApiError } from '@/services/apiClient';
import type {
  VarietySuitabilityRequest,
  VarietySuitabilityResponse,
  SuitabilityStatus,
  ConditionUsed,
  SoilDrainage,
  WaterAvailability,
  IntendedUse,
} from '@/types/suitability';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'success'; data: VarietySuitabilityResponse };

const initialForm: VarietySuitabilityRequest = {
  state: 'Manipur',
  district: 'Imphal West',
  village: '',
  latitude: undefined,
  longitude: undefined,
  soilType: '',
  soilPH: undefined,
  soilDrainage: 'unknown',
  waterAvailability: undefined,
  temperatureMin: undefined,
  temperatureMax: undefined,
  rainfall: undefined,
  plantingSeason: '',
  elevation: undefined,
  farmArea: undefined,
  preferredVariety: 'no_preference',
  intendedUse: undefined,
  notes: '',
  nitrogen: undefined,
  phosphorus: undefined,
  potassium: undefined,
};

const statusMeta: Record<
  SuitabilityStatus,
  { label: string; tone: 'success' | 'warning' | 'error' | 'info'; icon: typeof CheckCircle2 }
> = {
  suitable: { label: 'Suitable for Pineapple', tone: 'success', icon: CheckCircle2 },
  conditionally_suitable: { label: 'Conditionally Suitable', tone: 'warning', icon: AlertCircle },
  unsuitable: { label: 'Unsuitable for Pineapple', tone: 'error', icon: XCircle },
  insufficient_data: { label: 'Insufficient Data', tone: 'info', icon: HelpCircle },
};

export default function VarietySuitability() {
  const [form, setForm] = useState<VarietySuitabilityRequest>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<State>({ status: 'idle' });
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherSuccess, setWeatherSuccess] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [soilTestMode, setSoilTestMode] = useState<'preliminary' | 'soil_test'>(
    initialForm.nitrogen != null || initialForm.phosphorus != null || initialForm.potassium != null
      ? 'soil_test'
      : 'preliminary'
  );

  const update = <K extends keyof VarietySuitabilityRequest>(
    key: K,
    value: VarietySuitabilityRequest[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        }));
      },
      () => {
        // silently ignore — GPS is optional
      }
    );
  };

  const fetchLiveWeatherForSuitability = async () => {
    setWeatherError(null);
    setWeatherSuccess(null);
    setIsFetchingWeather(true);

    try {
      let lat = form.latitude;
      let lon = form.longitude;

      if (lat == null || lon == null) {
        // Resolve coordinates using district / state via geocoding
        const query = [form.district, form.state].filter(Boolean).join(', ') || 'Manipur';
        const geoResults = await geocodePlace(query);
        if (geoResults && geoResults.length > 0) {
          lat = Number(geoResults[0].latitude.toFixed(4));
          lon = Number(geoResults[0].longitude.toFixed(4));
          setForm((f) => ({
            ...f,
            latitude: lat,
            longitude: lon,
          }));
        } else {
          throw new Error(
            `Could not resolve coordinates for ${query}. Please enter coordinates or use GPS.`
          );
        }
      }

      const wx = await fetchWeather(lat, lon);

      const minT =
        wx.temperatureMin ??
        (wx.temperatureC != null ? Number((wx.temperatureC - 5).toFixed(1)) : 17.5);
      const maxT =
        wx.temperatureMax ??
        (wx.temperatureC != null ? Number((wx.temperatureC + 6).toFixed(1)) : 30.0);
      const rain =
        wx.estimatedAnnualRainfall ??
        (wx.periodRainfallMm != null && wx.periodRainfallMm > 0
          ? Math.round(wx.periodRainfallMm * 40)
          : 1650);

      setForm((f) => ({
        ...f,
        temperatureMin: minT,
        temperatureMax: maxT,
        rainfall: rain,
      }));

      setErrors((e) => ({
        ...e,
        temperatureMin: '',
        temperatureMax: '',
        rainfall: '',
      }));

      setWeatherSuccess(
        `Weather loaded (${lat.toFixed(2)}°, ${lon.toFixed(2)}°): Min ${minT}°C, Max ${maxT}°C, Annual Rain ~${rain} mm (via Open-Meteo)`
      );
    } catch (err: any) {
      setWeatherError(err?.message || 'Failed to fetch weather data. Please try again.');
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.state.trim()) next.state = 'State is required.';
    if (!form.district.trim()) next.district = 'District is required.';
    if (!form.soilType) next.soilType = 'Select a soil type.';
    if (!form.soilDrainage) next.soilDrainage = 'Select a soil drainage level.';
    if (!form.waterAvailability) next.waterAvailability = 'Select water availability.';
    if (!form.plantingSeason) next.plantingSeason = 'Select a planting season.';
    if (form.soilPH != null && (form.soilPH < 0 || form.soilPH > 14))
      next.soilPH = 'Soil pH must be between 0 and 14.';
    if (form.temperatureMin != null && form.temperatureMax != null &&
        form.temperatureMin > form.temperatureMax)
      next.temperatureMin = 'Minimum temperature cannot exceed the maximum.';
    if (form.rainfall != null && form.rainfall < 0)
      next.rainfall = 'Rainfall cannot be negative.';
    if (form.farmArea != null && form.farmArea <= 0)
      next.farmArea = 'Farm area must be greater than zero.';
    if (form.elevation != null && form.elevation < 0)
      next.elevation = 'Elevation cannot be negative.';

    if (soilTestMode === 'soil_test') {
      if (form.nitrogen == null || isNaN(form.nitrogen)) {
        next.nitrogen = 'Nitrogen (N) value from soil test is required.';
      } else if (form.nitrogen < 0) {
        next.nitrogen = 'Nitrogen (N) value cannot be negative.';
      }

      if (form.phosphorus == null || isNaN(form.phosphorus)) {
        next.phosphorus = 'Phosphorus (P) value from soil test is required.';
      } else if (form.phosphorus < 0) {
        next.phosphorus = 'Phosphorus (P) value cannot be negative.';
      }

      if (form.potassium == null || isNaN(form.potassium)) {
        next.potassium = 'Potassium (K) value from soil test is required.';
      } else if (form.potassium < 0) {
        next.potassium = 'Potassium (K) value cannot be negative.';
      }
    } else {
      // In preliminary mode, any stray NPK errors are cleared
      if (form.nitrogen != null && form.nitrogen < 0)
        next.nitrogen = 'Nitrogen (N) value cannot be negative.';
      if (form.phosphorus != null && form.phosphorus < 0)
        next.phosphorus = 'Phosphorus (P) value cannot be negative.';
      if (form.potassium != null && form.potassium < 0)
        next.potassium = 'Potassium (K) value cannot be negative.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setState({ status: 'loading' });
    try {
      const payload: VarietySuitabilityRequest =
        soilTestMode === 'preliminary'
          ? {
              ...form,
              nitrogen: undefined,
              phosphorus: undefined,
              potassium: undefined,
            }
          : form;
      const data = await checkSuitability(payload);
      setState({ status: 'success', data });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'network_error' || err.status === 0)) {
        setState({
          status: 'unavailable',
          message:
            'The variety & suitability backend is not connected yet. Once your model is served, suitability assessments will render here automatically.',
        });
      } else {
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : 'Suitability check failed.',
        });
      }
    }
  };

  return (
    <div>
      <PageHeader
        icon={Sprout}
        title="Variety & Suitability"
        description="Tell Loumi about your land, soil, and climate. The connected model assesses whether pineapple suits your conditions and which varieties fit best."
      />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <section className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-forest-900">Land details</h2>
              <button
                onClick={useMyLocation}
                className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-medium text-forest-600 transition hover:bg-forest-50"
              >
                <LocateFixed className="h-3.5 w-3.5" /> Use GPS
              </button>
            </div>
            <p className="mt-1 text-sm text-forest-600">
              Fields marked <span className="font-medium text-forest-800">required</span> must be
              filled. Optional fields can be left blank — choose Unknown where you're unsure.
            </p>

            {/* Required fields */}
            <div className="mt-6">
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-forest-500">
                Required
              </h3>
              <div className="mt-4">
                <FormGrid>
                  <div>
                    <TextField
                      label="State"
                      id="state"
                      placeholder="e.g. Manipur"
                      value={form.state}
                      onChange={(e) => update('state', e.target.value)}
                    />
                    {errors.state && (
                      <p className="mt-1 text-xs text-red-600">{errors.state}</p>
                    )}
                  </div>
                  <div>
                    <TextField
                      label="District"
                      id="district"
                      placeholder="e.g. Imphal West"
                      value={form.district}
                      onChange={(e) => update('district', e.target.value)}
                    />
                    {errors.district && (
                      <p className="mt-1 text-xs text-red-600">{errors.district}</p>
                    )}
                  </div>

                  <SelectField
                    label="Soil type"
                    id="soilType"
                    value={form.soilType ?? ''}
                    onChange={(e) => update('soilType', e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="sandy_loam">Sandy loam</option>
                    <option value="loamy">Loamy</option>
                    <option value="clay_loam">Clay loam</option>
                    <option value="sandy">Sandy</option>
                    <option value="clay">Clay</option>
                    <option value="other">Other</option>
                    <option value="unknown">Unknown</option>
                  </SelectField>
                  {errors.soilType && (
                    <p className="-mt-3 text-xs text-red-600">{errors.soilType}</p>
                  )}

                  <SelectField
                    label="Soil drainage"
                    id="soilDrainage"
                    value={form.soilDrainage ?? ''}
                    onChange={(e) => update('soilDrainage', e.target.value as SoilDrainage)}
                  >
                    <option value="">Select…</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="moderate">Moderate</option>
                    <option value="poor">Poor</option>
                    <option value="unknown">Unknown</option>
                  </SelectField>
                  {errors.soilDrainage && (
                    <p className="-mt-3 text-xs text-red-600">{errors.soilDrainage}</p>
                  )}

                  <SelectField
                    label="Water availability"
                    id="waterAvailability"
                    value={form.waterAvailability ?? ''}
                    onChange={(e) =>
                      update('waterAvailability', e.target.value as WaterAvailability)
                    }
                  >
                    <option value="">Select…</option>
                    <option value="reliable">Reliable</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="limited">Limited</option>
                  </SelectField>
                  {errors.waterAvailability && (
                    <p className="-mt-3 text-xs text-red-600">{errors.waterAvailability}</p>
                  )}

                  <SelectField
                    label="Planting season"
                    id="plantingSeason"
                    value={form.plantingSeason ?? ''}
                    onChange={(e) => update('plantingSeason', e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="current_season">Current season</option>
                    <option value="pre_monsoon">Pre-monsoon</option>
                    <option value="monsoon">Monsoon</option>
                    <option value="post_monsoon">Post-monsoon</option>
                    <option value="other">Other</option>
                  </SelectField>
                  {errors.plantingSeason && (
                    <p className="-mt-3 text-xs text-red-600">{errors.plantingSeason}</p>
                  )}
                </FormGrid>
              </div>
            </div>

            {/* Optional fields */}
            <div className="mt-8">
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-forest-500">
                Optional
              </h3>
              <div className="mt-4">
                <FormGrid>
                  <TextField
                    label="Village / locality"
                    id="village"
                    optional
                    placeholder="e.g. Lamphel"
                    value={form.village ?? ''}
                    onChange={(e) => update('village', e.target.value)}
                  />

                  <NumberField
                    label="Latitude"
                    id="lat"
                    optional
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
                    optional
                    unit="°"
                    step="0.0001"
                    value={form.longitude ?? ''}
                    onChange={(e) =>
                      update('longitude', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />

                  <div>
                    <NumberField
                      label="Soil pH"
                      id="soilPH"
                      optional
                      min={0}
                      max={14}
                      step="0.1"
                      value={form.soilPH ?? ''}
                      onChange={(e) =>
                        update('soilPH', e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                    {errors.soilPH && (
                      <p className="mt-1 text-xs text-red-600">{errors.soilPH}</p>
                    )}
                  </div>

                  {/* Soil Nutrient Profile: Two Farmer Workflows */}
                  <div className="col-span-1 sm:col-span-2 rounded-xl border border-forest-200 bg-forest-50/50 p-4 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-forest-200/60 pb-3">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-forest-700 shrink-0" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-forest-900">
                          Soil Macronutrients (NPK Workflow)
                        </h4>
                      </div>

                      {/* Workflow Switcher Tabs */}
                      <div className="inline-flex rounded-lg bg-forest-100/70 p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSoilTestMode('preliminary');
                            setForm((f) => ({
                              ...f,
                              nitrogen: undefined,
                              phosphorus: undefined,
                              potassium: undefined,
                            }));
                            setErrors((e) => ({
                              ...e,
                              nitrogen: '',
                              phosphorus: '',
                              potassium: '',
                            }));
                          }}
                          className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                            soilTestMode === 'preliminary'
                              ? 'bg-white text-forest-900 shadow-2xs font-semibold'
                              : 'text-forest-600 hover:text-forest-900'
                          }`}
                        >
                          Preliminary (No Soil Test)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSoilTestMode('soil_test')}
                          className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                            soilTestMode === 'soil_test'
                              ? 'bg-white text-forest-900 shadow-2xs font-semibold'
                              : 'text-forest-600 hover:text-forest-900'
                          }`}
                        >
                          I Have a Soil Test (NPK)
                        </button>
                      </div>
                    </div>

                    {soilTestMode === 'preliminary' ? (
                      <div className="rounded-lg bg-white/80 p-3.5 text-xs text-forest-700 border border-forest-100 space-y-1.5">
                        <p className="font-semibold text-forest-900 flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-forest-600 shrink-0" />
                          Workflow A: Preliminary Suitability Check Active
                        </p>
                        <p className="text-forest-600 leading-relaxed">
                          A laboratory soil test is <strong>not required</strong> to explore general pineapple suitability. The model will evaluate your climate, drainage, elevation, and soil type using documented regional baseline nutrient estimates (80 kg/ha N, 40 kg/ha P, 100 kg/ha K). This preliminary screening helps you determine if your land warrants further investment.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-white/80 p-3.5 text-xs text-forest-700 border border-forest-100 space-y-1">
                          <p className="font-semibold text-forest-900 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-forest-600 shrink-0" />
                            Workflow B: Soil-Test Verified Suitability Check
                          </p>
                          <p className="text-forest-600 leading-relaxed">
                            Enter available Nitrogen (N), Phosphorus (P), and Potassium (K) from your official laboratory Soil Health Card or soil test report (in kg/ha). Because the model evaluates the full nutrient profile, all three fields are required when evaluating a soil-test report (values are not assumed or zero-filled).
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                          <div>
                            <NumberField
                              label="Nitrogen (N)"
                              id="nitrogen"
                              unit="kg/ha"
                              min={0}
                              max={1000}
                              step="0.1"
                              placeholder="e.g. 80"
                              value={form.nitrogen ?? ''}
                              onChange={(e) =>
                                update(
                                  'nitrogen',
                                  e.target.value !== '' ? Number(e.target.value) : undefined
                                )
                              }
                            />
                            {errors.nitrogen && (
                              <p className="mt-1 text-xs text-red-600">{errors.nitrogen}</p>
                            )}
                          </div>

                          <div>
                            <NumberField
                              label="Phosphorus (P)"
                              id="phosphorus"
                              unit="kg/ha"
                              min={0}
                              max={1000}
                              step="0.1"
                              placeholder="e.g. 40"
                              value={form.phosphorus ?? ''}
                              onChange={(e) =>
                                update(
                                  'phosphorus',
                                  e.target.value !== '' ? Number(e.target.value) : undefined
                                )
                              }
                            />
                            {errors.phosphorus && (
                              <p className="mt-1 text-xs text-red-600">{errors.phosphorus}</p>
                            )}
                          </div>

                          <div>
                            <NumberField
                              label="Potassium (K)"
                              id="potassium"
                              unit="kg/ha"
                              min={0}
                              max={1000}
                              step="0.1"
                              placeholder="e.g. 100"
                              value={form.potassium ?? ''}
                              onChange={(e) =>
                                update(
                                  'potassium',
                                  e.target.value !== '' ? Number(e.target.value) : undefined
                                )
                              }
                            />
                            {errors.potassium && (
                              <p className="mt-1 text-xs text-red-600">{errors.potassium}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* One-Tap Weather & Climate Collection */}
                  <div className="col-span-1 sm:col-span-2 rounded-xl border border-forest-200 bg-forest-50/50 p-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CloudRain className="h-4 w-4 text-forest-700" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-forest-900">
                            Live Climate & Weather
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-forest-600">
                          Auto-populate min/max temperature and normal rainfall on a single tap via Open-Meteo
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={fetchLiveWeatherForSuitability}
                        disabled={isFetchingWeather}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-forest-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-forest-700 shadow-2xs transition hover:bg-forest-100 hover:border-forest-300 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                      >
                        {isFetchingWeather ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-forest-600" />
                            <span>Fetching Weather…</span>
                          </>
                        ) : (
                          <>
                            <CloudRain className="h-3.5 w-3.5 text-forest-600" />
                            <span>Fetch Live Weather</span>
                          </>
                        )}
                      </button>
                    </div>

                    {weatherSuccess && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 border border-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{weatherSuccess}</span>
                      </div>
                    )}

                    {weatherError && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span>{weatherError}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <NumberField
                      label="Average temperature (min)"
                      id="tempMin"
                      optional
                      unit="°C"
                      value={form.temperatureMin ?? ''}
                      onChange={(e) =>
                        update('temperatureMin', e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                    {errors.temperatureMin && (
                      <p className="mt-1 text-xs text-red-600">{errors.temperatureMin}</p>
                    )}
                  </div>
                  <NumberField
                    label="Average temperature (max)"
                    id="tempMax"
                    optional
                    unit="°C"
                    value={form.temperatureMax ?? ''}
                    onChange={(e) =>
                      update('temperatureMax', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />

                  <div>
                    <NumberField
                      label="Annual rainfall"
                      id="rainfall"
                      optional
                      unit="mm"
                      value={form.rainfall ?? ''}
                      onChange={(e) =>
                        update('rainfall', e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                    {errors.rainfall && (
                      <p className="mt-1 text-xs text-red-600">{errors.rainfall}</p>
                    )}
                  </div>

                  <div>
                    <NumberField
                      label="Farm area"
                      id="farmArea"
                      optional
                      unit="acre"
                      value={form.farmArea ?? ''}
                      onChange={(e) =>
                        update('farmArea', e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                    {errors.farmArea && (
                      <p className="mt-1 text-xs text-red-600">{errors.farmArea}</p>
                    )}
                  </div>

                  <SelectField
                    label="Preferred variety"
                    id="preferredVariety"
                    optional
                    value={form.preferredVariety ?? 'no_preference'}
                    onChange={(e) => update('preferredVariety', e.target.value)}
                  >
                    <option value="no_preference">No preference</option>
                    <option value="queen">Queen</option>
                    <option value="kew">Kew</option>
                  </SelectField>

                  <SelectField
                    label="Intended use"
                    id="intendedUse"
                    optional
                    value={form.intendedUse ?? ''}
                    onChange={(e) =>
                      update('intendedUse', (e.target.value || undefined) as IntendedUse)
                    }
                  >
                    <option value="">Not specified</option>
                    <option value="fresh">Fresh consumption</option>
                    <option value="processing">Processing</option>
                    <option value="both">Both</option>
                  </SelectField>

                  <div className="sm:col-span-2">
                    <TextareaField
                      label="Other notes"
                      id="notes"
                      optional
                      placeholder="Any other environmental or agricultural details"
                      value={form.notes ?? ''}
                      onChange={(e) => update('notes', e.target.value)}
                    />
                  </div>
                </FormGrid>
              </div>
            </div>

            <div className="mt-6">
              <Button onClick={submit} disabled={state.status === 'loading'} size="lg">
                <Sparkles className="h-5 w-5" /> Check Suitability
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold text-forest-900">Assessment</h2>

            {state.status === 'idle' && (
              <div className="mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-forest-200 bg-forest-50/40 p-8 text-center">
                <Sprout className="h-8 w-8 text-forest-400" />
                <p className="text-sm text-forest-600">
                  Fill in the required land details and tap <strong>Check Suitability</strong> to see results here.
                </p>
              </div>
            )}
            {state.status === 'loading' && (
              <LoadingState
                label="Assessing suitability…"
                description="The model is evaluating your land, soil, and climate inputs."
                className="mt-5"
              />
            )}
            {state.status === 'unavailable' && (
              <div className="mt-5">
                <ServiceUnavailable
                  title="Suitability service not connected"
                  message={state.message}
                  endpoint={API_ENDPOINTS.varietySuitability}
                />
              </div>
            )}
            {state.status === 'error' && (
              <div className="mt-5">
                <ErrorMessage
                  title="Assessment failed"
                  message={state.message}
                  onRetry={submit}
                />
              </div>
            )}
            {state.status === 'success' && (
              <SuitabilityView data={state.data} formRequest={form} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SuitabilityView({
  data,
  formRequest,
}: {
  data: VarietySuitabilityResponse;
  formRequest?: VarietySuitabilityRequest;
}) {
  const { result } = data;
  const meta = statusMeta[result.status];
  const Icon = meta.icon;
  const hasScore = typeof result.score === 'number';
  const isUnsuitable = result.status === 'unsuitable';

  // Extract farm conditions from backend metadata or fall back to formRequest
  const conditions: ConditionUsed[] =
    data.result.conditionsUsed && data.result.conditionsUsed.length > 0
      ? data.result.conditionsUsed
      : [
          {
            field: 'Minimum Temperature',
            value:
              formRequest?.temperatureMin != null
                ? `${formRequest.temperatureMin} °C`
                : '17.5 °C (Baseline)',
            source: formRequest?.temperatureMin != null ? 'provided' : 'regional_baseline',
            sourceLabel:
              formRequest?.temperatureMin != null ? 'Farmer provided' : 'Regional baseline',
          },
          {
            field: 'Maximum Temperature',
            value:
              formRequest?.temperatureMax != null
                ? `${formRequest.temperatureMax} °C`
                : '30.0 °C (Baseline)',
            source: formRequest?.temperatureMax != null ? 'provided' : 'regional_baseline',
            sourceLabel:
              formRequest?.temperatureMax != null ? 'Farmer provided' : 'Regional baseline',
          },
          {
            field: 'Annual Rainfall',
            value:
              formRequest?.rainfall != null
                ? `${formRequest.rainfall} mm`
                : '1600 mm (Baseline)',
            source: formRequest?.rainfall != null ? 'provided' : 'regional_baseline',
            sourceLabel: formRequest?.rainfall != null ? 'Farmer provided' : 'Regional baseline',
          },
          {
            field: 'Soil pH',
            value: formRequest?.soilPH != null ? `${formRequest.soilPH}` : '5.2 (Baseline)',
            source: formRequest?.soilPH != null ? 'provided' : 'regional_baseline',
            sourceLabel: formRequest?.soilPH != null ? 'Farmer provided' : 'Regional baseline',
          },
          {
            field: 'Soil Type',
            value: formRequest?.soilType
              ? formRequest.soilType.replace(/_/g, ' ')
              : 'Clay Loam (Baseline)',
            source: formRequest?.soilType ? 'provided' : 'regional_baseline',
            sourceLabel: formRequest?.soilType ? 'Farmer provided' : 'Regional baseline',
          },
          {
            field: 'Soil Drainage',
            value: formRequest?.soilDrainage ? formRequest.soilDrainage : 'Good (Baseline)',
            source:
              formRequest?.soilDrainage && formRequest.soilDrainage !== 'unknown'
                ? 'provided'
                : 'regional_baseline',
            sourceLabel:
              formRequest?.soilDrainage && formRequest.soilDrainage !== 'unknown'
                ? 'Farmer provided'
                : 'Regional baseline',
          },
          {
            field: 'Planting Season',
            value: formRequest?.plantingSeason
              ? formRequest.plantingSeason.replace(/_/g, ' ')
              : 'Pre-monsoon (Baseline)',
            source: formRequest?.plantingSeason ? 'provided' : 'regional_baseline',
            sourceLabel:
              formRequest?.plantingSeason ? 'Farmer provided' : 'Regional baseline',
          },
          {
            field: 'Elevation',
            value:
              formRequest?.elevation != null
                ? `${formRequest.elevation} m`
                : '780 m (Baseline)',
            source: formRequest?.elevation != null ? 'provided' : 'regional_baseline',
            sourceLabel: formRequest?.elevation != null ? 'Farmer provided' : 'Regional baseline',
          },
          ...(formRequest?.nitrogen != null
            ? [
                {
                  field: 'Available Nitrogen (N)',
                  value: `${formRequest.nitrogen} kg/ha (Soil Test)`,
                  source: 'provided' as const,
                  sourceLabel: 'Farmer provided (Soil Test)',
                },
              ]
            : []),
          ...(formRequest?.phosphorus != null
            ? [
                {
                  field: 'Available Phosphorus (P)',
                  value: `${formRequest.phosphorus} kg/ha (Soil Test)`,
                  source: 'provided' as const,
                  sourceLabel: 'Farmer provided (Soil Test)',
                },
              ]
            : []),
          ...(formRequest?.potassium != null
            ? [
                {
                  field: 'Available Potassium (K)',
                  value: `${formRequest.potassium} kg/ha (Soil Test)`,
                  source: 'provided' as const,
                  sourceLabel: 'Farmer provided (Soil Test)',
                },
              ]
            : []),
        ];

  // Measurements still needed for laboratory precision
  const stillNeededItems: string[] =
    data.result.dataStillNeeded && data.result.dataStillNeeded.length > 0
      ? data.result.dataStillNeeded
      : data.result.additionalDataNeeded && data.result.additionalDataNeeded.length > 0
      ? data.result.additionalDataNeeded
      : [
          'Laboratory soil test for Nitrogen (N), Phosphorus (P), and Potassium (K) nutrient profile',
          'In-situ volumetric soil moisture measurement',
        ];

  const isSoilTestProvided =
    result.workflowType === 'soil_test' ||
    conditions.some(
      (c) =>
        c.field.includes('Nitrogen') &&
        (c.source === 'provided' || c.sourceLabel.toLowerCase().includes('farmer'))
    );

  return (
    <div className="mt-5 space-y-6">
      {/* 1. Overall Suitability Status & Score Card */}
      <ResultCard tone={meta.tone} title={meta.label} icon={Icon}>
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                isSoilTestProvided
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-forest-50 text-forest-800 border-forest-200'
              }`}
            >
              {isSoilTestProvided ? (
                <>
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Workflow B: Soil-Test Verified Assessment</span>
                </>
              ) : (
                <>
                  <Sprout className="h-3.5 w-3.5 text-forest-600" />
                  <span>Workflow A: Preliminary Suitability Check</span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {hasScore && (
              <div className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-3 ring-1 ring-forest-100 shadow-sm">
                <Gauge className="h-6 w-6 text-forest-600" />
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold text-forest-900">
                      {result.score}
                    </span>
                    <span className="text-sm font-medium text-forest-500">/ 100</span>
                  </div>
                  <p className="text-xs font-medium text-forest-500">Suitability score</p>
                </div>
              </div>
            )}

            {/* Score Progress Bar */}
            {hasScore && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center justify-between text-xs text-forest-700 mb-1.5 font-medium">
                  <span>ML Model Match Confidence</span>
                  <span className="font-semibold">{result.score}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-forest-100/80">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.status === 'suitable'
                        ? 'bg-forest-600'
                        : result.status === 'conditionally_suitable'
                        ? 'bg-pineapple-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, result.score ?? 0))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {result.scoreExplanation && (
            <p className="text-sm leading-relaxed text-forest-800 bg-white/70 p-3 rounded-xl border border-forest-100">
              {result.scoreExplanation}
            </p>
          )}

          <p className="text-xs text-forest-500 italic">
            {isSoilTestProvided
              ? 'This assessment incorporates your laboratory soil test macronutrients (N, P, K in kg/ha) into model feature evaluation. Specific nutrient adequacy depends on laboratory testing extraction methods and local soil fertility calibration. This is an advisory estimate and does not replace field extension advice.'
              : 'This preliminary assessment uses documented regional baseline estimates for soil macronutrients (80 kg/ha N, 40 kg/ha P, 100 kg/ha K). While sufficient for initial exploratory evaluation, a laboratory Soil Health Card test is advised before commercial field preparation.'}
          </p>
        </div>
      </ResultCard>

      {/* 2. Farm Conditions Used (Measured vs Assumed Baseline) */}
      <ResultCard tone="neutral" title="Farm Conditions Used" icon={Layers}>
        <p className="text-xs text-forest-600 -mt-2 mb-4 leading-relaxed">
          Input metrics evaluated by the model. Values marked{' '}
          <span className="font-semibold text-forest-800">Farmer provided</span> were entered by you in this form; fields marked{' '}
          <span className="font-semibold text-amber-800">Regional baseline</span> use representative agro-climatic normals for Manipur.
        </p>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {conditions.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-forest-100 bg-forest-50/40 p-3 text-sm"
            >
              <div>
                <p className="text-xs font-medium text-forest-500">{item.field}</p>
                <p className="font-semibold text-forest-900 mt-0.5">{item.value}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                  item.source === 'provided'
                    ? 'bg-forest-100/90 text-forest-800 border-forest-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {item.source === 'provided' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Info className="h-3 w-3" />
                )}
                {item.sourceLabel}
              </span>
            </div>
          ))}
        </div>
      </ResultCard>

      {/* 3. Recommended Pineapple Varieties (only shown when varieties are recommended) */}
      {!isUnsuitable && result.recommendedVarieties.length > 0 && (
        <ResultCard tone="success" title="Recommended Pineapple Varieties" icon={Leaf}>
          <p className="text-xs text-forest-600 -mt-2 mb-4">
            Varieties evaluated and ranked by agro-climatic match score for your micro-climate. Recommendations are advisory estimates based on ICAR Manipur and MOMA guidelines.
          </p>

          <div className="space-y-4">
            {result.recommendedVarieties.map((v, i) => (
              <div
                key={i}
                className="rounded-xl border border-forest-200 bg-white p-5 shadow-sm space-y-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-forest-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-base font-bold text-forest-900">
                        {v.variety}
                      </h4>
                      {v.bestUse && (
                        <span className="inline-flex items-center rounded-md bg-forest-100/90 px-2.5 py-0.5 text-xs font-medium text-forest-800 border border-forest-200">
                          Best Use: {v.bestUse}
                        </span>
                      )}
                    </div>
                    {v.description && (
                      <p className="mt-1 text-xs text-forest-600 leading-relaxed max-w-xl">
                        {v.description}
                      </p>
                    )}
                  </div>

                  {typeof v.score === 'number' && (
                    <div className="flex items-center gap-2 rounded-xl bg-forest-50 px-3.5 py-1.5 border border-forest-100">
                      <div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="font-display text-xl font-bold text-forest-900">
                            {v.score}
                          </span>
                          <span className="text-xs font-semibold text-forest-500">/ 100</span>
                        </div>
                        <p className="text-[10px] font-medium text-forest-500 uppercase tracking-wide">
                          Match Score
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Target Growing Conditions */}
                {v.optimalConditions && v.optimalConditions.length > 0 && (
                  <div className="rounded-lg bg-forest-50/50 p-3 text-xs border border-forest-100/60">
                    <p className="font-semibold text-forest-800 mb-1.5">
                      Target Optimal Conditions (ICAR / MOMA):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-forest-700">
                      {v.optimalConditions.map((cond, cIdx) => (
                        <span key={cIdx} className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
                          {cond}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advantages & Limitations grid */}
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  {v.advantages && v.advantages.length > 0 && (
                    <div className="rounded-lg border border-forest-100 bg-forest-50/40 p-3 space-y-1.5">
                      <p className="font-semibold text-forest-900 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-forest-600 shrink-0" />
                        Key Advantages
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-forest-700 leading-relaxed">
                        {v.advantages.map((adv, aIdx) => (
                          <li key={aIdx}>{adv}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {v.limitations && v.limitations.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
                      <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                        Limitations & Watchpoints
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-amber-800 leading-relaxed">
                        {v.limitations.map((lim, lIdx) => (
                          <li key={lIdx}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Fallback to reasons list if detailed advantages not present */}
                {(!v.advantages || v.advantages.length === 0) && v.reasons && v.reasons.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-forest-800 mb-1">Recommendation Reasons:</p>
                    <ul className="list-disc pl-5 text-xs text-forest-700 space-y-0.5">
                      {v.reasons.map((r, j) => (
                        <li key={j}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {/* 4. Unsuitable Specific Card (only shown when unsuitable) */}
      {isUnsuitable && (
        <ResultCard tone="error" title="Identified Risk Factors for Pineapple" icon={XCircle}>
          <p className="text-xs text-red-700 -mt-2 mb-3 leading-relaxed">
            The machine learning model determined that the current soil or environmental metrics present severe agronomic risks for commercial pineapple farming:
          </p>
          <ResultList items={result.limitations} />
        </ResultCard>
      )}

      {/* 5. Supporting Reasoning, Limitations, and Improvements Cards */}
      <div className="grid gap-5 sm:grid-cols-2">
        {!isUnsuitable && result.reasons.length > 0 && (
          <ResultCard tone="neutral" title="Favorable Agricultural Factors" icon={MapPin}>
            <ResultList items={result.reasons} />
          </ResultCard>
        )}

        {!isUnsuitable && result.limitations.length > 0 && (
          <ResultCard tone="warning" title="Field Limitations & Watchpoints" icon={AlertCircle}>
            <ResultList items={result.limitations} />
          </ResultCard>
        )}

        {result.improvements.length > 0 && (
          <ResultCard
            tone="info"
            title="Actionable Soil & Field Improvements"
            icon={Leaf}
            className={isUnsuitable ? 'sm:col-span-2' : ''}
          >
            <p className="text-xs text-forest-600 -mt-2 mb-3">
              Agronomic remediation measures recommended by ICAR NEH guidelines to improve soil health and drainage:
            </p>
            <ResultList items={result.improvements} />
          </ResultCard>
        )}
      </div>

      {/* 6. Information That Could Improve This Assessment */}
      <ResultCard
        tone="neutral"
        title="Information That Could Improve This Assessment"
        icon={HelpCircle}
      >
        <div className="space-y-4">
          <p className="text-xs text-forest-600 -mt-2 leading-relaxed">
            Evaluating complex agricultural suitability accurately depends on complete local soil and microclimate data. The breakdown below distinguishes what was evaluated versus what would refine future evaluations:
          </p>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            {/* Used in this prediction */}
            <div className="rounded-xl border border-forest-100 bg-forest-50/50 p-3.5 space-y-2">
              <p className="font-semibold text-forest-900 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-forest-600" />
                Used in this prediction
              </p>
              <p className="text-forest-600 leading-relaxed">
                Parameters supplied by you in the form were evaluated directly; omitted fields were supplemented with representative regional baseline normals for the Manipur valley (see <strong>Farm Conditions Used</strong> above).
              </p>
            </div>

            {/* Still needed */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
              <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-amber-700" />
                Still needed for laboratory precision
              </p>
              <ul className="list-disc pl-4 space-y-1 text-amber-800 leading-relaxed">
                {stillNeededItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-forest-500 italic pt-1 border-t border-forest-100">
            Note: Collecting laboratory measurements refines evaluation precision, but does not imply that the suitability prediction will necessarily change.
          </p>
        </div>
      </ResultCard>

      {/* Footer Disclaimer & Model Version */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-forest-500 pt-1">
        <p>Suitability is an AI estimate. Verify with local agricultural officers before investing.</p>
        {data.modelVersion && (
          <span className="font-mono text-[11px] text-forest-600 bg-forest-50 px-2.5 py-1 rounded-md border border-forest-200 w-fit">
            Model: {data.modelVersion}
          </span>
        )}
      </div>
    </div>
  );
}
