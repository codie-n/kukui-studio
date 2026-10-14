import { useEffect, useId, useMemo, useState } from "react";
import type { EvidenceWeighingConfig } from "@kukui/schemas";
import type { ActivityProps } from "@kukui/core/types";
import {
  bandMessage,
  percentage,
  resolveScoring,
  scoreSelection,
} from "@kukui/core/scoring";
import { ActivityHeader, SafeHtml, htmlToText } from "@kukui/core";
import "./Component.css";


type State = {
  stage: "answering" | "submitted";
  ratings: Record<number, string>;
  attempts: number;
};

const initialState: State = { stage: "answering", ratings: {}, attempts: 0 };

export function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<EvidenceWeighingConfig>) {
  const [state, setState] = useState<State>(() => parseSuspend(suspendData) ?? initialState);
  const headingId = useId();

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData) ?? initialState);
    setSolutionsRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const selectRating = (index: number, ratingID: string) => {
    if (state.stage !== "answering") return;

    setState((s) => ({
      ...s,
      ratings: {
        ...s.ratings,
        [index]: ratingID,
      },
    }));
  };

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const submit = () => {
    if (state.selected.length === 0) return;
    const score = scoreSelection({
      selectedIndices: new Set(state.selected),
    });
    // Build the next state first so the suspend payload carries the same
    // attempts increment that setState applies (no stale spread).
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({ ...score, suspendData: JSON.stringify(next) });
  };

  const tryAgain = () => {
    setState(initialState);
    setSolutionsRevealed(false);
  };

  // Solution reveal is opt-in: the learner must press the "Show solution"
  // button after submitting. Reset on tryAgain and on config change.
  const [solutionsRevealed, setSolutionsRevealed] = useState(false);
  const showSolutions = state.stage === "submitted" && solutionsRevealed;

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const solutionLabel = ui.showSolutionButton ?? "Show solution";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const score = useMemo(
    () =>
      scoreSelection({
        selectedIndices: new Set(state.selected),
      }),
    [state.selected],
  );

  const pct = state.stage === "submitted" ? percentage(score) : 0;
  const banner = state.stage === "submitted" ? bandMessage(scoring.bands, pct) : null;

  return (
    <div className="kukui-mc">
      <article className="kukui-mc__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={<SafeHtml html={config.claim} />}
        />
        {/* Drop the radiogroup ARIA role — implementing it correctly requires
            roving tabindex + arrow-key navigation, which we don't yet do.
            A plain group with aria-pressed buttons gives accurate semantics. */}
        <ul role="group" aria-label="Answer choices" className="kukui-mc__answers">
          {displayOrder.map((i) => {
            const a = config.answers[i];
            if (!a) return null;
            const selected = state.selected.includes(i);
            const submitted = state.stage === "submitted";
            const correct = a.correct;
            const wrong = submitted && selected && !correct;
            const right = submitted && selected && correct;
            // Only after the learner presses "Show solution".
            const reveal = showSolutions && !selected && correct;
            const stateLabel = right
              ? "correct"
              : wrong
                ? "incorrect"
                : reveal
                  ? "correct, not selected"
                  : selected
                    ? "selected"
                    : "not selected";

            return (
              <li key={i} className="kukui-mc__answer-row">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${htmlToText(a.text)}, ${stateLabel}`}
                  disabled={submitted}
                  title={!submitted && a.tip ? a.tip : undefined}
                  className={[
                    "kukui-mc__answer",
                    selected ? "is-selected" : "",
                    right ? "is-correct" : "",
                    wrong ? "is-incorrect" : "",
                    reveal ? "is-reveal" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectRating(index, rating.id)}
                >
                  <SafeHtml as="span" className="kukui-mc__answer-text" html={a.text} />
                  <span className="kukui-mc__answer-icon" aria-hidden="true">
                    {right ? "✓" : wrong ? "✗" : reveal ? "○" : ""}
                  </span>
                </button>
                {/* Tip row mounts whenever the answer has a tip — presence
                    depends on config only, never on state, so the reveal is
                    opacity-only and neighbours stay put (layout-stable). The
                    tip becomes visible as soon as the answer is selected —
                    both pre- and post-submit — so touch and keyboard users
                    get it too (the `title` tooltip is a mouse-only bonus,
                    never the sole channel). */}
                {a.tip ? (
                  <div
                    className={[
                      "kukui-mc__tip",
                      selected ? "is-visible" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="kukui-mc__tip-label">Tip:</span> {a.tip}
                  </div>
                ) : null}
                <div
                  className={[
                    "kukui-mc__feedback",
                    submitted && selected ? "is-visible" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-live="polite"
                >
                  {submitted && selected && a.feedback ? a.feedback : ""}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="kukui-mc__actions">
          {state.stage === "answering" ? (
            <button
              type="button"
              className="kukui-mc__primary"
              disabled={state.selected.length === 0}
              onClick={submit}
            >
              {checkLabel}
            </button>
          ) : (
            <>
              <output className="kukui-mc__score">
                {score.raw} / {score.max}
                {banner ? <span className="kukui-mc__band"> — {banner}</span> : null}
              </output>
              {scoring.enableRetry ? (
                <button type="button" className="kukui-mc__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
              {scoring.enableSolutionsButton && !solutionsRevealed ? (
                <button
                  type="button"
                  className="kukui-mc__secondary"
                  onClick={() => setSolutionsRevealed(true)}
                >
                  {solutionLabel}
                </button>
              ) : null}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && Array.isArray(parsed.selected) && typeof parsed.attempts === "number") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        selected: parsed.selected.filter((n): n is number => typeof n === "number"),
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}

export default Component;
