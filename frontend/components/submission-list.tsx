"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { aiService } from "@/services/ai.service"
import { FileText, AlertTriangle, CheckCircle, Clock, RefreshCw, Play, Loader2 } from "lucide-react"

type Submission = {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "failed"
  lastUpdated: string
  progress: number
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
    const processingIds = submissions.filter((sub) => sub.status === "processing").map((sub) => sub.id)

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
      setSubmissions(data)
    } catch (err) {
      console.error("Error fetching submissions:", err)
      setError("Failed to load submissions")
    } finally {
      setLoading(false)
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
      setSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === submissionId
            ? { ...sub, status: "processing", progress: 5, lastUpdated: new Date().toISOString() }
            : sub,
        ),
      )
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
                status: status.status,
                progress: status.progress,
                lastUpdated: status.lastUpdated,
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "processing":
        return <Clock className="w-5 h-5 text-blue-500" />
      case "failed":
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <FileText className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed"
      case "processing":
        return "Processing"
      case "failed":
        return "Failed"
      default:
        return "Pending"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading submissions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Submissions</h2>
        <p className="text-gray-600">{error}</p>
        <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md" onClick={refreshSubmissions}>
          Retry
        </button>
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FileText className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Submissions Found</h2>
        <p className="text-gray-600 mb-6">There are no submissions available for analysis</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Submissions</h2>
        <button
          className="flex items-center text-sm text-gray-600 hover:text-blue-600"
          onClick={refreshSubmissions}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          <span>Refresh</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {submissions.map((submission) => (
              <tr key={submission.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getStatusIcon(submission.status)}
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">{submission.name}</div>
                      <div className="text-xs text-gray-500">ID: {submission.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${
                      submission.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : submission.status === "processing"
                          ? "bg-blue-100 text-blue-800"
                          : submission.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {getStatusText(submission.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(submission.lastUpdated)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {submission.status === "processing" ? (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{submission.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${submission.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : submission.status === "completed" ? (
                    <span className="text-sm text-gray-500">100% Complete</span>
                  ) : (
                    <span className="text-sm text-gray-500">Not started</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {submission.status === "completed" ? (
                    <button
                      className="text-blue-600 hover:text-blue-900 ml-3"
                      onClick={() => viewDashboard(submission.dashboardId!)}
                    >
                      View Dashboard
                    </button>
                  ) : submission.status === "pending" ? (
                    <button
                      className="flex items-center text-green-600 hover:text-green-900 ml-3"
                      onClick={() => processSubmission(submission.id)}
                      disabled={processingSubmissions[submission.id]}
                    >
                      {processingSubmissions[submission.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          <span>Process</span>
                        </>
                      )}
                    </button>
                  ) : submission.status === "processing" ? (
                    <span className="text-gray-500">Processing...</span>
                  ) : (
                    <button
                      className="text-red-600 hover:text-red-900 ml-3"
                      onClick={() => processSubmission(submission.id)}
                    >
                      Retry
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
