import fetch from "node-fetch";
import { ActionCable, Subscription } from "./ActionCable";
import { Opaque } from "./Opaque";
import { sleep } from "./sleep";
import { Tracer } from "./Tracer";
import { createTrace, Trace } from "./Trace";
import { pickCIEnvVars } from "./env";
import type { TestCaseResult } from "@jest/test-result";
import { TODO } from "./Todo";
import {
  AggregatedResult,
  BaseReporter,
  Context,
  ReporterOnStartOptions,
  Test,
  TestResult,
} from "@jest/reporters";

type ExamplesCount = {
  examples: number;
  failed: number;
  pending: number;
  errors_outside_examples: number;
};

type Action =
  | { action: "record_results"; results: Array<Trace> }
  | { action: "end_of_transmission"; examples_count: ExamplesCount };

type Channel = Opaque<string, "Channel">;

type Command =
  | { command: "subscribe"; identifier: Channel }
  | { command: "message"; identifier: Channel; data: string };

type Message = { confirm: Array<string> };

type ActionCableEvent =
  | { type: "welcome" }
  | { type: "ping"; message: number }
  | { type: "confirm_subscription"; identifier: Channel }
  | { type: "reject_subscription"; identifier: Channel }
  | { type: "message"; identifier: Channel; message: Message };

const BuildkiteAnalyticsUrl = "https://analytics-api.buildkite.com/v1/uploads";

export default class BuildkiteAnalyticsReporter extends BaseReporter {
  ac: ActionCable | undefined;
  httpTracer: Tracer | undefined;
  subscription: Subscription | undefined;

  async onRunStart(
    aggregatedResults: AggregatedResult,
    options: ReporterOnStartOptions
  ) {
    const url = new URL(BuildkiteAnalyticsUrl);
    const authorizationHeader = `Token token=\"RRSjX1jL6RT9tspd7HRMaH3g\"`;
    const body = { run_env: pickCIEnvVars() };
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        authorization: authorizationHeader,
        "content-type": "application/json",
      },
    });

    if (response.status === 401) TODO("Bad token");
    if (response.status !== 200) TODO("Bad req, here's the x-request-id");

    const { id, cable: rawCable, channel } = await response.json();
    const cable = new URL(rawCable);

    this.ac = new ActionCable(cable, [], {
      headers: { Authorization: authorizationHeader },
    });

    await this.ac.start();

    const subscription = await this.ac.createSubscription(channel);
    this.subscription = subscription;
  }

  async onTestStart(test: Test) {
    test.context.hasteFS.getSha1;
    this.httpTracer = new Tracer();
  }

  async onTestCaseResult(test: Test, testCaseResult: TestCaseResult) {
    if (!this.ac) TODO("blah no ac");
    if (!this.subscription) TODO("blah no subscription");
    if (!this.httpTracer) TODO("blah");

    const trace = createTrace(test, testCaseResult, this.httpTracer);

    const recordResults: Command = {
      command: "message",
      identifier: this.subscription.channel as Channel,
      data: JSON.stringify({
        action: "record_results",
        results: [trace],
      }),
    };

    await this.ac.send(recordResults);
  }

  async onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResults: AggregatedResult
  ) {
    // aggregatedResults.
  }

  async onRunComplete(contexts: Set<Context>) {
    if (!this.subscription) TODO("blah no subscription");
    if (!this.ac) TODO("blah no ac");

    const eot: Command = {
      command: "message",
      identifier: this.subscription.channel as Channel,
      data: JSON.stringify({
        action: "end_of_transmission",
        examples_count: {
          examples: 2,
          failed: 0,
          pending: 0,
          errors_outside_examples: 0,
        },
      }),
    };

    await this.ac.send(eot);

    // TODO: Wait until all unconfirmed tests are confirmed
    await sleep(1_000);

    await this.ac.stop();
  }
}
