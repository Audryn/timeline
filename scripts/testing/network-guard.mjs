import net from "node:net";
import { syncBuiltinESMExports } from "node:module";

const loopback = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

export function assertLocalDestination(host) {
  if (!loopback.has(String(host).toLowerCase())) {
    throw new Error("Local test network guard blocked a non-loopback connection.");
  }
}

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof normalized[0] === "object" ? normalized[0] : undefined;
  // Named pipes and Unix sockets are used by framework workers.
  if (options?.port !== undefined || typeof normalized[0] === "number") {
    assertLocalDestination(options?.host ?? (typeof normalized[1] === "string" ? normalized[1] : "localhost"));
  }
  return Reflect.apply(connect, this, args);
};

const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assertLocalDestination(url.hostname);
  return originalFetch(input, init);
};
syncBuiltinESMExports();
