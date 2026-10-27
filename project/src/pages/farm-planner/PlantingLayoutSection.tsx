import { AlertTriangle, Info } from 'lucide-react';
import { estimatePlantCount, cmToM } from './geometry';

export const PLANT_SPACING_PRESETS_CM = [5, 10, 15, 20, 25, 30, 45, 60] as const;
export const ROW_SPACING_PRESETS_CM = [30, 45, 60, 75, 90, 120] as const;

/** Verified ICAR NEH Manipur guidance used in this project — not a general pineapple recommendation label. */
export const VERIFIED_GUIDANCE = {
  plantSpacingCm: 30,
  rowSpacingCm: 60,
  arrangement: 'double' as PlantingArrangement,
  source: 'ICAR NEH Manipur double-row (60 cm between rows × 30 cm within the row)',
};

export const MIN_SPACING_CM = 5;
export const MAX_SPACING_CM = 500;
const MAX_DISPLAY = 5000;

export type PlantingArrangement = 'single' | 'double';

export interface PlantingLayoutValues {
  plantSpacingCm: number;
  rowSpacingCm: number;
  plantPreset: string;
  rowPreset: string;
  arrangement: PlantingArrangement;
}

export function metersToLayoutValues(
  plantSpacingM: number,
  rowSpacingM: number,
  staggered: boolean
): PlantingLayoutValues {
  const plantSpacingCm = Number(((plantSpacingM || 0.3) * 100).toFixed(2));
  const rowSpacingCm = Number(((rowSpacingM || 0.6) * 100).toFixed(2));
  const plantPreset = PLANT_SPACING_PRESETS_CM.includes(plantSpacingCm as (typeof PLANT_SPACING_PRESETS_CM)[number])
    ? String(plantSpacingCm)
    : 'custom';
  const rowPreset = ROW_SPACING_PRESETS_CM.includes(rowSpacingCm as (typeof ROW_SPACING_PRESETS_CM)[number])
    ? String(rowSpacingCm)
    : 'custom';
  return {
    plantSpacingCm,
    rowSpacingCm,
    plantPreset,
    rowPreset,
    arrangement: staggered === false ? 'single' : 'double',
  };
}

export const DEFAULT_PLANTING_LAYOUT: PlantingLayoutValues = metersToLayoutValues(0.3, 0.6, true);

export function parseSpacingPreset(preset: string, customCm: number, presets: readonly number[]): {
  preset: string;
  cm: number;
} {
  if (preset === 'custom') {
    return { preset: 'custom', cm: customCm };
  }
  const n = Number(preset);
  if (presets.includes(n)) return { preset: String(n), cm: n };
  return { preset: 'custom', cm: customCm };
}

export function validateSpacingCm(cm: number, label: string): string | null {
  if (!Number.isFinite(cm)) return `${label} must be a number.`;
  if (cm < MIN_SPACING_CM) return `${label} must be at least ${MIN_SPACING_CM} cm.`;
  if (cm > MAX_SPACING_CM) return `${label} cannot exceed ${MAX_SPACING_CM} cm.`;
  return null;
}

export function isOutsideVerifiedGuidance(values: PlantingLayoutValues): boolean {
  return (
    values.arrangement !== VERIFIED_GUIDANCE.arrangement ||
    Math.abs(values.plantSpacingCm - VERIFIED_GUIDANCE.plantSpacingCm) > 0.05 ||
    Math.abs(values.rowSpacingCm - VERIFIED_GUIDANCE.rowSpacingCm) > 0.05
  );
}

export function layoutFromForm(
  lengthM: number,
  breadthM: number,
  clearanceM: number,
  values: PlantingLayoutValues
) {
  const plantErr = validateSpacingCm(values.plantSpacingCm, 'Within-row plant spacing');
  const rowErr = validateSpacingCm(values.rowSpacingCm, 'Row spacing');
  if (plantErr || rowErr) {
    return {
      plantSpacingM: 0,
      rowSpacingM: 0,
      staggered: values.arrangement === 'double',
      estimate: { count: 0, rows: 0, maxPerRow: 0, error: plantErr || rowErr },
    };
  }
  const plantSpacingM = cmToM(values.plantSpacingCm);
  const rowSpacingM = cmToM(values.rowSpacingCm);
  const staggered = values.arrangement === 'double';
  const estimate = estimatePlantCount(lengthM, breadthM, rowSpacingM, plantSpacingM, clearanceM, staggered);
  return { plantSpacingM, rowSpacingM, staggered, estimate };
}

interface PlantingLayoutSectionProps {
  lengthM: number;
  breadthM: number;
  clearanceM: number;
  values: PlantingLayoutValues;
  onChange: (next: PlantingLayoutValues) => void;
  idPrefix?: string;
}

export default function PlantingLayoutSection({
  lengthM,
  breadthM,
  clearanceM,
  values,
  onChange,
  idPrefix = 'layout',
}: PlantingLayoutSectionProps) {
  const { estimate } = layoutFromForm(lengthM, breadthM, clearanceM, values);
  const outsideGuidance = isOutsideVerifiedGuidance(values);

  const setPlantPreset = (preset: string) => {
    if (preset === 'custom') {
      onChange({ ...values, plantPreset: 'custom' });
      return;
    }
    onChange({ ...values, plantPreset: preset, plantSpacingCm: Number(preset) });
  };

  const setRowPreset = (preset: string) => {
    if (preset === 'custom') {
      onChange({ ...values, rowPreset: 'custom' });
      return;
    }
    onChange({ ...values, rowPreset: preset, rowSpacingCm: Number(preset) });
  };

  return (
    <div className="rounded-xl border border-forest-200 bg-forest-50/40 p-4 space-y-3">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-forest-900">
          Planting Layout &amp; Spacing
        </h4>
        <p className="mt-0.5 text-[11px] text-forest-600">
          Distances are entered in centimetres and stored in metres. Plant positions follow the plot geometry, not a crop recommendation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-plant-preset`} className="font-semibold text-forest-800">
            Within-row plant spacing
          </label>
          <select
            id={`${idPrefix}-plant-preset`}
            value={values.plantPreset}
            onChange={(e) => setPlantPreset(e.target.value)}
            className="mt-1 w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs focus:outline-none"
          >
            {PLANT_SPACING_PRESETS_CM.map((cm) => (
              <option key={cm} value={String(cm)}>
                {cm} cm
              </option>
            ))}
            <option value="custom">Custom (cm)</option>
          </select>
          {values.plantPreset === 'custom' && (
            <input
              id={`${idPrefix}-plant-custom`}
              type="number"
              min={MIN_SPACING_CM}
              max={MAX_SPACING_CM}
              step="1"
              value={Number.isFinite(values.plantSpacingCm) ? values.plantSpacingCm : ''}
              onChange={(e) =>
                onChange({ ...values, plantPreset: 'custom', plantSpacingCm: parseFloat(e.target.value) })
              }
              placeholder="Enter centimetres"
              className="mt-1.5 w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs focus:outline-none"
            />
          )}
        </div>

        <div>
          <label htmlFor={`${idPrefix}-row-preset`} className="font-semibold text-forest-800">
            Row spacing
          </label>
          <select
            id={`${idPrefix}-row-preset`}
            value={values.rowPreset}
            onChange={(e) => setRowPreset(e.target.value)}
            className="mt-1 w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs focus:outline-none"
          >
            {ROW_SPACING_PRESETS_CM.map((cm) => (
              <option key={cm} value={String(cm)}>
                {cm} cm
              </option>
            ))}
            <option value="custom">Custom (cm)</option>
          </select>
          {values.rowPreset === 'custom' && (
            <input
              id={`${idPrefix}-row-custom`}
              type="number"
              min={MIN_SPACING_CM}
              max={MAX_SPACING_CM}
              step="1"
              value={Number.isFinite(values.rowSpacingCm) ? values.rowSpacingCm : ''}
              onChange={(e) =>
                onChange({ ...values, rowPreset: 'custom', rowSpacingCm: parseFloat(e.target.value) })
              }
              placeholder="Enter centimetres"
              className="mt-1.5 w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs focus:outline-none"
            />
          )}
        </div>
      </div>

      <fieldset>
        <legend className="font-semibold text-forest-800">Planting arrangement</legend>
        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-2 rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-arrangement`}
              checked={values.arrangement === 'single'}
              onChange={() => onChange({ ...values, arrangement: 'single' })}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold text-forest-900">Single row</span>
              <span className="block text-[11px] text-forest-600">Aligned plants in each row (rectangular grid).</span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-arrangement`}
              checked={values.arrangement === 'double'}
              onChange={() => onChange({ ...values, arrangement: 'double' })}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold text-forest-900">Double row</span>
              <span className="block text-[11px] text-forest-600">
                Alternate rows offset by half the plant spacing (existing staggered geometry).
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="rounded-lg border border-forest-100 bg-white p-3">
        <div className="flex items-start gap-1.5 text-[11px] text-forest-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-500" />
          <p>
            <strong className="text-forest-800">Mathematical plant-count estimate</strong> — this is how many nodes fit the
            selected geometry. It is not an agronomic recommendation or a yield target.
          </p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-forest-50 px-2 py-1.5">
            <div className="font-display text-sm font-bold text-forest-900">
              {estimate.error && estimate.count > MAX_DISPLAY ? '—' : estimate.count}
            </div>
            <div className="text-[10px] font-semibold uppercase text-forest-600">Est. plants</div>
          </div>
          <div className="rounded-md bg-forest-50 px-2 py-1.5">
            <div className="font-display text-sm font-bold text-forest-900">{estimate.rows || '—'}</div>
            <div className="text-[10px] font-semibold uppercase text-forest-600">Rows</div>
          </div>
          <div className="rounded-md bg-forest-50 px-2 py-1.5">
            <div className="font-display text-sm font-bold text-forest-900">{estimate.maxPerRow || '—'}</div>
            <div className="text-[10px] font-semibold uppercase text-forest-600">Max / row</div>
          </div>
        </div>
        {estimate.error && (
          <p className="mt-2 text-[11px] font-medium text-red-700">{estimate.error}</p>
        )}
      </div>

      {outsideGuidance && !estimate.error && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Selected spacing is outside this project’s verified agronomic guidance ({VERIFIED_GUIDANCE.source}). You can
            still use it for layout planning; do not treat this value as recommended pineapple practice.
          </p>
        </div>
      )}
    </div>
  );
}
