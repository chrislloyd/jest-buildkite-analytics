import { TODO } from "./todo";
import * as ws from "ws";
import { Opaque } from "./Opaque";
import timeout from "./timeout";

type Channel = Opaque<string, "Channel">;

type IncomingEvent =
  | { type: "welcome" }
  | { type: "ping"; message: number }
  | { type: "confirm_subscription"; identifier: Channel }
  | { type: "reject_subscription"; identifier: Channel }
  | { type: "message"; identifier: Channel; message: unknown };

type OutgoingCommand =
  | { command: "subscribe"; identifier: Channel }
  | { command: "message"; identifier: Channel; data: string };

function parseIncomingEvent(data: ws.RawData): IncomingEvent {
  return JSON.parse(data.toString("utf8"));
}

export type Consumer = (message: unknown) => Promise<void>;
export type Producer = (command: any) => Promise<void>;
export type Subscription = [send: Producer];

export class ActionCableClient {
  private socket: ws.WebSocket | undefined;
  private subscriptions: Map<Channel, Consumer> = new Map();

  constructor(private url: URL, private options: ws.ClientOptions) {}

  async start(): Promise<void> {
    const protocols = ["actioncable-v1-json", "actioncable-unsupported"];
    const socket = new ws.WebSocket(this.url, protocols, {
      ...this.options,
      origin: `https://${this.url.host}`,
    });

    await timeout(
      5000,
      "Opening websocket",
      new Promise<void>((resolve, reject) => {
        socket.once("open", () => {
          socket.removeListener("close", reject);
          resolve();
        });
        socket.once("error", reject);
      })
    );

    await timeout(
      5000,
      "Receiving welcome event",
      new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.once("message", (data) => {
          const event = parseIncomingEvent(data);
          if (event.type === "welcome") {
            socket.removeListener("error", reject);
            resolve();
          } else {
            reject();
          }
        });
      })
    );

    socket.on("message", (data) => {
      const event = parseIncomingEvent(data);
      this.handleEvent(event);
    });

    this.socket = socket;
  }

  async stop() {
    const socket = this.currentSocket();
    await timeout(
      5000,
      "Closing websocket",
      new Promise<void>((resolve) => {
        socket.once("close", () => {
          this.socket = undefined;
          resolve();
        });
        socket.close();
      })
    );
  }

  async subscribe(
    channel: Channel,
    subscription: Consumer
  ): Promise<Subscription> {
    const socket = this.currentSocket();

    await this.send({
      command: "subscribe",
      identifier: channel,
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.once("message", (data) => {
        const event = JSON.parse(data.toString("utf8"));
        if (
          event.type === "confirm_subscription" &&
          event.identifier === channel
        ) {
          socket.removeListener("error", reject);
          resolve();
        } else {
          reject();
        }
      });
    });

    const producer = async (message: any) => {
      this.send({
        command: "message",
        identifier: channel,
        data: JSON.stringify(message),
      });
    };

    this.subscriptions.set(channel, subscription);
    return [producer];
  }

  private async send(command: OutgoingCommand) {
    const socket = this.currentSocket();
    return new Promise<void>((resolve, reject) => {
      socket.send(JSON.stringify(command), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async handleEvent(event: IncomingEvent) {
    switch (event.type) {
      case "message":
        this.handleMessage(event.identifier, event.message);
        return;
    }
  }

  private async handleMessage(channel: Channel, message: unknown) {
    const subscription = this.subscriptions.get(channel);
    if (!subscription) TODO("Unkown channel");
    subscription(message);
  }

  private currentSocket(): ws.WebSocket {
    const socket = this.socket;
    if (!socket) TODO("not started");
    return socket;
  }
}
