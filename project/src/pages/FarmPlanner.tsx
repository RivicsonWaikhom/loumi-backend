import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  LayoutDashboard,
  Map as MapIcon,
  Plus,
  Calendar,
  FileDown,
  Trash2,
  Maximize2,
  MapPin,
  Compass,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  ChevronRight,
  Info,
  Download,
  Pencil,
  Sparkles,
  Loader2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import PlotNodeMapView from './farm-planner/PlotNodeMapView';
import { ExportDropdown } from './farm-planner/ExportDropdown';
import { Farm, Task, STATUS_INFO } from './farm-planner/types';
import {
  createInitialFarms,
  calculateLayout,
  generateS1Tasks,
  mergeLayoutPlants,
  layoutChangeImpact,
  mToCm,
  type LayoutChangeImpact,
} from './farm-planner/geometry';
import PlantingLayoutSection, {
  DEFAULT_PLANTING_LAYOUT,
  layoutFromForm,
  metersToLayoutValues,
  type PlantingLayoutValues,
} from './farm-planner/PlantingLayoutSection';
import {
  fetchUserFarms,
  createBackendFarm,
  updateBackendFarm,
  createDemoBackendFarm,
  deleteBackendFarm,
  syncLocalFarmsWithBackend,
} from '@/services/farmPlannerService';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'loumi_smart_farm_planner_farms';

function isValidFarmList(data: unknown): data is Farm[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  return data.every(
    (f) =>
      f &&
      typeof f === 'object' &&
      typeof f.id === 'string' &&
      typeof f.name === 'string' &&
      Array.isArray(f.plants) &&
      Array.isArray(f.tasks) &&
      typeof f.length === 'number' &&
      !isNaN(f.length) &&
      typeof f.breadth === 'number' &&
      !isNaN(f.breadth)
  );
}

export default function FarmPlanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(true);
  const [curFarmId, setCurFarmId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'farm-details' | 'map' | 'location' | 'tasks' | 'advice' | 'backup'
  >('dashboard');

  // Modals
  const [newFarmModalOpen, setNewFarmModalOpen] = useState(false);
  const [editFarmModalOpen, setEditFarmModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [layoutConfirm, setLayoutConfirm] = useState<{
    nextFarm: Farm;
    impact: LayoutChangeImpact;
  } | null>(null);

  const [newFarmName, setNewFarmName] = useState('My Pineapple Plot');
  const [newFarmLength, setNewFarmLength] = useState(20);
  const [newFarmBreadth, setNewFarmBreadth] = useState(12);
  const [newFarmVariety, setNewFarmVariety] = useState('Queen Pineapple');
  const [newFarmPlantingDate, setNewFarmPlantingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newFarmLayout, setNewFarmLayout] = useState<PlantingLayoutValues>(DEFAULT_PLANTING_LAYOUT);
  const [newFarmError, setNewFarmError] = useState<string | null>(null);
  const [newFarmSaving, setNewFarmSaving] = useState(false);

  const [editFarmName, setEditFarmName] = useState('');
  const [editFarmLength, setEditFarmLength] = useState(20);
  const [editFarmBreadth, setEditFarmBreadth] = useState(12);
  const [editFarmVariety, setEditFarmVariety] = useState('Queen Pineapple');
  const [editFarmPlantingDate, setEditFarmPlantingDate] = useState('');
  const [editFarmLayout, setEditFarmLayout] = useState<PlantingLayoutValues>(DEFAULT_PLANTING_LAYOUT);
  const [editFarmError, setEditFarmError] = useState<string | null>(null);
  const [editFarmSaving, setEditFarmSaving] = useState(false);

  // Farming Schedule filter
  const [scheduleFilter, setScheduleFilter] = useState<'UPCOMING' | 'ALL' | 'COMPLETED'>('UPCOMING');

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Scouting');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Notifications
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Load user's isolated farms from backend database
  useEffect(() => {
    let active = true;
    async function loadFarms() {
      setFarmsLoading(true);
      try {
        const backendFarms = await fetchUserFarms();
        if (!active) return;
        if (Array.isArray(backendFarms)) {
          setFarms(backendFarms);
          if (backendFarms.length > 0) {
            setCurFarmId((prev) =>
              backendFarms.some((f) => f.id === prev) ? prev : backendFarms[0].id
            );
          }
        }
      } catch (err) {
        console.warn('Notice loading farms from backend:', err);
      } finally {
        if (active) setFarmsLoading(false);
      }
    }
    loadFarms();
    return () => {
      active = false;
    };
  }, []);

  // Update current farm ID if current farm deleted or empty
  useEffect(() => {
    if (farms.length > 0) {
      if (!farms.some((f) => f.id === curFarmId)) {
        setCurFarmId(farms[0].id);
      }
    } else {
      setCurFarmId('');
    }
  }, [farms, curFarmId]);

  // Persist farms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(farms));
    } catch (e) {
      console.error('Failed to persist farms to localStorage', e);
    }
  }, [farms]);

  const curFarm = farms.find((f) => f.id === curFarmId) || farms[0] || null;

  // Aggregate metrics matching Image 1
  const totalFarmsCount = farms.length;
  const totalPlantsCount = farms.reduce((acc, f) => acc + (f.plants?.length || 0), 0);
  const healthyPlantsCount = farms.reduce(
    (acc, f) => acc + (f.plants?.filter((p) => p.status === 'healthy').length || 0),
    0
  );
  const diseasedPlantsCount = farms.reduce(
    (acc, f) =>
      acc +
      (f.plants?.filter((p) => p.status === 'disease' || p.status === 'suspected').length || 0),
    0
  );
  const inspectPlantsCount = farms.reduce(
    (acc, f) => acc + (f.plants?.filter((p) => p.status === 'inspect').length || 0),
    0
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueTasksCount = farms.reduce(
    (acc, f) =>
      acc + (f.tasks?.filter((t) => t.status === 'open' && t.due_date < todayStr).length || 0),
    0
  );

  // Recent observations across all farms
  const recentObservations = farms
    .flatMap((f) =>
      (f?.plants || []).flatMap((p) =>
        (p?.observations || []).map((obs) => ({
          ...obs,
          farmName: f?.name || 'Farm',
        }))
      )
    )
    .sort((a, b) => String(b?.observed_at || '').localeCompare(String(a?.observed_at || '')))
    .slice(0, 5);

  // Filtered tasks for current farm
  const currentFarmTasks = curFarm?.tasks || [];
  const filteredTasks = currentFarmTasks.filter((t) => {
    if (scheduleFilter === 'UPCOMING') return t.status === 'open';
    if (scheduleFilter === 'COMPLETED') return t.status === 'done';
    return true;
  });

  const handleUpdateFarm = (updated: Farm) => {
    setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  };

  const handleToggleTask = (taskId: string) => {
    if (!curFarm) return;
    const updatedTasks: Task[] = curFarm.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const nextStatus = t.status === 'open' ? 'done' : 'open';
      return {
        ...t,
        status: nextStatus,
        completed_at: nextStatus === 'done' ? new Date().toISOString().split('T')[0] : null,
      };
    });
    handleUpdateFarm({ ...curFarm, tasks: updatedTasks });
    showToast('ok', 'Task status updated');
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!curFarm || !newTaskTitle.trim()) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      farm_id: curFarm.id,
      title: newTaskTitle.trim(),
      due_date: newTaskDueDate || todayStr,
      source: newTaskCategory,
      notes: newTaskNotes.trim() || undefined,
      status: 'open',
    };
    handleUpdateFarm({
      ...curFarm,
      tasks: [newTask, ...curFarm.tasks],
    });
    setNewTaskTitle('');
    setNewTaskNotes('');
    setScheduleModalOpen(false);
    showToast('ok', 'Task added to schedule');
  };

  const handleDeleteFarm = async () => {
    if (!curFarm) return;
    const deletingId = curFarm.id;
    const deletingName = curFarm.name;
    const nextFarms = farms.filter((f) => f.id !== deletingId);

    try {
      await deleteBackendFarm(deletingId);
    } catch (e) {
      console.warn('Backend delete note:', e);
    }
    setFarms(nextFarms);
    setCurFarmId(nextFarms.length > 0 ? nextFarms[0].id : '');
    setDeleteModalOpen(false);
    setActiveTab('dashboard');
    showToast('ok', `Plot "${deletingName}" deleted.`);
  };

  const handleLoadDemoPlot = async () => {
    try {
      showToast('ok', 'Loading sample demo plot...');
      const demoFarm = await createDemoBackendFarm();
      setFarms((prev) => [demoFarm, ...prev]);
      setCurFarmId(demoFarm.id);
      setActiveTab('dashboard');
      showToast('ok', `Loaded demo plot: "${demoFarm.name}".`);
    } catch (err: any) {
      showToast('err', err?.message || 'Failed to load demo plot.');
    }
  };

  const openNewFarmModal = () => {
    setNewFarmName('My Pineapple Plot');
    setNewFarmLength(20);
    setNewFarmBreadth(12);
    setNewFarmVariety('Queen Pineapple');
    setNewFarmPlantingDate(todayStr);
    setNewFarmLayout(DEFAULT_PLANTING_LAYOUT);
    setNewFarmError(null);
    setNewFarmModalOpen(true);
  };

  const openEditFarmModal = () => {
    if (!curFarm) return;
    setEditFarmName(curFarm.name);
    setEditFarmLength(Number(curFarm.length) || 20);
    setEditFarmBreadth(Number(curFarm.breadth) || 12);
    setEditFarmVariety(curFarm.variety || 'Queen Pineapple');
    setEditFarmPlantingDate(curFarm.planting_date || todayStr);
    setEditFarmLayout(
      metersToLayoutValues(Number(curFarm.plant_spacing) || 0.3, Number(curFarm.row_spacing) || 0.6, curFarm.staggered !== false)
    );
    setEditFarmError(null);
    setEditFarmModalOpen(true);
  };

  const applyFarmLayout = async (nextFarm: Farm) => {
    try {
      setEditFarmSaving(true);
      const updated = await updateBackendFarm(nextFarm.id, {
        name: nextFarm.name,
        variety: nextFarm.variety,
        length: nextFarm.length,
        breadth: nextFarm.breadth,
        row_spacing: nextFarm.row_spacing,
        plant_spacing: nextFarm.plant_spacing,
        clearance: nextFarm.clearance,
        staggered: nextFarm.staggered,
        planting_date: nextFarm.planting_date,
        plants: nextFarm.plants,
      });
      setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setLayoutConfirm(null);
      setEditFarmModalOpen(false);
      showToast('ok', `Updated "${updated.name}" — ${updated.plants.length} plants on the map.`);
    } catch (err: any) {
      console.error('Update farm failed:', err);
      setEditFarmError(err?.message || 'Failed to persist plot updates to server.');
      showToast('err', err?.message || 'Failed to update plot.');
    } finally {
      setEditFarmSaving(false);
    }
  };

  const handleCreateFarmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFarmName.trim() || 'New Pineapple Plot';
    const length = Number(newFarmLength);
    const breadth = Number(newFarmBreadth);

    if (!name) {
      setNewFarmError('Plot name cannot be empty.');
      return;
    }
    if (!Number.isFinite(length) || length <= 0) {
      setNewFarmError('Plot length must be a positive number greater than 0.');
      return;
    }
    if (!Number.isFinite(breadth) || breadth <= 0) {
      setNewFarmError('Plot breadth must be a positive number greater than 0.');
      return;
    }

    const clearance = 0.5;
    const parsed = layoutFromForm(length, breadth, clearance, newFarmLayout);
    if (parsed.estimate.error) {
      setNewFarmError(parsed.estimate.error);
      return;
    }

    setNewFarmSaving(true);
    setNewFarmError(null);
    try {
      const plantingDate = newFarmPlantingDate || todayStr;
      const created = await createBackendFarm({
        name,
        variety: newFarmVariety,
        length,
        breadth,
        row_spacing: parsed.rowSpacingM,
        plant_spacing: parsed.plantSpacingM,
        clearance,
        staggered: parsed.staggered,
        planting_date: plantingDate,
        is_demo: false,
      });

      setFarms((prev) => [created, ...prev]);
      setCurFarmId(created.id);
      setNewFarmModalOpen(false);
      setActiveTab('farm-details');
      showToast('ok', `Created farm "${name}" with ${created.plants?.length || 0} plant nodes.`);
    } catch (err: any) {
      setNewFarmError(err?.message || 'Could not create this plot on the server.');
    } finally {
      setNewFarmSaving(false);
    }
  };

  const handleEditFarmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curFarm) return;
    const name = editFarmName.trim() || curFarm.name;
    const length = Number(editFarmLength);
    const breadth = Number(editFarmBreadth);

    if (!name) {
      setEditFarmError('Plot name cannot be empty.');
      return;
    }
    if (!Number.isFinite(length) || length <= 0) {
      setEditFarmError('Plot length must be a positive number greater than 0.');
      return;
    }
    if (!Number.isFinite(breadth) || breadth <= 0) {
      setEditFarmError('Plot breadth must be a positive number greater than 0.');
      return;
    }

    const clearance = Number(curFarm.clearance) || 0.5;
    const parsed = layoutFromForm(length, breadth, clearance, editFarmLayout);
    if (parsed.estimate.error) {
      setEditFarmError(parsed.estimate.error);
      return;
    }

    const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const layoutChanged =
      !nearlyEqual(length, Number(curFarm.length)) ||
      !nearlyEqual(breadth, Number(curFarm.breadth)) ||
      !nearlyEqual(parsed.rowSpacingM, Number(curFarm.row_spacing)) ||
      !nearlyEqual(parsed.plantSpacingM, Number(curFarm.plant_spacing)) ||
      parsed.staggered !== Boolean(curFarm.staggered !== false);

    setEditFarmSaving(true);
    setEditFarmError(null);
    try {
      if (!layoutChanged) {
        const payload = {
          name,
          variety: editFarmVariety,
          planting_date: editFarmPlantingDate || curFarm.planting_date,
        };
        const updated = await updateBackendFarm(curFarm.id, payload);
        setFarms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        setEditFarmModalOpen(false);
        showToast('ok', `Updated plot name to "${updated.name}".`);
        return;
      }

      const nextLayout = calculateLayout(
        curFarm.id,
        length,
        breadth,
        parsed.rowSpacingM,
        parsed.plantSpacingM,
        clearance,
        parsed.staggered
      );
      const plants = mergeLayoutPlants(curFarm.plants || [], nextLayout);
      const nextFarm: Farm = {
        ...curFarm,
        name,
        variety: editFarmVariety,
        planting_date: editFarmPlantingDate || curFarm.planting_date,
        length,
        breadth,
        clearance,
        row_spacing: parsed.rowSpacingM,
        plant_spacing: parsed.plantSpacingM,
        staggered: parsed.staggered,
        plants,
        total_plants: plants.length,
        active_plants: plants.filter((p) => !p.retired_at).length,
      };
      const impact = layoutChangeImpact(curFarm.plants || [], plants);
      if (impact.requiresConfirmation) {
        setLayoutConfirm({ nextFarm, impact });
        return;
      }
      await applyFarmLayout(nextFarm);
    } catch (err: any) {
      setEditFarmError(err?.message || 'Could not update this layout on the server.');
    } finally {
      setEditFarmSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf8] text-[#1c2e22]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg transition-all ${
            toast.type === 'ok'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <span>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Header / Title Bar Matching Image 1 */}
      <div className="border-b border-forest-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🍍</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold tracking-tight text-forest-900">
                  Smart Farm Planner
                </h1>
                <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  precision block
                </span>
              </div>
              <p className="text-xs text-forest-500">
                Double-row precision pineapple plot layout, S1 scheduling & observation tracking
              </p>
            </div>
          </div>

          {/* Farm Switcher & New Farm Quick Actions */}
          <div className="flex items-center gap-3">
            {farms.length > 0 && (
              <select
                value={curFarmId}
                onChange={(e) => {
                  setCurFarmId(e.target.value);
                  showToast('ok', `Selected farm`);
                }}
                className="rounded-xl border border-forest-200 bg-white px-3 py-1.5 text-xs font-medium text-forest-900 shadow-xs focus:border-forest-500 focus:outline-none"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.is_demo ? '(Demo)' : ''} ({f.length}×{f.breadth}m, {f.plants?.length || 0} plants)
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={openNewFarmModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-forest-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Farm</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        {farmsLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="h-9 w-9 animate-spin text-forest-700 mb-3" />
            <p className="text-sm font-semibold text-forest-900">Loading your farm plots...</p>
            <p className="text-xs text-forest-500 mt-1">Fetching saved plots from your account.</p>
          </div>
        ) : farms.length === 0 ? (
          <div className="mx-auto max-w-4xl py-10">
            <div className="mb-8 text-center space-y-2">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl shadow-sm border border-emerald-100">
                🍍
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-forest-950">
                Welcome to Loumi Farm Planner, {user?.full_name?.split(' ')[0] || 'Farmer'}!
              </h1>
              <p className="mx-auto max-w-md text-xs text-forest-600">
                Get started with precision agriculture. Design your own double-row plot from scratch, or explore features with a sample demo plot.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
              {/* Option A: Create My First Plot */}
              <div className="flex flex-col justify-between rounded-2xl border-2 border-forest-600 bg-white p-6 shadow-card hover:shadow-lg transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-forest-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-forest-700 border border-forest-200">
                      Option A
                    </span>
                    <span className="text-xs font-semibold text-emerald-800">Production Farm</span>
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-bold text-forest-900 flex items-center gap-2">
                      <MapIcon className="h-5 w-5 text-forest-700" />
                      <span>Create My First Plot</span>
                    </h2>
                    <p className="mt-2 text-xs text-forest-600 leading-relaxed">
                      Enter your plot name, custom length and breadth in metres, and select double-row or rectangular spacing. The precision plant map will be generated immediately.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-forest-50">
                    <div className="flex items-center gap-2 text-xs text-forest-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Custom length & breadth in metres</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-forest-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Double-row precision plant layout calculation</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-forest-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Dedicated observation & scouting records</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={openNewFarmModal}
                    className="w-full justify-center py-2.5 text-xs font-bold shadow-md cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Create My First Plot
                  </Button>
                </div>
              </div>

              {/* Option B: Use a Demo Plot */}
              <div className="flex flex-col justify-between rounded-2xl border border-forest-200 bg-white p-6 shadow-card hover:border-amber-400 hover:shadow-lg transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 border border-amber-200">
                      Option B
                    </span>
                    <span className="text-xs font-semibold text-amber-700">Sample Tour</span>
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-bold text-forest-900 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-600" />
                      <span>Use a Demo Plot</span>
                    </h2>
                    <p className="mt-2 text-xs text-forest-600 leading-relaxed">
                      Explore Loumi's features with a pre-configured 20m × 12m double-row plot named <strong>"{user?.full_name?.split(' ')[0] || 'Farmer'}'s Demo Plot"</strong> with sample healthy and suspected plant markers.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-forest-50">
                    <div className="flex items-center gap-2 text-xs text-forest-800">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Sample dimensions & pre-seeded health markers</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-forest-800">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Explore the interactive plant map instantly</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-forest-800">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Can be removed or upgraded with real plots anytime</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <Button
                    variant="secondary"
                    onClick={handleLoadDemoPlot}
                    className="w-full justify-center py-2.5 text-xs font-bold border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 mr-1.5 text-amber-600" /> Load Demo Plot
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Demo Plot Notice Banner */}
            {curFarm?.is_demo && (
              <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900 font-bold text-xs">
                    DEMO
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-950">
                      Demonstration Plot Active: "{curFarm.name}"
                    </p>
                    <p className="text-[11px] text-amber-800">
                      This is demonstration data for exploring Loumi's features. It does not affect your real farm records.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openNewFarmModal}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-forest-800 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Real Plot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-100/50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-amber-800" />
                    <span>Remove Demo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Banner Matching Image 1 */}
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 shadow-xs">
              <strong>Connected System:</strong> Precision horticulture engine with local offline browser persistence. Verified agronomic guidance in this project is ICAR NEH Manipur double-row 60 cm × 30 cm — plant counts on a plot are mathematical layout estimates, not recommendations.
            </div>

        {/* Sub-Navigation Buttons Matching Image 1 */}
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-forest-200 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'dashboard'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'border border-forest-200 bg-white text-forest-700 hover:bg-forest-50'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={openNewFarmModal}
            className="rounded-lg border border-forest-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-forest-700 hover:bg-forest-50"
          >
            New farm
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'map'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'border border-forest-200 bg-white text-forest-700 hover:bg-forest-50'
            }`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('farm-details')}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'farm-details'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'border border-forest-200 bg-white text-forest-700 hover:bg-forest-50'
            }`}
          >
            Farm Details & Schedule
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('location')}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'location'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'border border-forest-200 bg-white text-forest-700 hover:bg-forest-50'
            }`}
          >
            Location
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advice')}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'advice'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'border border-forest-200 bg-white text-forest-700 hover:bg-forest-50'
            }`}
          >
            Advice
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'backup'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'border border-forest-200 bg-white text-forest-700 hover:bg-forest-50'
            }`}
          >
            Backup
          </button>
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: DASHBOARD (MATCHING IMAGE 1) */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 6 KPI Cards Grid Matching Image 1 */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-forest-100 bg-white p-5 shadow-card">
                <div className="font-display text-3xl font-bold text-forest-900">{totalFarmsCount}</div>
                <div className="mt-1 text-xs font-medium text-forest-600">Farms</div>
              </div>

              <div className="rounded-2xl border border-forest-100 bg-white p-5 shadow-card">
                <div className="font-display text-3xl font-bold text-forest-900">
                  {totalPlantsCount.toLocaleString()}
                </div>
                <div className="mt-1 text-xs font-medium text-forest-600">Plants</div>
              </div>

              <div className="rounded-2xl border border-forest-100 bg-white p-5 shadow-card">
                <div className="font-display text-3xl font-bold text-emerald-600">{healthyPlantsCount}</div>
                <div className="mt-1 text-xs font-medium text-forest-600">Healthy</div>
              </div>

              <div className="rounded-2xl border border-forest-100 bg-white p-5 shadow-card">
                <div className="font-display text-3xl font-bold text-red-600">{diseasedPlantsCount}</div>
                <div className="mt-1 text-xs font-medium text-forest-600">Suspected or recorded disease</div>
              </div>

              <div className="rounded-2xl border border-forest-100 bg-white p-5 shadow-card">
                <div className="font-display text-3xl font-bold text-blue-600">{inspectPlantsCount}</div>
                <div className="mt-1 text-xs font-medium text-forest-600">Need inspection</div>
              </div>

              <div className="rounded-2xl border border-forest-100 bg-white p-5 shadow-card">
                <div className="font-display text-3xl font-bold text-forest-900">{overdueTasksCount}</div>
                <div className="mt-1 text-xs font-medium text-forest-600">Overdue tasks</div>
              </div>
            </div>

            {/* Split Row: Farms List (Left) & Recent Observations (Right) Matching Image 1 */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Farms Card */}
              <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
                <div className="flex items-center justify-between border-b border-forest-100 pb-3">
                  <h2 className="font-display text-base font-bold text-forest-900">Farms</h2>
                  <button
                    type="button"
                    onClick={openNewFarmModal}
                    className="text-xs font-semibold text-forest-700 hover:underline"
                  >
                    + Add New Farm
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {farms.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-xl border border-forest-100 bg-forest-50/30 p-4 transition-all hover:border-forest-300"
                    >
                      <div>
                        <h3 className="font-display text-sm font-bold text-forest-900">{f.name}</h3>
                        <p className="mt-0.5 text-xs text-forest-600">
                          {f.length}×{f.breadth} m, {f.plants?.length || 0} plants
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCurFarmId(f.id);
                            setActiveTab('farm-details');
                          }}
                          className="rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-700 shadow-xs hover:bg-forest-50"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurFarmId(f.id);
                            setActiveTab('map');
                          }}
                          className="rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-forest-800"
                        >
                          Open map
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Observations Card */}
              <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
                <h2 className="font-display text-base font-bold text-forest-900 border-b border-forest-100 pb-3">
                  Recent observations
                </h2>

                <div className="mt-4">
                  {recentObservations.length === 0 ? (
                    <p className="py-6 text-center text-xs text-forest-500">
                      No plant observations recorded yet. Open the Plot Map to inspect plants.
                    </p>
                  ) : (
                    <ul className="space-y-3 text-xs text-forest-700">
                      {recentObservations.map((obs) => (
                        <li key={obs.id} className="flex items-center gap-2 border-b border-forest-50 pb-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-600" />
                          <span className="font-semibold text-forest-900">
                            {obs.plant_id} ({obs.farmName}):
                          </span>
                          <span>
                            {obs.status.charAt(0).toUpperCase() + obs.status.slice(1)} on {obs.observed_at}
                          </span>
                          {obs.notes && <span className="italic text-forest-500">— {obs.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming Tasks Card Matching Image 1 */}
            <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
              <div className="flex items-center justify-between border-b border-forest-100 pb-3">
                <h2 className="font-display text-base font-bold text-forest-900">Upcoming tasks</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('farm-details')}
                  className="text-xs font-semibold text-forest-700 hover:underline"
                >
                  Manage all schedule tasks →
                </button>
              </div>

              <div className="mt-4">
                {currentFarmTasks.filter((t) => t.status === 'open').length === 0 ? (
                  <p className="py-4 text-xs text-forest-500">No open tasks.</p>
                ) : (
                  <div className="space-y-2.5">
                    {currentFarmTasks
                      .filter((t) => t.status === 'open')
                      .slice(0, 4)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded-xl border border-forest-100 bg-forest-50/20 px-4 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => handleToggleTask(t.id)}
                              className="h-4 w-4 rounded text-forest-700 focus:ring-forest-500"
                            />
                            <div>
                              <p className="text-xs font-semibold text-forest-900">{t.title}</p>
                              {t.notes && <p className="text-[11px] text-forest-500">{t.notes}</p>}
                            </div>
                          </div>
                          <span className="rounded-md bg-forest-100 px-2 py-0.5 text-[10px] font-bold text-forest-800">
                            Due {t.due_date}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: FARM DETAILS & SCHEDULE (MATCHING IMAGE 2 RIGHT PANEL) */}
        {/* ============================================================== */}
        {activeTab === 'farm-details' && curFarm && (
          <div className="space-y-6">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs font-medium text-forest-500">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="hover:text-forest-900"
              >
                Dashboard
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-forest-400" />
              <span className="font-semibold text-forest-800">{curFarm.name}</span>
            </div>

            {/* Farm Header Bar */}
            <div className="flex flex-col justify-between gap-4 border-b border-forest-200 pb-5 sm:flex-row sm:items-center">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#1b4332]">
                  {curFarm.name}
                </h1>
                <p className="mt-0.5 text-xs font-medium text-forest-600">
                  {curFarm.variety} Farm • Precision Block
                </p>
              </div>

              {/* Action Buttons Matching Image 2 */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={openEditFarmModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 shadow-xs hover:bg-forest-50"
                >
                  <Pencil className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Edit plot &amp; spacing</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('location')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 shadow-xs hover:bg-forest-50"
                >
                  <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Location & GPS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 shadow-xs hover:bg-forest-50"
                >
                  <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Manage Schedule</span>
                </button>

                <ExportDropdown
                  farm={curFarm}
                  onSuccess={(msg) => showToast('ok', msg)}
                  onError={(msg) => showToast('err', msg)}
                />

                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 shadow-xs hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Farm</span>
                </button>
              </div>
            </div>

            {/* Two-Column Grid: Farm Details & Layout (Left 5 Cols) + Farming Schedule (Right 7 Cols) */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              {/* Left Column (5 Cols) */}
              <div className="space-y-6 lg:col-span-5">
                {/* Card 1: Farm Details */}
                <div className="rounded-xl border border-forest-100 bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between border-b border-forest-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-forest-900">
                      Farm Details
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('location')}
                      className="flex items-center gap-1 text-[11px] font-semibold text-forest-700 hover:underline"
                    >
                      <Compass className="h-3 w-3" /> GPS Config
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-forest-50">
                      <span className="text-forest-600">Dimensions</span>
                      <span className="font-semibold text-forest-900">
                        {Number(curFarm.length || 0).toFixed(1)}m × {Number(curFarm.breadth || 0).toFixed(1)}m
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-forest-50">
                      <span className="text-forest-600">Total Area</span>
                      <span className="font-semibold text-forest-900">
                        {(Number(curFarm.length || 0) * Number(curFarm.breadth || 0)).toFixed(1)} sqm
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-forest-50">
                      <span className="text-forest-600">Crop Variety</span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 border border-emerald-200">
                        {curFarm.variety}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-forest-50">
                      <span className="text-forest-600">Row × plant spacing</span>
                      <span className="font-semibold text-forest-900">
                        {mToCm(Number(curFarm.row_spacing || 0.6))} cm × {mToCm(Number(curFarm.plant_spacing || 0.3))} cm
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-forest-50">
                      <span className="text-forest-600">Arrangement</span>
                      <span className="font-semibold text-forest-900">
                        {curFarm.staggered === false ? 'Single row' : 'Double row (staggered)'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-forest-50">
                      <span className="text-forest-600">Boundary Clearance</span>
                      <span className="font-semibold text-forest-900">
                        {Number(curFarm.clearance || 0.5).toFixed(2)}m
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-forest-50">
                      <span className="text-forest-600">Planting Date</span>
                      <span className="font-semibold text-forest-900">
                        {curFarm.planting_date || 'Not set'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-forest-600">Center GPS</span>
                      <span className="font-mono text-[11px] text-forest-900">
                        {curFarm.location
                          ? `${Number(curFarm.location.lat || 0).toFixed(4)}°N, ${Number(curFarm.location.lon || 0).toFixed(4)}°E`
                          : 'Manipur region'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Layout Optimization */}
                <div className="rounded-xl border border-forest-100 bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between border-b border-forest-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-forest-900">
                      Layout Optimization
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('map')}
                      className="inline-flex items-center gap-1 rounded-md border border-forest-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#2d6a4f] hover:bg-emerald-100"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Full Screen</span>
                    </button>
                  </div>

                  {/* Mini Map Clickable Preview */}
                  <div
                    onClick={() => setActiveTab('map')}
                    className="group relative mt-3 flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-forest-200 bg-[#eef6f0] p-2"
                  >
                    <svg viewBox={`0 0 ${curFarm.length || 20} ${curFarm.breadth || 12}`} className="h-full w-full">
                      <rect
                        x={0}
                        y={0}
                        width={curFarm.length || 20}
                        height={curFarm.breadth || 12}
                        fill="#ffffff"
                        stroke="#94a3b8"
                        strokeWidth={0.1}
                        strokeDasharray="0.3 0.2"
                      />
                      {(curFarm.plants || []).slice(0, 150).map((p) => (
                        <circle
                          key={p.id}
                          cx={p.x}
                          cy={p.y}
                          r={0.15}
                          fill={p.status === 'healthy' ? '#16a34a' : '#64748b'}
                        />
                      ))}
                    </svg>

                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-[#1b4332] shadow-sm backdrop-blur-xs flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5" /> Open Full Plot Map
                      </span>
                    </div>
                  </div>

                  {/* Layout Stats Grid Matching Image 2 */}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg border border-forest-100 bg-forest-50/40 p-2.5">
                      <div className="font-display text-base font-bold text-[#1b4332]">
                        {curFarm.plants?.length || 0}
                      </div>
                      <div className="text-[10px] font-semibold uppercase text-forest-600">
                        Est. plant nodes
                      </div>
                    </div>

                    <div className="rounded-lg border border-forest-100 bg-forest-50/40 p-2.5">
                      <div className="font-display text-base font-bold text-[#1b4332]">
                        {Math.max(...(curFarm.plants || []).map((p) => p.row || 1), 1)} ×{' '}
                        {Math.max(...(curFarm.plants || []).map((p) => p.pos || 1), 1)}
                      </div>
                      <div className="text-[10px] font-semibold uppercase text-forest-600">
                        Rows × Columns
                      </div>
                    </div>

                    <div className="rounded-lg border border-forest-100 bg-forest-50/40 p-2.5">
                      <div className="font-display text-base font-bold text-[#1b4332]">
                        {(() => {
                          const len = Number(curFarm.length || 20);
                          const brd = Number(curFarm.breadth || 12);
                          const clr = Number(curFarm.clearance || 0.5);
                          const total = len * brd;
                          const net = Math.max(0, len - 2 * clr) * Math.max(0, brd - 2 * clr);
                          return total > 0 ? ((net / total) * 100).toFixed(1) : '0.0';
                        })()}
                        %
                      </div>
                      <div className="text-[10px] font-semibold uppercase text-forest-600">
                        Land Utilization
                      </div>
                    </div>

                    <div className="rounded-lg border border-forest-100 bg-forest-50/40 p-2.5">
                      <div className="font-display text-base font-bold text-[#1b4332]">
                        {(() => {
                          const len = Number(curFarm.length || 20);
                          const brd = Number(curFarm.breadth || 12);
                          const clr = Number(curFarm.clearance || 0.5);
                          return (Math.max(0, len - 2 * clr) * Math.max(0, brd - 2 * clr)).toFixed(1);
                        })()}{' '}
                        m²
                      </div>
                      <div className="text-[10px] font-semibold uppercase text-forest-600">
                        Net Spaced Area
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Farming Schedule (7 Cols Matching Image 2) */}
              <div className="lg:col-span-7">
                <div className="rounded-xl border border-forest-100 bg-white p-5 shadow-card">
                  <div className="flex flex-col justify-between gap-3 border-b border-forest-100 pb-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-forest-900">
                        Farming Schedule
                      </h3>
                      <p className="mt-0.5 text-xs text-forest-500">
                        Calendar and NIPHM S1 follow-up activities
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setScheduleModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-forest-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Schedule</span>
                    </button>
                  </div>

                  {/* Filter Pills Matching Image 2 */}
                  <div className="mt-4 flex items-center gap-2">
                    {(['UPCOMING', 'ALL', 'COMPLETED'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setScheduleFilter(filter)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                          scheduleFilter === filter
                            ? 'bg-[#2d6a4f] text-white shadow-xs'
                            : 'bg-forest-50 text-forest-700 hover:bg-forest-100'
                        }`}
                      >
                        {filter === 'ALL' ? 'All Tasks' : filter}
                      </button>
                    ))}
                    <span className="ml-auto text-xs font-medium text-forest-400">
                      {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>

                  {/* Task Cards List */}
                  <div className="mt-4 space-y-3">
                    {filteredTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-forest-200 py-10 text-center">
                        <Calendar className="mx-auto h-8 w-8 text-forest-300" />
                        <p className="mt-2 text-xs font-medium text-forest-500">
                          No {scheduleFilter.toLowerCase()} tasks recorded for this plot.
                        </p>
                      </div>
                    ) : (
                      filteredTasks.map((t) => (
                        <div
                          key={t.id}
                          className={`rounded-xl border p-4 transition-all ${
                            t.status === 'done'
                              ? 'border-forest-100 bg-forest-50/20 opacity-70'
                              : 'border-forest-200 bg-white hover:border-forest-300 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={t.status === 'done'}
                                onChange={() => handleToggleTask(t.id)}
                                className="mt-0.5 h-4 w-4 rounded text-forest-700 focus:ring-forest-500 cursor-pointer"
                              />
                              <div>
                                <h4
                                  className={`text-xs font-bold text-forest-900 ${
                                    t.status === 'done' ? 'line-through text-forest-400' : ''
                                  }`}
                                >
                                  {t.title}
                                </h4>
                                {t.notes && (
                                  <p className="mt-1 text-xs text-forest-600">{t.notes}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                {t.source || 'Task'}
                              </span>
                              <span className="text-[11px] font-medium text-forest-500">
                                Due: {t.due_date}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: PLOT MAP (MATCHING IMAGE 2 LEFT & IMAGE 3) */}
        {/* ============================================================== */}
        {activeTab === 'map' && curFarm && (
          <PlotNodeMapView
            farm={curFarm}
            farms={farms}
            onSelectFarm={(id) => setCurFarmId(id)}
            onUpdateFarm={handleUpdateFarm}
            onOpenDiagnoseForPlant={(plantId) => {
              navigate(`/disease-detection?farmId=${curFarm.id}&plantId=${plantId}`);
            }}
          />
        )}

        {/* ============================================================== */}
        {/* VIEW 4: LOCATION & GPS */}
        {/* ============================================================== */}
        {activeTab === 'location' && curFarm && (
          <div className="max-w-2xl mx-auto rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
            <h2 className="font-display text-base font-bold text-forest-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-forest-700" />
              <span>Location & 3-Corner GPS Calibration</span>
            </h2>
            <p className="mt-1 text-xs text-forest-600">
              Calibrate corner coordinates for <strong>{curFarm.name}</strong> to convert local plant meters (x, y) into geographic latitude/longitude.
            </p>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-forest-800">Farm Center Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={curFarm.location?.lat || 24.817}
                  onChange={(e) => {
                    const lat = parseFloat(e.target.value);
                    handleUpdateFarm({
                      ...curFarm,
                      location: { lat, lon: curFarm.location?.lon || 93.948 },
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-forest-800">Farm Center Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={curFarm.location?.lon || 93.948}
                  onChange={(e) => {
                    const lon = parseFloat(e.target.value);
                    handleUpdateFarm({
                      ...curFarm,
                      location: { lat: curFarm.location?.lat || 24.817, lon },
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-forest-100 bg-forest-50/50 p-4">
                <span className="font-semibold text-forest-800">Manipur Regional Reference:</span>
                <p className="mt-0.5 text-forest-600">
                  Imphal East (24.8170° N, 93.9480° E), Churachandpur (24.3333° N, 93.6833° E).
                </p>
              </div>

              <div className="pt-2">
                <Button onClick={() => showToast('ok', 'Coordinates updated successfully')}>
                  Save Location Coordinates
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 5: ADVICE & KNOWLEDGE BASE */}
        {/* ============================================================== */}
        {activeTab === 'advice' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-forest-900">
                Official Pineapple Health Guide (ICAR / NIPHM AESA)
              </h2>
              <p className="mt-1 text-xs text-forest-600">
                Comprehensive pest and symptom reference for precision pineapple farms in Manipur.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-forest-100 bg-forest-50/30 p-4">
                  <h3 className="font-bold text-forest-900 text-sm">Pineapple Mealybug Wilt</h3>
                  <p className="mt-1 text-xs text-forest-600">
                    Associated with PMWaV transmitted by <em>Dysmicoccus brevipes</em>. Symbiotic ant trails carry nymphs.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-forest-800">Cultural Action:</p>
                  <p className="text-xs text-forest-600">
                    Maintain ant-guard barriers around beds. Strip and cure suckers in shade 3 days before planting.
                  </p>
                </div>

                <div className="rounded-xl border border-forest-100 bg-forest-50/30 p-4">
                  <h3 className="font-bold text-forest-900 text-sm">Fusarium Heart / Fruit Rot</h3>
                  <p className="mt-1 text-xs text-forest-600">
                    Fungal pathogens thriving in poorly drained soils and excessive standing water during heavy monsoon spells.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-forest-800">Cultural Action:</p>
                  <p className="text-xs text-forest-600">
                    Maintain 40–50 cm deep contour drainage furrows. Apply Trichoderma bio-dip on suckers.
                  </p>
                </div>

                <div className="rounded-xl border border-forest-100 bg-forest-50/30 p-4">
                  <h3 className="font-bold text-forest-900 text-sm">White Leaf Spot / Blight</h3>
                  <p className="mt-1 text-xs text-forest-600">
                    Small brown lesions expanding into papery white spots with dark margins along leaf rub contact lines.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-forest-800">Cultural Action:</p>
                  <p className="text-xs text-forest-600">
                    Ensure adequate plant spacing (30 cm) to avoid leaf abrasion in high winds.
                  </p>
                </div>

                <div className="rounded-xl border border-forest-100 bg-forest-50/30 p-4">
                  <h3 className="font-bold text-forest-900 text-sm">Healthy Pineapple Canopy</h3>
                  <p className="mt-1 text-xs text-forest-600">
                    Robust green leaves with waxy bloom, upright heart leaves, and active root development.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-forest-800">Cultural Action:</p>
                  <p className="text-xs text-forest-600">
                    Split nutrient applications at months 2, 5, and 8. Mulch beds to preserve moisture.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 7: BACKUP & EXPORT */}
        {/* ============================================================== */}
        {activeTab === 'backup' && (
          <div className="max-w-xl mx-auto rounded-2xl border border-forest-100 bg-white p-6 shadow-card space-y-4">
            <h2 className="font-display text-base font-bold text-forest-900">
              Backup & Data Export
            </h2>
            <p className="text-xs text-forest-600">
              Export farm geometry and plant observation history for offline recordkeeping or transfer.
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center justify-between rounded-xl border border-forest-100 bg-forest-50/50 p-3">
                <div>
                  <p className="text-xs font-bold text-forest-900">Export Current Farm Data</p>
                  <p className="text-[11px] text-forest-600">Download selected farm in CSV, Excel, or PDF</p>
                </div>
                <ExportDropdown
                  farm={curFarm}
                  onSuccess={(msg) => showToast('ok', msg)}
                  onError={(msg) => showToast('err', msg)}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(farms, null, 2));
                  const dl = document.createElement('a');
                  dl.setAttribute('href', dataStr);
                  dl.setAttribute('download', `smart_farm_planner_backup_${todayStr}.json`);
                  document.body.appendChild(dl);
                  dl.click();
                  document.body.removeChild(dl);
                  showToast('ok', 'Downloaded complete JSON backup');
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-forest-200 bg-forest-50 py-2.5 text-xs font-bold text-forest-800 hover:bg-forest-100"
              >
                <Download className="h-4 w-4" /> Download Complete JSON Backup
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL: CREATE NEW FARM */}
      {/* ============================================================== */}
      {newFarmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-forest-100 pb-3">
              <h3 className="font-display text-base font-bold text-forest-900">Create New Farm Plot</h3>
              <button
                type="button"
                onClick={() => setNewFarmModalOpen(false)}
                className="text-forest-400 hover:text-forest-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFarmSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-forest-800">Farm Plot Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hill Slope Block A"
                  value={newFarmName}
                  onChange={(e) => setNewFarmName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-forest-800">Length (meters)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="200"
                    value={newFarmLength}
                    onChange={(e) => setNewFarmLength(parseFloat(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-forest-800">Breadth (meters)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="200"
                    value={newFarmBreadth}
                    onChange={(e) => setNewFarmBreadth(parseFloat(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-forest-800">Pineapple Variety</label>
                  <select
                    value={newFarmVariety}
                    onChange={(e) => setNewFarmVariety(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="Queen Pineapple">Queen Pineapple (Fresh Market)</option>
                    <option value="Kew Pineapple">Kew Pineapple (Processing)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-forest-800">Planting Date</label>
                  <input
                    type="date"
                    value={newFarmPlantingDate}
                    onChange={(e) => setNewFarmPlantingDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <PlantingLayoutSection
                lengthM={Number(newFarmLength) || 0}
                breadthM={Number(newFarmBreadth) || 0}
                clearanceM={0.5}
                values={newFarmLayout}
                onChange={setNewFarmLayout}
                idPrefix="new-farm"
              />

              {newFarmError && <p className="text-[11px] font-medium text-red-700">{newFarmError}</p>}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" size="sm" type="button" onClick={() => setNewFarmModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={newFarmSaving}>
                  {newFarmSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Creating plot...
                    </>
                  ) : (
                    'Generate Farm Plot & Layout'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editFarmModalOpen && curFarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-forest-100 pb-3">
              <h3 className="font-display text-base font-bold text-forest-900">Edit Farm Plot &amp; Spacing</h3>
              <button
                type="button"
                onClick={() => setEditFarmModalOpen(false)}
                className="text-forest-400 hover:text-forest-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditFarmSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-forest-800">Farm Plot Name</label>
                <input
                  type="text"
                  required
                  value={editFarmName}
                  onChange={(e) => setEditFarmName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-forest-800">Length (meters)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="200"
                    value={editFarmLength}
                    onChange={(e) => setEditFarmLength(parseFloat(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-forest-800">Breadth (meters)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="200"
                    value={editFarmBreadth}
                    onChange={(e) => setEditFarmBreadth(parseFloat(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[11px] text-forest-500">
                Boundary clearance stays {Number(curFarm.clearance || 0.5).toFixed(2)} m. Physical plot size only changes if you edit length or breadth.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-forest-800">Pineapple Variety</label>
                  <select
                    value={editFarmVariety}
                    onChange={(e) => setEditFarmVariety(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="Queen Pineapple">Queen Pineapple (Fresh Market)</option>
                    <option value="Kew Pineapple">Kew Pineapple (Processing)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-forest-800">Planting Date</label>
                  <input
                    type="date"
                    value={editFarmPlantingDate}
                    onChange={(e) => setEditFarmPlantingDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <PlantingLayoutSection
                lengthM={Number(editFarmLength) || 0}
                breadthM={Number(editFarmBreadth) || 0}
                clearanceM={Number(curFarm.clearance) || 0.5}
                values={editFarmLayout}
                onChange={setEditFarmLayout}
                idPrefix="edit-farm"
              />

              {editFarmError && <p className="text-[11px] font-medium text-red-700">{editFarmError}</p>}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" size="sm" type="button" onClick={() => setEditFarmModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={editFarmSaving}>
                  {editFarmSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving farm changes...
                    </>
                  ) : (
                    'Save farm changes'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {layoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-forest-900">Confirm layout change</h3>
            <p className="mt-2 text-xs text-forest-700">
              Recalculating rows and plant positions will update the map. Plant IDs that still exist keep their observations and disease status. Plot size and boundary clearance are only changed if you edited those fields.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-forest-800">
              <li>
                Current nodes: <strong>{layoutConfirm.impact.currentCount}</strong>
              </li>
              <li>
                New mathematical estimate: <strong>{layoutConfirm.impact.nextCount}</strong>
              </li>
              {layoutConfirm.impact.removedCount > 0 && (
                <li>
                  Plant IDs that would be removed: <strong>{layoutConfirm.impact.removedCount}</strong>
                  {layoutConfirm.impact.recordedRemovedCount > 0
                    ? ` (including ${layoutConfirm.impact.recordedRemovedCount} with observations or a recorded status)`
                    : ''}
                </li>
              )}
              {layoutConfirm.impact.addedCount > 0 && (
                <li>
                  New plant IDs: <strong>{layoutConfirm.impact.addedCount}</strong>
                </li>
              )}
              {layoutConfirm.impact.positionsChanged && (
                <li>Existing plant IDs that remain will move to the new row and spacing coordinates.</li>
              )}
            </ul>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" size="sm" type="button" onClick={() => setLayoutConfirm(null)}>
                Keep current layout
              </Button>
              <Button size="sm" type="button" disabled={editFarmSaving} onClick={() => applyFarmLayout(layoutConfirm.nextFarm)}>
                {editFarmSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Applying layout...
                  </>
                ) : (
                  'Apply new layout'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD CUSTOM SCHEDULE TASK */}
      {/* ============================================================== */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-forest-100 pb-3">
              <h3 className="font-display text-base font-bold text-forest-900">Add Scheduled Farm Task</h3>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="text-forest-400 hover:text-forest-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-forest-800">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apply organic straw mulch to bed 3"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-forest-800">Category Tag</label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="Scouting">Scouting</option>
                    <option value="Fertilizer">Fertilizer</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Sanitation">Sanitation</option>
                    <option value="Harvest">Harvest</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-forest-800">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newTaskDueDate || todayStr}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-forest-800">Notes / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Inspect plant nodes for ant movement"
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-forest-200 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Save Scheduled Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ============================================================== */}
      {deleteModalOpen && curFarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-red-600">Delete Farm Plot?</h3>
            <p className="mt-2 text-xs text-forest-600">
              Are you sure you want to delete <strong>{curFarm.name}</strong> ({curFarm.plants?.length || 0} plants)? This action will remove all saved plant observations for this farm.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDeleteFarm}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
              >
                Delete Farm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
