import AIDashboard from "@/components/ai-dashboard"

// BUG-020: Next 15 requires params to be awaited.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="max-w-7xl mx-auto p-6">
      <AIDashboard dashboardId={id} />
    </div>
  )
}
