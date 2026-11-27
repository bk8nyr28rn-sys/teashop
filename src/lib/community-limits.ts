/** Text length limits, shared by server validation and client form hints. */
export const LIMITS = {
  titleMax: 120,
  postBodyMax: 5000,
  commentMax: 2000,
  reportDetailsMax: 500,
} as const;
