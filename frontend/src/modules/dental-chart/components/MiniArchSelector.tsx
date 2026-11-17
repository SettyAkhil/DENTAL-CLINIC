import React from 'react';
import { ADULT_TEETH } from '../types/dentalChart.types';

interface MiniArchSelectorProps {
  selectedFDI: number;
  onSelectTooth: (fdi: number) => void;
  toothConditionColors?: Map<number, string>;
}

export const MiniArchSelector: React.FC<MiniArchSelectorProps> = ({
  selectedFDI,
  onSelectTooth,
  toothConditionColors,
}) => {
  // Upper Teeth ordered 1 to 16 (FDI: 18 -> 11, then 21 -> 28)
  const upperTeeth = ADULT_TEETH.filter((t) => t.arch === 'UPPER');
  // Lower Teeth ordered 17 to 32 (FDI: 38 -> 31, then 41 -> 48 reversed for visual arch continuity)
  const lowerTeeth = ADULT_TEETH.filter((t) => t.arch === 'LOWER');

  return (
    <div className="absolute bottom-5 left-5 z-20 bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-2xl p-3 shadow-2xl select-none w-[130px] flex flex-col items-center gap-2">
      {/* Upper Arch */}
      <div className="w-full flex flex-col items-center">
        <svg viewBox="0 0 100 50" className="w-full h-11 overflow-visible">
          {upperTeeth.map((tooth, idx) => {
            const angle = Math.PI - (idx / (upperTeeth.length - 1)) * Math.PI;
            const rx = 40;
            const ry = 34;
            const cx = 50 + rx * Math.cos(angle);
            const cy = 42 - ry * Math.sin(angle);

            const isSelected = tooth.fdi === selectedFDI;
            const conditionColor = toothConditionColors?.get(tooth.fdi);

            return (
              <g
                key={tooth.fdi}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTooth(tooth.fdi);
                }}
              >
                {/* Glow ring if selected */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5.5"
                    fill="none"
                    stroke="#00e5ff"
                    strokeWidth="1.8"
                    className="animate-pulse"
                  />
                )}
                {/* Tooth node */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="3.6"
                  fill={
                    isSelected
                      ? '#00e5ff'
                      : conditionColor || '#f8fafc'
                  }
                  stroke={isSelected ? '#ffffff' : '#475569'}
                  strokeWidth="0.8"
                  className="transition-transform group-hover:scale-125"
                />
              </g>
            );
          })}
        </svg>
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
          Upper (1 – 16)
        </span>
      </div>

      {/* Lower Arch */}
      <div className="w-full flex flex-col items-center pt-1 border-t border-slate-800/80">
        <svg viewBox="0 0 100 50" className="w-full h-11 overflow-visible">
          {lowerTeeth.map((tooth, idx) => {
            const angle = (idx / (lowerTeeth.length - 1)) * Math.PI;
            const rx = 38;
            const ry = 32;
            const cx = 50 + rx * Math.cos(angle);
            const cy = 10 + ry * Math.sin(angle);

            const isSelected = tooth.fdi === selectedFDI;
            const conditionColor = toothConditionColors?.get(tooth.fdi);

            return (
              <g
                key={tooth.fdi}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTooth(tooth.fdi);
                }}
              >
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5.5"
                    fill="none"
                    stroke="#00e5ff"
                    strokeWidth="1.8"
                    className="animate-pulse"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r="3.6"
                  fill={
                    isSelected
                      ? '#00e5ff'
                      : conditionColor || '#f8fafc'
                  }
                  stroke={isSelected ? '#ffffff' : '#475569'}
                  strokeWidth="0.8"
                  className="transition-transform group-hover:scale-125"
                />
              </g>
            );
          })}
        </svg>
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
          Lower (17 – 32)
        </span>
      </div>
    </div>
  );
};
