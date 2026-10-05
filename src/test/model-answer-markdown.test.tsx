import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownLite from "@/components/MarkdownLite";

describe("MarkdownLite", () => {
  it("renders headings and inline bold as React elements", () => {
    const { container } = render(<MarkdownLite>{"## Pemeriksaan\n\nTemuan **penting**."}</MarkdownLite>);

    expect(screen.getByRole("heading", { level: 2, name: "Pemeriksaan" })).toBeInTheDocument();
    expect(screen.getByText("penting").tagName).toBe("STRONG");
    expect(container).not.toHaveTextContent("## Pemeriksaan");
    expect(container).not.toHaveTextContent("**penting**");
  });

  it("renders lists, italic text, inline code, and escapes HTML", () => {
    const { container } = render(
      <MarkdownLite>{"- *anamnesis*\n- gunakan `EKG`\n\n<script>alert(1)</script>"}</MarkdownLite>,
    );

    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelector("em")).toHaveTextContent("anamnesis");
    expect(container.querySelector("code")).toHaveTextContent("EKG");
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("<script>alert(1)</script>");
  });
});
