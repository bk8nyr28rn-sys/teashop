/**
 * Join questions. They test intent ("why are you here?"), never identity
 * proof. Text lives in the dictionaries under `onboarding.questions.<id>`.
 */
export const APPLICATION_QUESTIONS = ["why", "lookingFor", "guidelines"] as const;
export type ApplicationQuestionId = (typeof APPLICATION_QUESTIONS)[number];

export const ANSWER_MIN = 20;
export const ANSWER_MAX = 1000;
