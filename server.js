import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as XLSX_NS from 'xlsx';
const XLSX = (XLSX_NS && XLSX_NS.default) ? XLSX_NS.default : XLSX_NS;
import { parseExcelSheetToForm } from './server/excelParser.js';
import { generateFormWithGemini } from './server/geminiParser.js';
import { generateFormFromPdf } from './server/pdfParser.js';
import { initOraclePool, closeOraclePool, getOracleHealth } from './server/database/oracle.js';
import databaseRoutes from './server/routes/database.routes.js';
import formsRoutes from './server/routes/forms.routes.js';
import formDataRoutes from './server/routes/formData.routes.js';
import runtimeRoutes from './server/routes/runtime.routes.js';
import patientRoutes from './server/routes/patient.routes.js';
import { getDeployedForms } from './server/controllers/form.controller.js';
import { getPatientFormData } from './server/controllers/patient.controller.js';
import { formRepository } from './server/repositories/formRepository.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());
app.use(express.json());


// Health check endpoint (Step 2)
app.get('/api/health', async (req, res) => {
  const dbHealth = await getOracleHealth();
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const status = dbHealth.connected ? 'ok' : 'degraded';

  res.json({
    status,
    service: 'form-builder',
    database: {
      type: 'oracle',
      connected: dbHealth.connected,
    },
    aiEnabled: hasGemini,
    model: hasGemini ? 'gemini-3.5-flash' : 'local-heuristic-only',
    supportedFormats: ['xlsx', 'xls', 'pdf'],
  });
});

// Configure Multer for in-memory file uploads with 10MB limit and extension filter (.xlsx, .xls, .pdf)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const originalName = file.originalname.toLowerCase();
    if (
      originalName.endsWith('.xlsx') ||
      originalName.endsWith('.xls') ||
      originalName.endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file format: "${file.originalname}". Only Excel (.xlsx, .xls) and PDF (.pdf) files are allowed.`
        )
      );
    }
  },
});

// PDF Import endpoint: POST /api/forms/import/pdf
app.post('/api/forms/import/pdf', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds the 10MB limit. Please upload a smaller document.',
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload failed.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload a valid .pdf file.',
      });
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({
          success: false,
          error: 'GEMINI_API_KEY is not configured in .env. PDF understanding requires Gemini AI.',
        });
      }

      console.log(`[Server] Processing PDF file "${req.file.originalname}" (${(req.file.size / 1024).toFixed(1)} KB) with Gemini AI...`);
      const formDefinition = await generateFormFromPdf(
        req.file.buffer,
        process.env.GEMINI_API_KEY,
        { fileName: req.file.originalname }
      );

      return res.json({
        success: true,
        data: formDefinition,
        generator: 'gemini-multimodal-pdf',
        fileName: req.file.originalname,
      });
    } catch (parseError) {
      console.error('Error importing PDF form:', parseError);
      return res.status(422).json({
        success: false,
        error:
          parseError.message ||
          'Failed to parse the PDF document into a form schema. Please verify the document format.',
      });
    }
  });
});

// Excel Import endpoint: POST /api/forms/import/excel
app.post('/api/forms/import/excel', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds the 10MB limit. Please upload a smaller workbook.',
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload failed.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload a valid .xlsx or .xls file.',
      });
    }

    // If a PDF is uploaded to this endpoint, automatically delegate to PDF handler
    if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const formDefinition = await generateFormFromPdf(
          req.file.buffer,
          process.env.GEMINI_API_KEY,
          { fileName: req.file.originalname }
        );
        return res.json({
          success: true,
          data: formDefinition,
          generator: 'gemini-multimodal-pdf',
          fileName: req.file.originalname,
        });
      } catch (pdfErr) {
        return res.status(422).json({
          success: false,
          error: pdfErr.message || 'Failed to parse PDF document.',
        });
      }
    }

    const sheetName = req.body.sheetName || req.query.sheetName;

    try {
      // Parse workbook using SheetJS
      const workbook = XLSX.read(req.file.buffer, {
        type: 'buffer',
        cellStyles: true,
        cellNF: true,
        cellDates: true,
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'The uploaded Excel workbook contains no sheets.',
        });
      }

      const targetSheet = sheetName || workbook.SheetNames[0];
      let formDefinition = null;
      let generatorUsed = 'local-heuristic';

      // 1. Prioritize Gemini AI Model if GEMINI_API_KEY is available
      if (process.env.GEMINI_API_KEY) {
        try {
          console.log(
            `[Server] Using Gemini 3.5 Flash to parse sheet "${targetSheet}"...`
          );
          formDefinition = await generateFormWithGemini(
            workbook,
            targetSheet,
            process.env.GEMINI_API_KEY
          );
          generatorUsed = 'gemini-flash';
        } catch (geminiError) {
          console.warn(
            `[Server] Gemini generation encountered an issue, falling back to heuristic parser:`,
            geminiError.message
          );
        }
      }

      // 2. Fallback to local heuristic parser if Gemini didn't produce a form
      if (!formDefinition) {
        console.log(`[Server] Running local heuristic parser on "${targetSheet}"...`);
        formDefinition = parseExcelSheetToForm(workbook, targetSheet);
        generatorUsed = 'local-heuristic';
      }

      return res.json({
        success: true,
        data: formDefinition,
        generator: generatorUsed,
        sheetCount: workbook.SheetNames.length,
        sheetName: targetSheet,
      });
    } catch (parseError) {
      console.error('Error importing Excel form:', parseError);
      return res.status(422).json({
        success: false,
        error:
          parseError.message ||
          'Failed to parse the Excel sheet into a form. Please verify the document format.',
      });
    }
  });
});

// Mount Oracle Database & Form Data API routes
app.use('/api/database', databaseRoutes);
app.use('/api/forms', formsRoutes);
app.use('/api/forms', formDataRoutes);
app.use('/api/runtime/forms', runtimeRoutes);
app.use('/api/patients', patientRoutes);
app.get('/api/deployed-forms', getDeployedForms);
app.get('/api/forms/:slug/patient-data', getPatientFormData);
app.get('/api/runtime/forms/:slug/patient-data', getPatientFormData);

// Production frontend static file serving & SPA fallback
const DIST_DIR = path.resolve('dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const server = app.listen(PORT, async () => {
  console.log(`[FormBuilder Server] Backend listening on http://localhost:${PORT}`);
  try {
    await formRepository.init();
    console.log('[FormBuilder Server] FormRepository initialized with versioning and migration.');
  } catch (repoErr) {
    console.warn('[FormBuilder Server] FormRepository init notice:', repoErr.message);
  }
  try {
    await initOraclePool();
  } catch (err) {
    console.warn('[FormBuilder Server] Oracle pool initial connection notice:', err.message);
  }
});

const gracefulShutdown = async () => {
  console.log('[FormBuilder Server] Shutting down server gracefully...');
  server.close(async () => {
    await closeOraclePool();
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

