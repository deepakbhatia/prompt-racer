import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const BUILDER_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories relative to the sandbox root.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative directory to list. Default '.'",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file inside the sandbox.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a UTF-8 text file inside the sandbox.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path" },
          content: { type: "string", description: "Full file contents" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
];

export const RUN_COMMAND_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "run_command",
    description:
      "Run an allowlisted command inside the isolated sandbox. Use only to verify files you created.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Executable: node, npm, pnpm, or npx" },
        args: { type: "array", items: { type: "string" }, description: "Arguments only; no shell syntax" },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
};

export function builderTools(canRunCommands: boolean): ChatCompletionTool[] {
  return canRunCommands ? [...BUILDER_TOOLS, RUN_COMMAND_TOOL] : BUILDER_TOOLS;
}

export type BuilderToolName = "list_files" | "read_file" | "write_file" | "run_command";
