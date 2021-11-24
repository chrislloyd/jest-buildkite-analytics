export type SpanSection = "top" | string;

export type Span = {
  section: SpanSection;
  start_at: number;
  end_at?: number;
  duration?: number;
  detail: any;
  children: Array<Span>;
};

const MS = 1 / 1000;

export function endSpan(span: Span) {
  span.end_at = Date.now();
  span.duration = (span.end_at - span.start_at) * MS;
}
