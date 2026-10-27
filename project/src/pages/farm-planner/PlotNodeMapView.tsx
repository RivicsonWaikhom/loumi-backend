import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Tag,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { Farm, Plant, STATUS_INFO, Observation } from './types';
import { layoutRowCount, mToCm } from './geometry';
import { Button } from '@/components/ui/Button';

interface PlotNodeMapViewProps {
  farm: Farm;
  farms: Farm[];
  onSelectFarm: (farmId: string) => void;
  onUpdateFarm: (updatedFarm: Farm) => void;
  onOpenDiagnoseForPlant?: (plantId: string) => void;
}

export default function PlotNodeMapView({
  farm,
  farms,
  onSelectFarm,
  onUpdateFarm,
  onOpenDiagnoseForPlant,
}: PlotNodeMapViewProps) {
  const [filter, setFilter] = useState<string>('all');
  const [findInput, setFindInput] = useState<string>('');
  const [findMessage, setFindMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(true);

  // Observation form state
  const [obsStatus, setObsStatus] = useState<string>('healthy');
  const [obsCondition, setObsCondition] = useState<string>('');
  const [obsNotes, setObsNotes] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // SVG Pan & Zoom ViewBox (in local meters)
  const calcFitViewBox = (f: Farm) => {
    const len = Number(f?.length) || 20;
    const brd = Number(f?.breadth) || 12;
    const margin = Math.max(len, brd) * 0.05 + 0.4;
    return {
      x: -margin,
      y: -margin,
      w: len + 2 * margin,
      h: brd + 2 * margin,
    };
  };

  const [vb, setVb] = useState(() => calcFitViewBox(farm));
  const [svgPx, setSvgPx] = useState({ w: 1, h: 1 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const plantPointerRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    startVb: typeof vb;
    moved: boolean;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    startVb: vb,
    moved: false,
  });

  useEffect(() => {
    setVb(calcFitViewBox(farm));
    setSelectedPlantId(null);
  }, [farm.id]);

  useEffect(() => {
    setVb(calcFitViewBox(farm));
  }, [farm.length, farm.breadth]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSvgPx({ w: Math.max(cr.width, 1), h: Math.max(cr.height, 1) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  const plants = farm?.plants || [];
  const selectedPlant = useMemo(
    () => plants.find((p) => p.id === selectedPlantId) || null,
    [plants, selectedPlantId]
  );

  // All plants that have observations (notes) for the Fullscreen Notes drawer
  const taggedPlants = useMemo(
    () => (plants || []).filter((p) => (p?.observations && p.observations.length > 0) || p?.status !== 'unknown'),
    [plants]
  );

  const metersPerPixel = Math.max(vb.w / svgPx.w, vb.h / svgPx.h);
  const plantVisualR = Math.min(0.18, Math.max(0.06, 6 * metersPerPixel));
  const plantHitR = Math.max(plantVisualR * 1.6, 14 * metersPerPixel);
  const rowCount = layoutRowCount(
    Number(farm.breadth) || 0,
    Number(farm.row_spacing) || 0.6,
    Number(farm.clearance) || 0.5
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      startVb: { ...vb },
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.isDown || !svgRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const scale = Math.max(dragRef.current.startVb.w / rect.width, dragRef.current.startVb.h / rect.height);

    setVb({
      x: dragRef.current.startVb.x - dx * scale,
      y: dragRef.current.startVb.y - dy * scale,
      w: dragRef.current.startVb.w,
      h: dragRef.current.startVb.h,
    });
  };

  const handlePointerUp = () => {
    dragRef.current.isDown = false;
  };

  const zoomBy = (factor: number) => {
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    setVb({
      x: cx - (vb.w * factor) / 2,
      y: cy - (vb.h * factor) / 2,
      w: vb.w * factor,
      h: vb.h * factor,
    });
  };

  const fitToFarm = () => {
    setVb(calcFitViewBox(farm));
  };

  // Find plant handler
  const handleFindPlant = () => {
    const raw = findInput.trim().toUpperCase().replace(/^P-?/, '');
    if (!raw) return;
    const targetId = /^\d+$/.test(raw) ? 'P-' + raw.padStart(4, '0') : 'P-' + raw;
    const found = plants.find((p) => p.id === targetId);
    if (!found) {
      setFindMessage({ type: 'err', text: `No plant found with ID ${targetId}.` });
      return;
    }
    setFindMessage(null);
    setSelectedPlantId(found.id);

    // Center view on this plant
    const zoomSize = Math.min(vb.w, Math.max(farm.length, farm.breadth) / 3);
    setVb({
      x: found.x - zoomSize / 2,
      y: found.y - (zoomSize * vb.h) / vb.w / 2,
      w: zoomSize,
      h: (zoomSize * vb.h) / vb.w,
    });
  };

  // Save observation
  const handleSaveObservation = () => {
    if (!selectedPlant) return;
    const newObs: Observation = {
      id: `obs-${Date.now()}`,
      farm_id: farm.id,
      plant_id: selectedPlant.id,
      observed_at: new Date().toISOString().split('T')[0],
      status: obsStatus,
      condition: obsCondition.trim() || undefined,
      notes: obsNotes.trim() || undefined,
    };

    const updatedPlants = plants.map((p) => {
      if (p.id !== selectedPlant.id) return p;
      return {
        ...p,
        status: obsStatus,
        observations: [newObs, ...(p.observations || [])],
      };
    });

    const updatedFarm: Farm = {
      ...farm,
      plants: updatedPlants,
    };

    onUpdateFarm(updatedFarm);
    setSaveSuccessMsg(`Observation saved for ${selectedPlant.id}!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Filtered plant list to render
  const visiblePlants = useMemo(() => {
    if (filter === 'all') return plants;
    return plants.filter((p) => p.status === filter);
  }, [plants, filter]);

  const mapContent = (fullscreenMode: boolean) => (
    <div className="flex flex-col h-full">
      {/* Top Controls Row Matching Image 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Farm Dropdown */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-700">
            <span>Farm</span>
            <select
              value={farm.id}
              onChange={(e) => onSelectFarm(e.target.value)}
              className="rounded-lg border border-forest-200 bg-white px-2.5 py-1.5 text-xs font-medium text-forest-900 shadow-xs focus:border-forest-500 focus:outline-none"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Find Plant */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-forest-700">Find plant (ID or number)</span>
            <div className="flex items-center">
              <input
                type="text"
                placeholder="P-0012"
                value={findInput}
                onChange={(e) => setFindInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFindPlant()}
                className="w-24 rounded-l-lg border border-r-0 border-forest-200 px-2 py-1 text-xs text-forest-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleFindPlant}
                className="rounded-r-lg bg-forest-700 px-3 py-1 text-xs font-semibold text-white hover:bg-forest-800"
              >
                Find
              </button>
            </div>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-700">
            <span>Show</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-forest-200 bg-white px-2.5 py-1.5 text-xs font-medium text-forest-900 shadow-xs focus:border-forest-500 focus:outline-none"
            >
              <option value="all">All plants</option>
              <option value="unknown">Not inspected</option>
              <option value="healthy">Healthy</option>
              <option value="suspected">Suspected disease</option>
              <option value="disease">Recorded disease</option>
              <option value="inspect">Needs inspection</option>
            </select>
          </div>
        </div>

        {/* Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-forest-200 bg-forest-50/50 p-0.5">
            <button
              type="button"
              onClick={() => zoomBy(0.8)}
              title="Zoom In"
              className="rounded p-1 text-forest-700 hover:bg-white hover:shadow-xs"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1.25)}
              title="Zoom Out"
              className="rounded p-1 text-forest-700 hover:bg-white hover:shadow-xs"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fitToFarm}
              className="rounded px-2 py-1 text-xs font-medium text-forest-700 hover:bg-white hover:shadow-xs"
            >
              Fit to farm
            </button>
          </div>

          {!fullscreenMode && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-forest-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-forest-700 shadow-xs hover:bg-forest-50"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Fullscreen</span>
            </button>
          )}

          {fullscreenMode && (
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>

      {findMessage && (
        <div className="bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-800 border-b border-amber-200">
          {findMessage.text}
        </div>
      )}

      {/* Helper text matching image 3 */}
      <div className="bg-forest-50/40 px-4 py-1.5 text-[11px] text-forest-600 border-b border-forest-100 flex items-center justify-between">
        <span>
          Drag to pan / tap a plant to inspect. {plants.length} plant nodes (geometric estimate). Distances are local metres.
        </span>
        <span>
          {farm.length}m × {farm.breadth}m · {mToCm(Number(farm.row_spacing || 0.6))} cm row ×{' '}
          {mToCm(Number(farm.plant_spacing || 0.3))} cm plant · {farm.staggered === false ? 'single row' : 'double row'}
        </span>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative flex-1 min-h-[380px] bg-[#fbfdfb] overflow-hidden select-none">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          {/* Farm Perimeter Dotted Outline Matching Image 3 */}
          <rect
            x={0}
            y={0}
            width={farm.length}
            height={farm.breadth}
            fill="#ffffff"
            stroke="#94a3b8"
            strokeWidth={0.08}
            strokeDasharray="0.3 0.2"
          />

          {/* Bed / Row guidance — same y positions as calculateLayout */}
          {Array.from({ length: Math.min(rowCount, 400) }).map((_, r) => (
            <line
              key={r}
              x1={farm.clearance}
              y1={farm.clearance + r * farm.row_spacing}
              x2={farm.length - farm.clearance}
              y2={farm.clearance + r * farm.row_spacing}
              stroke="#e2e8f0"
              strokeWidth={Math.max(0.015, metersPerPixel * 1.2)}
            />
          ))}

          {/* Plant Nodes */}
          {visiblePlants.map((p) => {
            const isSelected = p.id === selectedPlantId;
            const statusCfg = STATUS_INFO[p.status] || STATUS_INFO.unknown;
            const r = isSelected ? plantVisualR * 1.35 : plantVisualR;

            return (
              <g
                key={p.id}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  plantPointerRef.current = { id: p.id, x: e.clientX, y: e.clientY };
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  const start = plantPointerRef.current;
                  plantPointerRef.current = null;
                  if (!start || start.id !== p.id) return;
                  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 12) {
                    setSelectedPlantId(p.id);
                  }
                }}
              >
                {/* Invisible hit target — ~28px minimum at current zoom */}
                <circle cx={p.x} cy={p.y} r={plantHitR} fill="transparent" />

                {/* Selection Glow */}
                {isSelected && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={plantHitR * 0.95}
                    fill="none"
                    stroke="#1b4332"
                    strokeWidth={Math.max(0.03, metersPerPixel * 1.5)}
                    strokeDasharray={`${0.08 + metersPerPixel} ${0.08 + metersPerPixel}`}
                  />
                )}

                {/* Symbol by Status */}
                {p.status === 'unknown' ? (
                  /* ○ Hollow circle */
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill="#ffffff"
                    stroke={statusCfg.color}
                    strokeWidth={0.035}
                  />
                ) : p.status === 'healthy' ? (
                  /* ● Filled green circle */
                  <circle cx={p.x} cy={p.y} r={r} fill={statusCfg.color} />
                ) : p.status === 'suspected' ? (
                  /* ◆ Amber diamond */
                  <polygon
                    points={`${p.x},${p.y - r * 1.2} ${p.x + r * 1.2},${p.y} ${p.x},${p.y + r * 1.2} ${p.x - r * 1.2},${p.y}`}
                    fill={statusCfg.color}
                  />
                ) : p.status === 'disease' ? (
                  /* ■ Red square */
                  <rect
                    x={p.x - r}
                    y={p.y - r}
                    width={r * 2}
                    height={r * 2}
                    fill={statusCfg.color}
                  />
                ) : (
                  /* ▲ Blue triangle */
                  <polygon
                    points={`${p.x},${p.y - r * 1.3} ${p.x + r * 1.2},${p.y + r * 0.9} ${p.x - r * 1.2},${p.y + r * 0.9}`}
                    fill={statusCfg.color}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend at Bottom Matching Image 3 */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-forest-100 bg-white/95 px-4 py-2 text-xs font-medium text-forest-800 shadow-sm backdrop-blur-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border border-slate-500 bg-white" />
            <span>Not inspected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" />
            <span>Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rotate-45 bg-amber-600" />
            <span>Suspected disease</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-red-600" />
            <span>Recorded disease</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block text-[10px] text-blue-600 font-bold">▲</span>
            <span>Needs inspection</span>
          </div>
        </div>
      </div>

      {/* Selected Plant Node Tagging Drawer */}
      {selectedPlant && (
        <div className="border-t border-forest-200 bg-white p-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-forest-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-forest-900">{selectedPlant.id}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    STATUS_INFO[selectedPlant.status]?.bg || 'bg-slate-100'
                  } ${STATUS_INFO[selectedPlant.status]?.text || 'text-slate-700'}`}
                >
                  {STATUS_INFO[selectedPlant.status]?.label || selectedPlant.status}
                </span>
                <span className="text-xs text-forest-500">
                  Row {selectedPlant.row}, Pos {selectedPlant.pos} • ({selectedPlant.x}m, {selectedPlant.y}m)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenDiagnoseForPlant && (
                <button
                  type="button"
                  onClick={() => onOpenDiagnoseForPlant(selectedPlant.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-forest-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Scan Leaf with YOLOv8</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedPlantId(null)}
                className="text-forest-400 hover:text-forest-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Form to tag plant node */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-forest-700">Update Condition Status</label>
              <select
                value={obsStatus}
                onChange={(e) => setObsStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs font-medium text-forest-900 focus:outline-none"
              >
                <option value="healthy">Healthy</option>
                <option value="suspected">Suspected disease</option>
                <option value="disease">Recorded disease</option>
                <option value="inspect">Needs inspection</option>
                <option value="unknown">Reset to uninspected</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-forest-700">Diagnosis / Issue Tag</label>
              <input
                type="text"
                placeholder="e.g. Leaf Blight, Mealybug wilt, Chlorosis"
                value={obsCondition}
                onChange={(e) => setObsCondition(e.target.value)}
                className="mt-1 w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs text-forest-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-forest-700">Observation Notes</label>
              <input
                type="text"
                placeholder="e.g. Checked heart leaves; slight tip discoloration"
                value={obsNotes}
                onChange={(e) => setObsNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-xs text-forest-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            {saveSuccessMsg ? (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {saveSuccessMsg}
              </span>
            ) : (
              <span className="text-xs text-forest-500">
                {(selectedPlant.observations || []).length} previous observations recorded for this node.
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveObservation}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-forest-900"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>Record Observation</span>
            </button>
          </div>

          {/* Past Observations */}
          {(selectedPlant.observations || []).length > 0 && (
            <div className="mt-4 border-t border-forest-100 pt-3">
              <p className="text-xs font-bold text-forest-800">History for {selectedPlant.id}:</p>
              <ul className="mt-1.5 space-y-1 text-xs text-forest-700">
                {(selectedPlant.observations || []).map((obs) => (
                  <li key={obs.id} className="flex items-center gap-2">
                    <span className="font-mono text-forest-500">{obs.observed_at}:</span>
                    <span className="font-medium text-forest-900">{obs.status}</span>
                    {obs.condition && <span className="text-forest-600">({obs.condition})</span>}
                    {obs.notes && <span className="italic text-forest-500">— {obs.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-forest-100 bg-white shadow-card overflow-hidden">
      {mapContent(false)}

      {/* Fullscreen View Modal Matching Image 2 Left Panel */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative flex flex-1 flex-col bg-white">
            {/* Fullscreen Header */}
            <div className="flex items-center justify-between border-b border-forest-100 bg-[#f7faf8] px-6 py-3">
              <div className="flex items-center gap-4">
                <h2 className="font-display text-lg font-bold text-[#1b4332] flex items-center gap-2">
                  <span className="text-xl">🌿</span>
                  <span>- Fullscreen View</span>
                </h2>
                <div className="hidden sm:flex items-center gap-4 text-xs text-forest-600">
                  <span>
                    Dimensions: <strong>{Number(farm.length || 20).toFixed(1)}m × {Number(farm.breadth || 12).toFixed(1)}m</strong>
                  </span>
                  <span>
                    Spacing:{' '}
                    <strong>
                      {mToCm(Number(farm.row_spacing || 0.6))} cm × {mToCm(Number(farm.plant_spacing || 0.3))} cm
                    </strong>
                  </span>
                  <span>
                    Total Plants: <strong>{plants.length}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNotesDrawer(!showNotesDrawer)}
                  className="rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                >
                  {showNotesDrawer ? 'Hide Notes' : 'Show Notes'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="rounded-lg bg-forest-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-900 flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </button>
              </div>
            </div>

            {/* Split Fullscreen: Map + Notes Drawer */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 relative">{mapContent(true)}</div>

              {/* Side Notes Drawer Matching Image 2 */}
              {showNotesDrawer && (
                <div className="w-80 border-l border-forest-200 bg-white p-4 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-forest-100 pb-2">
                    <h3 className="font-display text-sm font-bold text-forest-900 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-forest-600" />
                      <span>All Notes ({taggedPlants.length})</span>
                    </h3>
                  </div>

                  <div className="mt-3 space-y-3">
                    {taggedPlants.length === 0 ? (
                      <p className="text-xs text-forest-500 py-6 text-center">
                        No trees tagged with observations yet. Click any plant circle on the map to inspect and add notes.
                      </p>
                    ) : (
                      taggedPlants.map((tp) => (
                        <div
                          key={tp.id}
                          onClick={() => setSelectedPlantId(tp.id)}
                          className={`rounded-xl border p-3 cursor-pointer transition-all ${
                            tp.id === selectedPlantId
                              ? 'border-forest-600 bg-forest-50/80 shadow-xs'
                              : 'border-forest-100 bg-white hover:border-forest-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-forest-900">{tp.id}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                STATUS_INFO[tp.status]?.bg || 'bg-slate-100'
                              } ${STATUS_INFO[tp.status]?.text || 'text-slate-700'}`}
                            >
                              {STATUS_INFO[tp.status]?.label || tp.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-forest-600">
                            Plant: Row {tp.row}, Column {tp.pos}
                          </p>
                          {tp.observations?.[0]?.condition && (
                            <p className="mt-0.5 text-xs font-medium text-forest-800">
                              Tag: {tp.observations[0].condition}
                            </p>
                          )}
                          {tp.observations?.[0]?.notes && (
                            <p className="mt-0.5 text-xs text-forest-500 italic">
                              "{tp.observations[0].notes}"
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
