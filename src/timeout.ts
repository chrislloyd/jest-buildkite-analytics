class TimeoutError extends Error {}

export default async function timeout<T>(
  ms: number,
  message: string,
  promise: Promise<T>
): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new TimeoutError(message));
      }, ms);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}
