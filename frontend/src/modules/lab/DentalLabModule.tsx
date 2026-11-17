import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  Filter,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  Calendar,
  AlertCircle,
  ExternalLink,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  User,
  ArrowRight,
  X,
  Upload,
  Info,
  Check,
  ChevronRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  Patient,
  LabCase,
  LabItem,
  LabDocument,
  LabPhoto,
  LabCaseStatus,
  LabItemType,
  Appointment,
} from '../../types';
import { PatientSearchSelect } from '../../components/PatientSearchSelect';

interface DentalLabModuleProps {
  onNavigateToPatient?: (patientId: string) => void;
}

export const DentalLabModule: React.FC<DentalLabModuleProps> = ({
  onNavigateToPatient,
}) => {
  // Navigation within Dental Lab: 'dashboard' | 'cases' | 'create'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cases' | 'create'>('dashboard');

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dashboard Data
  const [dashboardCounts, setDashboardCounts] = useState<{
    totalCases: number;
    sentToLab: number;
    receivedFromLab: number;
    readyForHandover: number;
    handedOver: number;
  }>({
    totalCases: 0,
    sentToLab: 0,
    receivedFromLab: 0,
    readyForHandover: 0,
    handedOver: 0,
  });
  const [recentCases, setRecentCases] = useState<LabCase[]>([]);

  // Lab Cases List & Filters
  const [cases, setCases] = useState<LabCase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('ALL');
  const [labFilter, setLabFilter] = useState<string>('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Selected Case for Detailed Modal / View
  const [selectedCase, setSelectedCase] = useState<LabCase | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Handover Modal State
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().substring(0, 10));
  const [handoverRemarks, setHandoverRemarks] = useState('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

  // Receive Items Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().substring(0, 10));
  const [receiveNotes, setReceiveNotes] = useState('');
  const [makeReadyForHandover, setMakeReadyForHandover] = useState(true);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  // Lightbox Image Viewer
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Create / Edit Case Form State
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [formPatient, setFormPatient] = useState<Patient | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [labName, setLabName] = useState('');
  const [labContact, setLabContact] = useState('');
  const [labPhone, setLabPhone] = useState('');
  const [labEmail, setLabEmail] = useState('');
  const [labRefNumber, setLabRefNumber] = useState('');
  const [sentDate, setSentDate] = useState(new Date().toISOString().substring(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [formItems, setFormItems] = useState<
    Array<{
      id?: string;
      itemType: LabItemType;
      customItemName: string;
      toothNumber: string;
      material: string;
      shade: string;
      description: string;
    }>
  >([
    {
      itemType: 'CROWN',
      customItemName: '',
      toothNumber: '',
      material: 'Zirconia',
      shade: 'A2',
      description: '',
    },
  ]);
  const [pendingDocsToUpload, setPendingDocsToUpload] = useState<File[]>([]);
  const [pendingPhotosToUpload, setPendingPhotosToUpload] = useState<File[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Document & Photo uploading in Detail Modal
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  const fetchDashboard = async () => {
    try {
      const res = await api.get('/lab/dashboard');
      if (res.data.success) {
        setDashboardCounts(res.data.counts);
        setRecentCases(res.data.recentCases || []);
      }
    } catch (err) {
      console.error('Error fetching lab dashboard:', err);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (itemTypeFilter !== 'ALL') params.itemType = itemTypeFilter;
      if (labFilter !== 'ALL') params.labName = labFilter;
      if (startDateFilter) params.startDate = startDateFilter;
      if (endDateFilter) params.endDate = endDateFilter;

      const res = await api.get('/lab/cases', { params });
      if (res.data.success) {
        setCases(res.data.cases || []);
      }
    } catch (err) {
      console.error('Error fetching lab cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshCaseDetails = async (caseId: string) => {
    try {
      const res = await api.get(`/lab/cases/${caseId}`);
      if (res.data.success) {
        setSelectedCase(res.data.case);
        // Also update in list
        setCases((prev) =>
          prev.map((c) => (c.id === caseId ? res.data.case : c))
        );
      }
    } catch (err) {
      console.error('Error refreshing case details:', err);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchCases();
  }, []);

  // Listen to Socket.IO real-time events
  useEffect(() => {
    const socket = getSocket();
    const handleLabUpdate = () => {
      fetchDashboard();
      fetchCases();
      if (selectedCase) {
        refreshCaseDetails(selectedCase.id);
      }
    };

    socket.on('lab:created', handleLabUpdate);
    socket.on('lab:updated', handleLabUpdate);
    socket.on('lab:deleted', handleLabUpdate);

    return () => {
      socket.off('lab:created', handleLabUpdate);
      socket.off('lab:updated', handleLabUpdate);
      socket.off('lab:deleted', handleLabUpdate);
    };
  }, [selectedCase]);

  // When patient is selected in Create Case form, load their appointments
  useEffect(() => {
    if (formPatient) {
      api
        .get('/appointments', { params: { patientId: formPatient.id } })
        .then((res) => {
          if (res.data.success) {
            setPatientAppointments(res.data.appointments || []);
          }
        })
        .catch(() => setPatientAppointments([]));
    } else {
      setPatientAppointments([]);
      setSelectedAppointmentId('');
    }
  }, [formPatient]);

  // Distinct laboratory names for filtering
  const distinctLabs = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => {
      if (c.labName && c.labName.trim()) set.add(c.labName.trim());
    });
    return Array.from(set);
  }, [cases]);

  // -------------------------------------------------------------
  // ITEM MANAGEMENT IN FORM
  // -------------------------------------------------------------
  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        itemType: 'CROWN',
        customItemName: '',
        toothNumber: '',
        material: 'Zirconia',
        shade: 'A2',
        description: '',
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Reset Create Form
  const resetCreateForm = () => {
    setEditingCaseId(null);
    setFormPatient(null);
    setSelectedAppointmentId('');
    setLabName('');
    setLabContact('');
    setLabPhone('');
    setLabEmail('');
    setLabRefNumber('');
    setSentDate(new Date().toISOString().substring(0, 10));
    setExpectedDate('');
    setGeneralNotes('');
    setFormItems([
      {
        itemType: 'CROWN',
        customItemName: '',
        toothNumber: '',
        material: 'Zirconia',
        shade: 'A2',
        description: '',
      },
    ]);
    setPendingDocsToUpload([]);
    setPendingPhotosToUpload([]);
    setFormError(null);
  };

  const openCreateCaseView = (patientToPreselect?: Patient | null) => {
    resetCreateForm();
    if (patientToPreselect) {
      setFormPatient(patientToPreselect);
    }
    setActiveTab('create');
  };

  const openEditCaseView = (c: LabCase) => {
    setEditingCaseId(c.id);
    setFormPatient(c.patient);
    setSelectedAppointmentId(c.appointmentId || '');
    setLabName(c.labName);
    setLabContact(c.labContact || '');
    setLabPhone(c.labPhone || '');
    setLabEmail(c.labEmail || '');
    setLabRefNumber(c.labRefNumber || '');
    setSentDate(c.sentDate ? c.sentDate.substring(0, 10) : '');
    setExpectedDate(c.expectedDate ? c.expectedDate.substring(0, 10) : '');
    setGeneralNotes(c.generalNotes || '');
    setFormItems(
      c.items && c.items.length > 0
        ? c.items.map((it) => ({
            id: it.id,
            itemType: it.itemType,
            customItemName: it.customItemName || '',
            toothNumber: it.toothNumber,
            material: it.material || '',
            shade: it.shade || '',
            description: it.description || '',
          }))
        : [
            {
              itemType: 'CROWN',
              customItemName: '',
              toothNumber: '',
              material: '',
              shade: '',
              description: '',
            },
          ]
    );
    setPendingDocsToUpload([]);
    setPendingPhotosToUpload([]);
    setFormError(null);
    setIsDetailModalOpen(false);
    setActiveTab('create');
  };

  // -------------------------------------------------------------
  // SUBMIT CREATE / EDIT CASE
  // -------------------------------------------------------------
  const handleSaveLabCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formPatient) {
      setFormError('Please search and select an existing patient.');
      return;
    }
    if (!labName.trim()) {
      setFormError('Laboratory name is required.');
      return;
    }

    // Validate items
    for (let i = 0; i < formItems.length; i++) {
      if (!formItems[i].toothNumber.trim()) {
        setFormError(`Item #${i + 1}: Tooth number / region is required.`);
        return;
      }
    }

    setFormSubmitting(true);
    try {
      let savedCaseId = editingCaseId;

      if (editingCaseId) {
        // Update existing case
        const res = await api.put(`/lab/cases/${editingCaseId}`, {
          labName: labName.trim(),
          labContact: labContact.trim() || null,
          labPhone: labPhone.trim() || null,
          labEmail: labEmail.trim() || null,
          labRefNumber: labRefNumber.trim() || null,
          sentDate,
          expectedDate: expectedDate || null,
          generalNotes: generalNotes.trim() || null,
          items: formItems.map((item) => ({
            itemType: item.itemType,
            customItemName: item.customItemName?.trim() || null,
            toothNumber: item.toothNumber.trim(),
            material: item.material?.trim() || null,
            shade: item.shade?.trim() || null,
            description: item.description?.trim() || null,
          })),
        });
        if (res.data.success) {
          setActionSuccess(`Lab case ${res.data.case.caseNumber} updated successfully.`);
        }
      } else {
        // Create new case
        const res = await api.post('/lab/cases', {
          patientId: formPatient.id,
          appointmentId: selectedAppointmentId || null,
          labName: labName.trim(),
          labContact: labContact.trim() || null,
          labPhone: labPhone.trim() || null,
          labEmail: labEmail.trim() || null,
          labRefNumber: labRefNumber.trim() || null,
          sentDate,
          expectedDate: expectedDate || null,
          generalNotes: generalNotes.trim() || null,
          items: formItems.map((item) => ({
            itemType: item.itemType,
            customItemName: item.customItemName?.trim() || null,
            toothNumber: item.toothNumber.trim(),
            material: item.material?.trim() || null,
            shade: item.shade?.trim() || null,
            description: item.description?.trim() || null,
          })),
        });

        if (res.data.success) {
          savedCaseId = res.data.case.id;
          setActionSuccess(`Lab case ${res.data.case.caseNumber} created successfully.`);
        }
      }

      // Upload any pending documents
      if (savedCaseId && pendingDocsToUpload.length > 0) {
        const formData = new FormData();
        pendingDocsToUpload.forEach((file) => formData.append('documents', file));
        await api.post(`/lab/cases/${savedCaseId}/documents`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Upload any pending photos
      if (savedCaseId && pendingPhotosToUpload.length > 0) {
        const formData = new FormData();
        pendingPhotosToUpload.forEach((file) => formData.append('photos', file));
        await api.post(`/lab/cases/${savedCaseId}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      resetCreateForm();
      fetchDashboard();
      fetchCases();
      setActiveTab('cases');
    } catch (err: any) {
      console.error('Error saving lab case:', err);
      setFormError(err.response?.data?.message || 'Failed to save lab case.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // RECEIVE FROM LAB ACTION
  // -------------------------------------------------------------
  const handleOpenReceiveModal = (c: LabCase) => {
    setSelectedCase(c);
    setReceiveDate(new Date().toISOString().substring(0, 10));
    setReceiveNotes('');
    setMakeReadyForHandover(true);
    setIsReceiveModalOpen(true);
  };

  const handleConfirmReceive = async () => {
    if (!selectedCase) return;
    setReceiveSubmitting(true);
    try {
      const res = await api.post(`/lab/cases/${selectedCase.id}/receive`, {
        receivedDate: receiveDate,
        notes: receiveNotes.trim() || null,
        makeReadyForHandover,
      });

      if (res.data.success) {
        setActionSuccess(
          `Case ${selectedCase.caseNumber} recorded as Received from Laboratory.`
        );
        setIsReceiveModalOpen(false);
        refreshCaseDetails(selectedCase.id);
        fetchDashboard();
        fetchCases();
      }
    } catch (err: any) {
      console.error('Error recording received case:', err);
      setActionError(err.response?.data?.message || 'Failed to record received items.');
    } finally {
      setReceiveSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // PATIENT HANDOVER ACTION
  // -------------------------------------------------------------
  const handleOpenHandoverModal = (c: LabCase) => {
    setSelectedCase(c);
    setHandoverDate(new Date().toISOString().substring(0, 10));
    setHandoverRemarks('');
    setIsHandoverModalOpen(true);
  };

  const handleConfirmHandover = async () => {
    if (!selectedCase) return;
    setHandoverSubmitting(true);
    try {
      const res = await api.post(`/lab/cases/${selectedCase.id}/handover`, {
        handoverDate,
        remarks: handoverRemarks.trim() || null,
      });

      if (res.data.success) {
        setActionSuccess(
          `Case ${selectedCase.caseNumber} recorded as Handed Over to patient ${selectedCase.patient.name}.`
        );
        setIsHandoverModalOpen(false);
        refreshCaseDetails(selectedCase.id);
        fetchDashboard();
        fetchCases();
      }
    } catch (err: any) {
      console.error('Error recording handover:', err);
      setActionError(err.response?.data?.message || 'Failed to record patient handover.');
    } finally {
      setHandoverSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // DOCUMENT & PHOTO MANAGEMENT IN MODAL
  // -------------------------------------------------------------
  const handleUploadDocumentsModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCase || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    const formData = new FormData();
    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
        alert(`File "${f.name}" is not a PDF. Only PDF files are accepted.`);
        return;
      }
      formData.append('documents', f);
    }

    setUploadingDoc(true);
    try {
      const res = await api.post(`/lab/cases/${selectedCase.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setActionSuccess(`${files.length} document(s) uploaded successfully.`);
        refreshCaseDetails(selectedCase.id);
      }
    } catch (err: any) {
      console.error('Error uploading documents:', err);
      alert(err.response?.data?.message || 'Failed to upload PDF documents.');
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this PDF document?')) return;
    try {
      const res = await api.delete(`/lab/documents/${docId}`);
      if (res.data.success && selectedCase) {
        refreshCaseDetails(selectedCase.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete document.');
    }
  };

  const handleUploadPhotosModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCase || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    const formData = new FormData();
    for (const f of files) {
      if (!f.type.startsWith('image/') && !/\.(jpg|jpeg|png|webp)$/i.test(f.name)) {
        alert(`File "${f.name}" is not a valid image (JPG, PNG).`);
        return;
      }
      formData.append('photos', f);
    }
    formData.append('receivedDate', new Date().toISOString().substring(0, 10));

    setUploadingPhoto(true);
    try {
      const res = await api.post(`/lab/cases/${selectedCase.id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setActionSuccess(`${files.length} photo(s) uploaded successfully.`);
        refreshCaseDetails(selectedCase.id);
      }
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      alert(err.response?.data?.message || 'Failed to upload photos.');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photograph?')) return;
    try {
      const res = await api.delete(`/lab/photos/${photoId}`);
      if (res.data.success && selectedCase) {
        refreshCaseDetails(selectedCase.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete photo.');
    }
  };

  const handleDeleteCase = async (c: LabCase) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete Lab Case ${c.caseNumber} for patient ${c.patient.name}? This will remove all items, attached PDFs, and photos.`
      )
    ) {
      return;
    }
    try {
      const res = await api.delete(`/lab/cases/${c.id}`);
      if (res.data.success) {
        setActionSuccess(`Case ${c.caseNumber} deleted successfully.`);
        setIsDetailModalOpen(false);
        fetchDashboard();
        fetchCases();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete lab case.');
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: LabCaseStatus) => {
    switch (status) {
      case 'SENT_TO_LAB':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold uppercase tracking-wider">
            <Truck className="w-3 h-3 text-blue-600" />
            <span>Sent to Lab</span>
          </span>
        );
      case 'RECEIVED_FROM_LAB':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold uppercase tracking-wider">
            <Package className="w-3 h-3 text-amber-600" />
            <span>Received from Lab</span>
          </span>
        );
      case 'READY_FOR_HANDOVER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-900 border border-purple-300 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3 text-purple-600" />
            <span>Ready for Handover</span>
          </span>
        );
      case 'HANDED_OVER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Handed Over</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-wider">
            <X className="w-3 h-3 text-slate-500" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Format File Size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER & MODULE NAVIGATION TABS                           */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-5 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Dental Lab Work Management</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 uppercase tracking-wider">
                External Lab Module
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Maintain records of external lab fabrications, prosthesis tracking, lab PDF work-orders, item photos, and patient handovers.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cases');
              fetchCases();
            }}
            className={`px-3.5 py-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'cases'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Lab Cases Directory</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 font-black">
              {cases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => openCreateCaseView()}
            className={`px-3.5 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Lab Case</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. VIEW MODE: DENTAL LAB DASHBOARD                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 5 Real KPI Metric Cards - Rectangular Layout */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Lab Cases
                </span>
                <FlaskConical className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {dashboardCounts.totalCases}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">All dental lab records</p>
            </div>

            <div className="bg-white p-4 border border-blue-200 shadow-2xs border-l-4 border-l-blue-600">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                  Sent to Lab
                </span>
                <Truck className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-900 mt-2 font-mono">
                {dashboardCounts.sentToLab}
              </p>
              <p className="text-[10px] text-blue-600 font-semibold mt-1">In fabrication at external lab</p>
            </div>

            <div className="bg-white p-4 border border-amber-200 shadow-2xs border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                  Received from Lab
                </span>
                <Package className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-900 mt-2 font-mono">
                {dashboardCounts.receivedFromLab}
              </p>
              <p className="text-[10px] text-amber-700 font-semibold mt-1">Received & verified in clinic</p>
            </div>

            <div className="bg-white p-4 border border-purple-200 shadow-2xs border-l-4 border-l-purple-600">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                  Awaiting Handover
                </span>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-purple-900 mt-2 font-mono">
                {dashboardCounts.readyForHandover}
              </p>
              <p className="text-[10px] text-purple-700 font-semibold mt-1">Ready for patient appointment</p>
            </div>

            <div className="bg-white p-4 border border-emerald-200 shadow-2xs border-l-4 border-l-emerald-600">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Handed Over
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-900 mt-2 font-mono">
                {dashboardCounts.handedOver}
              </p>
              <p className="text-[10px] text-emerald-700 font-semibold mt-1">Delivered to patient</p>
            </div>
          </div>

          {/* Quick Action Banner */}
          <div className="bg-indigo-900 text-white p-5 border border-indigo-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black tracking-tight">
                Send New Work Order to External Dental Laboratory
              </h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                Record crowns, bridges, dentures, aligners, splints, or custom prosthetics with tooth numbers, material, shade, and lab instructions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCreateCaseView()}
              className="px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 font-black text-xs transition shrink-0 cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Lab Case</span>
            </button>
          </div>

          {/* Cases Awaiting Handover Banner */}
          {dashboardCounts.readyForHandover > 0 && (
            <div className="p-4 bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-purple-700 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-purple-900">
                    {dashboardCounts.readyForHandover} Dental Item(s) Ready for Patient Handover
                  </p>
                  <p className="text-[11px] text-purple-700">
                    Items received from the laboratory are waiting for the patient's visit and cementation/delivery.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('READY_FOR_HANDOVER');
                  setActiveTab('cases');
                  fetchCases();
                }}
                className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shrink-0 cursor-pointer"
              >
                View Items Ready for Handover
              </button>
            </div>
          )}

          {/* Recent Lab Cases Table */}
          <div className="bg-white border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recent Dental Lab Cases
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Latest lab work orders created and updated in the system.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('cases');
                  fetchCases();
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>View All Cases</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentCases.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No lab cases recorded yet. Click "Create New Lab Case" to add your first work order.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3.5">Case #</th>
                      <th className="py-2.5 px-3.5">Patient Name & ID</th>
                      <th className="py-2.5 px-3.5">Laboratory</th>
                      <th className="py-2.5 px-3.5">Items Ordered</th>
                      <th className="py-2.5 px-3.5">Sent Date</th>
                      <th className="py-2.5 px-3.5">Status</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentCases.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                          {c.caseNumber}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900">{c.patient.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {c.patient.patientCode}
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-800">{c.labName}</div>
                          {c.labRefNumber && (
                            <div className="text-[10px] text-slate-400">
                              Ref: {c.labRefNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="space-y-0.5">
                            {c.items.map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-block bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 mr-1 font-semibold border border-slate-200"
                              >
                                {it.itemType} {it.toothNumber ? `(T:${it.toothNumber})` : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600">
                          {c.sentDate ? c.sentDate.substring(0, 10) : '—'}
                        </td>
                        <td className="py-3 px-3.5">{renderStatusBadge(c.status)}</td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCase(c);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition cursor-pointer"
                          >
                            Manage Case
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. VIEW MODE: LAB CASES DIRECTORY                             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          {/* Search & Filter Bar - Rectangular Design */}
          <div className="bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by case number, patient name, patient code, lab name, or tooth number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-semibold text-slate-700 shrink-0"
              >
                <option value="ALL">All Statuses</option>
                <option value="SENT_TO_LAB">Sent to Lab</option>
                <option value="RECEIVED_FROM_LAB">Received from Lab</option>
                <option value="READY_FOR_HANDOVER">Ready for Handover</option>
                <option value="HANDED_OVER">Handed Over</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {/* Dental Item Type Filter */}
              <select
                value={itemTypeFilter}
                onChange={(e) => setItemTypeFilter(e.target.value)}
                className="text-xs px-3 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-semibold text-slate-700 shrink-0"
              >
                <option value="ALL">All Dental Items</option>
                <option value="CROWN">Crown</option>
                <option value="BRIDGE">Bridge</option>
                <option value="DENTURE">Denture</option>
                <option value="VENEER">Veneer</option>
                <option value="RETAINER">Retainer</option>
                <option value="SPLINT">Splint</option>
                <option value="OTHER">Other</option>
              </select>

              {/* Laboratory Filter */}
              {distinctLabs.length > 0 && (
                <select
                  value={labFilter}
                  onChange={(e) => setLabFilter(e.target.value)}
                  className="text-xs px-3 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-semibold text-slate-700 shrink-0"
                >
                  <option value="ALL">All Laboratories</option>
                  {distinctLabs.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}

              {/* Action Buttons */}
              <button
                type="button"
                onClick={fetchCases}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition shrink-0 cursor-pointer flex items-center gap-1.5"
                title="Refresh Cases"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
            </div>

            {/* Date Filters Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Sent Date Range:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-slate-300"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-slate-300"
                />
              </div>

              {(startDateFilter || endDateFilter || statusFilter !== 'ALL' || itemTypeFilter !== 'ALL' || labFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setItemTypeFilter('ALL');
                    setLabFilter('ALL');
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-bold ml-auto cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {/* Cases Table - Clean Rectangular Layout */}
          <div className="bg-white border border-slate-200">
            {loading ? (
              <div className="p-10 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-indigo-600 mb-2" />
                <span>Loading dental lab cases...</span>
              </div>
            ) : cases.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <FlaskConical className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No lab cases found.</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Try adjusting your search criteria or register a new external lab work order.
                </p>
                <button
                  type="button"
                  onClick={() => openCreateCaseView()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  + Create New Lab Case
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3.5">Case #</th>
                      <th className="py-3 px-3.5">Patient Details</th>
                      <th className="py-3 px-3.5">Laboratory</th>
                      <th className="py-3 px-3.5">Dental Item(s)</th>
                      <th className="py-3 px-3.5">Sent Date</th>
                      <th className="py-3 px-3.5">Received Date</th>
                      <th className="py-3 px-3.5">Handover Date</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">Attachments</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cases.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        {/* Case Number */}
                        <td className="py-3.5 px-3.5 font-mono font-bold text-indigo-900">
                          {c.caseNumber}
                        </td>

                        {/* Patient Name & Code */}
                        <td className="py-3.5 px-3.5">
                          <div className="font-bold text-slate-900">{c.patient.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {c.patient.patientCode} • {c.patient.mobile}
                          </div>
                        </td>

                        {/* Laboratory Name */}
                        <td className="py-3.5 px-3.5">
                          <div className="font-semibold text-slate-800">{c.labName}</div>
                          {c.labRefNumber && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Ref: {c.labRefNumber}
                            </div>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-3.5">
                          <div className="space-y-1">
                            {c.items && c.items.length > 0 ? (
                              c.items.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800">
                                    {it.itemType === 'OTHER' && it.customItemName
                                      ? it.customItemName
                                      : it.itemType}
                                  </span>
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 border border-slate-200">
                                    T: {it.toothNumber}
                                  </span>
                                  {it.shade && (
                                    <span className="text-[10px] bg-amber-50 text-amber-800 px-1 py-0.2 border border-amber-200">
                                      {it.shade}
                                    </span>
                                  )}
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">No items listed</span>
                            )}
                          </div>
                        </td>

                        {/* Sent Date */}
                        <td className="py-3.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {c.sentDate ? c.sentDate.substring(0, 10) : '—'}
                        </td>

                        {/* Received Date */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {c.receivedDate ? (
                            <span className="font-semibold text-amber-900">
                              {c.receivedDate.substring(0, 10)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Pending</span>
                          )}
                        </td>

                        {/* Handover Date */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {c.handoverDate ? (
                            <span className="font-bold text-emerald-800">
                              {c.handoverDate.substring(0, 10)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not handed over</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {renderStatusBadge(c.status)}
                        </td>

                        {/* Attachments Pills */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 border flex items-center gap-1 ${
                                (c.documents && c.documents.length > 0) || (c._count && c._count.documents > 0)
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="PDF Documents"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{c.documents ? c.documents.length : c._count?.documents || 0}</span>
                            </span>

                            <span
                              className={`text-[10px] px-1.5 py-0.5 border flex items-center gap-1 ${
                                (c.photos && c.photos.length > 0) || (c._count && c._count.photos > 0)
                                  ? 'bg-blue-50 text-blue-800 border-blue-200 font-bold'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="Item Photographs"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>{c.photos ? c.photos.length : c._count?.photos || 0}</span>
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Manage / Details Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCase(c);
                                setIsDetailModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition cursor-pointer"
                              title="View & Manage Case"
                            >
                              Manage
                            </button>

                            {/* Quick Handover Button if not handed over */}
                            {c.status !== 'HANDED_OVER' && c.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => handleOpenHandoverModal(c)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition cursor-pointer"
                                title="Record Patient Handover"
                              >
                                Handover
                              </button>
                            )}

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCase(c)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Delete Case"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. VIEW MODE: CREATE / EDIT LAB CASE                          */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'create' && (
        <form onSubmit={handleSaveLabCase} className="space-y-5">
          <div className="bg-white p-5 border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-indigo-600" />
                  <span>
                    {editingCaseId ? `Edit Lab Case` : `Create External Dental Lab Case`}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record work order sent to external laboratory, item specifications, tooth numbers, and patient details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setActiveTab('cases');
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
              >
                Back to Cases List
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* SECTION 1: Patient Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>1. Patient Details</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <PatientSearchSelect
                    label="Search & Select Registered Patient"
                    required
                    selectedPatient={formPatient}
                    onSelect={(p) => setFormPatient(p)}
                  />
                </div>

                {/* Optional Appointment Linking */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Link to Relevant Appointment / Visit (Optional)
                  </label>
                  <select
                    value={selectedAppointmentId}
                    onChange={(e) => setSelectedAppointmentId(e.target.value)}
                    disabled={!formPatient}
                    className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">-- No specific appointment linked --</option>
                    {patientAppointments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.appointmentCode} • {apt.appointmentDate.substring(0, 10)} • {apt.procedureName || apt.visitType}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Optional: Links this lab case to the clinical visit where the impression or prescription was taken.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 2: External Laboratory Details */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. External Laboratory Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Laboratory Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Dental Ceramic Lab"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. Sharma / Technician"
                    value={labContact}
                    onChange={(e) => setLabContact(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone / Mobile (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={labPhone}
                    onChange={(e) => setLabPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lab Ref / Work Order # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WO-2026-98"
                    value={labRefNumber}
                    onChange={(e) => setLabRefNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Timeline & Dates */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>3. Timeline & Dates</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date Sent to Lab <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={sentDate}
                    onChange={(e) => setSentDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Return Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: Dental Work Items (Multiple items per case supported) */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>4. Dental Items to Fabricate</span>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 font-bold">
                    {formItems.length}
                  </span>
                </h3>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Another Dental Item</span>
                </button>
              </div>

              <div className="space-y-3">
                {formItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-5 h-5 bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                          {index + 1}
                        </span>
                        <span>Dental Item Specification</span>
                      </span>

                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(index)}
                          className="text-slate-400 hover:text-rose-600 p-1 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Item</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Item Type <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={item.itemType}
                          onChange={(e) => handleItemChange(index, 'itemType', e.target.value)}
                          className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 font-semibold"
                        >
                          <option value="CROWN">Crown</option>
                          <option value="BRIDGE">Bridge</option>
                          <option value="DENTURE">Denture</option>
                          <option value="VENEER">Veneer</option>
                          <option value="RETAINER">Retainer</option>
                          <option value="SPLINT">Splint</option>
                          <option value="OTHER">Other Appliance</option>
                        </select>
                      </div>

                      {item.itemType === 'OTHER' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Specify Item Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Night Guard / Space Maintainer"
                            value={item.customItemName}
                            onChange={(e) => handleItemChange(index, 'customItemName', e.target.value)}
                            className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Tooth Number / Region <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 16, 17 or Upper Arch"
                          value={item.toothNumber}
                          onChange={(e) => handleItemChange(index, 'toothNumber', e.target.value)}
                          className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Material (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Zirconia / PFM / E-Max / Acrylic"
                          value={item.material}
                          onChange={(e) => handleItemChange(index, 'material', e.target.value)}
                          className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Shade (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. A1, A2, A3, BL2"
                          value={item.shade}
                          onChange={(e) => handleItemChange(index, 'shade', e.target.value)}
                          className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Work Description & Instructions for Technician (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Monolithic zirconia with stained fissure lines, tight interproximal contacts, clearance checked."
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 5: General Notes & Instructions */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>5. General Lab Notes & Instructions</span>
              </h3>

              <div>
                <textarea
                  rows={3}
                  placeholder="Additional notes for the laboratory, courier details, or special clinical remarks..."
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  className="w-full text-xs p-3 bg-white border border-slate-300 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* SECTION 6: Attach Documents & Photos during initial creation */}
            {!editingCaseId && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>6. Attach Documents (PDF) & Photos (Optional)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PDF Upload */}
                  <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-rose-600" />
                        <span>Lab Work-Order / PDF Documents</span>
                      </span>
                      <span className="text-[10px] text-slate-500">PDF only (max 15MB)</span>
                    </div>

                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setPendingDocsToUpload(Array.from(e.target.files));
                        }
                      }}
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-xs file:font-bold file:bg-slate-200 hover:file:bg-slate-300 file:text-slate-800 file:cursor-pointer"
                    />

                    {pendingDocsToUpload.length > 0 && (
                      <p className="text-[11px] text-indigo-700 font-bold">
                        {pendingDocsToUpload.length} PDF file(s) selected for upload upon save.
                      </p>
                    )}
                  </div>

                  {/* Photo Upload */}
                  <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        <span>Received Item Photographs</span>
                      </span>
                      <span className="text-[10px] text-slate-500">JPG, PNG (max 10MB)</span>
                    </div>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setPendingPhotosToUpload(Array.from(e.target.files));
                        }
                      }}
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-xs file:font-bold file:bg-slate-200 hover:file:bg-slate-300 file:text-slate-800 file:cursor-pointer"
                    />

                    {pendingPhotosToUpload.length > 0 && (
                      <p className="text-[11px] text-indigo-700 font-bold">
                        {pendingPhotosToUpload.length} image(s) selected for upload upon save.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setActiveTab('cases');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                {formSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Lab Case...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingCaseId ? 'Update Lab Case' : 'Register & Save Lab Case'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MODAL: DETAILED CASE MANAGEMENT VIEW                       */}
      {/* ------------------------------------------------------------- */}
      {isDetailModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {selectedCase.caseNumber}
                    </span>
                    {renderStatusBadge(selectedCase.status)}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Patient: <strong className="text-slate-800">{selectedCase.patient.name}</strong> ({selectedCase.patient.patientCode}) • Lab: <strong className="text-slate-800">{selectedCase.labName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditCaseView(selectedCase)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Status Action Buttons Ribbon */}
              <div className="p-3 bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="text-slate-500 font-semibold">Current State: </span>
                  <span className="font-bold text-slate-800">{selectedCase.status.replace(/_/g, ' ')}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Mark as Received button */}
                  {selectedCase.status === 'SENT_TO_LAB' && (
                    <button
                      type="button"
                      onClick={() => handleOpenReceiveModal(selectedCase)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Record Items Received from Lab</span>
                    </button>
                  )}

                  {/* Mark as Ready for Handover button */}
                  {selectedCase.status === 'RECEIVED_FROM_LAB' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await api.patch(`/lab/cases/${selectedCase.id}/status`, {
                          status: 'READY_FOR_HANDOVER',
                        });
                        refreshCaseDetails(selectedCase.id);
                        fetchDashboard();
                        fetchCases();
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Mark Ready for Patient Handover</span>
                    </button>
                  )}

                  {/* Patient Handover Button */}
                  {selectedCase.status !== 'HANDED_OVER' && selectedCase.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => handleOpenHandoverModal(selectedCase)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Record Patient Handover</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Handover Completed Notice */}
              {selectedCase.status === 'HANDED_OVER' && selectedCase.handoverDate && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Work Handed Over on {selectedCase.handoverDate.substring(0, 10)} to {selectedCase.patient.name} ({selectedCase.patient.patientCode})
                    </span>
                  </div>
                  {selectedCase.handoverNotes && (
                    <p className="mt-1 text-[11px] text-emerald-800 italic">
                      Remarks: "{selectedCase.handoverNotes}"
                    </p>
                  )}
                </div>
              )}

              {/* Patient & Laboratory Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Patient Details
                  </span>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedCase.patient.name}</span>
                    <span className="bg-slate-200 text-slate-700 font-mono text-[10px] px-1.5 py-0.2">
                      {selectedCase.patient.patientCode}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div>Mobile: {selectedCase.patient.mobile}</div>
                    <div>
                      {selectedCase.patient.gender} • {selectedCase.patient.age} yrs
                    </div>
                    {selectedCase.patient.medicalAlerts && (
                      <div className="text-amber-700 font-bold">
                        Alerts: {selectedCase.patient.medicalAlerts}
                      </div>
                    )}
                  </div>
                </div>

                {/* Laboratory Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Laboratory Details & Timeline
                  </span>
                  <div className="text-xs font-bold text-slate-900">{selectedCase.labName}</div>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    {selectedCase.labRefNumber && (
                      <div>Lab Ref / Order #: <span className="font-mono font-bold">{selectedCase.labRefNumber}</span></div>
                    )}
                    {selectedCase.labContact && <div>Contact: {selectedCase.labContact}</div>}
                    {selectedCase.labPhone && <div>Phone: {selectedCase.labPhone}</div>}
                    <div className="pt-1 flex items-center gap-3 text-[10px] text-slate-500">
                      <span>Sent: <strong>{selectedCase.sentDate.substring(0, 10)}</strong></span>
                      {selectedCase.expectedDate && (
                        <span>Return Date: <strong>{selectedCase.expectedDate.substring(0, 10)}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dental Items Table */}
              <div className="border border-slate-200">
                <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>Dental Items Ordered ({selectedCase.items?.length || 0})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Tooth #</th>
                        <th className="py-2 px-3">Material</th>
                        <th className="py-2 px-3">Shade</th>
                        <th className="py-2 px-3">Instructions</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedCase.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {it.itemType === 'OTHER' && it.customItemName
                              ? it.customItemName
                              : it.itemType}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-indigo-900 font-mono">
                            {it.toothNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{it.material || '—'}</td>
                          <td className="py-2.5 px-3">
                            {it.shade ? (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[10px]">
                                {it.shade}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs">
                            {it.description || '—'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {renderStatusBadge(it.status || selectedCase.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Notes if present */}
              {selectedCase.generalNotes && (
                <div className="p-3 bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">General Notes:</span>
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedCase.generalNotes}</p>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* LAB DOCUMENTS (PDF UPLOAD & PREVIEW)                          */}
              {/* ------------------------------------------------------------- */}
              <div className="border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Lab Documents (PDF Work Orders & Reports)
                    </h4>
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.2">
                      {selectedCase.documents?.length || 0}
                    </span>
                  </div>

                  <div>
                    <input
                      ref={docInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      onChange={handleUploadDocumentsModal}
                      className="hidden"
                      id="doc-upload-input"
                    />
                    <label
                      htmlFor="doc-upload-input"
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingDoc ? 'Uploading...' : '+ Attach PDF'}</span>
                    </label>
                  </div>
                </div>

                {selectedCase.documents && selectedCase.documents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedCase.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 truncate" title={doc.originalName}>
                              {doc.originalName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatBytes(doc.sizeBytes)} • {doc.uploadedAt ? doc.uploadedAt.substring(0, 10) : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Preview PDF */}
                          <a
                            href={`/api/lab/documents/${doc.id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                            title="Preview PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>

                          {/* Download PDF */}
                          <a
                            href={`/api/lab/documents/${doc.id}/download`}
                            download
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Delete Document */}
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-1">
                    No PDF documents attached yet. Click "+ Attach PDF" to upload work orders, invoices, or lab reports.
                  </p>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* RECEIVED ITEM PHOTOS (PHOTO UPLOAD & GALLERY)                 */}
              {/* ------------------------------------------------------------- */}
              <div className="border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Received Dental Items – Photographs
                    </h4>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2">
                      {selectedCase.photos?.length || 0}
                    </span>
                  </div>

                  <div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      multiple
                      onChange={handleUploadPhotosModal}
                      className="hidden"
                      id="photo-upload-input"
                    />
                    <label
                      htmlFor="photo-upload-input"
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingPhoto ? 'Uploading...' : '+ Upload Photos'}</span>
                    </label>
                  </div>
                </div>

                {selectedCase.photos && selectedCase.photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedCase.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="bg-slate-50 border border-slate-200 overflow-hidden group flex flex-col justify-between"
                      >
                        <div
                          className="relative aspect-square overflow-hidden bg-slate-900 cursor-pointer"
                          onClick={() => setPreviewPhotoUrl(`/api/lab/photos/${photo.id}`)}
                        >
                          <img
                            src={`/api/lab/photos/${photo.id}`}
                            alt={photo.originalName}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-5 h-5" />
                          </div>
                        </div>

                        <div className="p-2 space-y-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate" title={photo.originalName}>
                            {photo.originalName}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>{formatBytes(photo.sizeBytes)}</span>
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Delete Photo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {photo.notes && (
                            <p className="text-[10px] text-slate-600 italic truncate" title={photo.notes}>
                              {photo.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-1">
                    No received item photos uploaded yet. Click "+ Upload Photos" to attach pictures of crowns, bridges, or dentures received from the lab.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => handleDeleteCase(selectedCase)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Case</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-300 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. MODAL: RECORD RECEIVED ITEMS FROM LAB                      */}
      {/* ------------------------------------------------------------- */}
      {isReceiveModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span>Record Received from Laboratory</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Confirm receiving dental fabrication from <strong>{selectedCase.labName}</strong> for patient{' '}
              <strong>{selectedCase.patient.name}</strong> ({selectedCase.patient.patientCode}).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Actual Received Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Inspection Notes / Observations (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Fit verified on master model, shade matches A2 guide, margins sealed."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="makeReadyCheck"
                  checked={makeReadyForHandover}
                  onChange={(e) => setMakeReadyForHandover(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded-none cursor-pointer"
                />
                <label htmlFor="makeReadyCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Mark status as "Ready for Patient Handover" immediately
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReceive}
                disabled={receiveSubmitting}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                {receiveSubmitting ? 'Saving...' : 'Confirm Received'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: RECORD PATIENT HANDOVER                             */}
      {/* ------------------------------------------------------------- */}
      {isHandoverModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Record Patient Handover</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsHandoverModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 space-y-1 text-xs">
              <p className="font-bold text-emerald-900">
                Patient: {selectedCase.patient.name}
              </p>
              <p className="text-emerald-800 font-mono">
                Patient ID: {selectedCase.patient.patientCode}
              </p>
              <div className="pt-1 text-[11px] text-emerald-700">
                Item(s):{' '}
                <strong>
                  {selectedCase.items?.map((it) => `${it.itemType} (T:${it.toothNumber})`).join(', ') || 'Dental Appliance'}
                </strong>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Actual Handover Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Handover Remarks & Clinical Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Delivered and cemented with RelyX luting cement. Occlusion checked, contact points verified. Patient comfortable and satisfied."
                  value={handoverRemarks}
                  onChange={(e) => setHandoverRemarks(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsHandoverModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmHandover}
                disabled={handoverSubmitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                {handoverSubmitting ? 'Recording...' : 'Confirm Handover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. LIGHTBOX IMAGE PREVIEW MODAL                               */}
      {/* ------------------------------------------------------------- */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewPhotoUrl}
              alt="Dental item photograph"
              className="max-w-full max-h-[85vh] object-contain border border-slate-700 shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 font-bold text-sm flex items-center gap-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
              <span>Close Preview</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DentalLabModule;
