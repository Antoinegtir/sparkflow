export type QualityIssue = {
  kind: "contrast" | "touch-target" | "label" | "overflow";
  severity: "high" | "low";
  message: string;
  testId?: string;
};
export type QualityReport = { issues: QualityIssue[]; checked: { texts: number; controls: number }; score: number };

export function qualityScore(issues: QualityIssue[]) {
  const high = issues.filter((i) => i.severity === "high").length;
  return Math.max(0, 100 - 12 * high - 3 * (issues.length - high));
}

export function qualityFixPrompt(report: QualityReport, { dark = false } = {}) {
  const list = report.issues
    .slice(0, 12)
    .map((i) => `- ${i.message}${i.testId ? ` (testID ${i.testId})` : ""}`)
    .join("\n");
  return dark
    ? `Fix these accessibility issues in dark mode (dark colors live in theme.json "dark"; keep light mode unchanged):\n${list}`
    : `Fix these accessibility issues:\n${list}`;
}
