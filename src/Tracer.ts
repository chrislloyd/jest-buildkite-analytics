import { Span } from "./Span";

const MS = 1 / 1000;

export default class Tracer {
  top: Span;
  stack: Array<Span>;

  constructor() {
    this.top = {
      section: "top",
      start_at: Date.now(),
      detail: {},
      children: [],
    };
    this.stack = [this.top];
  }

  get currentSpan(): Span {
    return this.stack[this.stack.length - 1];
  }

  enter(section: string, detail: any) {
    const span = { section, start_at: Date.now(), detail, children: [] };
    this.currentSpan.children.push(span);
    this.stack.push(span);
  }

  leave() {
    this.currentSpan.end_at = Date.now();
    this.currentSpan.duration =
      (this.currentSpan.end_at - this.currentSpan.start_at) * MS;
    this.stack.pop();
  }

  /**
   * @param duration in miliseconds
   */
  backfill(section: string, duration: number, detail: any) {
    const now = Date.now();
    const span = {
      section,
      start_at: now - duration,
      end_at: now,
      duration: duration * MS,
      detail,
      children: [],
    };
    this.currentSpan.children.push(span);
  }

  /**
   * @param duration in miliseconds
   */
  finalize(duration: number): Span {
    if (this.stack.length !== 1) {
      throw new Error("Stack not empty");
    }
    this.top.end_at = this.top.start_at + duration;
    this.top.duration = duration * MS;
    return this.top;
  }
}
