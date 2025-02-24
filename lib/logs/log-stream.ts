/**
 * We'll create a LogStream class that:
 * 1. Patches console.log, console.error, etc.
 * 2. Maintains an array of SSE clients
 * 3. Forwards log messages to them
 */

import { randomBytes } from "crypto";

interface Client {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

class LogStream {
  public clients: Map<string, Client> = new Map();
  private originalConsoleLog?: typeof console.log;
  private originalConsoleError?: typeof console.error;
  private originalConsoleWarn?: typeof console.warn;
  private isPatched = false;

  startPatching() {
    if (this.isPatched) {
      // Already patched
      return;
    }
    this.isPatched = true;

    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;

    console.log("[LogStream] Patched console.* methods to forward logs to SSE clients.");

    console.log = (...args: any[]) => {
      this.forwardLog("log", args);
    };

    console.warn = (...args: any[]) => {
      this.forwardLog("warn", args);
    };

    console.error = (...args: any[]) => {
      this.forwardLog("error", args);
    };
  }

  forwardLog(level: string, args: any[]) {
    // Preserve old functionality
    if (level === "warn") {
      this.originalConsoleWarn?.(...args);
    } else if (level === "error") {
      this.originalConsoleError?.(...args);
    } else {
      this.originalConsoleLog?.(...args);
    }

    // Construct message
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map((arg) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }).join(" ");

    const payload = {
      timestamp: Date.now(),
      level,
      message
    };
    const event = `event: ${level}\ndata: ${JSON.stringify(payload)}\n\n`;

    // Send to all SSE clients
    for (const [_, client] of this.clients.entries()) {
      try {
        client.controller.enqueue(new TextEncoder().encode(event));
      } catch (err) {
        // If a client is closed or errored, remove them
        this.removeClient(client.id);
      }
    }
  }

  addClient(controller: ReadableStreamDefaultController<Uint8Array>): string {
    const id = randomBytes(3).toString("hex");
    const client: Client = { id, controller };
    this.clients.set(id, client);
    console.log("[LogStream] Added SSE client:", id, "total clients =", this.clients.size);
    return id;
  }

  removeClient(clientId: string) {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      console.log("[LogStream] Removed SSE client:", clientId, "total clients =", this.clients.size);
    }
  }
}

export const logStream = new LogStream(); 