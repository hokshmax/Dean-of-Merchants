import { AdapterRegistry } from "./registry";
import { ebayAdapter } from "./adapters/ebay";
import { amazonAdapter } from "./adapters/amazon";
import { walmartAdapter } from "./adapters/walmart";
import { targetAdapter } from "./adapters/target";
import { bestbuyAdapter } from "./adapters/bestbuy";
import { aliexpressAdapter } from "./adapters/aliexpress";
import { noonAdapter } from "./adapters/noon";
import { temuAdapter } from "./adapters/temu";

export * from "./types";
export * from "./registry";
export { ebayAdapter } from "./adapters/ebay";
export { amazonAdapter } from "./adapters/amazon";
export { walmartAdapter } from "./adapters/walmart";
export { targetAdapter } from "./adapters/target";
export { bestbuyAdapter } from "./adapters/bestbuy";
export { aliexpressAdapter } from "./adapters/aliexpress";
export { noonAdapter } from "./adapters/noon";
export { temuAdapter } from "./adapters/temu";

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(ebayAdapter);
  registry.register(amazonAdapter);
  registry.register(walmartAdapter);
  registry.register(targetAdapter);
  registry.register(bestbuyAdapter);
  registry.register(aliexpressAdapter);
  registry.register(noonAdapter);
  registry.register(temuAdapter);
  return registry;
}
