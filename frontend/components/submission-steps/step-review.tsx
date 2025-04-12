"use client"

import { CheckCircle, AlertTriangle } from "lucide-react"
import type { SubmissionFormData } from "@/hooks/use-submission-form"

type StepReviewProps = {
  formData: SubmissionFormData
  onSubmit: () => void
  onPrev: () => void
}

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Calculate total size of all files
const calculateTotalSize = (files: File[]) => {
  return files.reduce((total, file) => total + file.size, 0)
}

export default function StepReview({ formData, onSubmit, onPrev }: StepReviewProps) {
  const totalSize = calculateTotalSize(formData.files)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Review Submission</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-base font-medium text-gray-800 mb-3">Submission Details</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Submission Name</p>
                <p className="text-base text-gray-800">{formData.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Cedant</p>
                <p className="text-base text-gray-800">{formData.cedant}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Renewal Date</p>
                <p className="text-base text-gray-800">{formData.renewalDate}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Territory</p>
                <p className="text-base text-gray-800">{formData.territory}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Perils Covered</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.perils.map((peril) => (
                    <span
                      key={peril}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {peril.charAt(0).toUpperCase() + peril.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
              {formData.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Additional Notes</p>
                  <p className="text-sm text-gray-700">{formData.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-medium text-gray-800 mb-3">Files ({formData.files.length})</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            {formData.files.length > 0 ? (
              <div>
                <div className="mb-3">
                  <p className="text-sm text-gray-500">
                    Total Size: <span className="font-medium">{formatFileSize(totalSize)}</span>
                  </p>
                </div>
                <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                  {formData.files.map((file, index) => (
                    <li key={index} className="py-2">
                      <p className="text-sm font-medium text-gray-800">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center text-amber-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <p>No files uploaded</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex">
          <CheckCircle className="h-6 w-6 text-blue-500 mr-3" />
          <div>
            <h3 className="text-base font-medium text-blue-800">Ready to Submit</h3>
            <p className="text-sm text-blue-700 mt-1">
              Once submitted, your files will be uploaded and processed. You'll be able to track the progress and add
              more files later if needed.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to File Upload
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Submit Submission
        </button>
      </div>
    </div>
  )
}
