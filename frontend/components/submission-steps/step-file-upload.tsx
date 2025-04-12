"use client"

import type React from "react"

import { useState, useRef } from "react"
import { UploadCloud, File, X, FileArchive, FileText, FileSpreadsheet, AlertTriangle } from "lucide-react"
import type { SubmissionFormData } from "@/hooks/use-submission-form"

type StepFileUploadProps = {
  formData: SubmissionFormData
  addFiles: (files: File[]) => void
  removeFile: (index: number) => void
  clearFiles: () => void
  onNext: () => void
  onPrev: () => void
}

// Helper function to get file icon based on file type
const getFileIcon = (file: File) => {
  const fileType = file.type.split("/")[0]
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (file.type.includes("zip") || extension === "zip") {
    return <FileArchive className="h-5 w-5 text-amber-500" />
  } else if (fileType === "image") {
    return <File className="h-5 w-5 text-blue-500" />
  } else if (extension === "pdf") {
    return <FileText className="h-5 w-5 text-red-500" />
  } else if (["xlsx", "xls", "csv"].includes(extension || "")) {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />
  } else {
    return <File className="h-5 w-5 text-gray-500" />
  }
}

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export default function StepFileUpload({
  formData,
  addFiles,
  removeFile,
  clearFiles,
  onNext,
  onPrev,
}: StepFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)

      // Reset input value to allow selecting the same file again
      e.target.value = ""
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      addFiles(droppedFiles)
    }
  }

  const handleSubmit = () => {
    if (formData.files.length === 0) {
      setError("Please upload at least one file before continuing")
      return
    }

    setError(null)
    onNext()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Upload Submission Files</h2>
      <p className="text-gray-600 mb-6">
        Upload contract documents, claims data, and any other relevant files for analysis.
      </p>

      {/* File Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />

        <UploadCloud className="h-12 w-12 text-blue-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-800 mb-1">Drag & drop files here or click to browse</h3>
        <p className="text-sm text-gray-500 mb-2">
          Upload individual files or ZIP archives containing multiple documents
        </p>
        <p className="text-xs text-gray-400">Supported formats: PDF, DOCX, XLSX, CSV, ZIP, and more</p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* File List */}
      {formData.files.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium text-gray-800">Uploaded Files ({formData.files.length})</h3>
            <button type="button" onClick={clearFiles} className="text-sm text-red-600 hover:text-red-800">
              Clear All
            </button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {formData.files.map((file, index) => (
                <li key={index} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    {getFileIcon(file)}
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-800">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-500">
                    <X className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}
