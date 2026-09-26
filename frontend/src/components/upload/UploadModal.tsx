import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SCANNING_STEPS = [
  'Reading files & parsing structures...',
  'Inferring semantic data types & identifiers...',
  'Evaluating table schemas & cross-table joins...',
  'Computing 0-100 Data Health Score...',
  'Discovering domain-aware KPIs & aggregates...',
  'Running IQR & Z-score anomaly diagnostics...',
  'Synthesizing interactive dashboard & executive report...'
];

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentDataset, selectDatasetById, refreshDatasetList } = useWorkspace();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [datasetCustomName, setDatasetCustomName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setUploadError(null);
    setCurrentStepIndex(0);

    // Realistic scanning stepper timer while backend finishes
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < SCANNING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 700);

    try {
      const newDataset = await api.uploadFiles(selectedFiles, datasetCustomName.trim() || undefined);
      clearInterval(interval);
      setCurrentStepIndex(SCANNING_STEPS.length - 1);
      await refreshDatasetList();
      await selectDatasetById(newDataset.id);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      clearInterval(interval);
      setIsProcessing(false);
      setUploadError(err.message || 'Failed to process dataset');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fadeIn">
      <div className="glass-3d-card relative rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-[0_30px_70px_-15px_rgba(0,0,0,0.95),0_0_45px_rgba(14,165,233,0.2)] border border-cyan-500/40">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800/90 flex items-center justify-between bg-[#081020]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/25 to-cyan-500/25 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(14,165,233,0.25)]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white tracking-tight">Ingest Dataset</h2>
              <p className="text-xs text-slate-400">Autonomous multi-table schema inference & health profiling</p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition active:translate-y-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {isProcessing ? (
            /* Processing Stepper */
            <div className="py-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 mx-auto flex items-center justify-center shadow-lg shadow-cyan-500/25 animate-spin">
                  <Loader2 className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  DATOVA is analyzing your dataset...
                </h3>
                <p className="text-xs text-slate-400">Deterministic profiling and AI synthesis in progress</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Progress</span>
                  <span className="text-cyan-300 font-bold">
                    {Math.round(((currentStepIndex + 1) / SCANNING_STEPS.length) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                    style={{ width: `${((currentStepIndex + 1) / SCANNING_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 max-w-md mx-auto pt-2">
                {SCANNING_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 text-xs p-2 rounded-xl transition ${
                        isCurrent
                          ? 'bg-cyan-500/10 border border-cyan-500/30 text-white shadow-sm'
                          : isDone
                          ? 'text-slate-400'
                          : 'text-slate-600'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                      )}
                      <span className={isCurrent ? 'text-cyan-200 font-semibold' : ''}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Upload Zone */
            <div className="space-y-4">
              {/* Optional Dataset Custom Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Dataset Name <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Global Sales & Finance"
                  value={datasetCustomName}
                  onChange={(e) => setDatasetCustomName(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition shadow-inner"
                />
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative border-2 border-dashed border-slate-700/80 hover:border-cyan-400/80 rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-300 bg-[#0A1224]/60 hover:bg-[#0E1A33]/80 group shadow-inner"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept=".csv,.xlsx,.xls,.tsv"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-300 group-hover:scale-110 transition duration-300 mx-auto flex items-center justify-center mb-3 shadow-lg shadow-cyan-500/15">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  <span className="text-cyan-400 underline font-bold">Click to choose files</span> or drag & drop here
                </p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  Supports CSV, XLSX, XLS, TSV • Multi-table archives supported
                </p>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Selected Files ({selectedFiles.length})
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#091122]/90 border border-slate-700/60 text-xs shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                          )}
                          <span className="text-slate-200 font-medium truncate">{file.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                          className="text-slate-400 hover:text-rose-400 transition ml-2 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Submit CTA Button */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-3d-secondary px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  disabled={selectedFiles.length === 0}
                  className="btn-3d-cyan px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Start Automated Analysis</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
