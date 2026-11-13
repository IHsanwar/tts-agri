import { apiFetch, ApiError } from '../api/client';

export interface OutboxEvent {
  event_id: string;
  type: string;
  payload: Record<string, any>;
  seq: number;
  created_at: number;
}

const STORAGE_PREFIX = 'tts_outbox_';

export class OutboxQueue {
  private sessionId: string;
  private endpoint: string;
  private isFlushing: boolean = false;
  private flushListeners: Array<(pending: number) => void> = [];

  constructor(sessionId: string, endpoint: string = '/play/events') {
    this.sessionId = sessionId;
    this.endpoint = endpoint;
  }

  private getKey(): string {
    return `${STORAGE_PREFIX}${this.sessionId}`;
  }

  public getEvents(): OutboxEvent[] {
    try {
      const data = localStorage.getItem(this.getKey());
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveEvents(events: OutboxEvent[]): void {
    try {
      localStorage.setItem(this.getKey(), JSON.stringify(events));
      this.notify(events.length);
    } catch (e) {
      console.error('Failed to persist outbox queue', e);
    }
  }

  public subscribe(listener: (pending: number) => void): () => void {
    this.flushListeners.push(listener);
    listener(this.getEvents().length);
    return () => {
      this.flushListeners = this.flushListeners.filter((l) => l !== listener);
    };
  }

  private notify(count: number): void {
    for (const listener of this.flushListeners) {
      listener(count);
    }
  }

  public enqueue(type: string, payload: Record<string, any>): string {
    const events = this.getEvents();
    const event_id = 'ev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    const newEvent: OutboxEvent = {
      event_id,
      type,
      payload,
      seq: events.length + 1,
      created_at: Date.now(),
    };
    events.push(newEvent);
    this.saveEvents(events);
    return event_id;
  }

  public async flush(
    onSessionLost?: () => void,
    onSuccessBatch?: (results: any[], newScore: number, newStatus: string) => void
  ): Promise<boolean> {
    if (this.isFlushing) return false;
    const events = this.getEvents();
    if (events.length === 0) return true;

    this.isFlushing = true;
    try {
      // Send max 20 events per batch
      const batch = events.slice(0, 20);
      const res = await apiFetch<{
        results: Array<{ event_id: string; accepted: boolean; result?: any; reject_reason?: string }>;
        score: number;
        status: string;
      }>(this.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          events: batch.map((e) => ({
            event_id: e.event_id,
            type: e.type,
            payload: e.payload,
            seq: e.seq,
          })),
        }),
      });

      // Remove sent batch
      const processedIds = new Set(batch.map((b) => b.event_id));
      const remaining = events.filter((e) => !processedIds.has(e.event_id));
      this.saveEvents(remaining);

      if (onSuccessBatch) {
        onSuccessBatch(res.results, res.score, res.status);
      }

      this.isFlushing = false;

      // If more events remain, flush again
      if (remaining.length > 0) {
        return this.flush(onSessionLost, onSuccessBatch);
      }
      return true;
    } catch (err: any) {
      this.isFlushing = false;
      if (err instanceof ApiError && err.status === 401) {
        if (onSessionLost) {
          onSessionLost();
        }
      }
      return false;
    }
  }

  public clear(): void {
    localStorage.removeItem(this.getKey());
    this.notify(0);
  }
}

