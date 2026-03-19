import { consola, type ConsolaInstance } from "consola";

const loggers = new Map<string, ConsolaInstance>();

export function createLogger(tag: string): ConsolaInstance {
  const existing = loggers.get(tag);
  if (existing) {
    return existing;
  }

  const logger = consola.withTag(tag);
  loggers.set(tag, logger);
  return logger;
}

export const log = createLogger("octopus");
