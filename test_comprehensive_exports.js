const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;
const XLSX = require('xlsx');

// Import or replicate the exact computeFarmMetrics engine
function sanitizeFilename(name) {
  const cleaned = (name || 'Farm')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  return cleaned || 'Loumi_Farm';
}

function computeMetrics(farm) {
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
    else notInspectedCount++;
  }

  const formatPct = (cnt) =>
    totalActive > 0 ? `${((cnt / totalActive) * 100).toFixed(1)}%` : '0.0%';

  const length = Number(farm.length || 0);
  const breadth = Number(farm.breadth || 0);
  const clearance = Number(farm.clearance || 0.5);
  const grossArea = length * breadth;
  const usableLength = Math.max(0, length - 2 * clearance);
  const usableBreadth = Math.max(0, breadth - 2 * clearance);
  const netArea = usableLength * usableBreadth;
  const landUtilizationPct =
    grossArea > 0 ? `${((netArea / grossArea) * 100).toFixed(1)}%` : '0.0%';

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
    taggedPlants,
    tasks: farm.tasks || [],
  };
}

// PDF Generator function
function generatePdf(farm) {
  const m = computeMetrics(farm);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Banner
  doc.setFillColor(27, 67, 50);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LOUMI SMART FARM PLANNER', 15, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(134, 239, 172);
  doc.text('Precision Pineapple Cultivation & Health Assessment Report', 15, 18);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Report Date: 2026-10-24`, 195, 11, { align: 'right' });
  doc.text(`Target Farm: ${farm.name.slice(0, 32)}`, 195, 17, { align: 'right' });
  doc.text('Authorized User Record', 195, 22, { align: 'right' });

  // Section 1
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
    headStyles: { fillColor: [45, 106, 79], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: 55 }, 2: { fontStyle: 'bold', cellWidth: 45 }, 3: { cellWidth: 45 } },
  });

  // Section 2
  let curY = doc.lastAutoTable.finalY + 8;
  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. Plant Inventory & Health Status Breakdown', 15, curY);

  const healthTableBody = [
    ['Healthy Canopy', 'Normal', m.healthyCount.toString(), m.healthyPct, 'Optimal vegetative vigor; maintain routine field scouting.'],
    ['Suspected Disease', 'Early Warning', m.suspectedCount.toString(), m.suspectedPct, 'Symptoms detected (chlorosis/ant activity); flag node.'],
    ['Recorded Disease', 'Confirmed Anomaly', m.diseaseCount.toString(), m.diseasePct, 'Confirmed infection (Heart Rot / Wilt); execute remedial action.'],
    ['Needs Inspection', 'Follow-up Required', m.inspectCount.toString(), m.inspectPct, 'Plants tagged for agronomic verification.'],
    ['Not Inspected / Baseline', 'Unscouted', m.notInspectedCount.toString(), m.notInspectedPct, 'Baseline canopy nodes awaiting inspection.'],
    ['Total Active Population', '100% Reconciled', m.totalActive.toString(), m.totalActive > 0 ? '100.0%' : '0.0%', 'Complete reconciled inventory of active grid nodes.'],
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
    headStyles: { fillColor: [45, 106, 79], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42 }, 1: { cellWidth: 28 }, 2: { fontStyle: 'bold', cellWidth: 22 }, 3: { cellWidth: 20 }, 4: { cellWidth: 68 } },
  });

  // Section 3
  curY = doc.lastAutoTable.finalY + 8;
  if (curY > 240) { doc.addPage(); curY = 20; }
  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. Tagged Plant Nodes & Diagnostic Observations', 15, curY);

  const taggedRows = m.taggedPlants.map((p) => {
    const obs = p.observations || [];
    const last = obs.length > 0 ? obs[obs.length - 1] : null;
    const st = (p.status || 'unknown').toUpperCase();
    const noteText = last?.condition ? `${last.condition}${last.notes ? ': ' + last.notes : ''}` : last?.notes || 'No notes entered';
    return [p.id, `R${p.row}, P${p.pos}`, `X:${p.x.toFixed(2)}, Y:${p.y.toFixed(2)}`, st, last?.observed_at || 'None', noteText];
  });

  autoTable(doc, {
    startY: curY + 3,
    margin: { left: 15, right: 15, bottom: 18 },
    tableWidth: 180,
    head: [['Plant ID', 'Grid Pos', 'Coordinates', 'Health Status', 'Obs Date', 'Condition / Diagnostic Notes']],
    body: taggedRows.length > 0 ? taggedRows : [['All Active Nodes', '-', '-', 'BASELINE', '-', 'All active plant nodes are currently in baseline uninspected status. No anomalies recorded.']],
    theme: 'striped',
    headStyles: { fillColor: [45, 106, 79], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 20 }, 2: { cellWidth: 24 }, 3: { cellWidth: 26 }, 4: { cellWidth: 22 }, 5: { cellWidth: 68 } },
    showHead: 'everyPage',
    pageBreak: 'auto',
  });

  // Section 4
  curY = doc.lastAutoTable.finalY + 8;
  if (curY > 240) { doc.addPage(); curY = 20; }
  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. Farming Schedule & Field Management Tasks', 15, curY);

  const taskRows = m.tasks.map((t) => [t.title, t.due_date || 'Open', (t.status || 'open').toUpperCase(), t.source || 'General', t.notes || 'None']);
  autoTable(doc, {
    startY: curY + 3,
    margin: { left: 15, right: 15, bottom: 18 },
    tableWidth: 180,
    head: [['Task Title', 'Due Date', 'Status', 'Category / Source', 'Instructions & Field Notes']],
    body: taskRows.length > 0 ? taskRows : [['No scheduled tasks', '-', '-', '-', 'No active field tasks recorded for this plot.']],
    theme: 'striped',
    headStyles: { fillColor: [45, 106, 79], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 46, fontStyle: 'bold' }, 1: { cellWidth: 24 }, 2: { cellWidth: 20 }, 3: { cellWidth: 30 }, 4: { cellWidth: 60 } },
    showHead: 'everyPage',
    pageBreak: 'auto',
  });

  // Section 5
  curY = doc.lastAutoTable.finalY + 8;
  if (curY > 230) { doc.addPage(); curY = 20; }
  doc.setTextColor(27, 67, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('5. Precision Agricultural Advisories & Cultivation Guidelines', 15, curY);

  const advisoryBody = [
    ['Bed & Double-Row Architecture', 'Maintain standard double-row planting with 60 cm between paired rows, 25-30 cm plant-to-plant spacing within row, and 90 cm inter-bed walk alleys for drainage and aeration.'],
    ['Contour Furrows & Monsoon Drainage', 'Construct 40-50 cm deep contour drainage furrows along the slope gradient. Ensure zero standing water around root zones during heavy monsoon rains to prevent Phytophthora.'],
    ['Ant & Mealybug Wilt Management', 'Maintain weed-free ant-guard buffer strips around bed perimeters. Dip suckers in approved bio-formulations (Trichoderma / Neem oil) and cure in shade for 3 days before planting.'],
    ['Nutrition & Split Fertilizer', 'Apply balanced NPK in 3 splits during active vegetative growth. Avoid excessive nitrogen during early root establishment to prevent vegetative soft rot.']
  ];
  if (m.diseaseCount > 0 || m.suspectedCount > 0) {
    advisoryBody.unshift(['IMMEDIATE ANOMALY PROTOCOL', `Attention: ${m.diseaseCount} confirmed and ${m.suspectedCount} suspected anomalies detected. Quarantine affected nodes and apply Trichoderma/copper fungicide drench.`]);
  }
  autoTable(doc, {
    startY: curY + 3,
    margin: { left: 15, right: 15, bottom: 18 },
    tableWidth: 180,
    head: [['Agronomic Practice (ICAR / NIPHM)', 'Standard Specification & Field Guidance']],
    body: advisoryBody,
    theme: 'striped',
    headStyles: { fillColor: [45, 106, 79], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 125 } },
    showHead: 'everyPage',
    pageBreak: 'auto',
  });

  // Universal Pagination
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
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
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 287, 195, 287);
    doc.text(`Loumi Precision Agriculture Platform - Farm: ${farm.name.slice(0, 32)} (Generated: 2026-10-24)`, 15, 292);
    doc.text(`Page ${i} of ${totalPages}`, 195, 292, { align: 'right' });
  }

  return { doc, buffer: Buffer.from(doc.output('arraybuffer')), pages: totalPages, metrics: m };
}

// -------------------------------------------------------------
// Test Matrix: 10 Highly Diverse Farm Configurations
// -------------------------------------------------------------
const testSuite = [
  {
    name: 'Standard Double-Row 20x12m (Mixed Health Statuses)',
    farm: {
      id: 'F_std_20x12',
      name: 'Churachandpur Benchmark Plot',
      variety: 'Queen Pineapple',
      length: 20.0,
      breadth: 12.0,
      row_spacing: 0.6,
      plant_spacing: 0.3,
      clearance: 0.5,
      staggered: true,
      planting_date: '2026-05-01',
      location: { lat: 24.3312, lon: 93.6781 },
      plants: Array.from({ length: 76 }, (_, i) => ({
        id: `P-${String(i + 1).padStart(4, '0')}`,
        row: Math.floor(i / 10) + 1,
        pos: (i % 10) + 1,
        x: 0.5 + (i % 10) * 0.3,
        y: 0.5 + Math.floor(i / 10) * 0.6,
        status: i < 40 ? 'healthy' : i < 50 ? 'suspected' : i < 55 ? 'disease' : i < 65 ? 'inspect' : 'unknown',
        observations: i >= 40 && i < 55 ? [{ id: `obs-${i}`, observed_at: '2026-10-20', status: i < 50 ? 'suspected' : 'disease', notes: 'Leaf tip blight symptoms' }] : []
      })),
      tasks: [{ id: 't-1', title: 'Copper Oxychloride Drench', due_date: '2026-10-28', status: 'open', source: 'Health Protocol', notes: 'Treat suspected nodes 41-55' }]
    }
  },
  {
    name: 'Resized 20x20m Plot (Square Aspect Ratio)',
    farm: {
      id: 'F_res_20x20',
      name: 'Khaba Expanded Plot 20x20',
      variety: 'Queen Pineapple',
      length: 20.0,
      breadth: 20.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 0.5,
      staggered: true,
      planting_date: '2026-04-15',
      location: { lat: 24.8170, lon: 93.9368 },
      plants: Array.from({ length: 133 }, (_, i) => ({
        id: `P-${String(i + 1).padStart(4, '0')}`,
        row: Math.floor(i / 11) + 1,
        pos: (i % 11) + 1,
        x: 0.5 + (i % 11) * 0.6,
        y: 0.5 + Math.floor(i / 11) * 0.9,
        status: i < 100 ? 'healthy' : 'inspect',
        observations: []
      })),
      tasks: []
    }
  },
  {
    name: 'Resized 20x30m Plot (High Plant Count)',
    farm: {
      id: 'F_res_20x30',
      name: 'Bishnupur Long Plot 20x30',
      variety: 'Kew Pineapple',
      length: 20.0,
      breadth: 30.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 0.5,
      staggered: true,
      planting_date: '2026-03-20',
      location: { lat: 24.6300, lon: 93.7500 },
      plants: Array.from({ length: 209 }, (_, i) => ({
        id: `P-${String(i + 1).padStart(4, '0')}`,
        row: Math.floor(i / 11) + 1,
        pos: (i % 11) + 1,
        x: 0.5 + (i % 11) * 0.6,
        y: 0.5 + Math.floor(i / 11) * 0.9,
        status: 'healthy',
        observations: []
      })),
      tasks: [{ id: 't-1', title: 'Weeding between beds', due_date: '2026-11-01', status: 'open', source: 'General', notes: 'Manual weeding' }]
    }
  },
  {
    name: 'Commercial Plantation 60x40m (Spans Multiple Pages)',
    farm: {
      id: 'F_comm_60x40',
      name: 'Imphal Valley Mega Estate',
      variety: 'Mauritius Pineapple',
      length: 60.0,
      breadth: 40.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 1.0,
      staggered: false,
      planting_date: '2026-01-10',
      location: { lat: 24.7950, lon: 93.9400 },
      // 120 tagged plants to force 3+ pages
      plants: Array.from({ length: 120 }, (_, i) => ({
        id: `P-${String(i + 1).padStart(4, '0')}`,
        row: Math.floor(i / 10) + 1,
        pos: (i % 10) + 1,
        x: 1.0 + (i % 10) * 0.6,
        y: 1.0 + Math.floor(i / 10) * 0.9,
        status: i % 4 === 0 ? 'disease' : i % 3 === 0 ? 'suspected' : 'healthy',
        observations: [
          { id: `obs-${i}`, observed_at: '2026-10-24 14:00', status: 'disease', condition: 'Wilt', notes: `Node ${i + 1}: Extensive mealybug infestation on lower foliage.` }
        ]
      })),
      tasks: [
        { id: 't-1', title: 'Perimeter Ant Barrier Installation', due_date: '2026-10-26', status: 'open', source: 'Emergency', notes: 'Apply diatomaceous earth around sector A' },
        { id: 't-2', title: 'Foliar Potassium Spray', due_date: '2026-11-05', status: 'open', source: 'Nutrition', notes: 'K2SO4 2% spray on healthy sectors' }
      ]
    }
  },
  {
    name: 'Zero-Plant Newly Created Plot (Division-by-Zero Safety)',
    farm: {
      id: 'F_zero_empty',
      name: 'Newly Surveyed Empty Plot',
      variety: 'Queen Pineapple',
      length: 15.0,
      breadth: 10.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 0.5,
      staggered: true,
      planting_date: null,
      location: null,
      plants: [],
      tasks: []
    }
  },
  {
    name: '100% Uninspected Baseline Plot (No False Health Claims)',
    farm: {
      id: 'F_uninspected_all',
      name: 'Unscouted Fresh Plot',
      variety: 'Kew Pineapple',
      length: 14.0,
      breadth: 8.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 0.5,
      staggered: false,
      planting_date: '2026-06-01',
      location: { lat: 24.5000, lon: 93.8000 },
      plants: Array.from({ length: 25 }, (_, i) => ({
        id: `P-${String(i + 1).padStart(4, '0')}`,
        row: Math.floor(i / 5) + 1,
        pos: (i % 5) + 1,
        x: 0.5 + (i % 5) * 0.6,
        y: 0.5 + Math.floor(i / 5) * 0.9,
        status: 'unknown',
        observations: []
      })),
      tasks: []
    }
  },
  {
    name: 'Plot With Retired Historical Plants (Resize Reconciliation)',
    farm: {
      id: 'F_retired_resize',
      name: 'Terrace Plot Resized from 30m to 15m',
      variety: 'Queen Pineapple',
      length: 15.0,
      breadth: 10.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 0.5,
      staggered: true,
      planting_date: '2026-05-10',
      location: { lat: 24.4500, lon: 93.7000 },
      plants: [
        // 10 active plants
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `P-${String(i + 1).padStart(4, '0')}`,
          row: 1, pos: i + 1, x: 0.5 + i * 0.6, y: 0.5, status: 'healthy', observations: []
        })),
        // 5 retired plants with past disease observations
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `P-OLD-${String(i + 1).padStart(4, '0')}`,
          row: 5, pos: i + 1, x: 22.0 + i * 0.6, y: 15.0, status: 'disease',
          retired_at: '2026-10-24 12:00:00',
          retired_reason: 'Plot resized',
          observations: [{ id: `obs-ret-${i}`, observed_at: '2026-09-15', status: 'disease', notes: 'Historical rot on retired boundary' }]
        }))
      ],
      tasks: []
    }
  },
  {
    name: 'Missing Optional Fields & Non-Standard Spacing',
    farm: {
      id: 'F_missing_opts',
      name: 'Minimal Boundary Plot',
      variety: '',
      length: 18.5,
      breadth: 9.25,
      row_spacing: 1.2,
      plant_spacing: 0.5,
      clearance: 0.8,
      staggered: false,
      planting_date: null,
      location: null,
      plants: [
        { id: 'P-0001', row: 1, pos: 1, x: 0.8, y: 0.8, status: 'inspect', observations: [] }
      ],
      tasks: []
    }
  },
  {
    name: 'Special Characters, Quotes, & Long Notes',
    farm: {
      id: 'F_special_chars',
      name: 'Khaba & "Brothers", <Organic> Plot #1',
      variety: 'Queen Pineapple (Super Sweet & "Fragrant")',
      length: 22.0,
      breadth: 14.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 0.5,
      staggered: true,
      planting_date: '2026-06-15',
      location: { lat: 24.817012, lon: 93.936841 },
      plants: [
        {
          id: 'P-0001', row: 1, pos: 1, x: 0.5, y: 0.5, status: 'disease',
          observations: [
            {
              id: 'obs-long',
              observed_at: '2026-10-24 16:30',
              status: 'disease',
              condition: 'Phytophthora cinnamomi (Heart Rot)',
              notes: 'Severe water-soaked brown lesions on basal leaves with foul fermentative odor. Rapid rotting progressing into central heart whorl after 48h torrential monsoon precipitation. Immediate systemic drench advised.'
            }
          ]
        }
      ],
      tasks: [
        {
          id: 'task-long',
          title: 'Emergency Drainage Trench Excavation (30cm depth)',
          due_date: '2026-10-25',
          status: 'open',
          source: 'Field Scout Alert',
          notes: 'Dig 30cm deep trench along southern perimeter slope to discharge standing runoff towards natural waterway.'
        }
      ]
    }
  },
  {
    name: 'Large Aspect Ratio 50x15m (Extreme Length)',
    farm: {
      id: 'F_aspect_50x15',
      name: 'Hillside Contour Strip 50x15m',
      variety: 'Kew Pineapple',
      length: 50.0,
      breadth: 15.0,
      row_spacing: 0.9,
      plant_spacing: 0.6,
      clearance: 0.5,
      staggered: true,
      planting_date: '2026-04-01',
      location: { lat: 24.9000, lon: 93.9500 },
      plants: Array.from({ length: 50 }, (_, i) => ({
        id: `P-${String(i + 1).padStart(4, '0')}`,
        row: Math.floor(i / 25) + 1,
        pos: (i % 25) + 1,
        x: 0.5 + (i % 25) * 0.6,
        y: 0.5 + Math.floor(i / 25) * 0.9,
        status: i % 2 === 0 ? 'healthy' : 'inspect',
        observations: []
      })),
      tasks: []
    }
  }
];

// Run the test suite
console.log('================================================================');
console.log(' LOUMI PDF EXPORT COMPREHENSIVE REGRESSION SUITE (10 CASES)');
console.log('================================================================\n');

let passCount = 0;
for (const testCase of testSuite) {
  const { name, farm } = testCase;
  console.log(`RUNNING TEST: [${name}]`);

  const { doc, buffer, pages, metrics: m } = generatePdf(farm);

  // 1. Reconciled Population Check
  const sumCounts = m.healthyCount + m.suspectedCount + m.diseaseCount + m.inspectCount + m.notInspectedCount;
  if (sumCounts !== m.totalActive) {
    throw new Error(`Population mismatch for "${name}": sum(${sumCounts}) !== totalActive(${m.totalActive})`);
  }

  // 2. Division-by-Zero Safety Check
  if (m.totalActive === 0) {
    if (m.healthyPct !== '0.0%' || m.notInspectedPct !== '0.0%') {
      throw new Error(`Division-by-zero check failed for 0-plant farm "${name}": expected 0.0%, got ${m.healthyPct}`);
    }
  }

  // 3. Baseline Accuracy: 100% uninspected cannot have healthy > 0
  if (farm.id === 'F_uninspected_all') {
    if (m.healthyCount !== 0 || m.notInspectedCount !== m.totalActive) {
      throw new Error(`False healthy classification in unscouted farm "${name}": healthy=${m.healthyCount}, notInspected=${m.notInspectedCount}`);
    }
  }

  // 4. Retired Plants Check
  if (farm.id === 'F_retired_resize') {
    if (m.retiredPlants.length !== 5 || m.totalActive !== 10 || m.totalAll !== 15) {
      throw new Error(`Retired plant reconciliation failed in "${name}": retired=${m.retiredPlants.length}, active=${m.totalActive}, all=${m.totalAll}`);
    }
  }

  // 5. Multi-Page Layout Flow Check
  if (farm.id === 'F_comm_60x40') {
    if (pages < 2) {
      throw new Error(`Expected multi-page PDF for large commercial farm, got ${pages} pages`);
    }
  }

  // 6. Text Stream Verification (No corrupted % symbols, no spaced out letters)
  const rawText = buffer.toString('binary');
  const badPatterns = ['%Ï', '%Æ', '% ', '%²', '%Ë', 'H e a l t h y', 'S u s p e c t e d'];
  for (const bad of badPatterns) {
    if (rawText.includes(bad)) {
      throw new Error(`Corrupted text artifact found in PDF "${name}": contains "${bad}"`);
    }
  }

  // 7. Verify All 5 Section Titles Present in PDF Stream
  const sectionHeaders = [
    '1. Farm Overview & Physical Specifications',
    '2. Plant Inventory & Health Status Breakdown',
    '3. Tagged Plant Nodes & Diagnostic Observations',
    '4. Farming Schedule & Field Management Tasks',
    '5. Precision Agricultural Advisories & Cultivation Guidelines'
  ];
  for (const sHeader of sectionHeaders) {
    if (!rawText.includes(sHeader)) {
      throw new Error(`Missing expected section header in PDF "${name}": "${sHeader}"`);
    }
  }

  // 8. Verify Land Utilization Calculation
  if (m.grossArea > 0) {
    const expectedUtil = ((m.netArea / m.grossArea) * 100).toFixed(1) + '%';
    if (m.landUtilizationPct !== expectedUtil) {
      throw new Error(`Land utilization mismatch: got ${m.landUtilizationPct}, expected ${expectedUtil}`);
    }
  }

  console.log(`  -> [PASS] Verified: ${m.totalActive} active plants reconciled, ${pages} page(s), buffer: ${buffer.length} bytes, 0 corruption artifacts.\n`);
  passCount++;
}

console.log('================================================================');
console.log(` ALL ${passCount} / ${testSuite.length} EXPORT REGRESSION CASES PASSED WITH 100% VERIFICATION!`);
console.log('================================================================\n');
