"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSubmission } from "@/contexts/SubmissionContext"
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Download,
  Settings,
  Layers,
  BarChart2,
  FileSearch,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react"
import "./ReportGenerator.css"

type ReportSection = {
  id: string
  title: string
  description: string
  included: boolean
  required?: boolean
  icon: React.ReactNode
}

type ReportFormat = "pdf" | "docx" | "html"

const ReportGenerator = ({ id }: { id: string }) => {
  const { getSubmissionById } = useSubmission()
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const [reportFormat, setReportFormat] = useState<ReportFormat>("pdf")
  const [reportSections, setReportSections] = useState<ReportSection[]>([
    {
      id: "executive-summary",
      title: "Executive Summary",
      description: "High-level overview of the submission and key findings",
      included: true,
      required: true,
      icon: <FileText className="section-icon" />,
    },
    {
      id: "contract-analysis",
      title: "Contract Analysis",
      description: "Detailed comparison of contract terms and changes",
      included: true,
      icon: <Layers className="section-icon" />,
    },
    {
      id: "claims-analysis",
      title: "Claims Analysis",
      description: "Historical claims data analysis and trends",
      included: true,
      icon: <AlertTriangle className="section-icon" />,
    },
    {
      id: "exposure-analysis",
      title: "Exposure Analysis",
      description: "Analysis of exposure data and geographic distribution",
      included: true,
      icon: <FileSearch className="section-icon" />,
    },
    {
      id: "economic-factors",
      title: "Economic Factors",
      description: "Relevant economic indicators and market conditions",
      included: true,
      icon: <BarChart2 className="section-icon" />,
    },
    {
      id: "recommendations",
      title: "Recommendations",
      description: "Suggested actions and considerations",
      included: true,
      required: true,
      icon: <CheckCircle className="section-icon" />,
    },
  ])
  const [customizations, setCustomizations] = useState({
    includeCoverPage: true,
    includeTableOfContents: true,
    includeAppendices: true,
    includeCharts: true,
    includeRawData: false,
  })
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)

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
      } catch (error) {
        console.error("Error fetching submission data:", error)
        setError("Failed to load submission data")
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissionData()
  }, [id, getSubmissionById])

  const toggleSectionInclusion = (sectionId: string) => {
    setReportSections((prevSections) =>
      prevSections.map((section) =>
        section.id === sectionId && !section.required ? { ...section, included: !section.included } : section,
      ),
    )
  }

  const toggleAdvancedSettings = () => {
    setAdvancedSettingsOpen(!advancedSettingsOpen)
  }

  const updateCustomization = (key: keyof typeof customizations, value: boolean) => {
    setCustomizations((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const generateReport = async () => {
    try {
      setGenerating(true)

      // Prepare report configuration
      const reportConfig = {
        submissionId: id,
        format: reportFormat,
        sections: reportSections.filter((section) => section.included).map((section) => section.id),
        customizations,
      }

      // Call API to generate report
      // This is a mock implementation - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Mock report URL
      const mockReportUrl = `/api/reports/${id}/download?format=${reportFormat}`

      setReportUrl(mockReportUrl)
      setReportGenerated(true)
    } catch (error) {
      console.error("Error generating report:", error)
      alert("Failed to generate report. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="report-loading">
        <div className="spinner"></div>
        <p>Loading submission data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="report-error">
        <AlertTriangle className="error-icon" />
        <p>{error}</p>
        <Link href={`/submission/${id}`} className="back-button">
          Back to Submission
        </Link>
      </div>
    )
  }

  return (
    <div className="report-generator-container">
      <div className="generator-header">
        <h2>Report Generator</h2>
        <p>Create a customized analysis report for {submission.name}</p>
      </div>

      <div className="generator-content">
        <div className="report-configuration">
          <div className="config-section">
            <h3>Report Sections</h3>
            <p className="section-description">Select the sections to include in your report</p>

            <div className="sections-list">
              {reportSections.map((section) => (
                <div key={section.id} className="section-item">
                  <div className="section-checkbox">
                    <input
                      type="checkbox"
                      id={section.id}
                      checked={section.included}
                      onChange={() => toggleSectionInclusion(section.id)}
                      disabled={section.required}
                    />
                    <label htmlFor={section.id} className="checkbox-label">
                      <div className="section-title">
                        {section.icon}
                        <span>{section.title}</span>
                        {section.required && <span className="required-badge">Required</span>}
                      </div>
                    </label>
                  </div>
                  <p className="section-description">{section.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="config-section">
            <h3>Report Format</h3>
            <p className="section-description">Select the output format for your report</p>

            <div className="format-options">
              <div className="format-option">
                <input
                  type="radio"
                  id="format-pdf"
                  name="report-format"
                  value="pdf"
                  checked={reportFormat === "pdf"}
                  onChange={() => setReportFormat("pdf")}
                />
                <label htmlFor="format-pdf">
                  <FileText className="format-icon" />
                  <span>PDF Document</span>
                </label>
              </div>

              <div className="format-option">
                <input
                  type="radio"
                  id="format-docx"
                  name="report-format"
                  value="docx"
                  checked={reportFormat === "docx"}
                  onChange={() => setReportFormat("docx")}
                />
                <label htmlFor="format-docx">
                  <FileText className="format-icon" />
                  <span>Word Document (DOCX)</span>
                </label>
              </div>

              <div className="format-option">
                <input
                  type="radio"
                  id="format-html"
                  name="report-format"
                  value="html"
                  checked={reportFormat === "html"}
                  onChange={() => setReportFormat("html")}
                />
                <label htmlFor="format-html">
                  <FileText className="format-icon" />
                  <span>Web Page (HTML)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="advanced-settings-header" onClick={toggleAdvancedSettings}>
              <h3>
                <Settings className="settings-icon" />
                Advanced Settings
              </h3>
              {advancedSettingsOpen ? <ChevronUp className="toggle-icon" /> : <ChevronDown className="toggle-icon" />}
            </div>

            {advancedSettingsOpen && (
              <div className="advanced-settings">
                <div className="setting-item">
                  <input
                    type="checkbox"
                    id="cover-page"
                    checked={customizations.includeCoverPage}
                    onChange={(e) => updateCustomization("includeCoverPage", e.target.checked)}
                  />
                  <label htmlFor="cover-page">Include cover page</label>
                </div>

                <div className="setting-item">
                  <input
                    type="checkbox"
                    id="table-of-contents"
                    checked={customizations.includeTableOfContents}
                    onChange={(e) => updateCustomization("includeTableOfContents", e.target.checked)}
                  />
                  <label htmlFor="table-of-contents">Include table of contents</label>
                </div>

                <div className="setting-item">
                  <input
                    type="checkbox"
                    id="appendices"
                    checked={customizations.includeAppendices}
                    onChange={(e) => updateCustomization("includeAppendices", e.target.checked)}
                  />
                  <label htmlFor="appendices">Include appendices</label>
                </div>

                <div className="setting-item">
                  <input
                    type="checkbox"
                    id="charts"
                    checked={customizations.includeCharts}
                    onChange={(e) => updateCustomization("includeCharts", e.target.checked)}
                  />
                  <label htmlFor="charts">Include charts and visualizations</label>
                </div>

                <div className="setting-item">
                  <input
                    type="checkbox"
                    id="raw-data"
                    checked={customizations.includeRawData}
                    onChange={(e) => updateCustomization("includeRawData", e.target.checked)}
                  />
                  <label htmlFor="raw-data">Include raw data tables</label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="report-preview">
          {reportGenerated ? (
            <div className="report-success">
              <CheckCircle className="success-icon" />
              <h3>Report Generated Successfully</h3>
              <p>Your report is ready to download</p>

              <div className="report-actions">
                <a href={reportUrl || "#"} className="download-button" download>
                  <Download className="action-icon" />
                  <span>Download Report</span>
                </a>
                <button className="regenerate-button" onClick={generateReport}>
                  <RefreshCw className="action-icon" />
                  <span>Regenerate Report</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="preview-placeholder">
              <FileText className="placeholder-icon" />
              <h3>Report Preview</h3>
              <p>Configure your report options and click Generate to create your report</p>

              <div className="report-summary">
                <h4>Report Summary</h4>
                <div className="summary-item">
                  <span className="summary-label">Submission:</span>
                  <span className="summary-value">{submission.name}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Sections:</span>
                  <span className="summary-value">{reportSections.filter((s) => s.included).length} selected</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Format:</span>
                  <span className="summary-value">{reportFormat.toUpperCase()}</span>
                </div>
              </div>

              <button className="generate-button" onClick={generateReport} disabled={generating}>
                {generating ? (
                  <>
                    <div className="spinner small"></div>
                    <span>Generating Report...</span>
                  </>
                ) : (
                  <>
                    <FileText className="action-icon" />
                    <span>Generate Report</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportGenerator
