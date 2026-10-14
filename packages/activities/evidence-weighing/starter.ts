/**
 * Minimal valid config used as Studio's "new activity" template.
 * Extracted from apps/studio-app/src/starters.ts.
 */
const starter = {
  version: "1.0",
  title: "Evidence Weighing",
  claim: "Replace this with your claim, hypothesis, or diagnosis.",
  ratings: [
    { id: "weak", label: "Weak" },
    { id: "moderate", label: "Moderate" },
    { id: "strong", label: "Strong" },
  ],
  evidence: [
    { text: "Evidence A", expectedRating: "weak" },
    { text: "Evidence B", expectedRating: "strong" },
  ],
  behaviour: { enableRetry: true, enableSolutionsButton: true },
};

export default starter;
