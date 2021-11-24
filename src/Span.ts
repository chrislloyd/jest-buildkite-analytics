export type SpanSection = "top" | string;

export type Span = {
  section: SpanSection;
  start_at: number;
  end_at?: number;
  duration?: number; // in seconds
  detail: any;
  children: Array<Span>;
};
