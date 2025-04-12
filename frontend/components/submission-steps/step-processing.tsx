"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Loader2, Upload, FileSearch, BarChart2, AlertTriangle } from "lucide-react"
import { submissionService } from "@/services/submission.api"
import type { SubmissionFormData } from "@/hooks/use-submission-form"

type StepProcessingProps = {
  formData: SubmissionFormData
  submissionId: string
  uploadProgress: number
  processingProgress: number
  setUploadProgress: (progress: number) => void
  setProcessingProgress: (progress: number) => void
  setError: (error: string | null) => void
  onComplete: () => void
}

type ProcessingStep = {
  id: string
  label: string
  status: "pending" | "in-progress" | "complete" | "error"
  icon: React.ReactNode
}

export default function StepProcessing({
  formData,
  submissionId,
  uploadProgress,
  processingProgress,
  setUploadProgress,
  setProcessingProgress,
  setError,
  onComplete,
}: StepProcessingProps) {
  const router = useRouter()
  const [steps, setSteps] = useState<ProcessingStep[]>([
    {
      id: "upload",
      label: "Uploading Files",
      status: "in-progress",
      icon: <Upload className="h-5 w-5" />,
    },
    {
      id: "analyze",
      label: "Analyzing Documents",
      status: "pending",
      icon: <FileSearch className="h-5 w-5" />,
    },
    {
      id: "process",
      label: "Processing Data",
      status: "pending",
      icon: <BarChart2 className="h-5 w-5" />,
    },
  ])
  const [currentMessage, setCurrentMessage] = useState("Uploading your files...")
  const [isComplete, setIsComplete] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Handle file upload
  useEffect(() => {
    const uploadFiles = async () => {
      try {
        // Upload files
        await submissionService.uploadFiles(submissionId, formData.files, (progress) => {
          setUploadProgress(progress)
        })

        // Update steps
        setSteps((prevSteps) =>
          prevSteps.map((step) =>
            step.id === "upload"
              ? { ...step, status: "complete" }
              : step.id === "analyze"
                ? { ...step, status: "in-progress" }
                : step,
          ),
        )

        setCurrentMessage("Analyzing documents and extracting data...")

        // Start checking processing status
        checkProcessingStatus()
      } catch (error) {
        console.error("Error uploading files:", error)
        setUploadError("There was an error uploading your files. Please try again.")
        setSteps((prevSteps) => prevSteps.map((step) => (step.id === "upload" ? { ...step, status: "error" } : step)))
        setError("File upload failed")
      }
    }

    uploadFiles()
  }, [submissionId, formData.files, setUploadProgress, setError])

  // Check processing status
  const checkProcessingStatus = async () => {
    try {
      // Simulate processing progress
      let currentProgress = 0
      const interval = setInterval(async () => {
        try {
          // Check status from API
          const statusResponse = await submissionService.checkProcessingStatus(submissionId)

          if (statusResponse.status === "complete") {
            clearInterval(interval)
            setProcessingProgress(100)

            // Update steps
            setSteps((prevSteps) => prevSteps.map((step) => ({ ...step, status: "complete" })))

            setCurrentMessage("Processing complete!")
            setIsComplete(true)
          } else {
            // Update progress based on API response or increment
            currentProgress = statusResponse.progress || Math.min(currentProgress + 5, 95)
            setProcessingProgress(currentProgress)

            // Update steps based on progress
            if (currentProgress >= 50 && currentProgress < 90) {
              setSteps((prevSteps) =>
                prevSteps.map((step) =>
                  step.id === "analyze"
                    ? { ...step, status: "complete" }
                    : step.id === "process"
                      ? { ...step, status: "in-progress" }
                      : step,
                ),
              )
              setCurrentMessage("Processing data and generating insights...")
            }
          }
        } catch (error) {
          console.error("Error checking processing status:", error)
        }
      }, 2000)

      return () => clearInterval(interval)
    } catch (error) {
      console.error("Error in processing:", error)
      setError("Processing failed")
    }
  }

  const getStepIcon = (step: ProcessingStep) => {
    if (step.status === "complete") {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    } else if (step.status === "error") {
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    } else if (step.status === "in-progress") {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
    } else {
      return <div className="h-5 w-5 text-gray-300">{step.icon}</div>
    }
  }

  const handleViewSubmission = () => {
    router.push(`/submission/${submissionId}`)
  }

  const handleUploadMore = () => {
    router.push(`/submission/${submissionId}/upload`)
  }

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing Submission</h2>
      <p className="text-gray-600 mb-6">{currentMessage}</p>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Progress</span>
          <span>{uploadError ? "Error" : `${Math.round(processingProgress)}%`}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full ${uploadError ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${uploadError ? 100 : processingProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Processing steps */}
      <div className="mb-8">
        <ul className="space-y-4">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center">
              <div className="mr-3">{getStepIcon(step)}</div>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.status === "in-progress"
                      ? "text-blue-700"
                      : step.status === "complete"
                        ? "text-green-700"
                        : step.status === "error"
                          ? "text-red-700"
                          : "text-gray-500"
                  }`}
                >
                  {step.label}
                </p>
              </div>
              <div className="text-xs text-gray-500">
                {step.status === "complete" && "Complete"}
                {step.status === "in-progress" && "In Progress"}
                {step.status === "error" && "Failed"}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Error message */}
      {uploadError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-red-700">{uploadError}</p>
              <button onClick={handleRetry} className="mt-2 text-sm font-medium text-red-700 hover:text-red-600">
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion message */}
      {isComplete && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-green-800">Processing Complete!</p>
              <p className="text-sm text-green-700 mt-1">
                Your submission has been successfully processed and is ready for review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-end">
        {isComplete ? (
          <>
            <button
              type="button"
              onClick={handleUploadMore}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upload More Files
            </button>
            <button
              type="button"
              onClick={handleViewSubmission}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              View Submission
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-500 italic">Please wait while we process your submission...</p>
        )}
      </div>
    </div>
  )
}
