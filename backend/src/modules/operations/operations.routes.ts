import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { authenticateToken } from '../../middleware/auth';
import { emitRealtimeEvent } from '../../sockets';
import { ProcedureStatus, PaymentMode, PaymentStatus } from '@prisma/client';

const router = Router();

// GET /api/procedures/masters
router.get('/masters', authenticateToken, async (req: Request, res: Response) => {
  try {
    const masters = await prisma.procedureMaster.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, masters });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/procedures/history - Grouped Clinical & Treatment History by patient and visit date
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.query;
    const patientFilter = patientId ? { patientId: String(patientId) } : {};

    const [clinicalNotes, procedures, pharmacySales] = await Promise.all([
      prisma.clinicalNote.findMany({
        where: patientFilter,
        include: {
          patient: { select: { id: true, name: true, patientCode: true, mobile: true, age: true, gender: true } },
          doctor: { include: { user: { select: { fullName: true } } } },
          appointment: true,
          procedures: true,
        },
        orderBy: { consultationDate: 'desc' },
      }),
      prisma.procedure.findMany({
        where: patientFilter,
        include: {
          patient: { select: { id: true, name: true, patientCode: true, mobile: true, age: true, gender: true } },
          doctor: { include: { user: { select: { fullName: true } } } },
          procedureMaster: true,
          operationInvoice: { include: { payments: true } },
        },
        orderBy: { procedureDate: 'desc' },
      }),
      prisma.pharmacySale.findMany({
        where: patientFilter,
        include: {
          items: { include: { medicine: true, batchStock: true } },
        },
        orderBy: { saleDate: 'desc' },
      }),
    ]);

    // Group records by patientId and date (YYYY-MM-DD)
    const visitsMap = new Map<string, any>();

    const toDateKey = (d: any) => {
      const date = new Date(d);
      return isNaN(date.getTime()) ? 'Unspecified Date' : date.toISOString().substring(0, 10);
    };

    // 1. Ingest Clinical Notes
    clinicalNotes.forEach((cn) => {
      const dateKey = toDateKey(cn.consultationDate);
      const visitKey = `${cn.patientId}_${dateKey}`;

      if (!visitsMap.has(visitKey)) {
        visitsMap.set(visitKey, {
          id: visitKey,
          visitDate: dateKey,
          patientId: cn.patientId,
          patient: cn.patient,
          consultingDoctors: [],
          clinicalNotes: [],
          procedures: [],
          prescriptions: [],
          prescribedMedications: [],
          appointment: cn.appointment || null,
        });
      }

      const visit = visitsMap.get(visitKey);
      visit.clinicalNotes.push(cn);

      const docName = cn.doctor?.user?.fullName;
      if (docName && !visit.consultingDoctors.some((d: any) => d.name === docName)) {
        visit.consultingDoctors.push({
          id: cn.doctor.id,
          name: docName,
          specialization: cn.doctor.specialization,
        });
      }
    });

    // 2. Ingest Procedures
    procedures.forEach((pr) => {
      const dateKey = toDateKey(pr.procedureDate);
      const visitKey = `${pr.patientId}_${dateKey}`;

      if (!visitsMap.has(visitKey)) {
        visitsMap.set(visitKey, {
          id: visitKey,
          visitDate: dateKey,
          patientId: pr.patientId,
          patient: pr.patient,
          consultingDoctors: [],
          clinicalNotes: [],
          procedures: [],
          prescriptions: [],
          prescribedMedications: [],
          appointment: null,
        });
      }

      const visit = visitsMap.get(visitKey);
      visit.procedures.push(pr);

      // Collect prescribed medications from procedures into the visit level
      if (Array.isArray(pr.prescribedMedications) && pr.prescribedMedications.length > 0) {
        pr.prescribedMedications.forEach((med: any) => {
          if (med && med.name && !visit.prescribedMedications.some((m: any) => m.name === med.name && m.dosage === med.dosage && m.frequency === med.frequency)) {
            visit.prescribedMedications.push(med);
          }
        });
      }

      const docName = pr.doctor?.user?.fullName || pr.dentistName;
      if (docName && !visit.consultingDoctors.some((d: any) => d.name === docName)) {
        visit.consultingDoctors.push({
          id: pr.doctor?.id || null,
          name: docName,
          specialization: pr.doctor?.specialization || 'DENTAL',
        });
      }
    });

    // 3. Ingest Pharmacy Sales / Medicines
    pharmacySales.forEach((sale) => {
      const dateKey = toDateKey(sale.saleDate);
      const visitKey = `${sale.patientId}_${dateKey}`;

      if (visitsMap.has(visitKey)) {
        const visit = visitsMap.get(visitKey);
        visit.prescriptions.push(sale);
      }
    });

    // Convert to sorted array
    const visits = Array.from(visitsMap.values()).sort((a, b) => {
      return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
    });

    res.json({
      success: true,
      visits,
      totalVisits: visits.length,
      totalNotes: clinicalNotes.length,
      totalProcedures: procedures.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/procedures
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patientId, doctorId, status } = req.query;
    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const procedures = await prisma.procedure.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, patientCode: true, mobile: true } },
        doctor: { include: { user: { select: { fullName: true } } } },
        procedureMaster: true,
        operationInvoice: { include: { payments: true } },
      },
      orderBy: { procedureDate: 'desc' },
    });

    res.json({ success: true, procedures });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate sequential procedure code: PROC-2026-00001
async function generateProcedureCode(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PROC-${currentYear}-`;
  const lastProc = await prisma.procedure.findFirst({
    where: { procedureCode: { startsWith: prefix } },
    orderBy: { procedureCode: 'desc' },
  });

  if (!lastProc) return `${prefix}00001`;
  const parts = lastProc.procedureCode.split('-');
  const seq = parseInt(parts[2] || '0', 10) + 1;
  return `${prefix}${seq.toString().padStart(5, '0')}`;
}

const medicationEntrySchema = z.object({
  name: z.string().min(1, 'Medicine name is required'),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// POST /api/procedures - Create / Schedule a Procedure (Supports single or multiple procedures)
const createProcedureSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  patientCode: z.string().optional().nullable(),
  doctorId: z.string().optional().nullable(),
  dentistName: z.string().optional().nullable(),
  procedureMasterId: z.string().optional().nullable(),
  procedureName: z.string().optional().nullable(),
  procedureNames: z.array(z.string()).optional().nullable(),
  procedureDate: z.string().min(1, 'Procedure date is required'),
  toothNumber: z.string().optional().nullable(),
  charges: z.number().min(0).optional().default(0),
  clinicalNotes: z.string().optional().nullable(),
  procedureDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.string().optional().default('PLANNED'),
  clinicalNoteId: z.string().optional().nullable(),
  prescribedMedications: z.array(medicationEntrySchema).optional().nullable(),
});

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const data = createProcedureSchema.parse(req.body);

    // 1. Validate Patient
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [{ id: data.patientId }, { patientCode: data.patientId }],
      },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Selected patient not found' });
    }

    // 2. Resolve Procedure Names (support multiple or single)
    let procNames: string[] = [];
    if (Array.isArray(data.procedureNames) && data.procedureNames.length > 0) {
      procNames = data.procedureNames.map((n) => n.trim()).filter((n) => n.length > 0);
    } else if (data.procedureName && data.procedureName.trim().length > 0) {
      procNames = [data.procedureName.trim()];
    } else {
      procNames = ['Consultation'];
    }
    // Remove accidental duplicate entries in the same submission list
    procNames = Array.from(new Set(procNames));

    // 3. Resolve Doctor / Dentist Name
    let resolvedDoctorId: string | null = data.doctorId || null;
    let resolvedDentistName: string | null = data.dentistName?.trim() || null;

    if (resolvedDoctorId) {
      const doc = await prisma.doctor.findUnique({
        where: { id: resolvedDoctorId },
        include: { user: { select: { fullName: true } } },
      });
      if (doc) {
        if (!resolvedDentistName) resolvedDentistName = doc.user.fullName;
      } else {
        resolvedDoctorId = null;
      }
    }

    // 4. Resolve Procedure Status
    let normalizedStatus: ProcedureStatus = ProcedureStatus.PLANNED;
    const rawStatus = (data.status || 'PLANNED').toUpperCase().replace(/[\s-]+/g, '_');
    if (rawStatus === 'COMPLETED') {
      normalizedStatus = ProcedureStatus.COMPLETED;
    } else if (rawStatus === 'IN_PROGRESS') {
      normalizedStatus = ProcedureStatus.IN_PROGRESS;
    } else if (rawStatus === 'SCHEDULED') {
      normalizedStatus = ProcedureStatus.SCHEDULED;
    } else if (rawStatus === 'CANCELLED') {
      normalizedStatus = ProcedureStatus.CANCELLED;
    } else {
      normalizedStatus = ProcedureStatus.PLANNED;
    }

    // 5. Clinical notes / Description
    const clinicalNotes =
      data.clinicalNotes?.trim() ||
      data.procedureDescription?.trim() ||
      data.description?.trim() ||
      null;

    const parsedDate = new Date(data.procedureDate);

    // 6. Prevent accidental rapid double-submission (within 4 seconds for same patient and procedure names)
    const recentDuplicate = await prisma.procedure.findMany({
      where: {
        patientId: patient.id,
        procedureName: { in: procNames },
        toothNumber: data.toothNumber?.trim() || null,
        createdAt: { gte: new Date(Date.now() - 4000) },
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true, mobile: true } },
        doctor: { include: { user: { select: { fullName: true } } } },
        procedureMaster: true,
      },
    });

    if (recentDuplicate.length >= procNames.length) {
      return res.status(200).json({
        success: true,
        message: 'Procedures already saved (duplicate submission prevented)',
        procedure: recentDuplicate[0],
        procedures: recentDuplicate,
      });
    }

    // Filter prescribed medications (clinical documentation only - not linked to pharmacy or billing)
    const validMedications = (data.prescribedMedications || [])
      .filter((m) => m && typeof m.name === 'string' && m.name.trim().length > 0)
      .map((m) => ({
        name: m.name.trim(),
        dosage: m.dosage?.trim() || null,
        frequency: m.frequency?.trim() || null,
        duration: m.duration?.trim() || null,
        instructions: m.instructions?.trim() || null,
        notes: m.notes?.trim() || null,
      }));

    // 7. Create each procedure record
    const createdProcedures = [];
    for (const procName of procNames) {
      // Lookup procedure master if exists
      let matchedMasterId: string | null = null;
      let standardCharge = 0;

      const master = await prisma.procedureMaster.findFirst({
        where: { name: { equals: procName, mode: 'insensitive' } },
      });
      if (master) {
        matchedMasterId = master.id;
        standardCharge = master.standardCharge;
      }

      // Calculate charges
      let procCharge = standardCharge;
      if (data.charges && data.charges > 0) {
        if (procNames.length === 1) {
          procCharge = data.charges;
        } else if (standardCharge > 0) {
          procCharge = standardCharge;
        } else {
          procCharge = Math.round(data.charges / procNames.length);
        }
      }

      const procedureCode = await generateProcedureCode();

      const created = await prisma.procedure.create({
        data: {
          procedureCode,
          patientId: patient.id,
          doctorId: resolvedDoctorId,
          dentistName: resolvedDentistName,
          procedureMasterId: matchedMasterId,
          procedureName: procName,
          toothNumber: data.toothNumber?.trim() || null,
          procedureDate: parsedDate,
          charges: procCharge,
          clinicalNotes,
          clinicalNoteId: data.clinicalNoteId?.trim() || null,
          status: normalizedStatus,
          prescribedMedications: validMedications.length > 0 ? (validMedications as any) : undefined,
        },
        include: {
          patient: { select: { id: true, name: true, patientCode: true, mobile: true } },
          doctor: { include: { user: { select: { fullName: true } } } },
          procedureMaster: true,
        },
      });

      emitRealtimeEvent('procedure:scheduled', created);
      emitRealtimeEvent('procedure:created', created);
      createdProcedures.push(created);
    }

    res.status(201).json({
      success: true,
      message:
        createdProcedures.length === 1
          ? 'Procedure created successfully'
          : `${createdProcedures.length} procedures created successfully`,
      procedure: createdProcedures[0],
      procedures: createdProcedures,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, errors: err.errors });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/procedures/:id/status - Update procedure status (e.g. mark COMPLETED and send to billing queue)
router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const rawStatus = (status || 'COMPLETED').toUpperCase().replace(/[\s-]+/g, '_');
    let targetStatus: ProcedureStatus = ProcedureStatus.COMPLETED;
    if (rawStatus === 'IN_PROGRESS') targetStatus = ProcedureStatus.IN_PROGRESS;
    else if (rawStatus === 'PLANNED') targetStatus = ProcedureStatus.PLANNED;
    else if (rawStatus === 'CANCELLED') targetStatus = ProcedureStatus.CANCELLED;
    else if (rawStatus === 'SCHEDULED') targetStatus = ProcedureStatus.SCHEDULED;
    else targetStatus = ProcedureStatus.COMPLETED;

    const proc = await prisma.procedure.update({
      where: { id },
      data: { status: targetStatus },
      include: {
        patient: { select: { id: true, name: true, patientCode: true, mobile: true } },
        doctor: { include: { user: { select: { fullName: true } } } },
        procedureMaster: true,
        operationInvoice: true,
      },
    });

    emitRealtimeEvent('procedure:completed', proc);
    emitRealtimeEvent('procedure:updated', proc);

    res.json({
      success: true,
      message: `Procedure ${proc.procedureCode} status updated to ${proc.status} and sent to Billing queue`,
      procedure: proc,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/procedures/:id/complete - Mark Completed & Generate Separate Operation Invoice
const completeOperationSchema = z.object({
  consumablesFee: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  paymentMode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
  notes: z.string().optional(),
});

router.post('/:id/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = completeOperationSchema.parse(req.body);

    const proc = await prisma.procedure.findUnique({
      where: { id },
      include: { operationInvoice: true },
    });

    if (!proc) {
      return res.status(404).json({ success: false, message: 'Procedure not found' });
    }

    if (proc.operationInvoice) {
      return res.status(400).json({ success: false, message: 'Operation invoice already generated for this procedure' });
    }

    const subTotal = Math.max(0, proc.charges + data.consumablesFee - data.discount);
    const taxAmount = (subTotal * data.taxRate) / 100;
    const totalAmount = Math.round((subTotal + taxAmount) * 100) / 100;
    const paidAmount = Math.min(totalAmount, data.paidAmount);
    const pendingBalance = Math.round((totalAmount - paidAmount) * 100) / 100;

    const paymentStatus = pendingBalance <= 0 ? PaymentStatus.PAID : paidAmount > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID;

    const billCount = await prisma.operationBill.count();
    const invoiceNumber = `OBILL-${new Date().getFullYear()}-${(billCount + 1).toString().padStart(5, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark procedure completed
      const updatedProc = await tx.procedure.update({
        where: { id },
        data: { status: ProcedureStatus.COMPLETED },
      });

      // 2. Create Operation Bill
      const bill = await tx.operationBill.create({
        data: {
          invoiceNumber,
          procedureId: id,
          procedureFee: proc.charges,
          consumablesFee: data.consumablesFee,
          discount: data.discount,
          taxRate: data.taxRate,
          taxAmount,
          totalAmount,
          paidAmount,
          pendingBalance,
          paymentStatus,
        },
      });

      // 3. Receipt if paid
      let receipt = null;
      if (paidAmount > 0) {
        const pCount = await tx.payment.count();
        const receiptNumber = `RCP-${new Date().getFullYear()}-${(pCount + 1).toString().padStart(5, '0')}`;
        receipt = await tx.payment.create({
          data: {
            receiptNumber,
            amount: paidAmount,
            paymentMode: data.paymentMode,
            operationBillId: bill.id,
            notes: data.notes || `Operation invoice payment ${invoiceNumber}`,
          },
        });
      }

      return { updatedProc, bill, receipt };
    });

    emitRealtimeEvent('procedure:completed', result);

    res.json({
      success: true,
      message: 'Operation completed and invoice generated successfully',
      operation: result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, errors: err.errors });
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
