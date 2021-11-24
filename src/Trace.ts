import { v4 as uuidv4 } from "uuid";
import { Tracer } from "./Tracer";
import { Span } from "./Span";
import { Test } from "@jest/reporters";
import type { Status, TestCaseResult } from "@jest/test-result";
import * as path from "path";

type ResultState = "passed" | "failed" | "skipped";

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

function testPathRelativeToJestRoot(test: Test) {
  return "./" + path.relative(test.context.config.rootDir, test.path);
}

function resultStateFromJestStatus(status: Status): ResultState {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    default:
      return "skipped";
  }
}

export function createTrace(
  test: Test,
  testCaseResult: TestCaseResult,
  tracer: Tracer
): Trace {
  const span = tracer.finalize(test.duration);
  const id = uuidv4();
  const relativePath = testPathRelativeToJestRoot(test);

  let location = relativePath;
  if (testCaseResult.location) {
    location = `${relativePath}:${testCaseResult.location.line}:${testCaseResult.location.column}`;
  }

  return {
    id,
    scope: testCaseResult.ancestorTitles.join(" "),
    name: testCaseResult.title,
    identifier: `${relativePath}:${testCaseResult.title}`,
    location,
    file_name: relativePath,
    result: resultStateFromJestStatus(testCaseResult.status),
    failure: testCaseResult.failureMessages.join("\n"),
    history: span,
  };
}
