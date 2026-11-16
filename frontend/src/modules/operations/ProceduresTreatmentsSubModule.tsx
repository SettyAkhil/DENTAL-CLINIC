import React, { useState, useEffect, useMemo } from 'react';
import {
  Scissors,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileCheck,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  X,
  Stethoscope,
  Info,
  Check,
  Layers,
  User,
  Clock,
  Pill,
  Trash2,
} from 'lucide-react';
import api from '../../services/api';
import { Procedure, ProcedureMaster, Patient, Doctor } from '../../types';
import { getSocket } from '../../services/socket';
import { PatientSearchSelect } from '../../components/PatientSearchSelect';

export interface ProcedureCategoryGroup {
  category: string;
  procedures: string[];
}

export const PROCEDURE_CATEGORIES: ProcedureCategoryGroup[] = [
  {
    category: 'Consultation & Examination',
    procedures: ['Consultation', 'Dental Examination', 'Oral Examination', 'Diagnosis'],
  },
  {
    category: 'Restorative Procedures',
    procedures: [
      'Dental Filling',
      'GIC Restoration',
      'Composite Restoration',
      'Amalgam Restoration',
      'Crown Placement',
      'Bridge Placement',
      'Inlay / Onlay',
    ],
  },
  {
    category: 'Endodontic Procedures',
    procedures: ['Root Canal Treatment (RCT)', 'Re-RCT', 'Pulp Capping', 'Pulpotomy'],
  },
  {
    category: 'Surgical Procedures',
    procedures: [
      'Tooth Extraction',
      'Surgical Extraction',
      'Impacted Tooth Removal',
      'Irrigation',
      'Suture Placement',
      'Sutures Removal',
      'Incision and Drainage',
    ],
  },
  {
    category: 'Periodontal Procedures',
    procedures: ['Dental Scaling', 'Polishing', 'Deep Scaling', 'Root Planing', 'Gingival Treatment'],
  },
  {
    category: 'Prosthodontic Procedures',
    procedures: [
      'Denture Placement',
      'Denture Adjustment',
      'Impression Taking',
      'Temporary Crown Placement',
    ],
  },
  {
    category: 'Orthodontic Procedures',
    procedures: [
      'Orthodontic Consultation',
      'Orthodontic Alignment',
      'Braces Placement',
      'Retainer Placement',
    ],
  },
  {
    category: 'Other Procedures',
    procedures: [
      'Fluoride Application',
      'Sealant Application',
      'Tooth Whitening',
      'Other Procedure',
    ],
  },
];

interface ProceduresTreatmentsSubModuleProps {
  initialPatient?: Patient | null;
  onNavigateToBillingProcedure?: (procedure: Procedure) => void;
  onNavigateToHistory?: (patient: Patient) => void;
}

export const ProceduresTreatmentsSubModule: React.FC<ProceduresTreatmentsSubModuleProps> = ({
  initialPatient = null,
  onNavigateToBillingProcedure,
  onNavigateToHistory,
}) => {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [procedureMasters, setProcedureMasters] = useState<ProcedureMaster[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-module view navigation: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Filters for list view
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Procedure Form State
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>(['Consultation']);
  const [procedureSearch, setProcedureSearch] = useState('');
  const [customProcedureInput, setCustomProcedureInput] = useState('');
  const [procedureDate, setProcedureDate] = useState(new Date().toISOString().substring(0, 10));
  const [toothNumber, setToothNumber] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [customDentistName, setCustomDentistName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Planned' | 'In Progress' | 'Completed'>('Planned');
  const [charges, setCharges] = useState(500);

  // Medications Prescribed (Clinical Notes Only - not linked to pharmacy or billing)
  const [medications, setMedications] = useState<
    Array<{
      id: string;
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
      notes: string;
    }>
  >([]);

  const handleAddMedicineCard = () => {
    setMedications((prev) => [
      ...prev,
      {
        id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: '',
        notes: '',
      },
    ]);
  };

  const handleUpdateMedicine = (
    id: string,
    field: 'name' | 'dosage' | 'frequency' | 'duration' | 'instructions' | 'notes',
    value: string
  ) => {
    setMedications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveMedicineCard = (id: string) => {
    setMedications((prev) => prev.filter((item) => item.id !== id));
  };

  // Feedback states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [updatingProcId, setUpdatingProcId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // If initialPatient is passed, open create view with that patient
  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
    }
  }, [initialPatient]);

  const fetchData = async () => {
    try {
      const [procRes, masterRes, docRes] = await Promise.all([
        api.get('/procedures'),
        api.get('/procedures/masters'),
        api.get('/reports/doctors'),
      ]);
      if (procRes.data.success) setProcedures(procRes.data.procedures);
      if (masterRes.data.success) setProcedureMasters(masterRes.data.masters);
      if (docRes.data.success) {
        setDoctors(docRes.data.doctors);
        if (docRes.data.doctors.length > 0 && !doctorId) {
          setDoctorId(docRes.data.doctors[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const handleProcUpdate = () => {
      fetchData();
    };

    socket.on('procedure:scheduled', handleProcUpdate);
    socket.on('procedure:created', handleProcUpdate);
    socket.on('procedure:completed', handleProcUpdate);

    return () => {
      socket.off('procedure:scheduled', handleProcUpdate);
      socket.off('procedure:created', handleProcUpdate);
      socket.off('procedure:completed', handleProcUpdate);
    };
  }, []);

  const calculateEstimatedCharges = (procs: string[]) => {
    let total = 0;
    procs.forEach((pName) => {
      const matched = procedureMasters.find(
        (m) => m.name.toLowerCase() === pName.toLowerCase()
      );
      if (matched) {
        total += matched.standardCharge;
      } else {
        total += 500;
      }
    });
    return total;
  };

  const handleSendToBilling = async (proc: Procedure) => {
    setUpdatingProcId(proc.id);
    setActionSuccessMessage(null);
    try {
      const res = await api.patch(`/procedures/${proc.id}/status`, {
        status: 'COMPLETED',
      });
      if (res.data.success) {
        setActionSuccessMessage(
          `Procedure ${proc.procedureCode} (${proc.procedureName || 'Dental Procedure'}) for ${proc.patient.name} marked as Completed & sent to Billing queue!`
        );
        fetchData();
        setTimeout(() => {
          setActionSuccessMessage(null);
        }, 5000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error updating procedure status');
    } finally {
      setUpdatingProcId(null);
    }
  };

  const navigateToCreate = (patientToPreselect?: Patient | null) => {
    setSelectedPatient(patientToPreselect || initialPatient || null);
    setSelectedProcedures(['Consultation']);
    setProcedureSearch('');
    setCustomProcedureInput('');
    setProcedureDate(new Date().toISOString().substring(0, 10));
    setToothNumber('');
    setDescription('');
    setStatus('Planned');
    setFormError(null);
    setFormSuccess(null);
    setCharges(500);
    setMedications([]);

    if (doctors.length > 0) {
      setDoctorId(doctors[0].id);
      setCustomDentistName('');
    } else {
      setDoctorId('');
      setCustomDentistName('');
    }

    setViewMode('create');
  };

  const hasUnsavedChanges = useMemo(() => {
    return (
      (selectedPatient !== null && selectedPatient !== initialPatient) ||
      toothNumber.trim() !== '' ||
      description.trim() !== '' ||
      selectedProcedures.length > 1 ||
      (selectedProcedures.length === 1 && selectedProcedures[0] !== 'Consultation') ||
      customDentistName.trim() !== '' ||
      medications.some((m) => m.name.trim() !== '')
    );
  }, [selectedPatient, initialPatient, toothNumber, description, selectedProcedures, customDentistName, medications]);

  const handleBackToList = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes in this procedure form. Are you sure you want to discard and return to the list?'
      );
      if (!confirmed) return;
    }
    setViewMode('list');
  };

  const toggleProcedureSelection = (procName: string) => {
    if (selectedProcedures.includes(procName)) {
      if (selectedProcedures.length === 1) return;
      const updated = selectedProcedures.filter((p) => p !== procName);
      setSelectedProcedures(updated);
      setCharges(calculateEstimatedCharges(updated));
    } else {
      const updated = [...selectedProcedures, procName];
      setSelectedProcedures(updated);
      setCharges(calculateEstimatedCharges(updated));
    }
  };

  const handleAddCustomProcedure = () => {
    const trimmed = customProcedureInput.trim();
    if (!trimmed) return;
    if (selectedProcedures.includes(trimmed)) {
      setCustomProcedureInput('');
      return;
    }
    const updated = [...selectedProcedures, trimmed];
    setSelectedProcedures(updated);
    setCustomProcedureInput('');
    setCharges(calculateEstimatedCharges(updated));
  };

  const removeProcedureChip = (procName: string) => {
    if (selectedProcedures.length === 1) return;
    const updated = selectedProcedures.filter((p) => p !== procName);
    setSelectedProcedures(updated);
    setCharges(calculateEstimatedCharges(updated));
  };

  const handleSaveProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!selectedPatient) {
      setFormError('Please search and select a patient.');
      return;
    }
    if (selectedProcedures.length === 0) {
      setFormError('Please select at least one procedure.');
      return;
    }

    setSubmitting(true);
    try {
      let dentistNameToSave: string | null = null;
      if (doctorId) {
        const doc = doctors.find((d) => d.id === doctorId);
        if (doc) dentistNameToSave = `Dr. ${doc.user?.fullName}`;
      } else if (customDentistName.trim()) {
        dentistNameToSave = customDentistName.trim();
      }

      let apiStatus = 'PLANNED';
      if (status === 'In Progress') apiStatus = 'IN_PROGRESS';
      if (status === 'Completed') apiStatus = 'COMPLETED';

      // Prepare prescribed medications (strictly clinical notes - no pharmacy or billing impact)
      const validMeds = medications
        .filter((m) => m && m.name && m.name.trim().length > 0)
        .map((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim() || null,
          frequency: m.frequency.trim() || null,
          duration: m.duration.trim() || null,
          instructions: m.instructions.trim() || null,
          notes: m.notes.trim() || null,
        }));

      const res = await api.post('/procedures', {
        patientId: selectedPatient.id,
        doctorId: doctorId || null,
        dentistName: dentistNameToSave,
        procedureNames: selectedProcedures,
        procedureName: selectedProcedures[0],
        procedureDate: procedureDate,
        toothNumber: toothNumber.trim() || null,
        charges: Number(charges) || 0,
        clinicalNotes: description.trim() || null,
        procedureDescription: description.trim() || null,
        status: apiStatus,
        prescribedMedications: validMeds.length > 0 ? validMeds : undefined,
      });

      if (res.data.success) {
        setFormSuccess(
          selectedProcedures.length === 1
            ? `Procedure "${selectedProcedures[0]}" recorded successfully for ${selectedPatient.name}!`
            : `${selectedProcedures.length} procedures recorded successfully for ${selectedPatient.name}!`
        );
        fetchData();
        setTimeout(() => {
          setViewMode('list');
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to save procedure.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter procedures for list view
  const filteredProcedures = useMemo(() => {
    return procedures.filter((proc) => {
      const matchesStatus =
        statusFilter === 'ALL' || proc.status.toUpperCase() === statusFilter.toUpperCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        proc.procedureCode.toLowerCase().includes(q) ||
        proc.patient?.name.toLowerCase().includes(q) ||
        proc.patient?.patientCode.toLowerCase().includes(q) ||
        (proc.procedureName || '').toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [procedures, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Action Success Toast Banner */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW MODE 1: LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-5">
          {/* Top Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
                <Scissors className="w-4 h-4" />
                <span>Sub-module 2 of Operations & Procedures</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Procedures & Treatments</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record and manage clinical dental procedures actually performed during patient visits.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigateToCreate()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Procedure</span>
              </button>
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search patient, code, procedure..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Procedures Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-xs text-slate-400">Loading procedure records...</div>
            ) : filteredProcedures.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Scissors className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">No procedure records found matching your filters.</p>
                <button
                  type="button"
                  onClick={() => navigateToCreate()}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Procedure</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 pl-5">Procedure Code</th>
                      <th className="p-3.5">Patient</th>
                      <th className="p-3.5">Procedure Name</th>
                      <th className="p-3.5">Dentist / Doctor</th>
                      <th className="p-3.5">Tooth #</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Fee (₹)</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 pr-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProcedures.map((proc) => {
                      const isCompleted = proc.status === 'COMPLETED';
                      const isInvoiced = !!proc.operationInvoice;

                      return (
                        <tr key={proc.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3.5 pl-5 font-mono font-bold text-slate-900">
                            {proc.procedureCode}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{proc.patient?.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {proc.patient?.patientCode}
                            </div>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">
                            {proc.procedureName || proc.procedureMaster?.name || 'Procedure'}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            {proc.doctor?.user?.fullName
                              ? `Dr. ${proc.doctor.user.fullName}`
                              : proc.dentistName || '—'}
                          </td>
                          <td className="p-3.5 font-mono">
                            {proc.toothNumber ? (
                              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200 font-bold text-slate-800">
                                #{proc.toothNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap text-slate-600">
                            {new Date(proc.procedureDate).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">₹{proc.charges}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                proc.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : proc.status === 'IN_PROGRESS'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {proc.status}
                            </span>
                          </td>
                          <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                            {!isCompleted ? (
                              <button
                                type="button"
                                disabled={updatingProcId === proc.id}
                                onClick={() => handleSendToBilling(proc)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{updatingProcId === proc.id ? 'Updating...' : 'Complete & Bill'}</span>
                              </button>
                            ) : isInvoiced ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                <FileCheck className="w-3.5 h-3.5" />
                                Invoiced
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                <Clock className="w-3 h-3 text-slate-400" />
                                Awaiting Billing
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DEDICATED FULL-PAGE CREATE PROCEDURE */}
      {viewMode === 'create' && (
        <div className="space-y-6">
          {/* Header with Back Button */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToList}
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                title="Back to Procedures List"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Record Dental Procedure</h2>
                <p className="text-xs text-slate-500">
                  Select performed procedures, dentist, tooth number, status, and fee details.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToList}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveProcedure} className="space-y-6">
            {/* 1. Patient Selection */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>1. Patient Details</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Patient Name <span className="text-rose-500">*</span>
                  </label>
                  <PatientSearchSelect
                    selectedPatient={selectedPatient}
                    onSelect={(p) => setSelectedPatient(p)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Patient ID (Auto-populated)</label>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    {selectedPatient ? (
                      <>
                        <span className="font-mono text-xs font-black text-blue-700">{selectedPatient.patientCode}</span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {selectedPatient.gender}, {selectedPatient.age} yrs
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Select patient above</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Categorized Multi-Select Procedures */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-blue-600" />
                  <span>2. Procedures Selection (Multi-select)</span>
                </h3>
                <span className="text-xs font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  {selectedProcedures.length} Selected
                </span>
              </div>

              {/* Selected Chips */}
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl min-h-[46px] items-center">
                {selectedProcedures.map((proc) => (
                  <span
                    key={proc}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200 text-blue-900 rounded-lg text-xs font-bold shadow-2xs"
                  >
                    <span>{proc}</span>
                    <button
                      type="button"
                      onClick={() => removeProcedureChip(proc)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-slate-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Search & Custom Entry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search procedures across categories..."
                    value={procedureSearch}
                    onChange={(e) => setProcedureSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Or enter custom procedure name..."
                    value={customProcedureInput}
                    onChange={(e) => setCustomProcedureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomProcedure();
                      }
                    }}
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomProcedure}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shrink-0 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Categorized Options Accordion / Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
                {PROCEDURE_CATEGORIES.map((cat) => {
                  const filtered = cat.procedures.filter((p) =>
                    !procedureSearch || p.toLowerCase().includes(procedureSearch.toLowerCase())
                  );

                  if (filtered.length === 0) return null;

                  return (
                    <div key={cat.category} className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-[11px] font-black uppercase text-slate-600 tracking-wider">
                        {cat.category}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {filtered.map((p) => {
                          const isSelected = selectedProcedures.includes(p);
                          return (
                            <button
                              type="button"
                              key={p}
                              onClick={() => toggleProcedureSelection(p)}
                              className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isSelected ? '✓ ' : '+ '}
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Medications Prescribed (Clinical Notes Only) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-emerald-600" />
                    <span>3. Medications Prescribed (Clinical Notes Only)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Record medicines written in the doctor's prescription for clinical documentation. Strictly clinical notes — does NOT trigger pharmacy dispensing, inventory deduction, or billing charges.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddMedicineCard}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Medicine</span>
                </button>
              </div>

              {/* Medicine Cards List */}
              {medications.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Pill className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-600">No medicines prescribed for this visit</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                    Optional: You can record one or more medicines from the doctor's prescription if prescribed.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddMedicineCard}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Prescribed Medicine</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {medications.map((med, index) => (
                    <div
                      key={med.id}
                      className="p-4 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl space-y-3 transition"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                            {index + 1}
                          </span>
                          <span>Prescription Medicine #{index + 1}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicineCard(med.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
                          title="Remove medicine card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Remove</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        {/* Medicine Name (Required for this item) */}
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Medicine Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Amoxicillin, Paracetamol..."
                            value={med.name}
                            onChange={(e) => handleUpdateMedicine(med.id, 'name', e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                          />
                        </div>

                        {/* Dosage */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Dosage (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 500 mg, 250 mg"
                            value={med.dosage}
                            onChange={(e) => handleUpdateMedicine(med.id, 'dosage', e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        {/* Frequency */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Frequency (Optional)
                          </label>
                          <input
                            type="text"
                            list={`freq-list-${med.id}`}
                            placeholder="e.g. Twice daily"
                            value={med.frequency}
                            onChange={(e) => handleUpdateMedicine(med.id, 'frequency', e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                          <datalist id={`freq-list-${med.id}`}>
                            <option value="Once daily" />
                            <option value="Twice daily" />
                            <option value="Thrice daily" />
                            <option value="Four times daily" />
                            <option value="As needed (SOS)" />
                          </datalist>
                        </div>

                        {/* Duration */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Duration (Optional)
                          </label>
                          <input
                            type="text"
                            list={`dur-list-${med.id}`}
                            placeholder="e.g. 5 days"
                            value={med.duration}
                            onChange={(e) => handleUpdateMedicine(med.id, 'duration', e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                          <datalist id={`dur-list-${med.id}`}>
                            <option value="3 days" />
                            <option value="5 days" />
                            <option value="7 days" />
                            <option value="10 days" />
                            <option value="14 days" />
                          </datalist>
                        </div>

                        {/* Instructions */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Instructions (Optional)
                          </label>
                          <input
                            type="text"
                            list={`inst-list-${med.id}`}
                            placeholder="e.g. After food"
                            value={med.instructions}
                            onChange={(e) => handleUpdateMedicine(med.id, 'instructions', e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                          <datalist id={`inst-list-${med.id}`}>
                            <option value="After food" />
                            <option value="Before food" />
                            <option value="At bedtime" />
                            <option value="With water" />
                            <option value="Empty stomach" />
                          </datalist>
                        </div>
                      </div>

                      {/* Additional Notes */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Additional Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Complete full course, avoid alcohol, take with plenty of water..."
                          value={med.notes}
                          onChange={(e) => handleUpdateMedicine(med.id, 'notes', e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Treatment & Clinical Parameters */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>4. Treatment & Clinical Parameters</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Procedure Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={procedureDate}
                    onChange={(e) => setProcedureDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tooth Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 14, 21, 36"
                    value={toothNumber}
                    onChange={(e) => setToothNumber(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Dentist / Doctor</label>
                  <select
                    value={doctorId}
                    onChange={(e) => {
                      setDoctorId(e.target.value);
                      if (e.target.value) setCustomDentistName('');
                    }}
                    className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="">-- Choose Clinic Doctor --</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.user?.fullName} ({doc.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Procedure Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Treatment Details & Clinical Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Record clinical details, materials used, patient tolerance, or instructions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Estimated Charges (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={charges}
                    onChange={(e) => setCharges(Number(e.target.value))}
                    className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Standard fee auto-calculated based on selected procedures.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleBackToList}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <span>Recording Procedure...</span>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    <span>Save Performed Procedure</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
