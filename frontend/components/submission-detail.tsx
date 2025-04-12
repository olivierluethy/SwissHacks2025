"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSubmission } from "@/contexts/SubmissionContext"
import { BarChart2, AlertTriangle, CheckCircle, Clock, FileUp, Layers, FileSearch, FileOutput } from "lucide-react"

const SubmissionDetail = ({ id }: { id: string }) => {
  const router = useRouter()
  const { getSubmissionById } = useSubmission()
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    try {
      const submissionData = getSubmissionById(id)
      if (!submissionData) {
        setError("Submission not found")
      } else {
        setSubmission(submissionData)
      }
    } catch (error) {
      console.error("Error fetching submission:", error)
      setError("Failed to load submission details")
    } finally {
      setLoading(false)
    }
  }, [id, getSubmissionById])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="text-green-500 w-4 h-4 mr-1" />
      case "in-progress":
        return <Clock className="text-amber-500 w-4 h-4 mr-1" />
      case "pending":
        return <AlertTriangle className="text-red-500 w-4 h-4 mr-1" />
      default:
        return null
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "complete":
        return "Complete"
      case "in-progress":
        return "In Progress"
      case "pending":
        return "Pending"
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p>Loading submission details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p>{error}</p>
        <Link href="/" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="mb-4 md:mb-0">
          <h1>{submission.name}</h1>
          <div className="flex items-center mt-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100">
            {getStatusIcon(submission.status)}
            <span>{getStatusLabel(submission.status)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/submission/${id}/upload`}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            <FileUp className="w-4 h-4 mr-2" />
            <span>Upload Files</span>
          </Link>
          <Link
            href={`/submission/${id}/report`}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
          >
            <FileOutput className="w-4 h-4 mr-2" />
            <span>Generate Report</span>
          </Link>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-gray-300 ${activeTab === "overview" ? "border-blue-500 text-blue-600" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-gray-300 ${activeTab === "contract" ? "border-blue-500 text-blue-600" : ""}`}
          onClick={() => setActiveTab("contract")}
        >
          Contract Analysis
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-gray-300 ${activeTab === "files" ? "border-blue-500 text-blue-600" : ""}`}
          onClick={() => setActiveTab("files")}
        >
          File Analytics
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3>Submission Details</h3>
                <div className="grid grid-cols-1 gap-4 mt-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Cedant</span>
                    <span className="text-base font-medium text-gray-800 mt-1">{submission.cedant}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Renewal Date</span>
                    <span className="text-base font-medium text-gray-800 mt-1">{submission.renewalDate}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Territory</span>
                    <span className="text-base font-medium text-gray-800 mt-1">{submission.territory}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Perils</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {submission.perils.map((peril: string, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                        >
                          {peril}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3>Analysis Status</h3>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="flex items-center mb-2">
                      <Layers className="w-4 h-4 text-gray-600 mr-2" />
                      <span>Contract Analysis</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full ${submission.status === "complete" ? "bg-green-500" : "bg-amber-500"}`}
                        style={{ width: submission.status === "complete" ? "100%" : "60%" }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {submission.status === "complete" ? "Complete" : "In Progress"}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="flex items-center mb-2">
                      <BarChart2 className="w-4 h-4 text-gray-600 mr-2" />
                      <span>Economic Analysis</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full ${submission.status === "complete" ? "bg-green-500" : "bg-amber-500"}`}
                        style={{ width: submission.status === "complete" ? "100%" : "40%" }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {submission.status === "complete" ? "Complete" : "In Progress"}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="flex items-center mb-2">
                      <FileSearch className="w-4 h-4 text-gray-600 mr-2" />
                      <span>Claims Analysis</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full ${submission.status === "complete" ? "bg-green-500" : "bg-amber-500"}`}
                        style={{ width: submission.status === "complete" ? "100%" : "20%" }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {submission.status === "complete" ? "Complete" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3>AI-Generated Insights</h3>
              <div className="space-y-3 mt-3">
                <div className="flex items-start p-3 rounded-md bg-green-50 border-l-2 border-green-500">
                  <CheckCircle className="w-5 h-5 mr-3 mt-0.5" />
                  <p>Contract exclusions for Category 5 hurricanes reduce exposure by approximately 15%.</p>
                </div>
                <div className="flex items-start p-3 rounded-md bg-amber-50 border-l-2 border-amber-500">
                  <AlertTriangle className="w-5 h-5 mr-3 mt-0.5" />
                  <p>Rising construction costs (7.1% YoY) may impact claim severity for property damage.</p>
                </div>
                <div className="flex items-start p-3 rounded-md bg-blue-50 border-l-2 border-blue-500">
                  <Clock className="w-5 h-5 mr-3 mt-0.5" />
                  <p>Historical hit rate for Layer 2 is 11%, translating to an expected loss of $1.7M.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href={`/submission/${id}/contract`}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex items-center"
              >
                <Layers className="w-8 h-8 text-blue-500 mr-3" />
                <div className="flex-1">
                  <h4>Contract Analysis</h4>
                  <p>Compare contract terms and analyze changes</p>
                </div>
              </Link>
              <Link
                href={`/submission/${id}/files`}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex items-center"
              >
                <FileSearch className="w-8 h-8 text-blue-500 mr-3" />
                <div className="flex-1">
                  <h4>File Analytics</h4>
                  <p>Extract insights from submission documents</p>
                </div>
              </Link>
              <Link
                href={`/submission/${id}/upload`}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex items-center"
              >
                <FileUp className="w-8 h-8 text-blue-500 mr-3" />
                <div className="flex-1">
                  <h4>Upload Files</h4>
                  <p>Add documents to enhance analysis</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {activeTab === "contract" && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="max-w-md mx-auto text-center">
              <h3>Contract Analysis</h3>
              <p>Analyze contract terms and compare changes between versions.</p>
              <Link
                href={`/submission/${id}/contract`}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 inline-block"
              >
                Go to Contract Analysis
              </Link>
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="max-w-md mx-auto text-center">
              <h3>File Analytics</h3>
              <p>Extract insights from submission documents and analyze data.</p>
              <Link
                href={`/submission/${id}/files`}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 inline-block"
              >
                Go to File Analytics
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SubmissionDetail
