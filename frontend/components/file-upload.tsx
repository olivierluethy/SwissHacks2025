"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useSubmission } from "@/contexts/SubmissionContext"
import { fileService } from "@/services/file.api"
import { UploadCloud, type File } from "lucide-react"
import "./FileUpload.css"

const FileUpload = ({ id }: { id: string }) => {
  const { getSubmissionById, updateSubmission } = useSubmission()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileTypes, setFileTypes] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles((prevFiles) => [...prevFiles, ...selectedFiles])

      // Clear input to allow uploading the same file again if needed
      e.target.value = ""
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  const handleFileTypeChange = (fileName: string, fileType: string) => {
    setFileTypes((prevTypes) => ({
      ...prevTypes,
      [fileName]: fileType,
    }))
  }

  const handleSubmit = async () => {
    if (files.length === 0) return

    try {
      setUploading(true)
      setUploadProgress(0)
      setUploadError(null)

      // Create upload metadata
      const metadata = {
        submissionId: id,
        fileTypes: fileTypes,
      }

      // Upload files
      const result = await fileService.uploadFiles(files, metadata, (progress: number) => {
        setUploadProgress(progress)
      })

      // Update submission in context
      if (result.submission) {
        updateSubmission(id, result.submission)
      }

      setUploadSuccess(true)
      setFiles([])
      setFileTypes({})

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

  // Rest of the component remains the same as in the original file
  // ...

  return (
    <div className="file-upload-container">
      <div className="upload-header">
        <h2>Upload Submission Files</h2>
        <p className="upload-description">
          Upload contract documents, claims data, and supplementary information to analyze this submission.
        </p>
      </div>

      <div className="upload-section">
        <div
          className="upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (e.dataTransfer.files) {
              const droppedFiles = Array.from(e.dataTransfer.files)
              setFiles((prevFiles) => [...prevFiles, ...droppedFiles])
            }
          }}
        >
          <UploadCloud className="upload-icon" />
          <p>Drag & drop files here or click to browse</p>
          <span className="upload-formats">Supported formats: PDF, XLSX, XLS, CSV, DOC, DOCX</span>

          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} multiple />
        </div>
      </div>

      {/* Rest of the component UI */}
    </div>
  )
}

export default FileUpload
