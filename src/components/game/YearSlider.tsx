"use client";

import { useState, useCallback } from "react";

interface YearSliderProps {
  min?: number;
  max?: number;
  value: number;
  onChange: (year: number) => void;
  disabled?: boolean;
}

const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export default function YearSlider({
  min = 1950,
  max = 2025,
  value,
  onChange,
  disabled = false,
}: YearSliderProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseInt(e.target.value, 10));
    },
    [onChange]
  );

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`w-full ${disabled ? "opacity-50" : ""}`}>
      <div className="text-center mb-3">
        <span className="text-4xl font-bold text-orange-600 tabular-nums">
          {value}
        </span>
      </div>

      <div className="relative px-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-3 rounded-full appearance-none cursor-pointer bg-gray-200
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-7
            [&::-webkit-slider-thumb]:h-7
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-orange-500
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:border-4
            [&::-webkit-slider-thumb]:border-white
            [&::-moz-range-thumb]:w-7
            [&::-moz-range-thumb]:h-7
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-orange-500
            [&::-moz-range-thumb]:shadow-lg
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-4
            [&::-moz-range-thumb]:border-white
          "
          style={{
            background: `linear-gradient(to right, #f97316 0%, #f97316 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
          }}
        />

        {/* Decade markers */}
        <div className="flex justify-between mt-2 px-1">
          {DECADES.map((decade) => (
            <div key={decade} className="flex flex-col items-center">
              <div className="w-px h-2 bg-gray-300" />
              <span className="text-xs text-gray-400 mt-0.5">{decade}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
