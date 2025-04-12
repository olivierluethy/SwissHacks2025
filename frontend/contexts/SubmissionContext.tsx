"use client"

import { createContext, useState, useContext, useEffect, type ReactNode } from "react"
import { submissionService } from "@/services/submission.api"
import { floridaSubmission, turkeySubmission } from "@/data/mockData"

type Submission = {
  id: string
  name: string
  status: string
  cedant: string
  renewalDate: string
  territory: string
  perils: string[]
  [key: string]: any
}

type SubmissionContextType = {
  submissions: Submission[]
  activeSubmission: Submission | null
  setActiveSubmission: (submission: Submission | null) => void
  getSubmissionById: (id: string) => Submission | undefined
  updateSubmission: (id: string, updates: Partial<Submission>) => void
  addSubmission: (submission: Submission) => void
  refreshSubmissions: () => Promise<void>
  loading: boolean
}

const SubmissionContext = createContext<SubmissionContextType | undefined>(undefined)

export function useSubmission() {
  const context = useContext(SubmissionContext)
  if (context === undefined) {
    throw new Error("useSubmission must be used within a SubmissionProvider")
  }
  return context
}

export function SubmissionProvider({ children }: { children: ReactNode }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)

  // Load submissions on mount
  useEffect(() => {
    const loadSubmissions = async () => {
      try {
        setLoading(true)

        // Try to get submissions from API/localStorage
        const apiSubmissions = await submissionService.getSubmissions()

        if (apiSubmissions && apiSubmissions.length > 0) {
          setSubmissions(apiSubmissions)
        } else {
          // Fall back to mock data if no submissions found
          setSubmissions([floridaSubmission, turkeySubmission])
        }
      } catch (error) {
        console.error("Error loading submissions:", error)
        // Fall back to mock data on error
        setSubmissions([floridaSubmission, turkeySubmission])
      } finally {
        setLoading(false)
      }
    }

    loadSubmissions()
  }, [])

  // Function to get submission by ID
  const getSubmissionById = (id: string) => {
    return submissions.find((sub) => sub.id === id)
  }

  // Function to update submission
  const updateSubmission = (id: string, updates: Partial<Submission>) => {
    setSubmissions((prevSubmissions) => prevSubmissions.map((sub) => (sub.id === id ? { ...sub, ...updates } : sub)))

    if (activeSubmission && activeSubmission.id === id) {
      setActiveSubmission((prev) => (prev ? { ...prev, ...updates } : null))
    }
  }

  // Function to add a new submission
  const addSubmission = (submission: Submission) => {
    setSubmissions((prevSubmissions) => [...prevSubmissions, submission])
  }

  // Function to refresh submissions from API
  const refreshSubmissions = async () => {
    try {
      setLoading(true)
      const apiSubmissions = await submissionService.getSubmissions()

      if (apiSubmissions && apiSubmissions.length > 0) {
        setSubmissions(apiSubmissions)

        // Update active submission if it exists
        if (activeSubmission) {
          const updatedActive = apiSubmissions.find((sub) => sub.id === activeSubmission.id)
          if (updatedActive) {
            setActiveSubmission(updatedActive)
          }
        }
      }
    } catch (error) {
      console.error("Error refreshing submissions:", error)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    submissions,
    activeSubmission,
    setActiveSubmission,
    getSubmissionById,
    updateSubmission,
    addSubmission,
    refreshSubmissions,
    loading,
  }

  return <SubmissionContext.Provider value={value}>{children}</SubmissionContext.Provider>
}
