"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { aiService } from "@/services/ai.service"
import { FileText, AlertTriangle, CheckCircle, Clock, RefreshCw, Play, Loader2, FileSearch } from "lucide-react"

type Submission = {
  id: string
  name: string
  status: "pending_analysis" | "analyzing" | "pending_review"
  dashboardId?: string
}

export default function SubmissionList() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingSubmissions, setProcessingSubmissions] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)

  // Load submissions on mount
  useEffect(() => {
    fetchSubmissions()
  }, [])

  // Poll for updates on processing submissions
  useEffect(() => {
    const processingIds = submissions.filter((sub) => sub.status === "analyzing").map((sub) => sub.id)

    if (processingIds.length === 0) return

    const interval = setInterval(() => {
      processingIds.forEach((id) => {
        updateSubmissionStatus(id)
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [submissions])

  const fetchSubmissions = async () => {
    try {
      setLoading(true)
      const data = await aiService.getSubmissions()

      // Map the old status values to new ones
      const mappedData = data.map((sub: any) => ({
        ...sub,
        status: mapStatus(sub.status),
      }))

      setSubmissions(mappedData)
    } catch (err) {
      console.error("Error fetching submissions:", err)
      setError("Failed to load submissions")
    } finally {
      setLoading(false)
    }
  }

  // Map old status values to new ones
  const mapStatus = (oldStatus: string): "pending_analysis" | "analyzing" | "pending_review" => {
    switch (oldStatus) {
      case "pending":
        return "pending_analysis"
      case "processing":
        return "analyzing"
      case "completed":
        return "pending_review"
      default:
        return "pending_analysis"
    }
  }

  const refreshSubmissions = async () => {
    try {
      setRefreshing(true)
      await fetchSubmissions()
    } catch (err) {
      console.error("Error refreshing submissions:", err)
    } finally {
      setRefreshing(false)
    }
  }

  const processSubmission = async (submissionId: string) => {
    try {
      setProcessingSubmissions((prev) => ({ ...prev, [submissionId]: true }))
      await aiService.processSubmission(submissionId)

      // Update submission status
      setSubmissions((prev) => prev.map((sub) => (sub.id === submissionId ? { ...sub, status: "analyzing" } : sub)))
    } catch (err) {
      console.error("Error processing submission:", err)
    } finally {
      setProcessingSubmissions((prev) => ({ ...prev, [submissionId]: false }))
    }
  }

  const updateSubmissionStatus = async (submissionId: string) => {
    try {
      const status = await aiService.getProcessingStatus(submissionId)

      setSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === submissionId
            ? {
                ...sub,
                status: mapStatus(status.status),
                dashboardId: status.dashboardId,
              }
            : sub,
        ),
      )
    } catch (err) {
      console.error("Error updating submission status:", err)
    }
  }

  const viewDashboard = (dashboardId: string) => {
    router.push(`/dashboard/${dashboardId}`)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending_review":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "analyzing":
        return <Clock className="w-5 h-5 text-blue-500" />
      default:
        return <FileText className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending_review":
        return "Pending Review"
      case "analyzing":
        return "Analyzing"
      default:
        return "Pending Analysis"
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm p-8">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-gray-600 font-medium">Loading submissions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm p-8">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Submissions</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={refreshSubmissions}
        >
          Retry
        </button>
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm p-8">
        <FileText className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Submissions Found</h2>
        <p className="text-gray-600 mb-6">There are no submissions available for analysis</p>
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={refreshSubmissions}
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="flex justify-between items-center p-5 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Submissions</h2>
        <div className="flex items-center space-x-2">
          <button
            className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
            onClick={refreshSubmissions}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {submissions.map((submission) => (
              <tr key={submission.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="flex items-center">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center 
                      ${
                        submission.status === "pending_review"
                          ? "bg-green-100"
                          : submission.status === "analyzing"
                            ? "bg-blue-100"
                            : "bg-gray-100"
                      }`}
                    >
                      {getStatusIcon(submission.status)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{submission.id}</div>
                      <div className="text-sm text-gray-500">{submission.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <span
                    className={`px-3 py-1.5 inline-flex text-sm font-medium rounded-full 
                    ${
                      submission.status === "pending_review"
                        ? "bg-green-100 text-green-800"
                        : submission.status === "analyzing"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {getStatusText(submission.status)}
                  </span>
                </td>
                <td className="px-6 py-5 whitespace-nowrap text-center">
                  {submission.status === "pending_review" ? (
                    <button
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                      onClick={() => viewDashboard(submission.dashboardId!)}
                    >
                      <FileSearch className="w-4 h-4 mr-2" />
                      <span>Show Report</span>
                    </button>
                  ) : submission.status === "pending_analysis" ? (
                    <button
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                      onClick={() => processSubmission(submission.id)}
                      disabled={processingSubmissions[submission.id]}
                    >
                      {processingSubmissions[submission.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          <span>Analyze</span>
                        </>
                      )}
                    </button>
                  ) : submission.status === "analyzing" ? (
                    <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-md">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Analyzing...</span>
                    </div>
                  ) : (
                    <button
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                      onClick={() => processSubmission(submission.id)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      <span>Retry</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
