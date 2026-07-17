import type { ChallengeSpec } from "@prompt-race/shared";

/** Small stateful CLI task for exercising file I/O and argument handling. */
export const todoCli: ChallengeSpec = {
  id: "todo-cli",
  title: "Pocket Todo CLI",
  brief:
    "Build a command-line todo manager. It must add tasks, list open tasks, and mark a task complete. Persist tasks in a JSON file in the current working directory so separate invocations share state.",
  timeLimitSec: 20 * 60,
  allowedStack: ["Node.js", "TypeScript or JavaScript", "stdlib or a small CLI helper"],
  outOfScope: ["database", "authentication", "web UI", "cloud services"],
  acceptance: [
    "A documented npm/pnpm script or node entrypoint runs the CLI",
    'The command `add "Buy milk"` persists a task with the text "Buy milk"',
    "The command `list` prints each open task with a stable identifier and does not print completed tasks",
    "The command `done <id>` marks the matching task complete",
    "Tasks added in one invocation remain available to a later invocation from the same directory",
  ],
};
