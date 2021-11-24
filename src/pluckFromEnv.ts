export default function pluckFromEnv(key: string): string | undefined {
  const value = process.env[key];
  delete process.env[key];
  return value;
}
