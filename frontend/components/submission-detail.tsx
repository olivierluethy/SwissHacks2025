"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSubmission } from "@/contexts/SubmissionContext"
import { BarChart2, AlertTriangle, CheckCircle, Clock, FileUp, Layers, FileSearch, FileOutput } from "lucide-react"
import "./SubmissionDetail.css"

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
        return <CheckCircle className="status-icon complete" />
      case "in-progress":
        return <Clock className="status-icon in-progress" />
      case "pending":
        return <AlertTriangle className="status-icon pending" />
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
      <div className="submission-loading">
        <div className="spinner"></div>
        <p>Loading submission details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="submission-error">
        <AlertTriangle className="error-icon" />
        <p>{error}</p>
        <Link href="/" className="back-button">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="submission-detail-container">
      <div className="submission-header">
        <div className="submission-title">
          <h1>{submission.name}</h1>
          <div className="status-badge">
            {getStatusIcon(submission.status)}
            <span>{getStatusLabel(submission.status)}</span>
          </div>
        </div>
        <div className="submission-actions">
          <Link href={`/submission/${id}/upload`} className="action-button">
            <FileUp className="action-icon" />
            <span>Upload Files</span>
          </Link>
          <Link href={`/submission/${id}/report`} className="action-button primary">
            <FileOutput className="action-icon" />
            <span>Generate Report</span>
          </Link>
        </div>
      </div>

      <div className="submission-tabs">
        <button
          className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === "contract" ? "active" : ""}`}
          onClick={() => setActiveTab("contract")}
        >
          Contract Analysis
        </button>
        <button className={`tab-button ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>
          File Analytics
        </button>
      </div>

      <div className="submission-content">
        {activeTab === "overview" && (
          <div className="overview-tab">
            <div className="info-cards">
              <div className="info-card">
                <h3>Submission Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Cedant</span>
                    <span className="info-value">{submission.cedant}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Renewal Date</span>
                    <span className="info-value">{submission.renewalDate}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Territory</span>
                    <span className="info-value">{submission.territory}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Perils</span>
                    <div className="peril-tags">
                      {submission.perils.map((peril: string, index: number) => (
                        <span key={index} className="peril-tag">
                          {peril}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="info-card">
                <h3>Analysis Status</h3>
                <div className="analysis-status">
                  <div className="status-item">
                    <div className="status-header">
                      <Layers className="status-icon" />
                      <span>Contract Analysis</span>
                    </div>
                    <div className="status-progress">
                      <div
                        className={`progress-bar ${submission.status === "complete" ? "complete" : "in-progress"}`}
                        style={{ width: submission.status === "complete" ? "100%" : "60%" }}
                      ></div>
                    </div>
                    <span className="status-text">{submission.status === "complete" ? "Complete" : "In Progress"}</span>
                  </div>
                  <div className="status-item">
                    <div className="status-header">
                      <BarChart2 className="status-icon" />
                      <span>Economic Analysis</span>
                    </div>
                    <div className="status-progress">
                      <div
                        className={`progress-bar ${submission.status === "complete" ? "complete" : "in-progress"}`}
                        style={{ width: submission.status === "complete" ? "100%" : "40%" }}
                      ></div>
                    </div>
                    <span className="status-text">{submission.status === "complete" ? "Complete" : "In Progress"}</span>
                  </div>
                  <div className="status-item">
                    <div className="status-header">
                      <FileSearch className="status-icon" />
                      <span>Claims Analysis</span>
                    </div>
                    <div className="status-progress">
                      <div
                        className={`progress-bar ${submission.status === "complete" ? "complete" : "pending"}`}
                        style={{ width: submission.status === "complete" ? "100%" : "20%" }}
                      ></div>
                    </div>
                    <span className="status-text">{submission.status === "complete" ? "Complete" : "Pending"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="insights-section">
              <h3>AI-Generated Insights</h3>
              <div className="insights-list">
                <div className="insight-item positive">
                  <CheckCircle className="insight-icon" />
                  <p>Contract exclusions for Category 5 hurricanes reduce exposure by approximately 15%.</p>
                </div>
                <div className="insight-item warning">
                  <AlertTriangle className="insight-icon" />
                  <p>Rising construction costs (7.1% YoY) may impact claim severity for property damage.</p>
                </div>
                <div className="insight-item neutral">
                  <Clock className="insight-icon" />
                  <p>Historical hit rate for Layer 2 is 11%, translating to an expected loss of $1.7M.</p>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <Link href={`/submission/${id}/contract`} className="quick-action-card">
                <Layers className="quick-action-icon" />
                <div className="quick-action-content">
                  <h4>Contract Analysis</h4>
                  <p>Compare contract terms and analyze changes</p>
                </div>
              </Link>
              <Link href={`/submission/${id}/files`} className="quick-action-card">
                <FileSearch className="quick-action-icon" />
                <div className="quick-action-content">
                  <h4>File Analytics</h4>
                  <p>Extract insights from submission documents</p>
                </div>
              </Link>
              <Link href={`/submission/${id}/upload`} className="quick-action-card">
                <FileUp className="quick-action-icon" />
                <div className="quick-action-content">
                  <h4>Upload Files</h4>
                  <p>Add documents to enhance analysis</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {activeTab === "contract" && (
          <div className="contract-tab">
            <div className="tab-redirect">
              <h3>Contract Analysis</h3>
              <p>Analyze contract terms and compare changes between versions.</p>
              <Link href={`/submission/${id}/contract`} className="redirect-button">
                Go to Contract Analysis
              </Link>
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="files-tab">
            <div className="tab-redirect">
              <h3>File Analytics</h3>
              <p>Extract insights from submission documents and analyze data.</p>
              <Link href={`/submission/${id}/files`} className="redirect-button">
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
