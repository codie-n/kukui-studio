import { useEffect, useId, useState } from "react";
import type { InfiniteScrollConfig } from "@kukui/schemas";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader } from "@kukui/core";
import { doc, onSnapshot, updateDoc, increment } from "firebase/firestore";
import { db, authenticate } from "./firebase.js";
import "./Component.css";

const counterRef = doc(db, "prototype", "counter");

export function Component({
  config,
  headingLevel = 1,
}: ActivityProps<InfiniteScrollConfig>) {
  const headingId = useId();

  const [count, setCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function connect() {
      try {
        await authenticate();

        if (cancelled) return;

        unsubscribe = onSnapshot(
          counterRef,
          { includeMetadataChanges: true },
          (snapshot) => {
            if (snapshot.exists()) {
              setCount(snapshot.data().count);
              setConnected(!snapshot.metadata.fromCache);
              setError("");
            } else {
              setConnected(false);
              setError("Counter document not found.");
            }
          },
          (err) => {
            setConnected(false);
            setError(err.message);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function incrementCounter() {
    setUpdating(true);
    setError("");

    try {
      await updateDoc(counterRef, {
        count: increment(1),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setUpdating(false);
    }
  }


  return (
    <div className="kukui-is">
      <article className="kukui-is__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
        />

        <p role="status">
          {connected ? "Connected to Firebase"
          : error ? "Firebase connection unavailable"
          : "Waiting for Firebase..."}
        </p>

        <div className="kukui-is__counter">
          <p>Shared Counter</p>

          <output className="kukui-is__count">
            {count ?? "—"}
          </output>

          <button
            type="button"
            className="kukui-is__button"
            disabled={!connected || updating}
            onClick={incrementCounter}
          >
            {updating ? "Updating..." : "Increment (+1)"}
          </button>
        </div>

        {error && (
          <p className="kukui-is__error" role="alert">
            {error}
          </p>
        )}

      </article>
    </div>
  );
}

export default Component;
