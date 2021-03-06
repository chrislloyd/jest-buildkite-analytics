import Tracer from "./Tracer";
import type { Status, TestCaseResult } from "@jest/test-result";
import { TODO } from "./todo";
import {
  AggregatedResult,
  BaseReporter,
  Config,
  Context,
  ReporterOnStartOptions,
  Test,
  TestResult,
} from "@jest/reporters";
import BuildkiteTestAnalyticsClient from "./BuildkiteTestAnalyticsClient";
import * as path from "path";
import { ResultState } from "./Trace";
import { v4 as uuidv4 } from "uuid";

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

export default class Reporter extends BaseReporter {
  private client: BuildkiteTestAnalyticsClient;
  private tracer: Tracer | undefined;
  private tests = 0;
  private failed = 0;
  private pending = 0;

  constructor(private globalConfig: Config.GlobalConfig, private options: any) {
    super();
    this.client = new BuildkiteTestAnalyticsClient(this.options.token);
  }

  async onRunStart(
    aggregatedResults: AggregatedResult,
    options: ReporterOnStartOptions
  ) {
    await this.client.start();
  }

  async onTestStart(test: Test) {
    this.tracer = new Tracer();
  }

  async onTestCaseResult(test: Test, testCaseResult: TestCaseResult) {
    if (!this.tracer) TODO("no test start");

    if (testCaseResult.duration === undefined) TODO("empty duration");

    // Duration is empty if an error prevented the test from running in the
    // first place. If a test runs in sub-milisecond time, we round up to
    // lowest milisecond.
    const duration = Math.max(testCaseResult.duration || 0, 1);
    const span = this.tracer.finalize(duration);

    const relativePath = testPathRelativeToJestRoot(test);

    let location = relativePath;
    if (testCaseResult.location) {
      location = `${relativePath}:${testCaseResult.location.line}:${testCaseResult.location.column}`;
    }

    const result = resultStateFromJestStatus(testCaseResult.status);

    const trace = {
      id: uuidv4(),
      scope: testCaseResult.ancestorTitles.join(" "),
      name: testCaseResult.title,
      identifier: `${relativePath}:${testCaseResult.title}`,
      location,
      file_name: relativePath,
      result,
      failure: testCaseResult.failureMessages.join("\n"),
      history: span,
    };

    await this.client.result(trace);

    this.tests += 1;

    switch (result) {
      case "failed":
        this.failed += 1;
        break;
      case "skipped":
        this.pending += 1;
        break;
      default:
        break;
    }
  }

  async onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResults: AggregatedResult
  ) {}

  async onRunComplete(contexts: Set<Context>) {
    await this.client.complete(this.tests, this.failed, this.pending, 0);
  }
}
