const { EventEmitter } = require("events");

class EventService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  handleSSE(req, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);

    this.clients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch (_) {
        clearInterval(heartbeat);
        this.clients.delete(res);
      }
    }, 20000);

    req.on("close", () => {
      clearInterval(heartbeat);
      this.clients.delete(res);
    });
  }

  broadcast(type, payload = {}) {
    const data = `data: ${JSON.stringify({ type, payload, timestamp: Date.now() })}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(data);
      } catch (_) {
        this.clients.delete(client);
      }
    }
    // Also emit locally in process
    this.emit(type, payload);
  }
}

const eventService = new EventService();
module.exports = eventService;
