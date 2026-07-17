import type { ChallengeSpec } from "@prompt-race/shared";

/** Browser task that can be checked through visible DOM behavior. */
export const readingList: ChallengeSpec = {
  id: "reading-list",
  title: "Reading List",
  brief:
    "Build a single-page reading-list app. A user can add a book title, mark a book as read, filter between all/unread/read books, and remove a book. Persist the list in browser localStorage.",
  timeLimitSec: 30 * 60,
  allowedStack: ["HTML/CSS/JavaScript", "React or another lightweight browser framework"],
  outOfScope: ["backend", "authentication", "external APIs", "accounts", "design system"],
  acceptance: [
    "The app starts via a documented npm/pnpm script and renders in a browser",
    "Submitting a non-empty title adds a visible unread book; blank submissions do not add a book",
    "Each book can be marked read and has a visible read state",
    "All, Unread, and Read controls show the expected subset of books",
    "Each book can be removed",
    "Books and their read state survive a browser refresh in the same browser profile",
  ],
};
