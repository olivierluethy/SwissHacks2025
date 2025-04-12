import AIDashboard from "@/components/ai-dashboard"

export default function DashboardPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <AIDashboard dashboardId={params.id} />
    </div>
  )
}
