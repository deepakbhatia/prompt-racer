export type FeedKind = "user" | "guard" | "builder" | "system" | "error";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  text: string;
  at: string;
  filesTouched?: string[];
}