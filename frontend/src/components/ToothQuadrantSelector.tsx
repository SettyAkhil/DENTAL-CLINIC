import React, { useMemo, useState, useEffect } from 'react';
import { X, RotateCcw, AlertTriangle, Sparkles, Check } from 'lucide-react';
import { DentitionType, QuadrantType, SelectedTooth } from '../types';

export type { QuadrantType, DentitionType, SelectedTooth };

// Calculate accurate age from patient DOB string or age number
export const getPatientAge = (
  age?: number | null,
  dob?: string | null
): number | null => {
  if (dob) {
    const birthDate = new Date(dob);
    if (!isNaN(birthDate.getTime())) {
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge >= 0) return calculatedAge;
    }
  }
  if (typeof age === 'number' && !isNaN(age) && age >= 0) {
    return age;
  }
  return null;
};

export interface ChartSuggestion {
  chartType: DentitionType;
  isTransitionAge: boolean; // Age 6–12 (mixed dentition)
  age: number | null;
  label: string;
}

// Automatic age-based chart suggestion rules
export const getSuggestedChartType = (age: number | null): ChartSuggestion => {
  if (age === null || age === undefined) {
    return {
      chartType: 'permanent',
      isTransitionAge: false,
      age: null,
      label: 'Permanent Dentition (Default)',
    };
  }

  if (age <= 5) {
    return {
      chartType: 'primary',
      isTransitionAge: false,
      age,
      label: `Age ${age} yrs (0–5): Primary Teeth (20 Milk Teeth)`,
    };
  }

  if (age <= 12) {
    return {
      chartType: 'primary',
      isTransitionAge: true,
      age,
      label: `Age ${age} yrs (6–12): Primary Teeth (Mixed Dentition)`,
    };
  }

  return {
    chartType: 'permanent',
    isTransitionAge: false,
    age,
    label: `Age ${age} yrs (13+): Permanent Teeth (32 Teeth)`,
  };
};

// FDI calculation for Permanent Dentition (11-48)
export const getPermanentFdi = (quadrant: QuadrantType, position: number): number => {
  switch (quadrant) {
    case 'UR': return 10 + position; // 11 to 18
    case 'UL': return 20 + position; // 21 to 28
    case 'LL': return 30 + position; // 31 to 38
    case 'LR': return 40 + position; // 41 to 48
  }
};

// FDI calculation for Primary Dentition (51-85)
export const getPrimaryFdi = (quadrant: QuadrantType, position: number): number => {
  switch (quadrant) {
    case 'UR': return 50 + position; // 51 to 55
    case 'UL': return 60 + position; // 61 to 65
    case 'LL': return 70 + position; // 71 to 75
    case 'LR': return 80 + position; // 81 to 85
  }
};

// General getFdiNumber supporting both chart types
export const getFdiNumber = (
  quadrant: QuadrantType,
  position: number,
  chartType: DentitionType = 'permanent'
): number => {
  return chartType === 'primary'
    ? getPrimaryFdi(quadrant, position)
    : getPermanentFdi(quadrant, position);
};

// Anatomical names for Permanent teeth (positions 1-8)
export const PERMANENT_TOOTH_NAMES: Record<number, string> = {
  1: 'Central Incisor',
  2: 'Lateral Incisor',
  3: 'Canine',
  4: '1st Premolar',
  5: '2nd Premolar',
  6: '1st Molar',
  7: '2nd Molar',
  8: '3rd Molar (Wisdom)',
};

// Anatomical names for Primary teeth (positions 1-5, or A-E)
export const PRIMARY_TOOTH_NAMES: Record<number, string> = {
  1: 'Primary Central Incisor (A)',
  2: 'Primary Lateral Incisor (B)',
  3: 'Primary Canine (C)',
  4: '1st Primary Molar (D)',
  5: '2nd Primary Molar (E)',
};

export const QUADRANT_LABELS: Record<QuadrantType, string> = {
  UR: 'Upper Right (UR)',
  UL: 'Upper Left (UL)',
  LR: 'Lower Right (LR)',
  LL: 'Lower Left (LL)',
};

// Anatomical ordering for Permanent (8 teeth per quadrant)
export const PERMANENT_TEETH_ORDER: Record<QuadrantType, number[]> = {
  UR: [8, 7, 6, 5, 4, 3, 2, 1],
  UL: [1, 2, 3, 4, 5, 6, 7, 8],
  LR: [8, 7, 6, 5, 4, 3, 2, 1],
  LL: [1, 2, 3, 4, 5, 6, 7, 8],
};

// Anatomical ordering for Primary (5 teeth per quadrant)
export const PRIMARY_TEETH_ORDER: Record<QuadrantType, number[]> = {
  UR: [5, 4, 3, 2, 1],
  UL: [1, 2, 3, 4, 5],
  LR: [5, 4, 3, 2, 1],
  LL: [1, 2, 3, 4, 5],
};

// Parse existing string or array into normalized SelectedTooth objects
export const parseToothValue = (input?: SelectedTooth[] | string | null): SelectedTooth[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input;

  const results: SelectedTooth[] = [];
  const seenFdi = new Set<number>();
  const tokens = input.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);

  for (const token of tokens) {
    const clean = token.replace(/[^0-9a-zA-Z]/g, '');

    // Check numeric FDI
    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      // Permanent: 11-18, 21-28, 31-38, 41-48
      if (num >= 11 && num <= 18) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'UR', position: num - 10, fdi: num, dentition: 'permanent' });
        }
        continue;
      }
      if (num >= 21 && num <= 28) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'UL', position: num - 20, fdi: num, dentition: 'permanent' });
        }
        continue;
      }
      if (num >= 31 && num <= 38) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'LL', position: num - 30, fdi: num, dentition: 'permanent' });
        }
        continue;
      }
      if (num >= 41 && num <= 48) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'LR', position: num - 40, fdi: num, dentition: 'permanent' });
        }
        continue;
      }

      // Primary: 51-55, 61-65, 71-75, 81-85
      if (num >= 51 && num <= 55) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'UR', position: num - 50, fdi: num, dentition: 'primary' });
        }
        continue;
      }
      if (num >= 61 && num <= 65) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'UL', position: num - 60, fdi: num, dentition: 'primary' });
        }
        continue;
      }
      if (num >= 71 && num <= 75) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'LL', position: num - 70, fdi: num, dentition: 'primary' });
        }
        continue;
      }
      if (num >= 81 && num <= 85) {
        if (!seenFdi.has(num)) {
          seenFdi.add(num);
          results.push({ quadrant: 'LR', position: num - 80, fdi: num, dentition: 'primary' });
        }
        continue;
      }
    }

    // Check notation like UR8, LL6
    const match = clean.match(/^(UR|UL|LL|LR)([1-8])$/i);
    if (match) {
      const quad = match[1].toUpperCase() as QuadrantType;
      const pos = parseInt(match[2], 10);
      const fdi = getPermanentFdi(quad, pos);
      if (!seenFdi.has(fdi)) {
        seenFdi.add(fdi);
        results.push({ quadrant: quad, position: pos, fdi, dentition: 'permanent' });
      }
    }
  }

  return results.sort((a, b) => a.fdi - b.fdi);
};

export const formatFdiString = (teeth: SelectedTooth[]): string => {
  return teeth
    .slice()
    .sort((a, b) => a.fdi - b.fdi)
    .map((t) => t.fdi.toString())
    .join(', ');
};

interface ToothQuadrantSelectorProps {
  value?: SelectedTooth[] | string | null;
  patientAge?: number | null;
  patientDob?: string | null;
  initialChartType?: DentitionType | null;
  onChange: (selectedTeeth: SelectedTooth[], fdiString: string, chartType: DentitionType) => void;
  disabled?: boolean;
}

export const ToothQuadrantSelector: React.FC<ToothQuadrantSelectorProps> = ({
  value,
  patientAge,
  patientDob,
  initialChartType = null,
  onChange,
  disabled = false,
}) => {
  const selectedTeeth = useMemo(() => parseToothValue(value), [value]);

  const selectedFdiSet = useMemo(() => {
    return new Set<number>(selectedTeeth.map((t) => t.fdi));
  }, [selectedTeeth]);

  // Compute resolved patient age
  const effectiveAge = useMemo(() => getPatientAge(patientAge, patientDob), [patientAge, patientDob]);
  const suggestion = useMemo(() => getSuggestedChartType(effectiveAge), [effectiveAge]);

  // Detect if existing teeth already belong to primary dentition
  const detectedFromTeeth = useMemo<DentitionType | null>(() => {
    if (selectedTeeth.some((t) => t.fdi >= 51 && t.fdi <= 85)) return 'primary';
    if (selectedTeeth.some((t) => t.fdi >= 11 && t.fdi <= 48)) return 'permanent';
    return null;
  }, [selectedTeeth]);

  // Internal chart type state
  const [chartType, setChartType] = useState<DentitionType>(() => {
    if (initialChartType) return initialChartType;
    if (detectedFromTeeth) return detectedFromTeeth;
    return suggestion.chartType;
  });

  // Track if dentist manually changed the chart during this session
  const [isManuallyOverridden, setIsManuallyOverridden] = useState<boolean>(false);

  // Auto-update suggested chart if age changes AND dentist has not manually overridden
  useEffect(() => {
    if (!isManuallyOverridden && !initialChartType) {
      if (detectedFromTeeth) {
        setChartType(detectedFromTeeth);
      } else {
        setChartType(suggestion.chartType);
      }
    }
  }, [suggestion.chartType, isManuallyOverridden, initialChartType, detectedFromTeeth]);

  // Manual chart override handler
  const handleSwitchChart = (newType: DentitionType) => {
    if (disabled || newType === chartType) return;
    setIsManuallyOverridden(true);
    setChartType(newType);
    onChange(selectedTeeth, formatFdiString(selectedTeeth), newType);
  };

  const handleToggleTooth = (quadrant: QuadrantType, position: number) => {
    if (disabled) return;
    const fdi = getFdiNumber(quadrant, position, chartType);
    const exists = selectedFdiSet.has(fdi);

    let updated: SelectedTooth[];
    if (exists) {
      updated = selectedTeeth.filter((t) => t.fdi !== fdi);
    } else {
      updated = [
        ...selectedTeeth,
        { quadrant, position, fdi, dentition: chartType },
      ];
    }
    updated.sort((a, b) => a.fdi - b.fdi);
    onChange(updated, formatFdiString(updated), chartType);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onChange([], '', chartType);
  };

  const handleRemoveTooth = (fdiToRemove: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const updated = selectedTeeth.filter((t) => t.fdi !== fdiToRemove);
    onChange(updated, formatFdiString(updated), chartType);
  };

  // Render quadrant buttons row
  const renderQuadrantRow = (quadrant: QuadrantType) => {
    const teethOrder =
      chartType === 'primary'
        ? PRIMARY_TEETH_ORDER[quadrant]
        : PERMANENT_TEETH_ORDER[quadrant];

    return (
      <div className="flex items-center gap-1">
        {teethOrder.map((pos) => {
          const fdi = getFdiNumber(quadrant, pos, chartType);
          const isSelected = selectedFdiSet.has(fdi);
          const toothName =
            chartType === 'primary'
              ? PRIMARY_TOOTH_NAMES[pos]
              : PERMANENT_TOOTH_NAMES[pos];
          const dentitionLabel = chartType === 'primary' ? 'Primary' : 'Permanent';
          const tooltip = `${QUADRANT_LABELS[quadrant]} ${dentitionLabel} - Tooth #${pos}: ${toothName} (FDI: ${fdi})`;

          return (
            <button
              type="button"
              key={fdi}
              disabled={disabled}
              onClick={() => handleToggleTooth(quadrant, pos)}
              title={tooltip}
              aria-label={tooltip}
              className={`w-7 sm:w-8 h-9 rounded-lg flex flex-col items-center justify-center transition cursor-pointer select-none border text-center ${
                isSelected
                  ? chartType === 'primary'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-black ring-1 ring-amber-500 scale-[1.02]'
                    : 'bg-blue-600 text-white border-blue-600 shadow-xs font-black ring-1 ring-blue-500 scale-[1.02]'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-blue-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-[11px] font-black leading-tight">{pos}</span>
              <span
                className={`text-[8.5px] leading-none ${
                  isSelected ? 'text-white/90 font-bold' : 'text-slate-400 font-medium'
                }`}
              >
                {fdi}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const isPrimary = chartType === 'primary';

  return (
    <div className="space-y-2.5">
      {/* Top Header & Chart Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Affected Area / Dental Chart
            </label>

            {/* Selected chart badge */}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isPrimary
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-blue-100 text-blue-800 border-blue-300'
              }`}
            >
              {isPrimary ? 'Primary Teeth (20 Milk Teeth)' : 'Permanent Teeth (32 Adult Teeth)'}
            </span>

            {/* Source indication */}
            {isManuallyOverridden ? (
              <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                Dentist Override
              </span>
            ) : effectiveAge !== null ? (
              <span className="text-[9.5px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                <span>Auto-suggested (Age {effectiveAge})</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Manual Override Switcher & Clear */}
        <div className="flex items-center gap-2">
          {/* Segmented Switch for Dentist Manual Override */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center text-xs">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleSwitchChart('permanent')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                !isPrimary
                  ? 'bg-white text-blue-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Permanent Dentition (32 adult teeth: 11-48)"
            >
              {!isPrimary && <Check className="w-3 h-3 text-blue-600" />}
              <span>Permanent (32)</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleSwitchChart('primary')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                isPrimary
                  ? 'bg-white text-amber-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Primary Dentition (20 deciduous/milk teeth: 51-85)"
            >
              {isPrimary && <Check className="w-3 h-3 text-amber-600" />}
              <span>Primary (20)</span>
            </button>
          </div>

          {selectedTeeth.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={disabled}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-1.5 py-1 rounded hover:bg-rose-50 transition cursor-pointer"
              title="Clear all selected teeth"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Transition-Age Mixed Dentition Notice for Age 6–12 */}
      {suggestion.isTransitionAge && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Transition-Age Notice (Age {effectiveAge}):</strong> Patient is in the mixed dentition age range (6–12 years) and may present with both primary and permanent teeth. Primary chart is initially suggested; switch chart mode above as needed.
          </span>
        </div>
      )}

      {/* Four-Quadrant Dental Odontogram Card */}
      <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3 space-y-2 overflow-x-auto">
        {/* Top Header Labels: Maxillary (Upper) */}
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
          <div className="flex items-center gap-1">
            <span>Upper Right (UR)</span>
            <span className="text-[9px] font-semibold text-slate-400">
              {isPrimary ? '55–51' : '18–11'}
            </span>
          </div>
          <span
            className={`font-black text-[9px] px-2 py-0.5 rounded-full border ${
              isPrimary
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-100'
            }`}
          >
            MAXILLARY (UPPER ARCH)
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold text-slate-400">
              {isPrimary ? '61–65' : '21–28'}
            </span>
            <span>Upper Left (UL)</span>
          </div>
        </div>

        {/* Upper Arch (UR on left, UL on right, midline in center) */}
        <div className="flex items-center justify-between gap-2 min-w-[420px]">
          {/* UR */}
          <div className="flex-1 flex justify-end">{renderQuadrantRow('UR')}</div>

          {/* Vertical Midline */}
          <div className="w-px h-10 bg-slate-300 relative flex items-center justify-center">
            <span className="absolute text-[8px] font-bold text-slate-400 bg-slate-100 px-0.5 rounded">
              |
            </span>
          </div>

          {/* UL */}
          <div className="flex-1 flex justify-start">{renderQuadrantRow('UL')}</div>
        </div>

        {/* Horizontal Occlusal Plane Divider with Midline label */}
        <div className="relative flex items-center justify-center my-1">
          <div className="w-full border-t border-slate-200" />
          <span className="absolute bg-slate-100 text-[8px] font-black uppercase text-slate-400 px-2 py-0.5 rounded-full border border-slate-200/80">
            Midline / Occlusal Axis
          </span>
        </div>

        {/* Lower Arch (LR on left, LL on right, midline in center) */}
        <div className="flex items-center justify-between gap-2 min-w-[420px]">
          {/* LR */}
          <div className="flex-1 flex justify-end">{renderQuadrantRow('LR')}</div>

          {/* Vertical Midline */}
          <div className="w-px h-10 bg-slate-300 relative flex items-center justify-center">
            <span className="absolute text-[8px] font-bold text-slate-400 bg-slate-100 px-0.5 rounded">
              |
            </span>
          </div>

          {/* LL */}
          <div className="flex-1 flex justify-start">{renderQuadrantRow('LL')}</div>
        </div>

        {/* Bottom Header Labels: Mandibular (Lower) */}
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
          <div className="flex items-center gap-1">
            <span>Lower Right (LR)</span>
            <span className="text-[9px] font-semibold text-slate-400">
              {isPrimary ? '85–81' : '48–41'}
            </span>
          </div>
          <span
            className={`font-black text-[9px] px-2 py-0.5 rounded-full border ${
              isPrimary
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
            }`}
          >
            MANDIBULAR (LOWER ARCH)
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold text-slate-400">
              {isPrimary ? '71–75' : '31–38'}
            </span>
            <span>Lower Left (LL)</span>
          </div>
        </div>
      </div>

      {/* Selected Teeth Badges & Feedback */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[26px]">
        {selectedTeeth.length === 0 ? (
          <span className="text-[11px] text-slate-400 italic">
            No teeth selected (click tooth positions on chart above to mark affected teeth, or leave unselected if generalized)
          </span>
        ) : (
          <>
            <span className="text-[11px] font-bold text-slate-700 mr-1">
              Selected ({selectedTeeth.length}):
            </span>
            {selectedTeeth.map((t) => {
              const isPriTooth = t.fdi >= 51 && t.fdi <= 85;
              return (
                <span
                  key={t.fdi}
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                    isPriTooth
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  <span>{t.quadrant} {t.position}</span>
                  <span className={`text-[9.5px] font-semibold ${isPriTooth ? 'text-amber-600' : 'text-blue-500'}`}>
                    #{t.fdi} {isPriTooth ? '(Primary)' : ''}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveTooth(t.fdi, e)}
                      className="hover:text-rose-600 ml-0.5 transition cursor-pointer"
                      title={`Deselect tooth ${t.quadrant} ${t.position} (FDI: ${t.fdi})`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
