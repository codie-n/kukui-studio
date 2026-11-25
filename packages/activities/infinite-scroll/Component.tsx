import { useEffect, useId, useState } from "react";
import type { InfiniteScrollConfig } from "@kukui/schemas";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader } from "@kukui/core";
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, type Timestamp } from "firebase/firestore";
import { db, auth, authenticate } from "./firebase.js";
import "./Component.css";

const postsRef = collection(db, "posts");

type Posts = {
  id: string;
  text: string;
  authorId: string;
  createdAt: Timestamp | null;
}

export function Component({
  config,
  headingLevel = 1,
}: ActivityProps<InfiniteScrollConfig>) {
  const headingId = useId();

  const [posts, setPosts] = useState<Posts[]>([]);
  const [postText, setPostText] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function connect() {
      try {
        await authenticate();

        if (cancelled) return;

        const postsQuery = query(
          postsRef,
          orderBy("createdAt", "desc")
        );

        unsubscribe = onSnapshot(
          postsQuery,
          { includeMetadataChanges: true },
          (snapshot) => {
            const retrievedPosts: Posts[] = snapshot.docs.map((doc) => ({
              id: doc.id,
              text: doc.data().text,
              authorId: doc.data().authorId,
              createdAt: doc.data().createdAt,
            }));

            setPosts(retrievedPosts);
            setConnected(!snapshot.metadata.fromCache);
            setError("");
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

  async function submitPost() {
    const text = postText.trim();
    const user = auth.currentUser;

    if (!text || text.length > 2000 || !user || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await addDoc(postsRef, {
        text: text,
        authorId: user.uid,
        createdAt: serverTimestamp(),
      });

      setPostText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setSubmitting(false);
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

        <div className="kukui-is__composer">
          <label htmlFor={`${headingId}-post`}>
            Create a post
          </label>

          <textarea 
            id={`${headingId}-post`}
            className="kukui-is__textarea"
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="Share your thoughts"
            maxLength={2000}
            rows={4}
            disabled={!connected || submitting}
          />

          <button
            type="button"
            className="kukui-is__button"
            disabled={!connected || submitting || !postText.trim()}
            onClick={submitPost}
          >
            {submitting ? "Submitting..." : "Submit Post"}
          </button>
        </div>

        {error && (
          <p className="kukui-is__error" role="alert">
            {error}
          </p>
        )}

        <div className="kukui-is__feed">
          {connected && posts.length === 0 && (
            <p>No posts yet</p>
          )}

          {posts.map((post) => (
            <article key={post.id} className="kukui-is__post">
              <div className="kukui-is__post-header">
                <strong>
                  {post.authorId === auth.currentUser?.uid ? "You" : "Anonymous Student"}
                </strong>

                <span>
                  {post.createdAt ? post.createdAt.toDate().toLocaleString() : "Sending..."}
                </span>
              </div>

              <p className="kukui-is__post-text">
                {post.text}
              </p>
            </article>
          ))}
        </div>

      </article>
    </div>
  );
}

export default Component;
