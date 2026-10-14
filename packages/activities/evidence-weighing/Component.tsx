import { useEffect, useId, useMemo, useState } from "react";
import type { EvidenceWeighingConfig } from "@kukui/schemas";
import type { ActivityProps } from "@kukui/core/types";
import {
  bandMessage,
  percentage,
  resolveScoring,
} from "@kukui/core/scoring";
import { ActivityHeader, SafeHtml } from "@kukui/core";
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

  const correctCount = config.evidence.filter(
    (item, index) => state.ratings[index] === item.expectedRating,
  ).length;

  const score = {
    raw: correctCount,
    max: config.evidence.length,
    success: correctCount === config.evidence.length,
  };

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const submit = () => {
    if (Object.keys(state.ratings).length !== config.evidence.length) return;

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
        <div className="kukui-ew__evidence-list">
          {config.evidence.map((item, index) => {
            const isCorrect = state.ratings[index] === item.expectedRating;
            const expectedRating = config.ratings.find(
              (rating) => rating.id === item.expectedRating
            );

            return (
              <div key={index} className="kukui-ew__evidence">
                <p id={`evidence-${headingId}-${index}`}>
                  {item.text}
                </p>

                <div
                  className="kukui-ew__ratings"
                  role="group"
                  aria-labelledby={`evidence-${headingId}-${index}`}
                >
                  {config.ratings.map((rating) => (
                    <label key={rating.id}>
                      <input
                        type="radio"
                        name={`evidence-${headingId}-${index}`}
                        checked={state.ratings[index] === rating.id}
                        disabled={state.stage === "submitted"}
                        onChange={() => selectRating(index, rating.id)}
                      />
                      {rating.label}
                    </label>
                  ))}
                </div>
                {state.stage === "submitted" && (
                  <div className="kukui-ew__feedback">
                    {isCorrect && <p>Correct</p>}
                    {!isCorrect && <p>Incorrect</p>}

                    {item.feedback && <p>{item.feedback}</p>}
                  </div>
                )}
                {showSolutions && (
                  <p className="kukui-ew__solution">
                    Expected rating: {expectedRating?.label}
                  </p>
                )}
            </div>
            );
        })}
        </div>

        <div className="kukui-mc__actions">
          {state.stage === "answering" ? (
            <button
              type="button"
              className="kukui-mc__primary"
              disabled={Object.keys(state.ratings).length === 0}
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
    if (
      parsed &&
      typeof parsed.ratings === "object" &&
      parsed.ratings !== null &&
      !Array.isArray(parsed.ratings) &&
      typeof parsed.attempts === "number"
    ) {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        ratings: parsed.ratings,
        attempts: parsed.attempts,
      };
    }
  } catch {
    // Invalid save data
  }
  return null;
}

export default Component;
