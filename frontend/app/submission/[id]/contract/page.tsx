import Navigation from "@/components/navigation"
import ContractAnalysis from "@/components/contract-analysis"

export default function ContractAnalysisPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Navigation />
      <ContractAnalysis id={params.id} />
    </>
  )
}
