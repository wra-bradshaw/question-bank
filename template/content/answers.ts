// Suggested answers keyed by question id. Missing entries hide "Show answer".
// Split per-year like `answers/2019.ts` in the COMP20008 bank if you like.

export const answers: Record<string, string> = {
  '2019-s1-q01': String.raw`**(a)** Not well-formed: several sibling top-level elements, so no single root.`,
  '2019-s1-mc01': String.raw`Only **B** has a single root element with matching open and close tags. A never closes, C closes in the wrong order, and D is not an element at all.`,
  '2019-s1-mc02': String.raw`Remove or correct physically impossible values (**A**), always investigate before discarding (**C**), and document any imputation (**D**). Deleting everything above the mean (**B**) discards roughly half of legitimate data.`,
};
