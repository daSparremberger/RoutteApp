import type { DomainEvent, EventType, EventPayload } from '@rotavans/shared';
import { useEffect, useRef } from 'react';

type EventHandler = (payload: any) => void | Promise<void>;

interface Subscription {
  unsubscribe: () => void;
}

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private eventQueue: DomainEvent[] = [];
  private isProcessing = false;

  subscribe<T extends EventType>(eventType: T, handler: (payload: EventPayload<T>) => void | Promise<void>): Subscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);

    return {
      unsubscribe: () => {
        this.handlers.get(eventType)?.delete(handler as EventHandler);
      },
    };
  }

  emit<T extends EventType>(eventType: T, payload: EventPayload<T>, correlationId?: string): void {
    const event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      correlationId,
    } as DomainEvent;

    this.eventQueue.push(event);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      const handlers = this.handlers.get(event.type);

      if (handlers) {
        const promises = Array.from(handlers).map(async (handler) => {
          try {
            await handler((event as any).payload);
          } catch (error) {
            console.error(`[EventBus] Error in handler for ${event.type}:`, error);
            if (event.type !== 'ERROR_OCCURRED') {
              this.emit('ERROR_OCCURRED', {
                code: 'EVENT_HANDLER_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                context: { eventType: event.type },
              });
            }
          }
        });

        await Promise.all(promises);
      }
    }

    this.isProcessing = false;
  }

  waitFor<T extends EventType>(
    eventType: T,
    timeout = 30000,
    predicate?: (payload: EventPayload<T>) => boolean
  ): Promise<EventPayload<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const subscription = this.subscribe(eventType, (payload: any) => {
        if (!predicate || predicate(payload)) {
          clearTimeout(timer);
          subscription.unsubscribe();
          resolve(payload);
        }
      });
    });
  }

  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  clear(): void {
    this.handlers.clear();
    this.eventQueue = [];
    this.isProcessing = false;
  }
}

export const eventBus = new EventBus();

export function useEvent<T extends EventType>(
  eventType: T,
  handler: (payload: EventPayload<T>) => void | Promise<void>,
  deps: React.DependencyList = []
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const subscription = eventBus.subscribe(eventType, (payload) => {
      handlerRef.current(payload);
    });

    return () => subscription.unsubscribe();
  }, [eventType, ...deps]);
}

export function emitEvent<T extends EventType>(
  eventType: T,
  payload: EventPayload<T>,
  correlationId?: string
): void {
  eventBus.emit(eventType, payload, correlationId);
}
