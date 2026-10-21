import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EvidenceWeighingConfig } from "@kukui/schemas";
import Component from "./Component.js";
import uiSchema from "./ui-schema.js";

// jsdom rewrites import.meta.url to a non-file scheme, and Vitest's CSS
// handling intercepts `?raw` imports, so resolve from the vitest root
// (repo root) instead — same approach as reflection-prompt.
const css = readFileSync(
  join(process.cwd(), "packages", "activities", "evidence-weighing", "Component.css"),
  "utf8",
);

const cfg: EvidenceWeighingConfig = {
  version: "1.0",
  title: "Evidence for Photosynthesis",
  claim: "A plant is actively performing photosynthesis.",
  ratings: [
    { id: "weak", label: "Weak" },
    { id: "moderate", label: "Moderate" },
    { id: "strong", label: "Strong" },
  ],
  evidence: [
    {
      text: "The plant has green leaves.",
      expectedRating: "weak",
      feedback: "Green leaves alone do not confirm active photosynthesis.",
    },
    {
      text: "The plant is absorbing carbon dioxide and releasing oxygen.",
      expectedRating: "strong",
      feedback: "These measurements provide strong evidence of photosynthesis.",
    },
  ],
  behaviour: {
    enableRetry: true,
    enableSolutionsButton: true,
  },
};


describe("Component", () => {
  it("renders the title, claim, evidence, and rating options", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /evidence for photosynthesis/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/a plant is actively performing photosynthesis/i),
    ).toBeInTheDocument();

    expect(screen.getByText(/the plant has green leaves/i)).toBeInTheDocument();

    // Two evidence items, each with three rating options.
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("disables Check until all evidence items are rated", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Component config={cfg} onSubmit={onSubmit} />);

    const check = screen.getByRole("button", { name: /^check$/i });

    expect(check).toBeDisabled();

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });
    const strongOptions = screen.getAllByRole("radio", { name: /strong/i });

    await user.click(weakOptions[0]);
    expect(check).toBeDisabled();

    await user.click(strongOptions[1]);
    expect(check).toBeEnabled();

    await user.click(check);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 2,
      max: 2,
      success: true,
    });
  });

  it("calculates partial credit for incorrect ratings", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Component config={cfg} onSubmit={onSubmit} />);

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });

    // First rating is correct; second is incorrect.
    await user.click(weakOptions[0]);
    await user.click(weakOptions[1]);

    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 2,
      success: false,
    });
  });

  it("shows evidence feedback after submission", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });
    const strongOptions = screen.getAllByRole("radio", { name: /strong/i });

    await user.click(weakOptions[0]);
    await user.click(strongOptions[1]);

    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(
      screen.getByText(/green leaves alone do not confirm/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/measurements provide strong evidence/i),
    ).toBeInTheDocument();
  });

  it("Try again resets the selected ratings", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });
    const strongOptions = screen.getAllByRole("radio", { name: /strong/i });

    await user.click(weakOptions[0]);
    await user.click(strongOptions[1]);

    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(
      screen.getByRole("button", { name: /^check$/i }),
    ).toBeDisabled();

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("persists rating selections through onPersist", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        onPersist={onPersist}
      />,
    );

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });

    await user.click(weakOptions[0]);

    expect(onPersist).toHaveBeenCalled();

    const lastCall = onPersist.mock.calls.at(-1);
    const saved = JSON.parse(lastCall?.[0] as string);

    expect(saved.ratings).toEqual({ "0": "weak" });
  });

  it("uses separate radio groups for each evidence item", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });
    const strongOptions = screen.getAllByRole("radio", { name: /strong/i });

    await user.click(weakOptions[0]);
    await user.click(strongOptions[1]);

    expect(weakOptions[0]).toBeChecked();
    expect(strongOptions[1]).toBeChecked();
  });

  it("renders the title as h2 when headingLevel=2", () => {
    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        headingLevel={2}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /evidence for photosynthesis/i,
      }),
    ).toBeInTheDocument();
  });

  it("includes the submitted ratings and attempt count in suspendData", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Component config={cfg} onSubmit={onSubmit} />);

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });
    const strongOptions = screen.getAllByRole("radio", { name: /strong/i });

    await user.click(weakOptions[0]);
    await user.click(strongOptions[1]);

    await user.click(screen.getByRole("button", { name: /^check$/i }));

    const payload = onSubmit.mock.calls[0]?.[0] as {
      suspendData: string;
    };

    const suspended = JSON.parse(payload.suspendData);

    expect(suspended.stage).toBe("submitted");
    expect(suspended.attempts).toBe(1);
    expect(suspended.ratings).toEqual({
      "0": "weak",
      "1": "strong",
    });
  });

  it("reveals expected ratings only after Show solution is clicked", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    const moderateOptions = screen.getAllByRole("radio", {
      name: /moderate/i,
    });

    await user.click(moderateOptions[0]);
    await user.click(moderateOptions[1]);

    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(screen.queryByText(/expected rating:/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /show solution/i }),
    );

    expect(screen.getAllByText(/expected rating:/i)).toHaveLength(2);

    expect(
      screen.queryByRole("button", { name: /show solution/i }),
    ).not.toBeInTheDocument();
  });

  it("hides Show solution when disabled in the configuration", async () => {
    const user = userEvent.setup();

    const noSolutions: EvidenceWeighingConfig = {
      ...cfg,
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: false,
      },
    };

    render(<Component config={noSolutions} onSubmit={vi.fn()} />);

    const weakOptions = screen.getAllByRole("radio", { name: /weak/i });

    await user.click(weakOptions[0]);
    await user.click(weakOptions[1]);

    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(
      screen.queryByRole("button", { name: /show solution/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Component.css tokens", () => {
  it("uses the on-primary token for text on primary fills", () => {
    expect(css).toContain("var(--color-on-primary, #ffffff)");
    expect(css).not.toMatch(/color:\s*#ffffff\s*;/);
  });

  it("has no stale fallback hexes", () => {
    for (const stale of [
      "#7b4324",
      "#9b5830",
      "#dad2c6",
      "#606069",
      "#bbae9a",
    ]) {
      expect(css).not.toContain(stale);
    }

    expect(css).toContain("var(--color-primary, #4a7a5f)");
    expect(css).toContain("var(--color-primary-hover, #3f6b52)");
    expect(css).toContain("var(--color-border, #d1d7df)");
    expect(css).toContain("var(--color-text-secondary, #49515b)");
  });
});

describe("ui-schema", () => {
  it("inlines the APPEARANCE fragment with the curated Color scheme label", () => {
    const appearance = (uiSchema as Record<string, unknown>).appearance as {
      "ui:title": string;
      theme: {
        "ui:title": string;
        "ui:help": string;
      };
    };

    expect(appearance["ui:title"]).toBe("Appearance");
    expect(appearance.theme["ui:title"]).toBe("Color scheme");
    expect(appearance.theme["ui:help"]).toMatch(/auto.*lets the os decide/i);
  });
});

