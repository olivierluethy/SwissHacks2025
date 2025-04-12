"use client"

import { useState } from "react"

export type SubmissionFormData = {
  name: string
  cedant: string
  renewalDate: string
  territory: string
  perils: string[]
  notes?: string
  files: File[]
}

export type SubmissionFormStep = "basic-info" | "file-upload" | "review" | "processing" | "complete"

export function useSubmissionForm() {
  const [currentStep, setCurrentStep] = useState<SubmissionFormStep>("basic-info")
  const [formData, setFormData] = useState<SubmissionFormData>({
    name: "",
    cedant: "",
    renewalDate: "",
    territory: "",
    perils: [],
    notes: "",
    files: [],
  })
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Update form data
  const updateFormData = (data: Partial<SubmissionFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  // Add files to form data
  const addFiles = (newFiles: File[]) => {
    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...newFiles],
    }))
  }

  // Remove file from form data
  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }))
  }

  // Clear all files
  const clearFiles = () => {
    setFormData((prev) => ({
      ...prev,
      files: [],
    }))
  }

  // Go to next step
  const nextStep = () => {
    switch (currentStep) {
      case "basic-info":
        setCurrentStep("file-upload")
        break
      case "file-upload":
        setCurrentStep("review")
        break
      case "review":
        setCurrentStep("processing")
        break
      case "processing":
        setCurrentStep("complete")
        break
      default:
        break
    }
  }

  // Go to previous step
  const prevStep = () => {
    switch (currentStep) {
      case "file-upload":
        setCurrentStep("basic-info")
        break
      case "review":
        setCurrentStep("file-upload")
        break
      default:
        break
    }
  }

  // Go to specific step
  const goToStep = (step: SubmissionFormStep) => {
    setCurrentStep(step)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      cedant: "",
      renewalDate: "",
      territory: "",
      perils: [],
      notes: "",
      files: [],
    })
    setCurrentStep("basic-info")
    setSubmissionId(null)
    setUploadProgress(0)
    setProcessingProgress(0)
    setError(null)
  }

  return {
    currentStep,
    formData,
    submissionId,
    uploadProgress,
    processingProgress,
    error,
    updateFormData,
    addFiles,
    removeFile,
    clearFiles,
    nextStep,
    prevStep,
    goToStep,
    resetForm,
    setSubmissionId,
    setUploadProgress,
    setProcessingProgress,
    setError,
  }
}
