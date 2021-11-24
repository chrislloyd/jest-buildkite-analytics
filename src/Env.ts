export default class Env {
  constructor(private env: NodeJS.ProcessEnv) {}

  pluck(key: string): string | undefined {
    const value = this.env[key];
    delete this.env[key];
    return value;
  }
}
