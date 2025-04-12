"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSubmission } from "@/contexts/SubmissionContext"
import { submissionService } from "@/services/submission.api"
import { UploadCloud, File, X, FileArchive, FileText, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react"

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

const FileUpload = ({ id }: { id: string }) => {
  const router = useRouter()
  const { getSubmissionById, updateSubmission, refreshSubmissions } = useSubmission()
  const [submission, setSubmission] = useState<any>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const submissionData = getSubmissionById(id)
    if (submissionData) {
      setSubmission(submissionData)
    }
  }, [id, getSubmissionById])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files)
      setFiles((prevFiles) => [...prevFiles, ...selectedFiles])

      // Reset input value to allow selecting the same file again
      e.target.value = ""
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
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
      setFiles((prevFiles) => [...prevFiles, ...droppedFiles])
    }
  }

  const handleSubmit = async () => {
    if (files.length === 0) {
      setUploadError("Please select at least one file to upload")
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)
      setUploadError(null)

      // Upload files
      await submissionService.uploadFiles(id, files, (progress) => {
        setUploadProgress(progress)
      })

      // Refresh submissions to get updated data
      await refreshSubmissions()

      setUploadSuccess(true)
      setFiles([])

      // Reset success message after 3 seconds
      setTimeout(() => {
        setUploadSuccess(false)
      }, 3000)
    } catch (error) {
      console.error("Upload error:", error)
      setUploadError("Error uploading files. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  if (!submission) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading submission...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Upload Files</h1>
        <p className="text-gray-600">Upload additional files to enhance the analysis for {submission.name}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
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

        {/* File List */}
        {files.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-800">Files to Upload ({files.length})</h3>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-sm text-red-600 hover:text-red-800"
                disabled={uploading}
              >
                Clear All
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div className="flex items-center">
                      {getFileIcon(file)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-800">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="text-gray-400 hover:text-red-500"
                      disabled={uploading}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Upload Progress</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {uploadSuccess && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-800">Upload Successful!</p>
                <p className="text-sm text-green-700 mt-1">
                  Your files have been uploaded and are now being processed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {uploadError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => router.push(`/submission/${id}`)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={uploading}
          >
            Back to Submission
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={uploading || files.length === 0}
          >
            {uploading ? "Uploading..." : "Upload Files"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FileUpload
