import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  ADULT_TEETH,
  DentalFindingItem,
  ToothSurface,
  getToothByFDI,
} from './types/dentalChart.types';
import { dentalChartService } from './services/dentalChartService';
import { DentalChartHeader } from './components/DentalChartHeader';
import { DentalModelViewer } from './components/DentalModelViewer';
import { DentalChart2D } from './components/DentalChart2D';
import { ToothInspectionPanel } from './components/ToothInspectionPanel';
import { DentalChartSummary } from './components/DentalChartSummary';
import { FindingsLegend } from './components/FindingsLegend';

interface DentalChartModuleProps {
  initialPatientId?: string;
  onBack?: () => void;
}

export const DentalChartModule: React.FC<DentalChartModuleProps> = ({
  initialPatientId,
  onBack,
}) => {
  // View Toggle: 3D View by default
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');

  // Currently Selected FDI Tooth (Defaults to Tooth 16 matching reference image)
  const [selectedFDI, setSelectedFDI] = useState<number>(16);

  // Patient State
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Clinical Findings for selected patient
  const [findings, setFindings] = useState<DentalFindingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Tooth History for the currently inspected tooth
  const [toothHistory, setToothHistory] = useState<DentalFindingItem[]>([]);
  const [loadingToothHistory, setLoadingToothHistory] = useState<boolean>(false);

  // 1. Fetch available patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await api.get('/patients');
        if (res.data.success && res.data.patients.length > 0) {
          setPatients(res.data.patients);
          const initial = initialPatientId
            ? res.data.patients.find((p: any) => p.id === initialPatientId) || res.data.patients[0]
            : res.data.patients[0];
          setSelectedPatient(initial);
        }
      } catch (err) {
        console.error('Failed to load patients for dental chart:', err);
      }
    };
    fetchPatients();
  }, [initialPatientId]);

  // 2. Fetch patient dental chart findings whenever selectedPatient changes
  const loadChartData = useCallback(async () => {
    if (!selectedPatient?.id) return;
    try {
      setLoading(true);
      const data = await dentalChartService.getPatientChart(selectedPatient.id);
      if (data.success) {
        setFindings(data.findings);
      }
    } catch (err) {
      console.error('Failed to fetch patient dental chart:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPatient?.id]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // 3. Fetch specific tooth history whenever selectedFDI or findings change
  useEffect(() => {
    if (!selectedPatient?.id || !selectedFDI) return;
    const fetchHistory = async () => {
      try {
        setLoadingToothHistory(true);
        const history = await dentalChartService.getToothHistory(selectedPatient.id, selectedFDI);
        setToothHistory(history);
      } catch (err) {
        console.error('Failed to fetch tooth history:', err);
      } finally {
        setLoadingToothHistory(false);
      }
    };
    fetchHistory();
  }, [selectedPatient?.id, selectedFDI, findings]);

  // 4. Save Finding Handler
  const handleSaveFinding = async (findingData: {
    toothNumber: number;
    toothName: string;
    surface: ToothSurface;
    condition: string;
    severity: 'Mild' | 'Moderate' | 'Severe' | 'Critical' | 'N/A';
    treatment?: string;
    notes?: string;
  }) => {
    if (!selectedPatient?.id) return;

    await dentalChartService.saveFinding({
      patientId: selectedPatient.id,
      toothNumber: findingData.toothNumber,
      dentitionType: 'ADULT',
      toothName: findingData.toothName,
      surface: findingData.surface,
      condition: findingData.condition,
      severity: findingData.severity,
      treatment: findingData.treatment,
      notes: findingData.notes,
    });

    // Refresh patient findings list
    await loadChartData();
  };

  // 5. Delete Finding Handler
  const handleDeleteFinding = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this dental finding?')) return;
    try {
      await dentalChartService.deleteFinding(id);
      await loadChartData();
    } catch (err) {
      console.error('Failed to delete dental finding:', err);
    }
  };

  const selectedToothObj = getToothByFDI(selectedFDI) || ADULT_TEETH[2]; // Default to Tooth 16

  return (
    <div className="w-full min-h-screen bg-[#F5F8FC] flex flex-col font-sans antialiased text-slate-800 select-none overflow-x-hidden">
      {/* 1. Top Dental Charting Header */}
      <DentalChartHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedPatient={selectedPatient}
        patients={patients}
        onSelectPatient={setSelectedPatient}
        onBack={onBack}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* 2. Main 3D / 2D Dental Visualization + Right Tooth Inspection Panel */}
        <section className="flex flex-col lg:flex-row gap-5 items-stretch">
          {/* Left: 3D Model Viewer OR 2D Odontogram */}
          {viewMode === '3D' ? (
            <DentalModelViewer
              selectedFDI={selectedFDI}
              onSelectTooth={setSelectedFDI}
              findings={findings}
            />
          ) : (
            <DentalChart2D
              selectedFDI={selectedFDI}
              onSelectTooth={setSelectedFDI}
              findings={findings}
            />
          )}

          {/* Right: Tooth Inspection Panel */}
          <ToothInspectionPanel
            tooth={selectedToothObj}
            onSelectTooth={setSelectedFDI}
            onClose={() => {}}
            patientId={selectedPatient?.id || ''}
            onSaveFinding={handleSaveFinding}
            toothHistory={toothHistory}
            isLoadingHistory={loadingToothHistory}
          />
        </section>

        {/* 3. Bottom Row: Dental Chart Summary (Left) + Findings Legend (Right) */}
        <section className="flex flex-col lg:flex-row gap-5 items-stretch">
          <DentalChartSummary
            findings={findings}
            onSelectTooth={setSelectedFDI}
            onDeleteFinding={handleDeleteFinding}
          />

          <FindingsLegend />
        </section>
      </main>
    </div>
  );
};

export default DentalChartModule;
