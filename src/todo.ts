class Todo extends Error {}

export function TODO(message: string): never {
  throw new Todo(message);
}
