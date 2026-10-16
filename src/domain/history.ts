export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });
export function commitHistory<T>(history: History<T>, present: T, limit = 100): History<T> {
  if (present === history.present) return history;
  return { past: [...history.past, history.present].slice(-limit), present, future: [] };
}
export function undoHistory<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  return previous === undefined
    ? history
    : { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}
export function redoHistory<T>(history: History<T>): History<T> {
  const next = history.future[0];
  return next === undefined ? history : { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}
