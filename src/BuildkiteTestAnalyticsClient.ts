import { ActionCableClient, Producer } from "./ActionCableClient";
import { TODO } from "./todo";
import fetch from "node-fetch";
import { sleep } from "./sleep";
import { Trace } from "./Trace";
import { v4 as uuidv4 } from "uuid";
import Env from "./Env";

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

export function runEnv(env: Env) {
  const buildkiteBuildId = env.pluck("BUILDKITE_BUILD_ID");
  const debug = env.pluck("BUILDKITE_ANALYTICS_DEBUG_ENABLED");

  if (buildkiteBuildId) {
    return {
      CI: "buildkite",
      key: buildkiteBuildId,
      url: env.pluck("BUILDKITE_BUILD_URL"),
      branch: env.pluck("BUILDKITE_BRANCH"),
      commit_sha: env.pluck("BUILDKITE_COMMIT"),
      number: env.pluck("BUILDKITE_BUILD_NUMBER"),
      job_id: env.pluck("BUILDKITE_JOB_ID"),
      message: env.pluck("BUILDKITE_MESSAGE"),
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
  private token: string;

  constructor(token: string, private env: Env = new Env(process.env)) {
    this.token =
      token ||
      this.env.pluck("BUILDKITE_ANALYTICS_TOKEN") ||
      TODO("No token specified");
  }

  async start() {
    const authorizationHeader = `Token token=\"${this.token}\"`;
    const body = { run_env: runEnv(this.env) };
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

  async complete(
    examples: number,
    failed: number,
    pending: number,
    errorsOutsideExamples: number
  ) {
    if (!this.cable) TODO("no cable");

    await this.sendAction({
      action: "end_of_transmission",
      examples_count: {
        examples,
        failed,
        pending,
        errors_outside_examples: errorsOutsideExamples,
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
