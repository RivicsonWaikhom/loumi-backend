import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Farm, Plant, Task } from '@/pages/farm-planner/types';
import { estimatePlantCount } from '@/pages/farm-planner/geometry';

/**
 * Sanitize a farm name for safe cross-platform filename usage
 */
export function sanitizeFilename(name: string): string {
  const cleaned = (name || 'Farm')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  return cleaned || 'Loumi_Farm';
}

/**
 * Format a date as YYYY-MM-DD
 */
export function getExportDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Escape a string for RFC 4180 CSV compliance
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Helper to trigger browser download of a Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Authoritative Health Statistics & Physical Metric Engine
 * Reconciles 100% of the active plant population across all categories.
 */
export interface FarmHealthMetrics {
  allPlants: Plant[];
  activePlants: Plant[];
  retiredPlants: Plant[];
  totalActive: number;
  totalAll: number;
  healthyCount: number;
  suspectedCount: number;
  diseaseCount: number;
  inspectCount: number;
  notInspectedCount: number;
  healthyPct: string;
  suspectedPct: string;
  diseasePct: string;
  inspectPct: string;
  notInspectedPct: string;
  grossArea: number;
  netArea: number;
  landUtilizationPct: string;
  usableLength: number;
  usableBreadth: number;
  theoreticalCapacity: { count: number; rows: number; maxPerRow: number };
  taggedPlants: Plant[];
  tasks: Task[];
}

export function computeFarmMetrics(farm: Farm): FarmHealthMetrics {
  const allPlants = farm.plants || [];
  const activePlants = allPlants.filter((p) => !p.retired_at);
  const retiredPlants = allPlants.filter((p) => Boolean(p.retired_at));
  const totalActive = activePlants.length;
  const totalAll = allPlants.length;

  let healthyCount = 0;
  let suspectedCount = 0;
  let diseaseCount = 0;
  let inspectCount = 0;
  let notInspectedCount = 0;

  for (const p of activePlants) {
    const st = String(p.status || '').toLowerCase().trim();
    if (st === 'healthy') healthyCount++;
    else if (st === 'suspected') suspectedCount++;
    else if (st === 'disease') diseaseCount++;
    else if (st === 'inspect') inspectCount++;
    else notInspectedCount++; // 'unknown', empty, null, etc.
  }

  const formatPct = (cnt: number) =>
    totalActive > 0 ? `${((cnt / totalActive) * 100).toFixed(1)}%` : '0.0%';

  const length = Number(farm.length || 0);
  const breadth = Number(farm.breadth || 0);
  const clearance = Number(farm.clearance || 0.5);
  const rowSpacing = Number(farm.row_spacing || 0.6);
  const plantSpacing = Number(farm.plant_spacing || 0.3);
  const staggered = farm.staggered !== false;

  const grossArea = length * breadth;
  const usableLength = Math.max(0, length - 2 * clearance);
  const usableBreadth = Math.max(0, breadth - 2 * clearance);
  const netArea = usableLength * usableBreadth;
  const landUtilizationPct =
    grossArea > 0 ? `${((netArea / grossArea) * 100).toFixed(1)}%` : '0.0%';

  let theoreticalCapacity = { count: 0, rows: 0, maxPerRow: 0 };
  try {
    const est = estimatePlantCount(length, breadth, rowSpacing, plantSpacing, clearance, staggered);
    if (!est.error) {
      theoreticalCapacity = { count: est.count, rows: est.rows, maxPerRow: est.maxPerRow };
    }
  } catch {
    // fallback if geometry estimation raises an exception
    theoreticalCapacity = { count: totalActive, rows: 0, maxPerRow: 0 };
  }

  // Tagged plants: plants with observations or non-default status
  const taggedPlants = allPlants.filter((p) => {
    const hasObs = p.observations && p.observations.length > 0;
    const isTaggedStatus = p.status && p.status !== 'unknown';
    return hasObs || isTaggedStatus;
  });

  return {
    allPlants,
    activePlants,
    retiredPlants,
    totalActive,
    totalAll,
    healthyCount,
    suspectedCount,
    diseaseCount,
    inspectCount,
    notInspectedCount,
    healthyPct: formatPct(healthyCount),
    suspectedPct: formatPct(suspectedCount),
    diseasePct: formatPct(diseaseCount),
    inspectPct: formatPct(inspectCount),
    notInspectedPct: formatPct(notInspectedCount),
    grossArea,
    netArea,
    landUtilizationPct,
    usableLength,
    usableBreadth,
    theoreticalCapacity,
    taggedPlants,
    tasks: farm.tasks || [],
  };
}

/**
 * Export selected farm data to structured RFC 4180 CSV
 */
export function exportFarmToCsv(farm: Farm): { filename: string; count: number } {
  if (!farm) throw new Error('No farm selected for CSV export.');

  const dateStr = getExportDateStr();
  const safeName = sanitizeFilename(farm.name);
  const filename = `${safeName}_export_${dateStr}.csv`;
  const m = computeFarmMetrics(farm);

  const headers = [
    'farm_name',
    'crop_variety',
    'plant_id',
    'row',
    'position_in_row',
    'x_meters',
    'y_meters',
    'health_status',
    'is_active',
    'total_observations',
    'last_observation_date',
    'last_observation_status',
    'last_observation_condition',
    'last_observation_notes',
  ];

  const rows = m.allPlants.map((p) => {
    const obs = p.observations || [];
    const lastObs = obs.length > 0 ? obs[obs.length - 1] : null;
    const isActive = !p.retired_at ? 'YES' : 'NO (RETIRED)';
    const status = (p.status || 'unknown').toLowerCase();

    return [
      farm.name,
      farm.variety || 'Pineapple',
      p.id,
      p.row,
      p.pos,
      typeof p.x === 'number' ? p.x.toFixed(3) : p.x,
      typeof p.y === 'number' ? p.y.toFixed(3) : p.y,
      status,
      isActive,
      obs.length,
      lastObs?.observed_at || '',
      lastObs?.status || '',
      lastObs?.condition || '',
      lastObs?.notes || '',
    ]
      .map(escapeCsvField)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);

  return { filename, count: m.allPlants.length };
}

/**
 * Export selected farm data to genuine multi-sheet Excel (.xlsx) workbook
 */
export function exportFarmToExcel(farm: Farm): { filename: string; count: number } {
  if (!farm) throw new Error('No farm selected for Excel export.');

  const dateStr = getExportDateStr();
  const safeName = sanitizeFilename(farm.name);
  const filename = `${safeName}_export_${dateStr}.xlsx`;
  const m = computeFarmMetrics(farm);

  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: Farm Overview & Health Statistics
  // -------------------------------------------------------------
  const overviewData: (string | number)[][] = [
    ['LOUMI SMART FARM PLANNER - DETAILED FARM REPORT'],
    ['Generated At', new Date().toLocaleString()],
    [],
    ['Parameter', 'Specification / Value'],
    ['Farm ID', farm.id],
    ['Farm Name', farm.name],
    ['Crop Variety', farm.variety || 'Queen Pineapple'],
    ['Plot Dimensions (L x B)', `${farm.length} m x ${farm.breadth} m`],
    ['Total Gross Area', `${m.grossArea.toFixed(2)} m2`],
    ['Net Cultivated Area', `${m.netArea.toFixed(2)} m2`],
    ['Land Utilization', m.landUtilizationPct],
    ['Row Spacing', `${farm.row_spacing} m (${(farm.row_spacing * 100).toFixed(0)} cm)`],
    ['Plant Spacing', `${farm.plant_spacing} m (${(farm.plant_spacing * 100).toFixed(0)} cm)`],
    ['Boundary Clearance', `${farm.clearance} m`],
    ['Layout Style', farm.staggered ? 'Double-row Staggered (Precision)' : 'Single-row Rectangular Grid'],
    ['Theoretical Layout Capacity', `${m.theoreticalCapacity.count} plants (${m.theoreticalCapacity.rows} rows)`],
    ['Planting Date', farm.planting_date || 'Not specified'],
    ['GPS Latitude', farm.location?.lat ? farm.location.lat.toFixed(6) : 'Not calibrated'],
    ['GPS Longitude', farm.location?.lon ? farm.location.lon.toFixed(6) : 'Not calibrated'],
    [],
    ['Health Status Metric', 'Active Count', 'Percentage (% of Active Population)'],
    ['Healthy Canopy', m.healthyCount, m.healthyPct],
    ['Suspected Disease', m.suspectedCount, m.suspectedPct],
    ['Recorded Disease', m.diseaseCount, m.diseasePct],
    ['Needs Inspection', m.inspectCount, m.inspectPct],
    ['Not Inspected / Baseline', m.notInspectedCount, m.notInspectedPct],
    ['Total Active Population', m.totalActive, m.totalActive > 0 ? '100.0%' : '0.0%'],
  ];

  if (m.retiredPlants.length > 0) {
    overviewData.push(
      ['Historical / Retired Records', m.retiredPlants.length, 'Preserved from plot resize'],
      ['Total All Records', m.totalAll, '-']
    );
  }

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 32 }, { wch: 35 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Farm Overview');

  // -------------------------------------------------------------
  // Sheet 2: Plants Inventory
  // -------------------------------------------------------------
  const plantHeaders = [
    'Plant ID',
    'Row',
    'Position',
    'X (m)',
    'Y (m)',
    'Health Status',
    'Active Status',
    'Total Observations',
    'Last Inspection Date',
    'Last Inspection Status',
    'Last Condition / Diagnostics',
    'Last Notes',
  ];

  const plantRows = m.allPlants.map((p) => {
    const obs = p.observations || [];
    const last = obs.length > 0 ? obs[obs.length - 1] : null;
    return [
      p.id,
      p.row,
      p.pos,
      typeof p.x === 'number' ? Number(p.x.toFixed(3)) : p.x,
      typeof p.y === 'number' ? Number(p.y.toFixed(3)) : p.y,
      (p.status || 'unknown').toLowerCase(),
      !p.retired_at ? 'Active' : 'Retired',
      obs.length,
      last?.observed_at || '',
      last?.status || '',
      last?.condition || '',
      last?.notes || '',
    ];
  });

  const wsPlants = XLSX.utils.aoa_to_sheet([
    plantHeaders,
    ...(plantRows.length > 0
      ? plantRows
      : [['No plants recorded', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']]),
  ]);
  wsPlants['!cols'] = [
    { wch: 14 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 30 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPlants, 'Plants Inventory');

  // -------------------------------------------------------------
  // Sheet 3: Historical Observations Log
  // -------------------------------------------------------------
  const obsHeaders = [
    'Observation ID',
    'Plant ID',
    'Observation Date',
    'Recorded Status',
    'Field Condition',
    'Notes / Symptoms / Diagnosis',
  ];

  const allObservations = m.allPlants.flatMap((p) =>
    (p.observations || []).map((o) => [
      o.id || '',
      p.id,
      o.observed_at || '',
      o.status || '',
      o.condition || '',
      o.notes || '',
    ])
  );

  const wsObs = XLSX.utils.aoa_to_sheet([
    obsHeaders,
    ...(allObservations.length > 0
      ? allObservations
      : [['No observations recorded for this farm yet', '', '', '', '', '']]),
  ]);
  wsObs['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsObs, 'Observations Log');

  // -------------------------------------------------------------
  // Sheet 4: Farming Schedule & Tasks
  // -------------------------------------------------------------
  const taskHeaders = ['Task ID', 'Title', 'Due Date', 'Status', 'Category / Source', 'Notes'];
  const taskRows = m.tasks.map((t) => [
    t.id,
    t.title,
    t.due_date || '',
    (t.status || 'open').toUpperCase(),
    t.source || 'General',
    t.notes || '',
  ]);

  const wsTasks = XLSX.utils.aoa_to_sheet([
    taskHeaders,
    ...(taskRows.length > 0 ? taskRows : [['No tasks scheduled', '', '', '', '', '']]),
  ]);
  wsTasks['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Tasks & Schedule');

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename);

  return { filename, count: m.allPlants.length };
}

/**
 * Export selected farm data to formatted publication-grade PDF report
 * Formatted with 5 dedicated sections and 100% reconciled health metrics.
 */
export function exportFarmToPdf(farm: Farm): { filename: string; count: number } {
  if (!farm) throw new Error('No farm selected for PDF export.');

  const dateStr = getExportDateStr();
  const safeName = sanitizeFilename(farm.name);
  const filename = `${safeName}_export_${dateStr}.pdf`;
  const m = computeFarmMetrics(farm);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // -------------------------------------------------------------
  // Top Banner (Forest Green #1b4332)
  // -------------------------------------------------------------
  doc.setFillColor(27, 67, 50);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LOUMI SMART FARM PLANNER', 15, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(134, 239, 172); // Light emerald
  doc.text('Precision Pineapple Cultivation & Health Assessment Report', 15, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 195, 11, { align: 'right' });
  doc.text(`Target Farm: ${farm.name.slice(0, 32)}`, 195, 17, { align: 'right' });
  doc.text('Authorized User Record', 195, 22, { align: 'right' });

  // -------------------------------------------------------------
  // Section 1: Farm Overview & Physical Specifications
  // -------------------------------------------------------------
  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. Farm Overview & Physical Specifications', 15, 34);

  const overviewTableBody = [
    ['Farm ID', farm.id, 'Plot Dimensions (L x B)', `${farm.length.toFixed(1)} m x ${farm.breadth.toFixed(1)} m`],
    ['Farm Name', farm.name, 'Total Gross Area', `${m.grossArea.toFixed(1)} sqm`],
    ['Crop Variety', farm.variety || 'Queen Pineapple', 'Net Spaced Area', `${m.netArea.toFixed(1)} sqm`],
    ['Planting Date', farm.planting_date || 'Not specified', 'Land Utilization', m.landUtilizationPct],
    ['Planting Pattern', farm.staggered ? 'Double-row Staggered' : 'Single-row Regular Grid', 'Row Spacing', `${(farm.row_spacing * 100).toFixed(0)} cm`],
    [
      'Center GPS',
      farm.location?.lat ? `${farm.location.lat.toFixed(4)}N, ${farm.location.lon.toFixed(4)}E` : 'Not calibrated',
      'Plant Spacing (In-row)',
      `${(farm.plant_spacing * 100).toFixed(0)} cm`,
    ],
    ['Boundary Clearance', `${farm.clearance.toFixed(2)} m`, 'Total Active Plant Nodes', `${m.totalActive} nodes`],
  ];

  autoTable(doc, {
    startY: 37,
    margin: { left: 15, right: 15 },
    tableWidth: 180,
    head: [['General Parameter', 'Specification', 'Physical Dimension', 'Value']],
    body: overviewTableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [45, 106, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 45 },
      3: { cellWidth: 45 },
    },
  });

  // -------------------------------------------------------------
  // Section 2: Plant Inventory & Health Status Breakdown
  // -------------------------------------------------------------
  let curY = (doc as any).lastAutoTable.finalY + 8;
  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. Plant Inventory & Health Status Breakdown', 15, curY);

  const healthTableBody: (string | number)[][] = [
    [
      'Healthy Canopy',
      'Normal',
      m.healthyCount.toString(),
      m.healthyPct,
      'Optimal vegetative vigor; maintain routine bi-weekly field scouting.',
    ],
    [
      'Suspected Disease',
      'Early Warning',
      m.suspectedCount.toString(),
      m.suspectedPct,
      'Symptoms detected (chlorosis/ant activity); flag node for immediate inspection.',
    ],
    [
      'Recorded Disease',
      'Confirmed Anomaly',
      m.diseaseCount.toString(),
      m.diseasePct,
      'Confirmed infection (Heart Rot / Wilt); apply targeted organic or copper bio-dip.',
    ],
    [
      'Needs Inspection',
      'Follow-up Required',
      m.inspectCount.toString(),
      m.inspectPct,
      'Plants tagged for agronomic verification by farmer or field scout.',
    ],
    [
      'Not Inspected / Baseline',
      'Unscouted',
      m.notInspectedCount.toString(),
      m.notInspectedPct,
      'Baseline canopy nodes awaiting formal field observation.',
    ],
    [
      'Total Active Population',
      '100% Reconciled',
      m.totalActive.toString(),
      m.totalActive > 0 ? '100.0%' : '0.0%',
      'Complete reconciled inventory of active grid nodes.',
    ],
  ];

  if (m.retiredPlants.length > 0) {
    healthTableBody.push([
      'Historical / Retired Records',
      'Past Geometry',
      m.retiredPlants.length.toString(),
      '-',
      'Preserved observations from prior plot resizing (historical audit trail).',
    ]);
  }

  autoTable(doc, {
    startY: curY + 3,
    margin: { left: 15, right: 15 },
    tableWidth: 180,
    head: [['Health Status Category', 'Indicator', 'Active Count', 'Percentage', 'Agronomic Assessment & Protocol']],
    body: healthTableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [45, 106, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { cellWidth: 28 },
      2: { fontStyle: 'bold', cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { cellWidth: 68 },
    },
  });

  // -------------------------------------------------------------
  // Section 3: Tagged Plant Nodes & Diagnostic Observations
  // -------------------------------------------------------------
  curY = (doc as any).lastAutoTable.finalY + 8;
  if (curY > 240) {
    doc.addPage();
    curY = 20;
  }

  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. Tagged Plant Nodes & Diagnostic Observations', 15, curY);

  const taggedRows = m.taggedPlants.map((p) => {
    const obs = p.observations || [];
    const last = obs.length > 0 ? obs[obs.length - 1] : null;
    const st = (p.status || 'unknown').toUpperCase();
    const noteText = last?.condition
      ? `${last.condition}${last.notes ? ': ' + last.notes : ''}`
      : last?.notes || 'No notes entered';

    return [
      p.id,
      `R${p.row}, P${p.pos}`,
      `X:${p.x.toFixed(2)}, Y:${p.y.toFixed(2)}`,
      st,
      last?.observed_at || 'None',
      noteText,
    ];
  });

  autoTable(doc, {
    startY: curY + 3,
    margin: { left: 15, right: 15, bottom: 18 },
    tableWidth: 180,
    head: [['Plant ID', 'Grid Pos', 'Coordinates', 'Health Status', 'Obs Date', 'Condition / Diagnostic Notes']],
    body:
      taggedRows.length > 0
        ? taggedRows
        : [
            [
              'All Active Nodes',
              '-',
              '-',
              'BASELINE',
              '-',
              'All active plant nodes are currently in baseline uninspected status. No anomalies recorded.',
            ],
          ],
    theme: 'striped',
    headStyles: {
      fillColor: [45, 106, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 26 },
      4: { cellWidth: 22 },
      5: { cellWidth: 68 },
    },
    showHead: 'everyPage',
    pageBreak: 'auto',
  });

  // -------------------------------------------------------------
  // Section 4: Farming Schedule & Field Management Tasks
  // -------------------------------------------------------------
  curY = (doc as any).lastAutoTable.finalY + 8;
  if (curY > 240) {
    doc.addPage();
    curY = 20;
  }

  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. Farming Schedule & Field Management Tasks', 15, curY);

  const taskRows = m.tasks.map((t) => [
    t.title,
    t.due_date || 'Open',
    (t.status || 'open').toUpperCase(),
    t.source || 'General',
    t.notes || 'None',
  ]);

  autoTable(doc, {
    startY: curY + 3,
    margin: { left: 15, right: 15, bottom: 18 },
    tableWidth: 180,
    head: [['Task Title', 'Due Date', 'Status', 'Category / Source', 'Instructions & Field Notes']],
    body:
      taskRows.length > 0
        ? taskRows
        : [['No scheduled tasks', '-', '-', '-', 'No active field tasks recorded for this plot.']],
    theme: 'striped',
    headStyles: {
      fillColor: [45, 106, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: 'bold' },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 30 },
      4: { cellWidth: 60 },
    },
    showHead: 'everyPage',
    pageBreak: 'auto',
  });

  // -------------------------------------------------------------
  // Section 5: Precision Agricultural Advisories & Cultivation Guidelines
  // -------------------------------------------------------------
  curY = (doc as any).lastAutoTable.finalY + 8;
  if (curY > 230) {
    doc.addPage();
    curY = 20;
  }

  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('5. Precision Agricultural Advisories & Cultivation Guidelines', 15, curY);

  const advisoryBody = [
    [
      'Bed & Double-Row Architecture',
      'Maintain standard double-row planting with 60 cm between paired rows, 25-30 cm plant-to-plant spacing within row, and 90 cm inter-bed walk alleys for drainage and aeration.',
    ],
    [
      'Contour Furrows & Monsoon Drainage',
      'Construct 40-50 cm deep contour drainage furrows along the slope gradient. Ensure zero standing water around root zones during heavy monsoon rains to prevent Phytophthora.',
    ],
    [
      'Ant & Mealybug Wilt Management',
      'Maintain weed-free ant-guard buffer strips around bed perimeters. Dip suckers in approved bio-formulations (Trichoderma / Neem oil) and cure in shade for 3 days before planting.',
    ],
    [
      'Nutrition & Split Fertilizer',
      'Apply balanced NPK in 3 splits during active vegetative growth. Avoid excessive nitrogen during early root establishment to prevent vegetative soft rot.',
    ],
  ];

  if (m.diseaseCount > 0 || m.suspectedCount > 0) {
    advisoryBody.unshift([
      'IMMEDIATE ANOMALY PROTOCOL',
      `Attention: ${m.diseaseCount} confirmed and ${m.suspectedCount} suspected anomalies detected. Quarantine affected nodes, apply Trichoderma/copper fungicide drench to root zones, and sanitize weeding tools.`,
    ]);
  }

  autoTable(doc, {
    startY: curY + 3,
    margin: { left: 15, right: 15, bottom: 18 },
    tableWidth: 180,
    head: [['Agronomic Practice (ICAR / NIPHM)', 'Standard Specification & Field Guidance']],
    body: advisoryBody,
    theme: 'striped',
    headStyles: {
      fillColor: [45, 106, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 125 },
    },
    showHead: 'everyPage',
    pageBreak: 'auto',
  });

  // -------------------------------------------------------------
  // Universal Running Header & Footer across all pages
  // -------------------------------------------------------------
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running header on pages 2+
    if (i > 1) {
      doc.setFillColor(27, 67, 50);
      doc.rect(0, 0, 210, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('LOUMI SMART FARM REPORT', 15, 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${farm.name} - Authorized Record`, 195, 5.5, { align: 'right' });
    }

    // Running footer on all pages
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(15, 287, 195, 287);
    doc.text(
      `Loumi Precision Agriculture Platform - Farm: ${farm.name.slice(0, 32)} (Generated: ${dateStr})`,
      15,
      292
    );
    doc.text(`Page ${i} of ${totalPages}`, 195, 292, { align: 'right' });
  }

  doc.save(filename);

  return { filename, count: m.allPlants.length };
}
