"use client"

import type React from "react"

import { useState } from "react"
import { Calendar, Building2, MapPin } from "lucide-react"
import type { SubmissionFormData } from "@/hooks/use-submission-form"

type StepBasicInfoProps = {
  formData: SubmissionFormData
  updateFormData: (data: Partial<SubmissionFormData>) => void
  onNext: () => void
}

const perilOptions = [
  { id: "hurricane", label: "Hurricane" },
  { id: "earthquake", label: "Earthquake" },
  { id: "flood", label: "Flood" },
  { id: "fire", label: "Fire" },
  { id: "windstorm", label: "Windstorm" },
  { id: "tsunami", label: "Tsunami" },
  { id: "landslide", label: "Landslide" },
  { id: "tornado", label: "Tornado" },
]

export default function StepBasicInfo({ formData, updateFormData, onNext }: StepBasicInfoProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Submission name is required"
    }

    if (!formData.cedant.trim()) {
      newErrors.cedant = "Cedant name is required"
    }

    if (!formData.renewalDate.trim()) {
      newErrors.renewalDate = "Renewal date is required"
    }

    if (!formData.territory.trim()) {
      newErrors.territory = "Territory is required"
    }

    if (formData.perils.length === 0) {
      newErrors.perils = "At least one peril must be selected"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onNext()
    }
  }

  const handlePerilChange = (perilId: string) => {
    const updatedPerils = formData.perils.includes(perilId)
      ? formData.perils.filter((id) => id !== perilId)
      : [...formData.perils, perilId]

    updateFormData({ perils: updatedPerils })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Basic Submission Information</h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Submission Name*
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              className={`w-full px-3 py-2 border ${
                errors.name ? "border-red-500" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., Florida Property Catastrophe 2025"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="cedant" className="block text-sm font-medium text-gray-700 mb-1">
              Cedant Name*
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="cedant"
                type="text"
                value={formData.cedant}
                onChange={(e) => updateFormData({ cedant: e.target.value })}
                className={`w-full pl-10 pr-3 py-2 border ${
                  errors.cedant ? "border-red-500" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                placeholder="e.g., Florida Regional Insurance"
              />
            </div>
            {errors.cedant && <p className="mt-1 text-sm text-red-600">{errors.cedant}</p>}
          </div>

          <div>
            <label htmlFor="renewalDate" className="block text-sm font-medium text-gray-700 mb-1">
              Renewal Date*
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="renewalDate"
                type="date"
                value={formData.renewalDate}
                onChange={(e) => updateFormData({ renewalDate: e.target.value })}
                className={`w-full pl-10 pr-3 py-2 border ${
                  errors.renewalDate ? "border-red-500" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              />
            </div>
            {errors.renewalDate && <p className="mt-1 text-sm text-red-600">{errors.renewalDate}</p>}
          </div>

          <div>
            <label htmlFor="territory" className="block text-sm font-medium text-gray-700 mb-1">
              Territory*
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="territory"
                type="text"
                value={formData.territory}
                onChange={(e) => updateFormData({ territory: e.target.value })}
                className={`w-full pl-10 pr-3 py-2 border ${
                  errors.territory ? "border-red-500" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                placeholder="e.g., Florida (All counties)"
              />
            </div>
            {errors.territory && <p className="mt-1 text-sm text-red-600">{errors.territory}</p>}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Perils Covered*</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {perilOptions.map((peril) => (
              <div key={peril.id} className="flex items-center">
                <input
                  id={`peril-${peril.id}`}
                  type="checkbox"
                  checked={formData.perils.includes(peril.id)}
                  onChange={() => handlePerilChange(peril.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`peril-${peril.id}`} className="ml-2 block text-sm text-gray-700">
                  {peril.label}
                </label>
              </div>
            ))}
          </div>
          {errors.perils && <p className="mt-1 text-sm text-red-600">{errors.perils}</p>}
        </div>

        <div className="mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={formData.notes || ""}
            onChange={(e) => updateFormData({ notes: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional information about this submission..."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Continue to File Upload
          </button>
        </div>
      </form>
    </div>
  )
}
