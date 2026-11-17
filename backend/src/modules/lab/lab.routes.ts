import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../../config/prisma';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { emitRealtimeEvent } from '../../sockets';
import { LabCaseStatus, LabItemType } from '@prisma/client';

const router = Router();

// Configure Multer for in-memory file buffers (max 20MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

// Helper: Generate next sequential Case Number (LAB-2026-00001)
async function generateLabCaseNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `LAB-${currentYear}-`;

  const cases = await prisma.labCase.findMany({
    where: {
      caseNumber: {
        startsWith: prefix,
      },
    },
    select: {
      caseNumber: true,
    },
  });

  let maxSeq = 0;
  for (const c of cases) {
    const parts = c.caseNumber.split('-');
    const num = parseInt(parts[2] || '0', 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${nextSeq.toString().padStart(5, '0')}`;
}

// -------------------------------------------------------------
// 1. DASHBOARD COUNTS (Real database-derived counts)
// -------------------------------------------------------------
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalCases,
      reportsThisMonth,
      reportsToday,
      reportsWithPdf,
      sentToLab,
      receivedFromLab,
      readyForHandover,
      handedOver,
    ] = await Promise.all([
      prisma.labCase.count(),
      prisma.labCase.count({ where: { sentDate: { gte: startOfMonth } } }),
      prisma.labCase.count({ where: { sentDate: { gte: startOfToday } } }),
      prisma.labCase.count({ where: { documents: { some: {} } } }),
      prisma.labCase.count({ where: { status: LabCaseStatus.SENT_TO_LAB } }),
      prisma.labCase.count({ where: { status: LabCaseStatus.RECEIVED_FROM_LAB } }),
      prisma.labCase.count({ where: { status: LabCaseStatus.READY_FOR_HANDOVER } }),
      prisma.labCase.count({ where: { status: LabCaseStatus.HANDED_OVER } }),
    ]);

    const recentCases = await prisma.labCase.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            name: true,
            mobile: true,
            age: true,
            gender: true,
          },
        },
        items: true,
        documents: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
          },
        },
        _count: {
          select: {
            documents: true,
            photos: true,
          },
        },
      },
    });

    res.json({
      success: true,
      counts: {
        totalCases,
        totalReports: totalCases,
        reportsThisMonth,
        reportsToday,
        reportsWithPdf,
        sentToLab,
        receivedFromLab,
        readyForHandover,
        handedOver,
      },
      recentCases,
    });
  } catch (err: any) {
    console.error('Error fetching lab dashboard metrics:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch lab dashboard counts' });
  }
});

// -------------------------------------------------------------
// 2. LIST CASES (Search, filter by status, lab, item type, date)
// -------------------------------------------------------------
router.get('/cases', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      itemType,
      testType,
      labName,
      patientId,
      startDate,
      endDate,
    } = req.query;

    const where: any = {};

    if (patientId) {
      where.patientId = String(patientId);
    }

    if (status && Object.values(LabCaseStatus).includes(status as LabCaseStatus)) {
      where.status = status as LabCaseStatus;
    }

    if (labName && String(labName).trim()) {
      where.labName = {
        contains: String(labName).trim(),
        mode: 'insensitive',
      };
    }

    if (itemType && Object.values(LabItemType).includes(itemType as LabItemType)) {
      where.items = {
        some: {
          itemType: itemType as LabItemType,
        },
      };
    }

    if (testType && String(testType).trim() && String(testType) !== 'ALL') {
      where.items = {
        some: {
          customItemName: {
            contains: String(testType).trim(),
            mode: 'insensitive',
          },
        },
      };
    }

    if (startDate || endDate) {
      where.sentDate = {};
      if (startDate) {
        where.sentDate.gte = new Date(String(startDate));
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        where.sentDate.lte = end;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { caseNumber: { contains: q, mode: 'insensitive' } },
        { labName: { contains: q, mode: 'insensitive' } },
        { labRefNumber: { contains: q, mode: 'insensitive' } },
        { generalNotes: { contains: q, mode: 'insensitive' } },
        {
          patient: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { patientCode: { contains: q, mode: 'insensitive' } },
              { mobile: { contains: q } },
            ],
          },
        },
        {
          items: {
            some: {
              OR: [
                { toothNumber: { contains: q, mode: 'insensitive' } },
                { material: { contains: q, mode: 'insensitive' } },
                { customItemName: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const cases = await prisma.labCase.findMany({
      where,
      orderBy: { sentDate: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            name: true,
            mobile: true,
            age: true,
            gender: true,
          },
        },
        appointment: {
          select: {
            id: true,
            appointmentCode: true,
            appointmentDate: true,
            procedureName: true,
          },
        },
        items: true,
        documents: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
          },
        },
        photos: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            notes: true,
            receivedDate: true,
            uploadedAt: true,
          },
        },
      },
    });

    res.json({
      success: true,
      total: cases.length,
      cases,
    });
  } catch (err: any) {
    console.error('Error listing lab cases:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve lab cases' });
  }
});

// -------------------------------------------------------------
// 3. GET SINGLE CASE BY ID
// -------------------------------------------------------------
router.get('/cases/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const labCase = await prisma.labCase.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            name: true,
            mobile: true,
            age: true,
            gender: true,
            medicalAlerts: true,
          },
        },
        appointment: {
          select: {
            id: true,
            appointmentCode: true,
            appointmentDate: true,
            procedureName: true,
            doctor: {
              select: {
                user: {
                  select: { fullName: true },
                },
              },
            },
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
        photos: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            notes: true,
            receivedDate: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!labCase) {
      return res.status(404).json({ success: false, message: 'Lab case not found' });
    }

    res.json({ success: true, case: labCase });
  } catch (err: any) {
    console.error('Error fetching lab case detail:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch lab case' });
  }
});

// -------------------------------------------------------------
// 4. CREATE LAB CASE / REPORT
// -------------------------------------------------------------
const createLabItemSchema = z.object({
  itemType: z.nativeEnum(LabItemType).default(LabItemType.OTHER),
  customItemName: z.string().optional().nullable(),
  toothNumber: z.string().optional().default('N/A'),
  material: z.string().optional().nullable(),
  shade: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const createLabCaseSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  appointmentId: z.string().optional().nullable(),
  labName: z.string().optional().nullable().default('Diagnostic Laboratory'),
  labContact: z.string().optional().nullable(),
  labPhone: z.string().optional().nullable(),
  labEmail: z.string().optional().nullable(),
  labRefNumber: z.string().optional().nullable(),
  sentDate: z.string().optional(),
  expectedDate: z.string().optional().nullable(),
  generalNotes: z.string().optional().nullable(),
  testType: z.string().optional().nullable(),
  status: z.nativeEnum(LabCaseStatus).optional().default(LabCaseStatus.RECEIVED_FROM_LAB),
  items: z.array(createLabItemSchema).optional().default([]),
});

router.post('/cases', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createLabCaseSchema.parse(req.body);

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: parsed.patientId },
    });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Selected patient not found' });
    }

    const caseNumber = await generateLabCaseNumber();
    const finalLabName = parsed.labName?.trim() || 'Diagnostic Laboratory';
    const testTitle = parsed.testType?.trim() || 'Diagnostic Lab Report';
    const caseStatus = parsed.status || LabCaseStatus.RECEIVED_FROM_LAB;

    const itemsToCreate = (parsed.items && parsed.items.length > 0)
      ? parsed.items.map((item) => ({
          itemType: item.itemType || LabItemType.OTHER,
          customItemName: item.customItemName?.trim() || testTitle,
          toothNumber: item.toothNumber?.trim() || 'N/A',
          material: item.material?.trim() || null,
          shade: item.shade?.trim() || null,
          description: item.description?.trim() || parsed.generalNotes?.trim() || null,
          status: caseStatus,
        }))
      : [{
          itemType: LabItemType.OTHER,
          customItemName: testTitle,
          toothNumber: 'N/A',
          material: null,
          shade: null,
          description: parsed.generalNotes?.trim() || null,
          status: caseStatus,
        }];

    const newCase = await prisma.labCase.create({
      data: {
        caseNumber,
        patientId: parsed.patientId,
        appointmentId: parsed.appointmentId || null,
        labName: finalLabName,
        labContact: parsed.labContact?.trim() || null,
        labPhone: parsed.labPhone?.trim() || null,
        labEmail: parsed.labEmail?.trim() || null,
        labRefNumber: parsed.labRefNumber?.trim() || null,
        status: caseStatus,
        sentDate: parsed.sentDate ? new Date(parsed.sentDate) : new Date(),
        receivedDate: new Date(),
        expectedDate: parsed.expectedDate ? new Date(parsed.expectedDate) : null,
        generalNotes: parsed.generalNotes?.trim() || null,
        createdById: req.user?.id || null,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            name: true,
            mobile: true,
          },
        },
        items: true,
      },
    });

    emitRealtimeEvent('lab:created', newCase);

    res.status(201).json({
      success: true,
      message: `Lab report ${newCase.caseNumber} recorded successfully`,
      case: newCase,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: err.errors[0]?.message || 'Validation error' });
    }
    console.error('Error creating lab case:', err);
    res.status(500).json({ success: false, message: 'Failed to create lab case' });
  }
});

// -------------------------------------------------------------
// 5. UPDATE LAB CASE DETAILS
// -------------------------------------------------------------
router.put('/cases/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      labName,
      labContact,
      labPhone,
      labEmail,
      labRefNumber,
      sentDate,
      expectedDate,
      generalNotes,
      testType,
      items,
    } = req.body;

    const existing = await prisma.labCase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Lab case not found' });
    }

    // Update main case details
    const updated = await prisma.$transaction(async (tx) => {
      // If items array is provided, replace or update
      if (Array.isArray(items) && items.length > 0) {
        // Delete items that are no longer present
        await tx.labItem.deleteMany({
          where: { labCaseId: id },
        });

        // Insert fresh items preserving status
        await tx.labItem.createMany({
          data: items.map((item: any) => ({
            labCaseId: id,
            itemType: item.itemType || LabItemType.OTHER,
            customItemName: item.customItemName?.trim() || null,
            toothNumber: String(item.toothNumber || 'N/A').trim(),
            material: item.material?.trim() || null,
            shade: item.shade?.trim() || null,
            description: item.description?.trim() || null,
            status: item.status || existing.status,
            receivedDate: item.receivedDate ? new Date(item.receivedDate) : existing.receivedDate,
            handoverDate: item.handoverDate ? new Date(item.handoverDate) : existing.handoverDate,
          })),
        });
      } else if (testType && existing.items.length > 0) {
        await tx.labItem.update({
          where: { id: existing.items[0].id },
          data: {
            customItemName: String(testType).trim(),
            description: generalNotes !== undefined ? (generalNotes?.trim() || null) : existing.items[0].description,
          },
        });
      }

      return tx.labCase.update({
        where: { id },
        data: {
          labName: labName !== undefined ? labName.trim() : existing.labName,
          labContact: labContact !== undefined ? (labContact?.trim() || null) : existing.labContact,
          labPhone: labPhone !== undefined ? (labPhone?.trim() || null) : existing.labPhone,
          labEmail: labEmail !== undefined ? (labEmail?.trim() || null) : existing.labEmail,
          labRefNumber: labRefNumber !== undefined ? (labRefNumber?.trim() || null) : existing.labRefNumber,
          sentDate: sentDate ? new Date(sentDate) : existing.sentDate,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          generalNotes: generalNotes !== undefined ? (generalNotes?.trim() || null) : existing.generalNotes,
        },
        include: {
          patient: {
            select: {
              id: true,
              patientCode: true,
              name: true,
              mobile: true,
            },
          },
          items: true,
          documents: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              uploadedAt: true,
            },
          },
          photos: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              notes: true,
              receivedDate: true,
              uploadedAt: true,
            },
          },
        },
      });
    });

    emitRealtimeEvent('lab:updated', updated);

    res.json({
      success: true,
      message: 'Lab case updated successfully',
      case: updated,
    });
  } catch (err: any) {
    console.error('Error updating lab case:', err);
    res.status(500).json({ success: false, message: 'Failed to update lab case' });
  }
});

// -------------------------------------------------------------
// 6. RECORD RECEIVED FROM LAB (Updates received date & status)
// -------------------------------------------------------------
router.post('/cases/:id/receive', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { receivedDate, notes, makeReadyForHandover } = req.body;

    const existing = await prisma.labCase.findUnique({
      where: { id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Lab case not found' });
    }

    const finalReceivedDate = receivedDate ? new Date(receivedDate) : new Date();
    const newStatus = makeReadyForHandover
      ? LabCaseStatus.READY_FOR_HANDOVER
      : LabCaseStatus.RECEIVED_FROM_LAB;

    const updated = await prisma.$transaction(async (tx) => {
      // Update items
      await tx.labItem.updateMany({
        where: { labCaseId: id },
        data: {
          status: newStatus,
          receivedDate: finalReceivedDate,
        },
      });

      return tx.labCase.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: finalReceivedDate,
          generalNotes: notes ? `${existing.generalNotes ? existing.generalNotes + '\n' : ''}[Received ${finalReceivedDate.toISOString().substring(0, 10)}]: ${notes}` : existing.generalNotes,
        },
        include: {
          patient: true,
          items: true,
          documents: {
            select: { id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true },
          },
          photos: {
            select: { id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, notes: true, receivedDate: true, uploadedAt: true },
          },
        },
      });
    });

    emitRealtimeEvent('lab:updated', updated);

    res.json({
      success: true,
      message: `Items received from laboratory. Status updated to ${newStatus}.`,
      case: updated,
    });
  } catch (err: any) {
    console.error('Error recording received from lab:', err);
    res.status(500).json({ success: false, message: 'Failed to record received item' });
  }
});

// -------------------------------------------------------------
// 7. RECORD PATIENT HANDOVER
// -------------------------------------------------------------
router.post('/cases/:id/handover', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { handoverDate, remarks, itemIds } = req.body;

    const existing = await prisma.labCase.findUnique({
      where: { id },
      include: { patient: true, items: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Lab case not found' });
    }

    const finalHandoverDate = handoverDate ? new Date(handoverDate) : new Date();

    const updated = await prisma.$transaction(async (tx) => {
      // Update specific items or all items
      if (Array.isArray(itemIds) && itemIds.length > 0) {
        await tx.labItem.updateMany({
          where: { id: { in: itemIds }, labCaseId: id },
          data: {
            status: LabCaseStatus.HANDED_OVER,
            handoverDate: finalHandoverDate,
          },
        });
      } else {
        await tx.labItem.updateMany({
          where: { labCaseId: id },
          data: {
            status: LabCaseStatus.HANDED_OVER,
            handoverDate: finalHandoverDate,
          },
        });
      }

      return tx.labCase.update({
        where: { id },
        data: {
          status: LabCaseStatus.HANDED_OVER,
          handoverDate: finalHandoverDate,
          handoverNotes: remarks?.trim() || null,
        },
        include: {
          patient: true,
          items: true,
          documents: {
            select: { id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true },
          },
          photos: {
            select: { id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, notes: true, receivedDate: true, uploadedAt: true },
          },
        },
      });
    });

    emitRealtimeEvent('lab:updated', updated);

    res.json({
      success: true,
      message: `Dental work handed over to ${existing.patient.name} (${existing.patient.patientCode}) on ${finalHandoverDate.toISOString().substring(0, 10)}.`,
      case: updated,
    });
  } catch (err: any) {
    console.error('Error recording patient handover:', err);
    res.status(500).json({ success: false, message: 'Failed to record patient handover' });
  }
});

// -------------------------------------------------------------
// 8. UPDATE STATUS DIRECTLY (e.g. Ready for Handover, Cancelled)
// -------------------------------------------------------------
router.patch('/cases/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!Object.values(LabCaseStatus).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updated = await prisma.labCase.update({
      where: { id },
      data: {
        status,
        ...(remarks ? { handoverNotes: remarks } : {}),
      },
      include: {
        patient: true,
        items: true,
        documents: {
          select: { id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true },
        },
        photos: {
          select: { id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, notes: true, receivedDate: true, uploadedAt: true },
        },
      },
    });

    emitRealtimeEvent('lab:updated', updated);

    res.json({
      success: true,
      message: `Case status updated to ${status}`,
      case: updated,
    });
  } catch (err: any) {
    console.error('Error updating case status:', err);
    res.status(500).json({ success: false, message: 'Failed to update case status' });
  }
});

// -------------------------------------------------------------
// 9. UPLOAD PDF DOCUMENTS
// -------------------------------------------------------------
router.post(
  '/cases/:id/documents',
  authenticateToken,
  upload.array('documents', 10),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'No documents provided for upload' });
      }

      const labCase = await prisma.labCase.findUnique({
        where: { id },
      });
      if (!labCase) {
        return res.status(404).json({ success: false, message: 'Lab case not found' });
      }

      // Validate all files are PDFs
      for (const file of files) {
        const isPdf =
          file.mimetype === 'application/pdf' ||
          file.originalname.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          return res.status(400).json({
            success: false,
            message: `File "${file.originalname}" is not a PDF. Only PDF files are accepted for lab documents.`,
          });
        }
      }

      const createdDocs = await Promise.all(
        files.map(async (file) => {
          const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          return prisma.labDocument.create({
            data: {
              labCaseId: id,
              filename: safeName,
              originalName: file.originalname,
              mimeType: 'application/pdf',
              sizeBytes: file.size,
              fileData: file.buffer,
              fileUrl: `/api/lab/documents/download/${safeName}`,
            },
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              uploadedAt: true,
            },
          });
        })
      );

      res.status(201).json({
        success: true,
        message: `${createdDocs.length} PDF document(s) uploaded successfully`,
        documents: createdDocs,
      });
    } catch (err: any) {
      console.error('Error uploading documents:', err);
      res.status(500).json({ success: false, message: 'Failed to upload documents' });
    }
  }
);

// -------------------------------------------------------------
// 10. PREVIEW / DOWNLOAD PDF DOCUMENT
// -------------------------------------------------------------
router.get('/documents/:docId/view', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const doc = await prisma.labDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || !doc.fileData) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader('Content-Length', doc.sizeBytes);
    res.send(doc.fileData);
  } catch (err: any) {
    console.error('Error streaming PDF document:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve document' });
  }
});

router.get('/documents/:docId/download', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const doc = await prisma.labDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || !doc.fileData) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader('Content-Length', doc.sizeBytes);
    res.send(doc.fileData);
  } catch (err: any) {
    console.error('Error downloading PDF document:', err);
    res.status(500).json({ success: false, message: 'Failed to download document' });
  }
});

// Delete document
router.delete('/documents/:docId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    await prisma.labDocument.delete({
      where: { id: docId },
    });
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting document:', err);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
});

// -------------------------------------------------------------
// 11. UPLOAD RECEIVED ITEM PHOTOS
// -------------------------------------------------------------
router.post(
  '/cases/:id/photos',
  authenticateToken,
  upload.array('photos', 10),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];
      const { notes, receivedDate } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'No photos provided for upload' });
      }

      const labCase = await prisma.labCase.findUnique({
        where: { id },
      });
      if (!labCase) {
        return res.status(404).json({ success: false, message: 'Lab case not found' });
      }

      // Validate all files are images
      for (const file of files) {
        const isImage =
          file.mimetype.startsWith('image/') ||
          /\.(jpg|jpeg|png|webp)$/i.test(file.originalname);
        if (!isImage) {
          return res.status(400).json({
            success: false,
            message: `File "${file.originalname}" is not an image. Only JPG, JPEG, PNG, and WebP are allowed.`,
          });
        }
      }

      const finalReceivedDate = receivedDate ? new Date(receivedDate) : new Date();

      const createdPhotos = await Promise.all(
        files.map(async (file) => {
          const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          return prisma.labPhoto.create({
            data: {
              labCaseId: id,
              filename: safeName,
              originalName: file.originalname,
              mimeType: file.mimetype || 'image/jpeg',
              sizeBytes: file.size,
              photoData: file.buffer,
              photoUrl: `/api/lab/photos/${safeName}`,
              notes: notes?.trim() || null,
              receivedDate: finalReceivedDate,
            },
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              notes: true,
              receivedDate: true,
              uploadedAt: true,
            },
          });
        })
      );

      res.status(201).json({
        success: true,
        message: `${createdPhotos.length} photo(s) uploaded successfully`,
        photos: createdPhotos,
      });
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      res.status(500).json({ success: false, message: 'Failed to upload photos' });
    }
  }
);

// -------------------------------------------------------------
// 12. VIEW PHOTO (Stream image binary)
// -------------------------------------------------------------
router.get('/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const photo = await prisma.labPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo || !photo.photoData) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
    res.setHeader('Content-Length', photo.sizeBytes);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(photo.photoData);
  } catch (err: any) {
    console.error('Error streaming photo:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve photo' });
  }
});

// Delete photo
router.delete('/photos/:photoId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    await prisma.labPhoto.delete({
      where: { id: photoId },
    });
    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ success: false, message: 'Failed to delete photo' });
  }
});

// -------------------------------------------------------------
// 13. DELETE LAB CASE
// -------------------------------------------------------------
router.delete('/cases/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const labCase = await prisma.labCase.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!labCase) {
      return res.status(404).json({ success: false, message: 'Lab case not found' });
    }

    await prisma.labCase.delete({
      where: { id },
    });

    emitRealtimeEvent('lab:deleted', { id, caseNumber: labCase.caseNumber });

    res.json({
      success: true,
      message: `Lab case ${labCase.caseNumber} deleted successfully`,
    });
  } catch (err: any) {
    console.error('Error deleting lab case:', err);
    res.status(500).json({ success: false, message: 'Failed to delete lab case' });
  }
});

export default router;
