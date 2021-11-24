import { ActionCableClient, Producer } from "./ActionCableClient";
import { pickCIEnvVars } from "./env";
import { TODO } from "./todo";
import fetch from "node-fetch";
import { sleep } from "./sleep";
import { Trace } from "./Trace";

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

export default class BuildkiteTestAnalyticsClient {
  private cable: ActionCableClient | undefined;
  private send: Producer | undefined;

  async start() {
    const authorizationHeader = `Token token=\"RRSjX1jL6RT9tspd7HRMaH3g\"`;
    const body = { run_env: pickCIEnvVars() };
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
