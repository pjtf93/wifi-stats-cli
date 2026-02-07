export type LogLevel = "info" | "success" | "error";
export type Logger = (level: LogLevel, message: string, data?: Record<string, unknown>) => void;

export const log: Logger = (level, message, data = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  };

  process.stderr.write(`${JSON.stringify(entry)}\n`);
};
