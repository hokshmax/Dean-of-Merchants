import { AdapterRegistry } from "./registry";
import { ebayAdapter } from "./adapters/ebay";
import { amazonAdapter } from "./adapters/amazon";

export * from "./types";
export * from "./registry";
export { ebayAdapter } from "./adapters/ebay";
export { amazonAdapter } from "./adapters/amazon";

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(ebayAdapter);
  registry.register(amazonAdapter);
  return registry;
}
