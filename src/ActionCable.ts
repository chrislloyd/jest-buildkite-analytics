import { TODO } from "./Todo";
import * as ws from "ws";

type ActionCableIncomingMessage =
  | { type: "welcome" }
  | { type: "ping"; message: number }
  | { type: "reject_subscription" };

type ActionCableOutgoingMessage =
  | {
      command: "message";
      identifier: string;
      data: Object;
    }
  | {
      command: "subscribe";
      identifier: string;
    };

export class Subscription {
  constructor(private ws: ws.WebSocket, public channel: string) {}

  async send(message: ActionCableOutgoingMessage) {
    const _ws = this.ws;
    if (!_ws) TODO("not started");
    return new Promise<void>((resolve, reject) => {
      console.log("->", message);
      _ws.send(JSON.stringify(message), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export class ActionCable {
  private ws: ws.WebSocket | undefined;
  private subscriptions: WeakSet<Subscription> = new WeakSet();

  constructor(
    private url: URL,
    private protocols: Array<string>,
    private options: ws.ClientOptions
  ) {}

  async start(): Promise<void> {
    const protocols = [
      ...this.protocols,
      "actioncable-v1-json",
      "actioncable-unsupported",
    ];
    const _ws = new ws.WebSocket(this.url, protocols, {
      ...this.options,
      origin: `https://${this.url.host}`,
    });
    await new Promise<void>((resolve, reject) => {
      _ws.once("open", () => {
        _ws.removeListener("close", reject);
        resolve();
      });
      _ws.once("error", reject);
    });

    await new Promise<void>((resolve, reject) => {
      _ws.once("error", reject);
      _ws.once("message", (event) => {
        const message = JSON.parse(event.toString("utf8"));
        console.log("<-", message);
        if (message.type === "welcome") {
          _ws.removeListener("error", reject);
          resolve();
        } else {
          reject();
        }
      });
    });

    this.ws = _ws;

    this.ws.on("message", (event) => {
      const message = JSON.parse(event.toString("utf8"));
      console.log("<-", message);
    });
  }

  async stop() {
    const _ws = this.ws;
    if (!_ws) TODO("Not started");
    await new Promise((resolve) => {
      _ws.once("close", resolve);
      _ws.close();
    });
    this.ws = undefined;
  }

  async createSubscription(channel: string): Promise<Subscription> {
    const _ws = this.ws;
    if (!_ws) {
      TODO("ws not started");
    }
    const subscription = new Subscription(_ws, channel);
    await this.send({ command: "subscribe", identifier: subscription.channel });

    await new Promise<void>((resolve, reject) => {
      _ws.once("error", reject);
      _ws.once("message", (event) => {
        const message = JSON.parse(event.toString("utf8"));
        console.log("<-", message);
        if (
          message.type === "confirm_subscription" &&
          message.identifier === subscription.channel
        ) {
          _ws.removeListener("error", reject);
          resolve();
        } else {
          reject();
        }
      });
    });

    this.subscriptions.add(subscription);
    return subscription;
  }

  async send(data: ActionCableOutgoingMessage) {
    const _ws = this.ws;
    if (!_ws) TODO("not started");
    return new Promise<void>((resolve, reject) => {
      _ws.send(JSON.stringify(data), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("->", data);
          resolve();
        }
      });
    });
  }
}
