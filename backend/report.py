"""PDF / text report rendering.

Moved out of main.py unchanged in behaviour, except that the font is resolved
from config instead of a CWD-relative "./fonts/..." path (IMP-016) and chart
images are always cleaned up.
"""

from __future__ import annotations

import logging
import os
import tempfile

import matplotlib

matplotlib.use("Agg")  # headless; must be set before pyplot is imported
import matplotlib.pyplot as plt  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402
from fpdf import FPDF, HTMLMixin  # noqa: E402

import config  # noqa: E402

logger = logging.getLogger("archre.report")


class PDF(FPDF, HTMLMixin):
    pass


def render_chart(chart_data: dict) -> str:
    """Render a chart spec to a PNG and return its path."""
    chart_type = chart_data.get("chartType")
    data_points = chart_data.get("data", []) or []

    values = [pt.get("value") for pt in data_points]
    labels = []
    for pt in data_points:
        extras = {k: v for k, v in pt.items() if k != "value"}
        labels.append(next(iter(extras.values())) if extras else "")

    plt.figure(figsize=(6, 4))
    plt.title(chart_data.get("title", "Chart"))
    if not data_points:
        plt.text(0.5, 0.5, "No data", ha="center")
    elif chart_type == "bar":
        plt.bar(labels, values, color="skyblue")
        plt.xlabel(chart_data.get("xAxisLabel", ""))
        plt.ylabel(chart_data.get("yAxisLabel", ""))
    elif chart_type == "line":
        plt.plot(labels, values, marker="o", linestyle="-", color="green")
        plt.xlabel(chart_data.get("xAxisLabel", ""))
        plt.ylabel(chart_data.get("yAxisLabel", ""))
    elif chart_type == "pie":
        plt.pie(values, labels=labels, autopct="%1.1f%%")
    else:
        plt.text(0.5, 0.5, "Unsupported chart type", ha="center")

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    plt.tight_layout()
    plt.savefig(temp_file.name, format="png")
    plt.close()
    return temp_file.name


def render_html_to_text(html_content: str) -> str:
    soup = BeautifulSoup(html_content or "", "html.parser")
    return soup.get_text(separator="\n")


def _report_lines(data: dict) -> list:
    lines = [f"=== {data.get('title', 'Overview Report')} ===\n", "Markdown Summary:\n"]
    lines.append(data.get("markdown", "No overview markdown provided.") + "\n")

    key_insights = data.get("keyInsights", []) or []
    lines.append("=== Key Insights ===\n")
    if key_insights:
        for insight in key_insights:
            lines.append(f"* {insight.get('title', 'No Title')}")
            lines.append(f"  Description: {insight.get('description', 'No Description')}")
            lines.append(f"  Impact: {insight.get('impact', 'N/A')}")
            lines.append(f"  Confidence: {insight.get('confidence', 0)}\n")
    else:
        lines.append("No key insights available.\n")

    lines.append("=== Dashboard Tabs ===\n")
    for tab in data.get("tabs", []) or []:
        lines.append(f"[{tab.get('id')}] {tab.get('title', 'No Title')}")
        content = tab.get("content", {}) or {}
        content_type = content.get("type", "N/A")
        if content_type == "json":
            lines.append("Chart Content: (Rendered as graph below)")
        elif content_type == "html":
            lines.append("HTML Content Rendered:")
            lines.append(render_html_to_text(content.get("data", "")))
        lines.append("")
    return lines


def generate_report(data: dict, output_format: str = "pdf", output_filepath: str = "report") -> str:
    """Render `data` (a dashboard document) to PDF or TXT. Returns the file path."""
    report_text = "\n".join(_report_lines(data))
    tabs = data.get("tabs", []) or []

    if output_format.lower() == "txt":
        output_file = output_filepath + ".txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report_text)
        return output_file

    if output_format.lower() != "pdf":
        raise ValueError("Unsupported output format. Choose 'pdf' or 'txt'.")

    pdf = PDF()
    pdf.add_page()
    pdf.add_font("DejaVu", "", str(config.FONTS_DIR / "DejaVuSerif.ttf"), uni=True)
    pdf.set_font("DejaVu", "", 12)
    pdf.set_auto_page_break(auto=True, margin=15)

    for line in report_text.split("\n"):
        pdf.multi_cell(0, 10, line)

    for tab in tabs:
        content = tab.get("content", {}) or {}
        content_type = content.get("type", "N/A")
        pdf.ln(10)
        pdf.cell(0, 10, f"Tab: {tab.get('title', 'No Title')}", ln=True)

        if content_type == "json":
            chart_data = content.get("data", {}) or {}
            image_path = render_chart(chart_data)
            pdf.ln(5)
            try:
                pdf.image(image_path, w=pdf.w / 2)
            except RuntimeError as e:
                pdf.multi_cell(0, 10, f"Error rendering chart: {e}")
            finally:
                try:
                    os.remove(image_path)
                except OSError:
                    pass
            pdf.multi_cell(0, 10, f"Description: {chart_data.get('description', '')}")
        elif content_type == "html":
            html_content = content.get("data", "")
            pdf.ln(5)
            try:
                pdf.write_html(html_content)
            except Exception:
                pdf.multi_cell(0, 10, render_html_to_text(html_content))
        else:
            pdf.multi_cell(0, 10, "Unsupported content type.")

    output_file = output_filepath + ".pdf"
    pdf.output(output_file)
    return output_file
