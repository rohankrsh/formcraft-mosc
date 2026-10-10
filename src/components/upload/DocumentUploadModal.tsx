import { useState, useRef } from 'react';
import type React from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  Loader2,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useFormStore } from '../../store/useFormStore';

export type SourceType = 'excel' | 'pdf';

export const DocumentUploadModal: React.FC = () => {
  const { isUploadModalOpen, setUploadModalOpen, loadForm } = useFormStore();

  const [selectedSourceType, setSelectedSourceType] = useState<SourceType>('excel');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isUploadModalOpen) return null;

  const resetUploadState = () => {
    setSelectedFile(null);
    setSheetNames([]);
    setSelectedSheet('');
    setErrorMessage(null);
    setStatusMessage(null);
    setIsAnalyzing(false);
    setIsConverting(false);
  };

  const handleClose = () => {
    resetUploadState();
    setUploadModalOpen(false);
  };

  const validateAndAnalyzeFile = async (file: File) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const fileName = file.name.toLowerCase();
    const isPdfFile = fileName.endsWith('.pdf');
    const isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isPdfFile && !isExcelFile) {
      setErrorMessage(
        `Unsupported file format: "${file.name}". Please upload an Excel (.xlsx, .xls) or PDF (.pdf) file.`
      );
      setSelectedFile(null);
      setSheetNames([]);
      setSelectedSheet('');
      return;
    }

    // Auto-align source toggle if user drops a different supported file type
    if (isPdfFile && selectedSourceType !== 'pdf') {
      setSelectedSourceType('pdf');
    } else if (isExcelFile && selectedSourceType !== 'excel') {
      setSelectedSourceType('excel');
    }

    // 2. File size validation (10MB limit)
    const MAX_SIZE_MB = 10;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMessage(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is ${MAX_SIZE_MB}MB.`
      );
      setSelectedFile(null);
      setSheetNames([]);
      setSelectedSheet('');
      return;
    }

    setSelectedFile(file);

    // 3. Handle PDF upload
    if (isPdfFile) {
      setSheetNames(['Document Content']);
      setSelectedSheet('Document Content');
      setStatusMessage(
        `PDF document "${file.name}" (${(file.size / 1024).toFixed(1)} KB) loaded. The AI model will analyze visual fields and tables.`
      );
      return;
    }

    // 4. Handle Excel workbook inspection
    setIsAnalyzing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', bookSheets: true });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Workbook is empty. No sheets were found in this Excel file.');
      }

      setSheetNames(workbook.SheetNames);
      setSelectedSheet(workbook.SheetNames[0]);
      setStatusMessage(
        `Workbook loaded. Found ${workbook.SheetNames.length} ${
          workbook.SheetNames.length === 1 ? 'sheet' : 'sheets'
        }.`
      );
    } catch (err: any) {
      console.error('Error reading workbook sheets:', err);
      setErrorMessage(
        err?.message || 'Malformed or corrupted Excel file. Unable to read worksheet structure.'
      );
      setSelectedFile(null);
      setSheetNames([]);
      setSelectedSheet('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndAnalyzeFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndAnalyzeFile(file);
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');
    const apiPath = isPdf ? '/api/forms/import/pdf' : '/api/forms/import/excel';
    const fallbackUrl = isPdf
      ? 'http://localhost:3001/api/forms/import/pdf'
      : 'http://localhost:3001/api/forms/import/excel';

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (!isPdf && selectedSheet) {
        formData.append('sheetName', selectedSheet);
      }

      const authHeaders = { 'x-api-key': 'formcraft_secret_key_2026' };

      // Call backend import endpoint
      let response: Response;
      try {
        response = await fetch(apiPath, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });
      } catch {
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });
      }

      if (!response.ok && response.status === 404) {
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });
      }

      const rawText = await response.text();
      let result: any = null;
      try {
        result = rawText ? JSON.parse(rawText) : null;
      } catch {
        // Not JSON
      }

      if (!response.ok || !result || !result.success) {
        throw new Error(
          result?.error ||
            `Failed to generate form from ${isPdf ? 'PDF' : 'Excel'} document (HTTP ${response.status}: ${
              rawText.slice(0, 150) || response.statusText || 'No response'
            }).`
        );
      }

      if (!result.data || !result.data.fields || Object.keys(result.data.fields).length === 0) {
        throw new Error(
          `Document produced 0 form fields. Please ensure the document contains identifiable form labels or fields.`
        );
      }

      // Successfully generated form definition! Load directly into builder canvas
      loadForm(result.data);
      handleClose();
    } catch (err: any) {
      console.error('Conversion error:', err);
      let msg = err?.message || 'An unexpected error occurred while converting the document.';
      if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
        msg = 'The AI model is currently experiencing high demand. Please click "Convert with AI Model" again in a few moments.';
      }
      setErrorMessage(msg);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-colors flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>Upload & Auto-Generate Form</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span>AI Powered</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Excel & PDF
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload a document to generate an editable, drag-and-drop form canvas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Source Type Options */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Select Document Source Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Excel */}
              <div
                onClick={() => setSelectedSourceType('excel')}
                className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  selectedSourceType === 'excel'
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={selectedSourceType === 'excel'}
                    onChange={() => setSelectedSourceType('excel')}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Excel</span>
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.2 rounded">
                      Supported
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Accepts <span className="font-mono text-slate-700 dark:text-slate-300">.xlsx</span> and{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">.xls</span> workbooks.
                  </p>
                </div>
              </div>

              {/* Option B: PDF */}
              <div
                onClick={() => setSelectedSourceType('pdf')}
                className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  selectedSourceType === 'pdf'
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={selectedSourceType === 'pdf'}
                    onChange={() => setSelectedSourceType('pdf')}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">PDF Document</span>
                    <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.2 rounded">
                      Supported (AI)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Accepts <span className="font-mono text-slate-700 dark:text-slate-300">.pdf</span> forms with visual layout and table recognition.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. File Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              {selectedSourceType === 'pdf' ? 'Upload PDF Document' : 'Upload Excel File'}
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept={
                selectedSourceType === 'pdf'
                  ? '.pdf,application/pdf'
                  : '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
              }
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? selectedSourceType === 'pdf'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01]'
                      : 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 hover:border-blue-500/70 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                    selectedSourceType === 'pdf'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {selectedSourceType === 'pdf'
                    ? 'Drag and drop your PDF form here'
                    : 'Drag and drop your Excel workbook here'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  or{' '}
                  <span
                    className={`font-semibold underline ${
                      selectedSourceType === 'pdf'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    browse file
                  </span>{' '}
                  from your computer
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-400">
                  <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                    {selectedSourceType === 'pdf' ? '.PDF' : '.XLSX, .XLS'}
                  </span>
                  <span>•</span>
                  <span>Max file size 10MB</span>
                </div>
              </div>
            ) : (
              /* Selected File Card */
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  selectedFile.name.toLowerCase().endsWith('.pdf')
                    ? 'border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/15'
                    : 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/15'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm ${
                      selectedFile.name.toLowerCase().endsWith('.pdf')
                        ? 'bg-blue-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB •{' '}
                      {selectedFile.name.toLowerCase().endsWith('.pdf')
                        ? 'PDF Document (Visual AI Recognition Ready)'
                        : `${sheetNames.length} ${sheetNames.length === 1 ? 'Sheet' : 'Sheets'} found`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setSheetNames([]);
                    setSelectedSheet('');
                    setErrorMessage(null);
                    setStatusMessage(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Change File
                </button>
              </div>
            )}
          </div>

          {/* 3. Sheet Picker */}
          {selectedFile && selectedSourceType === 'excel' && sheetNames.length > 1 && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Select Sheet to Convert
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Multiple sheets detected ({sheetNames.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Choose the worksheet containing the form layout you want to import:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {sheetNames.map((name, idx) => {
                  const isChecked = selectedSheet === name;
                  return (
                    <label
                      key={name}
                      onClick={() => setSelectedSheet(name)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-mono text-slate-400 w-4">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-semibold truncate">{name}</span>
                      </div>
                      <input
                        type="radio"
                        name="sheetSelect"
                        checked={isChecked}
                        onChange={() => setSelectedSheet(name)}
                        className="text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Single-sheet notice */}
          {selectedFile && sheetNames.length === 1 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>
                Target Sheet: <strong className="text-slate-900 dark:text-white font-mono">{sheetNames[0]}</strong> (Auto-selected)
              </span>
            </div>
          )}

          {/* 5. Error State */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-rose-700 dark:text-rose-300">
                <p className="font-semibold">Unable to process file</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* 6. Success / Status info */}
          {statusMessage && !errorMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* 7. AI Conversion In-Progress Card */}
          {isConverting && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/30">
                <Sparkles className="w-5 h-5 animate-spin" />
              </div>
              <div className="text-xs text-blue-950 dark:text-blue-200">
                <p className="font-bold flex items-center gap-1.5">
                  <span>AI model is analyzing document structure</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping" />
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  Detecting sections, 12-column responsive layout, and input types.
                </p>
              </div>
            </div>
          )}

          {/* 8. Heuristics & AI overview note */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>AI-Powered Layout Understanding</span>
              </p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                The AI model analyzes the visual 2D layout of your document, converting merged titles to sections, dates to typed inputs, and dropdowns to select options. Ambiguous tables are flagged with{' '}
                <code className="text-blue-600 dark:text-blue-400 font-semibold">_needsReview</code> for easy review on the canvas.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            id="modal-convert-btn"
            disabled={!selectedFile || !selectedSheet || isAnalyzing || isConverting}
            onClick={handleConvert}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all ${
              !selectedFile || !selectedSheet || isAnalyzing || isConverting
                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20 active:scale-95'
            }`}
          >
            {isAnalyzing || isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isAnalyzing ? 'Reading sheets...' : 'Generating form with AI...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Convert with AI Model</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
