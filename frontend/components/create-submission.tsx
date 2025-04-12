"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSubmissionForm } from "@/hooks/use-submission-form"
import { submissionService } from "@/services/submission.api"
import StepBasicInfo from "./submission-steps/step-basic-info"
import StepFileUpload from "./submission-steps/step-file-upload"
import StepReview from "./submission-steps/step-review"
import StepProcessing from "./submission-steps/step-processing"
import { CheckCircle, AlertTriangle } from "lucide-react"

export default function CreateSubmission() {
  const router = useRouter()
  const {
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
  } = useSubmissionForm()
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)

  const handleSubmit = async () => {
    try {
      setSubmissionError(null)

      // Create submission
      const submission = await submissionService.createSubmission({
        name: formData.name,
        cedant: formData.cedant,
        renewalDate: formData.renewalDate,
        territory: formData.territory,
        perils: formData.perils,
        notes: formData.notes,
      })

      // Set submission ID
      setSubmissionId(submission.id)

      // Move to processing step
      nextStep()

      setSubmissionSuccess(true)
    } catch (error) {
      console.error("Error creating submission:", error)
      setSubmissionError("Failed to create submission. Please try again.")
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case "basic-info":
        return <StepBasicInfo formData={formData} updateFormData={updateFormData} onNext={nextStep} />
      case "file-upload":
        return (
          <StepFileUpload
            formData={formData}
            addFiles={addFiles}
            removeFile={removeFile}
            clearFiles={clearFiles}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )
      case "review":
        return <StepReview formData={formData} onSubmit={handleSubmit} onPrev={prevStep} />
      case "processing":
        return (
          <StepProcessing
            formData={formData}
            submissionId={submissionId || ""}
            uploadProgress={uploadProgress}
            processingProgress={processingProgress}
            setUploadProgress={setUploadProgress}
            setProcessingProgress={setProcessingProgress}
            setError={setError}
            onComplete={() => goToStep("complete")}
          />
        )
      case "complete":
        return (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Submission Complete!</h2>
              <p className="text-gray-600">Your submission has been successfully created and processed.</p>
            </div>

            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Return to Dashboard
              </button>
              <button
                type="button"
                onClick={() => router.push(`/submission/${submissionId}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                View Submission
              </button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Create New Submission</h1>
        <p className="text-gray-600">
          Create a new submission to analyze contract terms, claims data, and generate insights.
        </p>
      </div>

      {/* Progress indicator */}
      {currentStep !== "processing" && currentStep !== "complete" && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === "basic-info" || currentStep === "file-upload" || currentStep === "review"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                1
              </div>
              <div
                className={`h-1 w-12 ${
                  currentStep === "file-upload" || currentStep === "review" ? "bg-blue-500" : "bg-gray-200"
                }`}
              ></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === "file-upload" || currentStep === "review"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                2
              </div>
              <div className={`h-1 w-12 ${currentStep === "review" ? "bg-blue-500" : "bg-gray-200"}`}></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === "review" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                3
              </div>
            </div>
            <div className="flex text-sm">
              <span className={`mr-4 ${currentStep === "basic-info" ? "font-medium text-blue-600" : "text-gray-500"}`}>
                Basic Info
              </span>
              <span className={`mr-4 ${currentStep === "file-upload" ? "font-medium text-blue-600" : "text-gray-500"}`}>
                File Upload
              </span>
              <span className={`${currentStep === "review" ? "font-medium text-blue-600" : "text-gray-500"}`}>
                Review
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {submissionError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-red-700">{submissionError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current step */}
      {renderStep()}
    </div>
  )
}
