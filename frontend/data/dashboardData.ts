// Mock data for dashboard charts and visualizations

export const contractRiskData = [
  { name: "Exclusions", previous: 45, current: 30 },
  { name: "Coverage Territory", previous: 65, current: 57 },
  { name: "Claims Notification", previous: 40, current: 35 },
  { name: "Reinstatement", previous: 60, current: 48 },
]

export const layerData = [
  { name: "Layer 1", attachment: 10, limit: 20, hitRate: 18, expectedLoss: 2.4, rol: 22.5 },
  { name: "Layer 2", attachment: 30, limit: 20, hitRate: 11, expectedLoss: 1.7, rol: 18.5 },
  { name: "Layer 3", attachment: 50, limit: 30, hitRate: 7, expectedLoss: 1.2, rol: 14.0 },
]

export const hurricaneData = [
  { year: 2015, frequency: 6, severity: 2.3 },
  { year: 2016, frequency: 7, severity: 2.1 },
  { year: 2017, frequency: 10, severity: 3.2 },
  { year: 2018, frequency: 8, severity: 2.7 },
  { year: 2019, frequency: 7, severity: 2.5 },
  { year: 2020, frequency: 12, severity: 3.4 },
  { year: 2021, frequency: 9, severity: 3.1 },
  { year: 2022, frequency: 8, severity: 2.9 },
  { year: 2023, frequency: 11, severity: 3.3 },
  { year: 2024, frequency: 10, severity: 3.5 },
]

export const claimsData = [
  { category: "Hurricane", cedant: 30, industry: 43 },
  { category: "Fire", cedant: 12, industry: 12 },
  { category: "Windstorm", cedant: 18, industry: 20 },
  { category: "Flood", cedant: 22, industry: 20 },
]

export const exposureData = [
  { name: "Miami-Dade", value: 35 },
  { name: "Broward", value: 25 },
  { name: "Palm Beach", value: 20 },
  { name: "Orange", value: 10 },
  { name: "Other", value: 10 },
]

export const economicData = [
  { year: 2015, inflation: 1.8, constructionIndex: 95, insuranceRates: 100 },
  { year: 2016, inflation: 2.1, constructionIndex: 97, insuranceRates: 102 },
  { year: 2017, inflation: 2.3, constructionIndex: 100, insuranceRates: 105 },
  { year: 2018, inflation: 2.5, constructionIndex: 103, insuranceRates: 108 },
  { year: 2019, inflation: 1.9, constructionIndex: 106, insuranceRates: 110 },
  { year: 2020, inflation: 1.4, constructionIndex: 108, insuranceRates: 115 },
  { year: 2021, inflation: 7.0, constructionIndex: 115, insuranceRates: 125 },
  { year: 2022, inflation: 6.5, constructionIndex: 125, insuranceRates: 140 },
  { year: 2023, inflation: 3.9, constructionIndex: 130, insuranceRates: 150 },
  { year: 2024, inflation: 3.0, constructionIndex: 135, insuranceRates: 155 },
]

export const climateRiskData = [
  { year: 2025, baseline: 100, lowEmission: 105, highEmission: 110 },
  { year: 2030, baseline: 100, lowEmission: 110, highEmission: 125 },
  { year: 2035, baseline: 100, lowEmission: 115, highEmission: 140 },
  { year: 2040, baseline: 100, lowEmission: 120, highEmission: 160 },
  { year: 2045, baseline: 100, lowEmission: 125, highEmission: 180 },
  { year: 2050, baseline: 100, lowEmission: 130, highEmission: 200 },
]

export const contractChanges = [
  {
    clause: "Exclusions",
    previous: "Standard named storm exclusions",
    current: "Enhanced exclusions for Category 5 hurricanes",
    impact: "↓ -15% risk",
    color: "text-green-600",
  },
  {
    clause: "Coverage Territory",
    previous: "All Florida counties",
    current: "Excludes Monroe County",
    impact: "↓ -8% exposure",
    color: "text-green-600",
  },
  {
    clause: "Claims Notification",
    previous: "72-hour reporting window",
    current: "48-hour reporting requirement",
    impact: "↓ -5% risk",
    color: "text-green-600",
  },
  {
    clause: "Reinstatement",
    previous: "1 automatic reinstatement at 100%",
    current: "1 automatic reinstatement at 85%",
    impact: "↓ -12% risk",
    color: "text-green-600",
  },
]

export const keyInsights = [
  {
    text: "Contract changes reduce exposure by 15% YoY",
    type: "positive",
  },
  {
    text: "Cedant hurricane claims 13% below industry average",
    type: "positive",
  },
  {
    text: "Hurricane frequency shows 8% increase over 10-year period",
    type: "warning",
  },
  {
    text: "Positive regulatory environment with reform measures",
    type: "positive",
  },
]

export const underwriterResponse = {
  decision: "Accept",
  layer: "Layer 2 ($20M xs $30M)",
  pricing: "ROL 18.5%",
  rationale:
    "Based on comprehensive analysis of contract changes, historical performance, and risk modeling, this layer presents a favorable risk-reward profile. The cedant has demonstrated better-than-industry claims performance, and contract changes have reduced overall exposure.",
  conditions: [
    "Maintain current exclusions for Category 5 hurricanes",
    "Require 48-hour claims reporting compliance",
    "Reinstatement provision at 85% as specified",
  ],
  analyst: "Sarah Johnson",
  date: "2024-04-10",
}
