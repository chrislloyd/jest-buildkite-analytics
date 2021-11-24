import { ActionCableClient, Producer } from "./ActionCableClient";
import { TODO } from "./todo";
import fetch from "node-fetch";
import { sleep } from "./sleep";
import { Trace } from "./Trace";
import { v4 as uuidv4 } from "uuid";
import pluckFromEnv from "./pluckFromEnv";

type IncomingMessage = { confirm: Array<string> };

type ExamplesCount = {
  examples: number;
  failed: number;
  pending: number;
  errors_outside_examples: number;
};

type OutgoingMessage =
  | { action: "record_results"; results: Array<Trace> }
  | { action: "end_of_transmission"; examples_count: ExamplesCount };

const BuildkiteAnalyticsUrl = new URL(
  "https://analytics-api.buildkite.com/v1/uploads"
);

export function runEnv() {
  const buildkiteBuildId = pluckFromEnv("BUILDKITE_BUILD_ID");
  const debug = pluckFromEnv("BUILDKITE_ANALYTICS_DEBUG_ENABLED");

  if (buildkiteBuildId) {
    return {
      CI: "buildkite",
      key: buildkiteBuildId,
      url: pluckFromEnv("BUILDKITE_BUILD_URL"),
      branch: pluckFromEnv("BUILDKITE_BRANCH"),
      commit_sha: pluckFromEnv("BUILDKITE_COMMIT"),
      number: pluckFromEnv("BUILDKITE_BUILD_NUMBER"),
      job_id: pluckFromEnv("BUILDKITE_JOB_ID"),
      message: pluckFromEnv("BUILDKITE_MESSAGE"),
      debug,
    };
  } else {
    return {
      CI: undefined,
      key: uuidv4(),
      debug,
    };
  }
}

export default class BuildkiteTestAnalyticsClient {
  private cable: ActionCableClient | undefined;
  private send: Producer | undefined;

  constructor(private token: string) {}

  async start() {
    const authorizationHeader = `Token token=\"${this.token}\"`;
    const body = { run_env: runEnv() };
    const response = await fetch(BuildkiteAnalyticsUrl, {
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
    const cableUrl = new URL(rawCable);

    this.cable = new ActionCableClient(cableUrl, {
      headers: { Authorization: authorizationHeader },
    });

    await this.cable.start();

    const [send] = await this.cable.subscribe(channel, this.handleMessage);
    this.send = send;
  }

  async result(trace: Trace) {
    await this.sendAction({
      action: "record_results",
      results: [trace],
    });
  }

  async complete() {
    if (!this.cable) TODO("no cable");

    await this.sendAction({
      action: "end_of_transmission",
      examples_count: {
        examples: 2,
        failed: 0,
        pending: 0,
        errors_outside_examples: 0,
      },
    });

    // TODO: Wait until all unconfirmed tests are confirmed
    await sleep(1_000);

    await this.cable.stop();
    this.cable = undefined;
    this.send = undefined;
  }

  private async sendAction(message: OutgoingMessage) {
    if (!this.send) TODO("no subscription");
    return this.send(message);
  }

  private async handleMessage(message: unknown) {
    const confirmation = message as IncomingMessage;
    try {
      TODO("handle result confirmations");
    } catch (e) {}
  }
}
