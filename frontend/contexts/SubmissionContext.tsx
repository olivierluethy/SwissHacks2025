"use client"

import { createContext, useState, useContext, type ReactNode } from "react"
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
  const [submissions, setSubmissions] = useState<Submission[]>([floridaSubmission, turkeySubmission])
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null)

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

  const value = {
    submissions,
    activeSubmission,
    setActiveSubmission,
    getSubmissionById,
    updateSubmission,
  }

  return <SubmissionContext.Provider value={value}>{children}</SubmissionContext.Provider>
}
