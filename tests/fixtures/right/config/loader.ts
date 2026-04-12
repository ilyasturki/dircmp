interface Config {
  env: string;
  debug: boolean;
  port: number;
}

export function loadConfig(): Config {
  return {
    env: process.env.NODE_ENV ?? "development",
    debug: process.env.DEBUG === "true",
    port: parseInt(process.env.PORT ?? "3000", 10),
  };
}
