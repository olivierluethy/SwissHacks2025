"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSubmission } from "@/contexts/SubmissionContext"
import { fileService } from "@/services/file.api"
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  ArrowLeftRight,
  Plus,
  Minus,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

type Contract = {
  id: string
  name: string
  type: string
  url: string
  date?: string
  size?: number
}

type Clause = {
  id: string
  name: string
  previousText?: string
  currentText?: string
  changes?: {
    type: "addition" | "deletion" | "modification"
    text: string
  }[]
  significance?: "high" | "medium" | "low"
}

const ContractAnalysis = ({ id }: { id: string }) => {
  const { getSubmissionById } = useSubmission()
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<{
    previous: Contract | null
    current: Contract | null
  }>({
    previous: null,
    current: null,
  })
  const [clauses, setClauses] = useState<Clause[]>([])
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null)
  const [comparisonMode, setComparisonMode] = useState<"side-by-side" | "inline">("side-by-side")
  const [filterSignificance, setFilterSignificance] = useState<"all" | "high" | "medium" | "low">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    coverage: true,
    exclusions: true,
    conditions: true,
    definitions: true,
    endorsements: false,
  })

  useEffect(() => {
    const fetchSubmissionData = async () => {
      try {
        setLoading(true)
        const submissionData = getSubmissionById(id)

        if (!submissionData) {
          setError("Submission not found")
          return
        }

        setSubmission(submissionData)

        // Fetch contracts
        const contractsData = await fileService.getSubmissionFiles(id)

        // Filter for contract documents
        const previousContract = contractsData.find(
          (file: any) => file.type === "previous-contract" || file.name.toLowerCase().includes("previous"),
        )

        const currentContract = contractsData.find(
          (file: any) => file.type === "current-contract" || file.name.toLowerCase().includes("current"),
        )

        setContracts({
          previous: previousContract || null,
          current: currentContract || null,
        })

        // If we have both contracts, fetch comparison
        if (previousContract && currentContract) {
          const comparisonData = await fileService.compareContracts(id, previousContract.name, currentContract.name)

          if (comparisonData && comparisonData.clauses) {
            setClauses(comparisonData.clauses)
            if (comparisonData.clauses.length > 0) {
              setSelectedClause(comparisonData.clauses[0])
            }
          }
        }
      } catch (error) {
        console.error("Error fetching contract data:", error)
        setError("Failed to load contract analysis")
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissionData()
  }, [id, getSubmissionById])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const getSignificanceLabel = (significance: string) => {
    switch (significance) {
      case "high":
        return (
          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            High Impact
          </span>
        )
      case "medium":
        return (
          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Medium Impact
          </span>
        )
      case "low":
        return (
          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            Low Impact
          </span>
        )
      default:
        return null
    }
  }

  const getSignificanceIcon = (significance: string) => {
    switch (significance) {
      case "high":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "medium":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />
      case "low":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      default:
        return null
    }
  }

  const getClauseCategory = (clauseName: string): string => {
    clauseName = clauseName.toLowerCase()

    if (clauseName.includes("cover") || clauseName.includes("insured") || clauseName.includes("peril")) {
      return "coverage"
    } else if (clauseName.includes("exclu") || clauseName.includes("not covered")) {
      return "exclusions"
    } else if (
      clauseName.includes("condition") ||
      clauseName.includes("requirement") ||
      clauseName.includes("obligation")
    ) {
      return "conditions"
    } else if (clauseName.includes("defin") || clauseName.includes("mean")) {
      return "definitions"
    } else if (clauseName.includes("endorse") || clauseName.includes("rider")) {
      return "endorsements"
    }

    return "other"
  }

  const filteredClauses = clauses.filter((clause) => {
    // Filter by significance
    if (filterSignificance !== "all" && clause.significance !== filterSignificance) {
      return false
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        clause.name.toLowerCase().includes(query) ||
        (clause.previousText && clause.previousText.toLowerCase().includes(query)) ||
        (clause.currentText && clause.currentText.toLowerCase().includes(query))
      )
    }

    return true
  })

  // Group clauses by category
  const clausesByCategory: Record<string, Clause[]> = {
    coverage: [],
    exclusions: [],
    conditions: [],
    definitions: [],
    endorsements: [],
    other: [],
  }

  filteredClauses.forEach((clause) => {
    const category = getClauseCategory(clause.name)
    clausesByCategory[category].push(clause)
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-8 h-8 border-3 border-gray-100 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Loading contract analysis...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
        <p className="text-gray-600">{error}</p>
        <Link
          href={`/submission/${id}`}
          className="mt-4 py-2 px-4 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          Back to Submission
        </Link>
      </div>
    )
  }

  if (!contracts.previous || !contracts.current) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
        <p className="text-gray-600">Missing contract documents. Please upload both previous and current contracts.</p>
        <Link
          href={`/submission/${id}/upload`}
          className="mt-4 py-2 px-4 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          Upload Contracts
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Contract Analysis</h2>
        <p className="text-sm text-gray-500">Compare and analyze changes between contract versions</p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center w-full md:w-auto flex-1">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-base font-semibold text-gray-800">Previous Contract</h3>
              <p className="text-sm text-gray-500">{contracts.previous.name}</p>
            </div>
          </div>
          <div>
            <a
              href={contracts.previous.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              View Document
            </a>
          </div>
        </div>

        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500">
          <ArrowLeftRight className="w-5 h-5" />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center w-full md:w-auto flex-1">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-base font-semibold text-gray-800">Current Contract</h3>
              <p className="text-sm text-gray-500">{contracts.current.name}</p>
            </div>
          </div>
          <div>
            <a
              href={contracts.current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              View Document
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search clauses..."
                className="w-full py-2 pl-8 pr-2 border border-gray-300 rounded-md text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full">
              <select
                value={filterSignificance}
                onChange={(e) => setFilterSignificance(e.target.value as any)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-600 bg-white"
              >
                <option value="all">All Changes</option>
                <option value="high">High Impact</option>
                <option value="medium">Medium Impact</option>
                <option value="low">Low Impact</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {Object.keys(clausesByCategory).map(
              (category) =>
                clausesByCategory[category].length > 0 && (
                  <div key={category} className="mb-4">
                    <div
                      className="flex justify-between items-center p-2 bg-gray-50 rounded-md cursor-pointer mb-2"
                      onClick={() => toggleSection(category)}
                    >
                      <h4 className="text-sm font-semibold text-gray-600 capitalize">{category}</h4>
                      {expandedSections[category] ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>

                    {expandedSections[category] && (
                      <div className="flex flex-col gap-1">
                        {clausesByCategory[category].map((clause) => (
                          <div
                            key={clause.id}
                            className={`flex items-center justify-between p-3 rounded-md cursor-pointer ${
                              selectedClause?.id === clause.id
                                ? "bg-blue-50 border-l-2 border-blue-500"
                                : "hover:bg-gray-50"
                            }`}
                            onClick={() => setSelectedClause(clause)}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm text-gray-700">{clause.name}</span>
                              {clause.significance && getSignificanceIcon(clause.significance)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ),
            )}

            {filteredClauses.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <p className="text-gray-600">No clauses found matching your criteria</p>
                {(filterSignificance !== "all" || searchQuery) && (
                  <button
                    className="mt-3 py-1.5 px-3 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
                    onClick={() => {
                      setFilterSignificance("all")
                      setSearchQuery("")
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col">
          {selectedClause ? (
            <>
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{selectedClause.name}</h3>
                  {selectedClause.significance && getSignificanceLabel(selectedClause.significance)}
                </div>
                <div className="flex gap-2">
                  <button
                    className={`py-1.5 px-3 text-sm font-medium rounded-md ${
                      comparisonMode === "side-by-side"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setComparisonMode("side-by-side")}
                  >
                    Side by Side
                  </button>
                  <button
                    className={`py-1.5 px-3 text-sm font-medium rounded-md ${
                      comparisonMode === "inline"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setComparisonMode("inline")}
                  >
                    Inline Changes
                  </button>
                </div>
              </div>

              {comparisonMode === "side-by-side" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">Previous Contract</h4>
                    <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-800 whitespace-pre-line overflow-y-auto max-h-[300px]">
                      {selectedClause.previousText || <em className="text-gray-500">No text available</em>}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">Current Contract</h4>
                    <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-800 whitespace-pre-line overflow-y-auto max-h-[300px]">
                      {selectedClause.currentText || <em className="text-gray-500">No text available</em>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">Changes</h4>
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                    {selectedClause.changes && selectedClause.changes.length > 0 ? (
                      selectedClause.changes.map((change, index) => (
                        <div
                          key={index}
                          className={`flex items-start p-3 rounded-md ${
                            change.type === "addition"
                              ? "bg-emerald-50 border-l-2 border-emerald-500"
                              : change.type === "deletion"
                                ? "bg-red-50 border-l-2 border-red-500"
                                : "bg-blue-50 border-l-2 border-blue-500"
                          }`}
                        >
                          {change.type === "addition" && <Plus className="w-4 h-4 text-emerald-500 mr-3 mt-0.5" />}
                          {change.type === "deletion" && <Minus className="w-4 h-4 text-red-500 mr-3 mt-0.5" />}
                          {change.type === "modification" && (
                            <ArrowLeftRight className="w-4 h-4 text-blue-500 mr-3 mt-0.5" />
                          )}
                          <div className="text-sm text-gray-700">{change.text}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-600">No specific changes detected</p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-3">Analysis Notes</h4>
                <div className="text-sm text-gray-600">
                  <p>
                    {selectedClause.significance === "high" &&
                      "This clause contains significant changes that may substantially alter coverage or terms. Careful review is recommended."}
                    {selectedClause.significance === "medium" &&
                      "This clause contains moderate changes that modify but do not fundamentally alter the coverage or terms."}
                    {selectedClause.significance === "low" &&
                      "This clause contains minor changes, primarily clarifications or formatting adjustments with minimal impact."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <FileText className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-600">Select a clause to view details and comparison</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            Contract Comparison Summary
          </h3>
          <div className="flex justify-between">
            <div className="text-center">
              <span className="block text-2xl font-semibold text-gray-800">{clauses.length}</span>
              <span className="text-sm text-gray-500">Total Clauses</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-semibold text-gray-800">
                {clauses.filter((c) => c.significance === "high").length}
              </span>
              <span className="text-sm text-gray-500">High Impact</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-semibold text-gray-800">
                {clauses.filter((c) => c.significance === "medium").length}
              </span>
              <span className="text-sm text-gray-500">Medium Impact</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-semibold text-gray-800">
                {clauses.filter((c) => c.significance === "low").length}
              </span>
              <span className="text-sm text-gray-500">Low Impact</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Key Findings</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-start p-3 bg-red-50 rounded-md border-l-2 border-red-500">
              <AlertTriangle className="w-4 h-4 text-red-500 mr-3 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p>
                  Expanded exclusions for cyber-related losses may reduce coverage for technology-related incidents.
                </p>
              </div>
            </div>
            <div className="flex items-start p-3 bg-amber-50 rounded-md border-l-2 border-amber-500">
              <AlertTriangle className="w-4 h-4 text-amber-500 mr-3 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p>Modified reporting requirements shorten the claim notification period from 90 to 60 days.</p>
              </div>
            </div>
            <div className="flex items-start p-3 bg-emerald-50 rounded-md border-l-2 border-emerald-500">
              <CheckCircle className="w-4 h-4 text-emerald-500 mr-3 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p>Clarified definitions for "flood" and "storm surge" improve consistency with industry standards.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link
          href={`/submission/${id}/report`}
          className="py-2 px-4 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors flex items-center"
        >
          <FileText className="w-4 h-4 mr-2" />
          <span>Generate Report</span>
        </Link>
        <a
          href="#"
          className="py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors flex items-center"
          onClick={(e) => e.preventDefault()}
        >
          <Download className="w-4 h-4 mr-2" />
          <span>Download Analysis</span>
        </a>
      </div>
    </div>
  )
}

export default ContractAnalysis
