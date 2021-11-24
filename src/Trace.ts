import { Span } from "./Span";

export type ResultState = "passed" | "failed" | "skipped";

export type Trace = {
  id: string;
  scope: string;
  name: string;
  identifier: string;
  location: string;
  file_name: string | "Unknown";
  result: ResultState;
  failure: string | undefined;
  history: Span;
};
