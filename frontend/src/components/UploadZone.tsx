"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelected, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={`
        glass w-full max-w-xl cursor-pointer group relative overflow-hidden
        ${isDragging ? "!border-violet-300/70" : ""}
        ${disabled ? "opacity-60 pointer-events-none" : ""}
      `}
      style={{
        padding: "4rem 3rem",
        transition: "border-color 0.3s, transform 0.3s",
      }}
      whileHover={{ scale: 1.015, y: -2 }}
    >
      {/* Holographic shimmer on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(196,181,253,0.15) 0%, rgba(165,243,252,0.1) 40%, rgba(251,146,191,0.1) 70%, transparent 100%)",
          borderRadius: "inherit",
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept=".log,.txt"
        onChange={handleChange}
        className="hidden"
      />

      <div className="flex flex-col items-center relative z-10">
        <motion.div
          className="mb-8 relative"
          whileHover={{ scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {/* Icon container — embossed glass circle */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)",
              border: "1.5px solid rgba(255,255,255,0.7)",
              borderRadius: "50%",
              padding: "1.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <AnimatePresence mode="wait">
              {fileName ? (
                <motion.div key="file" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                  <FileText className="w-10 h-10 text-violet-500" />
                </motion.div>
              ) : (
                <motion.div key="upload" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                  <UploadCloud className="w-10 h-10 text-violet-500" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <h3 className="text-xl font-semibold tracking-tight" style={{ color: "#1e293b" }}>
          {fileName || "Upload System Logs"}
        </h3>
        <p className="mt-2 text-center text-sm" style={{ color: "#64748b" }}>
          {fileName
            ? "Initiating detection protocol..."
            : "Drag & drop .log or .txt files here"}
        </p>

        {!fileName && (
          <div className="pill-ghost mt-6 text-xs" style={{ padding: "8px 24px" }}>
            Browse Files
          </div>
        )}
      </div>
    </motion.div>
  );
}
