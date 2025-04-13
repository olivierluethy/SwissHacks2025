import SubmissionList from "@/components/submission-list"

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">AI-Powered Reinsurance Analytics</h1>
        <p className="text-gray-600">Analyze and review reinsurance submissions with advanced AI insights</p>
      </div>
      <SubmissionList />
    </div>
  )
}
