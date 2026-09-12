/**
 * The jobs the chargen prose endpoint will do.
 *
 * Its own module, and a very small one, because both halves need it and only
 * one of them should reach the browser: `background.functions.ts` validates
 * against this list and ships to the client bundle, while the prompts it maps
 * to are server-side and stay there (see background.prompts.ts).
 *
 * The list is the point. The client names a job; the server decides what that
 * job tells the model.
 */
export const BACKGROUND_JOBS = ["lifepath_background", "self_description"] as const;
export type BackgroundJob = (typeof BACKGROUND_JOBS)[number];
