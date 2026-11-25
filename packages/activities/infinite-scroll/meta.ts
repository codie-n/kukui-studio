import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Infinite Scroll";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description = "Social media like, infinitely scrolling board that students can post to.";

/** Bloom's taxonomy level — drives Studio's cognitive-level filter. */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
