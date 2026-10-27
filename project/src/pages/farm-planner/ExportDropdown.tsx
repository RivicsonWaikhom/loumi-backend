import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { Farm } from './types';
import {
  exportFarmToCsv,
  exportFarmToExcel,
  exportFarmToPdf,
} from '@/services/farmExportService';
import { fetchBackendFarm } from '@/services/farmPlannerService';

interface ExportDropdownProps {
  farm: Farm | null;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
  className?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  farm,
  onSuccess,
  onError,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsOpen(false);

    if (!farm) {
      onError?.('Please select a farm before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      // Fetch authoritative persisted farm data from backend to prevent stale client state
      let authoritativeFarm = farm;
      try {
        const fresh = await fetchBackendFarm(farm.id);
        if (fresh && fresh.id === farm.id) {
          authoritativeFarm = fresh;
        }
      } catch (fetchErr) {
        console.warn('Backend fetch for farm export failed, using client state:', fetchErr);
      }

      // Small timeout to allow UI to respond before synchronous file generation
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (format === 'csv') {
        const { filename } = exportFarmToCsv(authoritativeFarm);
        onSuccess?.(`Exported CSV: ${filename}`);
      } else if (format === 'excel') {
        const { filename } = exportFarmToExcel(authoritativeFarm);
        onSuccess?.(`Exported Excel: ${filename}`);
      } else if (format === 'pdf') {
        const { filename } = exportFarmToPdf(authoritativeFarm);
        onSuccess?.(`Exported PDF: ${filename}`);
      }
    } catch (err: any) {
      console.error(`Export ${format} error:`, err);
      onError?.(err?.message || `Failed to generate ${format.toUpperCase()} export.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="export-dropdown-btn"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => {
          if (!farm) {
            onError?.('Please select a farm before exporting.');
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        disabled={isExporting}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2d6a4f] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#1b4332] focus:outline-hidden focus:ring-2 focus:ring-forest-500 disabled:opacity-60 cursor-pointer"
      >
        {isExporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
        ) : (
          <FileDown className="h-3.5 w-3.5 text-white" />
        )}
        <span>Export As</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-emerald-100 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="export-dropdown-btn"
          className="absolute right-0 z-50 mt-1.5 w-52 origin-top-right rounded-xl border border-forest-100 bg-white py-1.5 shadow-lg ring-1 ring-black/5 animate-fade-in focus:outline-hidden"
        >
          <div className="border-b border-forest-100/60 px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-forest-500">
              Export Farm Records
            </p>
            <p className="truncate text-xs font-semibold text-forest-900">
              {farm ? farm.name : 'No Farm Selected'}
            </p>
          </div>

          <div className="py-1">
            {/* 1. CSV Option */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleExport('csv')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-forest-50 focus:bg-forest-50 focus:outline-hidden"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-forest-900">CSV (.csv)</p>
                <p className="text-[10px] text-forest-500">Comma-separated values</p>
              </div>
            </button>

            {/* 2. Excel Option */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleExport('excel')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-forest-50 focus:bg-forest-50 focus:outline-hidden"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-forest-900">Excel (.xlsx)</p>
                <p className="text-[10px] text-forest-500">Multi-sheet workbook</p>
              </div>
            </button>

            {/* 3. PDF Option */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleExport('pdf')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-forest-50 focus:bg-forest-50 focus:outline-hidden"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                <FileDown className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-forest-900">PDF (.pdf)</p>
                <p className="text-[10px] text-forest-500">Formatted printable report</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
