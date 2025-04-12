"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSubmission } from "@/contexts/SubmissionContext"
import { dashboardService } from "@/services/dashboard.api"
import { submissionService } from "@/services/submission.api"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart2,
  ThermometerSun,
  DollarSign,
  Building,
  MapPin,
  Wind,
  Plus,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

const Dashboard = () => {
  const router = useRouter()
  const { getSubmissionById } = useSubmission()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [allSubmissions, setAllSubmissions] = useState<any[]>([])
  const [processingSubmissions, setProcessingSubmissions] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch all submissions
        const submissions = await submissionService.getSubmissions()
        setAllSubmissions(submissions)

        // Filter processing submissions
        const processing = submissions.filter((sub: any) => sub.status === "pending")
        setProcessingSubmissions(processing)

        // Get the first complete submission as default (in a real app, this would be based on route params)
        const completeSubmission = submissions.find((sub: any) => sub.status === "complete")

        if (completeSubmission) {
          setSubmission(completeSubmission)

          // Fetch dashboard data for the selected submission
          const data = await dashboardService.getDashboardData(completeSubmission.id)
          setDashboardData(data)
        } else if (submissions.length > 0) {
          // If no complete submissions, use the first one
          setSubmission(submissions[0])
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err)
        setError("Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const refreshSubmissions = async () => {
    try {
      setRefreshing(true)

      // Fetch all submissions
      const submissions = await submissionService.getSubmissions()
      setAllSubmissions(submissions)

      // Filter processing submissions
      const processing = submissions.filter((sub: any) => sub.status === "pending")
      setProcessingSubmissions(processing)

      // Check if current submission status has changed
      if (submission) {
        const updatedSubmission = submissions.find((sub: any) => sub.id === submission.id)
        if (updatedSubmission && updatedSubmission.status !== submission.status) {
          setSubmission(updatedSubmission)

          // If status changed to complete, fetch dashboard data
          if (updatedSubmission.status === "complete") {
            const data = await dashboardService.getDashboardData(updatedSubmission.id)
            setDashboardData(data)
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing submissions:", err)
    } finally {
      setRefreshing(false)
    }
  }

  const selectSubmission = async (submissionId: string) => {
    try {
      setLoading(true)

      // Find submission in existing list
      const selectedSubmission = allSubmissions.find((sub: any) => sub.id === submissionId)

      if (selectedSubmission) {
        setSubmission(selectedSubmission)

        // If submission is complete, fetch dashboard data
        if (selectedSubmission.status === "complete") {
          const data = await dashboardService.getDashboardData(submissionId)
          setDashboardData(data)
        }
      }
    } catch (err) {
      console.error("Error selecting submission:", err)
      setError("Failed to load submission data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Dashboard</h2>
        <p className="text-gray-600">{error}</p>
        <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  if (!allSubmissions || allSubmissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <FileText className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Submissions Found</h2>
        <p className="text-gray-600 mb-6">Create your first submission to get started</p>
        <Link
          href="/submission/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition-colors"
        >
          Create New Submission
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Submission Info Bar */}
      <div className="bg-white border-b border-gray-200 py-2 px-4">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <select
                value={submission?.id || ""}
                onChange={(e) => selectSubmission(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {allSubmissions.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            {submission && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  submission.status === "complete" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {submission.status === "complete" ? "Analysis Complete" : "Processing"}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3 mt-2 sm:mt-0">
            <button
              onClick={refreshSubmissions}
              className="flex items-center text-sm text-gray-600 hover:text-blue-600"
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              <span>Refresh</span>
            </button>
            <Link
              href="/submission/new"
              className="flex items-center text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>New Submission</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Processing Submissions Alert */}
      {processingSubmissions.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 p-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-amber-500 mr-2" />
              <span className="text-sm text-amber-800">
                {processingSubmissions.length === 1
                  ? "1 submission is currently being processed"
                  : `${processingSubmissions.length} submissions are currently being processed`}
              </span>
            </div>
            <button
              onClick={refreshSubmissions}
              className="text-xs text-amber-800 hover:text-amber-900 font-medium"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Check Status"}
            </button>
          </div>
        </div>
      )}

      {/* Show processing state if selected submission is not complete */}
      {submission && submission.status !== "complete" ? (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <div className="bg-white rounded-lg shadow-sm p-8 max-w-2xl w-full">
            <div className="text-center mb-6">
              <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing Submission</h2>
              <p className="text-gray-600">
                Your submission is currently being processed. This may take a few minutes.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>In Progress</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-blue-500 w-3/5"></div>
              </div>
            </div>

            <div className="mb-8">
              <ul className="space-y-4">
                <li className="flex items-center">
                  <div className="mr-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700">Uploading Files</p>
                  </div>
                  <div className="text-xs text-gray-500">Complete</div>
                </li>
                <li className="flex items-center">
                  <div className="mr-3">
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700">Analyzing Documents</p>
                  </div>
                  <div className="text-xs text-gray-500">In Progress</div>
                </li>
                <li className="flex items-center">
                  <div className="mr-3">
                    <div className="h-5 w-5 text-gray-300">
                      <BarChart2 className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500">Processing Data</p>
                  </div>
                  <div className="text-xs text-gray-500">Pending</div>
                </li>
              </ul>
            </div>

            <div className="flex justify-between">
              <Link
                href="/"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50"
              >
                Return Later
              </Link>
              <button
                onClick={refreshSubmissions}
                className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh Status"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Navigation Tabs - Only show for complete submissions */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="flex overflow-x-auto hide-scrollbar">
              <button
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap ${
                  activeTab === "overview"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap ${
                  activeTab === "contract"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("contract")}
              >
                Contract Analysis
              </button>
              <button
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap ${
                  activeTab === "economic"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("economic")}
              >
                Economic Factors
              </button>
              <button
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap ${
                  activeTab === "historical"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("historical")}
              >
                Historical Performance
              </button>
              <button
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap ${
                  activeTab === "climate"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("climate")}
              >
                Climate Risk
              </button>
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {/* Underwriter Response - Always visible at the top */}
            {dashboardData && dashboardData.underwriterResponse && (
              <div className="bg-white rounded-lg shadow-sm border-l-4 border-blue-500 p-4 mb-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-1">Underwriter Response</h2>
                    <div className="flex items-center mb-2">
                      <span className="font-medium text-blue-600 mr-2">
                        {dashboardData.underwriterResponse.decision}:
                      </span>
                      <span>
                        {dashboardData.underwriterResponse.layer} at {dashboardData.underwriterResponse.pricing}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 md:mt-0">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium">
                      Accept Recommendation
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-3">{dashboardData.underwriterResponse.rationale}</p>
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Conditions:</h3>
                  <ul className="text-sm text-gray-600 list-disc pl-5">
                    {dashboardData.underwriterResponse.conditions.map((condition: string, index: number) => (
                      <li key={index}>{condition}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Analysis by {dashboardData.underwriterResponse.analyst} on {dashboardData.underwriterResponse.date}
                </div>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Submission Info */}
                <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium mb-4">Submission Details</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Perils Covered</h4>
                      <div className="flex flex-wrap gap-1">
                        {submission.perils.map((peril: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {peril}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Territory</h4>
                      <p className="text-gray-900">{submission.territory}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Cedant</h4>
                      <p className="text-gray-900">{submission.cedant}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Renewal Date</h4>
                      <p className="text-gray-900">{submission.renewalDate}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-lg font-medium mb-4">Layer Performance</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Layer
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Attachment
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Limit
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Hit Rate
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Expected Loss
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              ROL
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Recommendation
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {dashboardData.layerData.map((layer: any, index: number) => (
                            <tr key={index} className={layer.name === "Layer 2" ? "bg-blue-50" : ""}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                {layer.name}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                ${layer.attachment}M
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${layer.limit}M</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{layer.hitRate}%</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                ${layer.expectedLoss}M
                              </td>
                              <td
                                className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${
                                  layer.name === "Layer 2" ? "text-blue-600" : "text-gray-900"
                                }`}
                              >
                                {layer.rol}%
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm">
                                {layer.name === "Layer 2" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Accept
                                  </span>
                                ) : layer.name === "Layer 1" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    Consider
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    Decline
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Key Insights */}
                <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
                  <div className="p-5">
                    <h3 className="text-lg font-medium mb-3">Key Insights</h3>
                    <ul className="space-y-4">
                      {dashboardData.keyInsights.map((insight: any, index: number) => (
                        <li key={index} className="flex items-start">
                          {insight.type === "positive" ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                          )}
                          <span>{insight.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-medium mb-3">Geographic Exposure</h3>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardData.exposureData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {dashboardData.exposureData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Contractual Changes */}
                <div className="col-span-1 md:col-span-3 bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium mb-4">Contractual Risk Changes (YoY)</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.contractRiskData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="previous" name="2023 Risk" fill="#8884d8" />
                        <Bar dataKey="current" name="2024 Risk" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Contract Analysis Tab */}
            {activeTab === "contract" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium mb-4">Key Contractual Changes</h3>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Clause
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          2023 Contract
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          2024 Contract
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Risk Impact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardData.contractChanges.map((change: any, index: number) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {change.clause}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{change.previous}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{change.current}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${change.color}`}>{change.impact}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Contract Risk Assessment</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.contractRiskData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={120} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="previous" name="2023 Risk" fill="#8884d8" />
                          <Bar dataKey="current" name="2024 Risk" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-4">Risk Reduction Analysis</h3>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="text-base font-medium text-gray-800 mb-2">Key Improvements</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Enhanced exclusions reduce Category 5 hurricane exposure by 15%</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Territory restrictions eliminate high-risk Monroe County properties</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Faster claims reporting requirements improve loss control</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <h4 className="text-base font-medium text-blue-800 mb-2">Contract Analysis Summary</h4>
                      <p className="text-gray-700">
                        The 2024 contract shows significant improvements in risk management through targeted exclusions,
                        territory restrictions, and enhanced reporting requirements. Overall risk reduction is estimated
                        at 12% compared to the 2023 contract.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Economic Factors Tab */}
            {activeTab === "economic" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium mb-4">Economic Factors Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="text-base font-medium mb-3">Economic Indicators (10-Year Trend)</h4>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboardData.economicData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="inflation" stroke="#8884d8" name="Inflation Rate (%)" />
                          <Line
                            type="monotone"
                            dataKey="constructionIndex"
                            stroke="#82ca9d"
                            name="Construction Cost Index"
                          />
                          <Line type="monotone" dataKey="insuranceRates" stroke="#ffc658" name="Insurance Rate Index" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-base font-medium mb-3">Economic Impact Assessment</h4>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h5 className="text-sm font-medium text-gray-800 mb-2">Key Economic Factors</h5>
                      <ul className="space-y-3">
                        <li className="flex items-start">
                          <DollarSign className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium block">Inflation</span>
                            <p className="text-sm text-gray-600">
                              Current inflation rate of 3.0% is moderating after 2021-2022 spike, reducing pressure on
                              claims costs.
                            </p>
                          </div>
                        </li>
                        <li className="flex items-start">
                          <Building className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium block">Construction Costs</span>
                            <p className="text-sm text-gray-600">
                              Construction costs remain elevated at 35% above 2017 baseline, impacting property repair
                              and replacement costs.
                            </p>
                          </div>
                        </li>
                        <li className="flex items-start">
                          <BarChart2 className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium block">Insurance Market</span>
                            <p className="text-sm text-gray-600">
                              Insurance rates have increased 55% since 2017, reflecting hardening market conditions and
                              increased catastrophe losses.
                            </p>
                          </div>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <h5 className="text-base font-medium text-blue-800 mb-2">Economic Outlook</h5>
                      <p className="text-gray-700">
                        Economic indicators suggest stabilizing conditions with moderating inflation, though elevated
                        construction costs and insurance rates will continue to impact loss costs. The overall economic
                        environment presents a moderate risk factor for this submission.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Performance Tab */}
            {activeTab === "historical" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium mb-4">Historical Performance Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-base font-medium mb-3">Cedant Claims vs. Industry Data</h4>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.claimsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="cedant" name="Cedant Claims" fill="#8884d8" />
                          <Bar dataKey="industry" name="Industry Average" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-base font-medium mb-3">Hurricane Trend Analysis</h4>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboardData.hurricaneData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="frequency"
                            stroke="#8884d8"
                            name="Hurricane Frequency"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="severity"
                            stroke="#82ca9d"
                            name="Severity Index"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <h4 className="text-base font-medium text-gray-800 mb-3">Historical Performance Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Claims Performance</h5>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Cedant hurricane claims 13% below industry average</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Consistent underperformance in flood claims suggests effective risk selection</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Average claim settlement time 15% faster than industry benchmark</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Hurricane Trends</h5>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Hurricane frequency shows 8% increase over 10-year period</span>
                        </li>
                        <li className="flex items-start">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Severity index increased by 52% since 2015</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Contract exclusions mitigate impact of increasing hurricane severity</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Climate Risk Tab */}
            {activeTab === "climate" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium mb-4">Climate Risk Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="text-base font-medium mb-3">Climate Risk Projections (2025-2050)</h4>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData.climateRiskData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="baseline"
                            stackId="1"
                            stroke="#8884d8"
                            fill="#8884d8"
                            name="Baseline Risk Index"
                          />
                          <Area
                            type="monotone"
                            dataKey="lowEmission"
                            stackId="2"
                            stroke="#82ca9d"
                            fill="#82ca9d"
                            name="Low Emission Scenario"
                          />
                          <Area
                            type="monotone"
                            dataKey="highEmission"
                            stackId="3"
                            stroke="#ffc658"
                            fill="#ffc658"
                            name="High Emission Scenario"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-base font-medium mb-3">Climate Risk Assessment</h4>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h5 className="text-sm font-medium text-gray-800 mb-2">Key Climate Factors</h5>
                      <ul className="space-y-3">
                        <li className="flex items-start">
                          <ThermometerSun className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium block">Sea Level Rise</span>
                            <p className="text-sm text-gray-600">
                              Projected 8-12 inch rise by 2050 increases flood risk for coastal properties in coverage
                              territory.
                            </p>
                          </div>
                        </li>
                        <li className="flex items-start">
                          <Wind className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium block">Hurricane Intensity</span>
                            <p className="text-sm text-gray-600">
                              Models project 10-15% increase in Category 4-5 hurricane frequency by 2050.
                            </p>
                          </div>
                        </li>
                        <li className="flex items-start">
                          <MapPin className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium block">Geographic Exposure</span>
                            <p className="text-sm text-gray-600">
                              Contract exclusion of Monroe County and coastal areas reduces exposure to highest climate
                              risk zones.
                            </p>
                          </div>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <h5 className="text-base font-medium text-blue-800 mb-2">Climate Risk Outlook</h5>
                      <p className="text-gray-700">
                        Climate models indicate increasing risk over the contract period, but territorial exclusions and
                        enhanced Category 5 hurricane exclusions provide significant mitigation. The 1-year contract
                        term limits exposure to long-term climate trends.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 p-4 mt-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <div className="text-sm text-gray-500 mb-2 md:mb-0">
            <span className="font-medium">ARCHRE</span> - Advanced Reinsurance Contract and Hazard Risk Evaluator
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            <span>Last updated: {refreshing ? "Refreshing..." : "10 minutes ago"}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Dashboard
