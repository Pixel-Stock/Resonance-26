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
        ${isDragging ? "!border-indigo-400/50" : ""}
        ${disabled ? "opacity-60 pointer-events-none" : ""}
      `}
      style={{
        padding: "4rem 3rem",
        transition: "border-color 0.3s, transform 0.3s",
        background: isDragging
          ? "rgba(99,102,241,0.07)"
          : "rgba(30,41,59,0.4)",
      }}
      whileHover={{ scale: 1.015, y: -2 }}
    >
      {/* Shimmer on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(129,140,248,0.07) 0%, rgba(45,212,191,0.05) 40%, rgba(251,146,191,0.05) 70%, transparent 100%)",
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
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(129,140,248,0.12) 0%, rgba(129,140,248,0.06) 100%)",
              border: "1px solid rgba(129,140,248,0.2)",
              borderRadius: "50%",
              padding: "1.5rem",
              boxShadow:
                "0 4px 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(129,140,248,0.2)",
            }}
          >
            <AnimatePresence mode="wait">
              {fileName ? (
                <motion.div
                  key="file"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                >
                  <FileText className="w-10 h-10" style={{ color: "#818cf8" }} />
                </motion.div>
              ) : (
                <motion.div
                  key="upload"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                >
                  <UploadCloud
                    className="w-10 h-10"
                    style={{ color: "#818cf8" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <h3
          className="text-xl font-semibold tracking-tight"
          style={{ color: "#e2e8f0" }}
        >
          {fileName || "Upload System Logs"}
        </h3>
        <p className="mt-2 text-center text-sm" style={{ color: "#64748b" }}>
          {fileName
            ? "Initiating detection protocol..."
            : "Drag & drop .log or .txt files here"}
        </p>

        {!fileName && (
          <div
            className="pill-ghost mt-6 text-xs"
            style={{ padding: "8px 24px" }}
          >
            Browse Files
          </div>
        )}
      </div>
    </motion.div>
  );
}
