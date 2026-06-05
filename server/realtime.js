// ════════════════════════════════════════════════════════════════
// Bikers Portal — Realtime bus (simple EventEmitter, server-wide)
// ════════════════════════════════════════════════════════════════
import { EventEmitter } from 'node:events'

class Bus extends EventEmitter {}
export const bus = new Bus()
bus.setMaxListeners(0)
