"""Regression tests for the model-output contract.

BUG-003: the old `clean_and_parse_json` regex "repair" broke valid JSON. Each
input below is a case that used to raise JSONDecodeError or silently corrupt the
payload; they must all survive the schema path intact.
"""

import json

import pytest
from pydantic import ValidationError

from schemas import ChartSpec, Dashboard, KeyInsight, Overview, Tab


# The exact strings that broke the old parser.
BROKEN_BY_OLD_PARSER = [
    '{"title": "T", "markdown": "Loss ratio, combined: 92%"}',
    '{"title": "T", "markdown": "see https://x.io, note: high"}',
    '{"title": "T", "markdown": "Deductible, per occurrence: EUR 5m"}',
    '{"title": "T", "markdown": "```python\\ncode\\n```"}',
]


@pytest.mark.parametrize("raw", BROKEN_BY_OLD_PARSER)
def test_valid_json_survives(raw):
    overview = Overview.model_validate(json.loads(raw))
    assert overview.title == "T"
    # The content must be byte-identical - the old parser mangled it.
    assert overview.markdown == json.loads(raw)["markdown"]


def test_colon_inside_string_is_preserved_exactly():
    payload = {"title": "T", "markdown": "Loss ratio, combined: 92%"}
    assert Overview.model_validate(payload).markdown == "Loss ratio, combined: 92%"


def test_extra_properties_rejected():
    with pytest.raises(ValidationError):
        Overview.model_validate({"title": "T", "markdown": "m", "sneaky": 1})


def test_missing_required_field_rejected():
    with pytest.raises(ValidationError):
        Overview.model_validate({"title": "T"})


def test_confidence_bounds_enforced():
    base = {"title": "t", "description": "d", "impact": "positive"}
    assert KeyInsight.model_validate({**base, "confidence": 0.5}).confidence == 0.5
    for bad in (-0.1, 1.1):
        with pytest.raises(ValidationError):
            KeyInsight.model_validate({**base, "confidence": bad})


def test_impact_enum_enforced():
    with pytest.raises(ValidationError):
        KeyInsight.model_validate(
            {"title": "t", "description": "d", "impact": "sideways", "confidence": 0.5}
        )


def test_chart_type_enum_enforced():
    with pytest.raises(ValidationError):
        ChartSpec.model_validate({"chartType": "donut", "title": "t", "data": []})


def test_chart_accepts_empty_data():
    # The frontend renders an empty state for this (BUG-012); it must not be a
    # validation error, or a whole run fails over one bad tab.
    assert ChartSpec.model_validate({"chartType": "bar", "title": "t", "data": []}).data == []


def test_tab_union_discriminates_html_and_chart():
    html_tab = Tab.model_validate(
        {"id": "a", "title": "A", "content": {"type": "html", "data": "<p>x</p>"}}
    )
    assert html_tab.content.type == "html"

    chart_tab = Tab.model_validate(
        {
            "id": "b",
            "title": "B",
            "content": {
                "type": "json",
                "data": {"chartType": "bar", "title": "t", "data": [
                    {"category": "x", "value": 1.0}
                ]},
            },
        }
    )
    assert chart_tab.content.type == "json"
    assert chart_tab.content.data.data[0].value == 1.0


def test_dashboard_round_trips_through_json():
    dashboard = Dashboard(
        title="T",
        markdown="Loss ratio, combined: 92%",
        keyInsights=[
            KeyInsight(title="a", description="b", impact="negative", confidence=0.3)
        ],
        tabs=[],
    )
    restored = Dashboard.model_validate(json.loads(json.dumps(dashboard.model_dump())))
    assert restored == dashboard


def test_schema_is_json_schema_serialisable():
    # llm._response_format depends on this.
    schema = Overview.model_json_schema()
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == {"title", "markdown"}
