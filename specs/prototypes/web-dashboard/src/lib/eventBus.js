import { useEffect, useRef } from 'react';
class EventBus {
    constructor() {
        this.handlers = new Map();
        this.eventQueue = [];
        this.isProcessing = false;
    }
    subscribe(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType).add(handler);
        return {
            unsubscribe: () => {
                this.handlers.get(eventType)?.delete(handler);
            },
        };
    }
    emit(eventType, payload, correlationId) {
        const event = {
            type: eventType,
            payload,
            timestamp: Date.now(),
            correlationId,
        };
        this.eventQueue.push(event);
        this.processQueue();
    }
    async processQueue() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            const handlers = this.handlers.get(event.type);
            if (handlers) {
                const promises = Array.from(handlers).map(async (handler) => {
                    try {
                        await handler(event.payload);
                    }
                    catch (error) {
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
    waitFor(eventType, timeout = 30000, predicate) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                subscription.unsubscribe();
                reject(new Error(`Timeout waiting for event: ${eventType}`));
            }, timeout);
            const subscription = this.subscribe(eventType, (payload) => {
                if (!predicate || predicate(payload)) {
                    clearTimeout(timer);
                    subscription.unsubscribe();
                    resolve(payload);
                }
            });
        });
    }
    getRegisteredEventTypes() {
        return Array.from(this.handlers.keys());
    }
    clear() {
        this.handlers.clear();
        this.eventQueue = [];
        this.isProcessing = false;
    }
}
export const eventBus = new EventBus();
export function useEvent(eventType, handler, deps = []) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    useEffect(() => {
        const subscription = eventBus.subscribe(eventType, (payload) => {
            handlerRef.current(payload);
        });
        return () => subscription.unsubscribe();
    }, [eventType, ...deps]);
}
export function emitEvent(eventType, payload, correlationId) {
    eventBus.emit(eventType, payload, correlationId);
}
