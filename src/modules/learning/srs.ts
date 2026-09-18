import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";

/** Row shape of `public.review_states` (progress data: always free). */
export interface ReviewStateRow {
  card_key: string;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";

const GRADES: Record<ReviewGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const scheduler = fsrs({ enable_fuzz: false });

export function newReviewState(cardKey: string, now: Date): ReviewStateRow {
  return toRow(cardKey, createEmptyCard(now));
}

export function review(row: ReviewStateRow, grade: ReviewGrade, now: Date): ReviewStateRow {
  const { card } = scheduler.next(fromRow(row), now, GRADES[grade]);
  return toRow(row.card_key, card);
}

export function isDue(row: ReviewStateRow, now: Date): boolean {
  return new Date(row.due).getTime() <= now.getTime();
}

function fromRow(row: ReviewStateRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: 0,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

function toRow(cardKey: string, card: Card): ReviewStateRow {
  return {
    card_key: cardKey,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}
