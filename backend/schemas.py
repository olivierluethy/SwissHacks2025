"""Typed contracts for everything the model is allowed to return.

IMP-006 / BUG-003: these schemas used to exist only as prose inside f-string
prompts, and the output was coerced with a regex "repair" function that broke
valid JSON (`{"markdown": "Loss ratio, combined: 92%"}` raised JSONDecodeError).
They are now real Pydantic models, handed to the API as a strict JSON schema and
validated on the way back, so malformed output cannot reach the UI.
"""

from typing import List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class _Strict(BaseModel):
    """Base for every model-facing schema.

    `extra="forbid"` maps to `additionalProperties: false`, which the OpenAI
    structured-output mode requires.
    """

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# Charts
# ---------------------------------------------------------------------------
class DataPoint(_Strict):
    category: str = Field(description="Label for the data point")
    value: float = Field(description="Numerical value")


class ChartSpec(_Strict):
    chartType: Literal["bar", "line", "pie"]
    title: str
    description: str = ""
    xAxisLabel: str = ""
    yAxisLabel: str = ""
    data: List[DataPoint] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Dashboard pieces
# ---------------------------------------------------------------------------
class Overview(_Strict):
    title: str = Field(description="The main title of the analysis report")
    markdown: str = Field(
        description="Markdown summary focusing on critical, non-obvious insights"
    )


class KeyInsight(_Strict):
    title: str = Field(description="Insight headline")
    description: str = Field(description="Detailed explanation")
    impact: Literal["positive", "negative"]
    confidence: float = Field(ge=0.0, le=1.0)


class KeyInsights(_Strict):
    insights: List[KeyInsight] = Field(default_factory=list)


class HtmlContent(_Strict):
    type: Literal["html"]
    data: str


class ChartContent(_Strict):
    type: Literal["json"]
    data: ChartSpec


class Tab(_Strict):
    id: str = Field(description="Unique tab identifier, kebab-case")
    title: str
    content: Union[ChartContent, HtmlContent]


class Tabs(_Strict):
    tabs: List[Tab] = Field(default_factory=list)


class Dashboard(BaseModel):
    """The document the frontend renders. Assembled server-side, not by the model."""

    title: str
    markdown: str
    keyInsights: List[KeyInsight] = Field(default_factory=list)
    tabs: List[Tab] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Per-source-file summary (IMP-004 map step)
# ---------------------------------------------------------------------------
class FileSummary(_Strict):
    summary: str = Field(
        description="Dense factual summary preserving every figure that matters "
        "for underwriting: limits, deductibles, premiums, exposures, losses, dates."
    )
    figures: List[str] = Field(
        default_factory=list,
        description="Verbatim key figures with their labels, e.g. 'Total insured value: EUR 4.2bn'",
    )


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
class ChatChartDecision(_Strict):
    wants_chart: bool
    chart: Optional[ChartSpec] = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: Optional[str] = None
    chart: Optional[ChartSpec] = None
