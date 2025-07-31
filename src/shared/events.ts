import { EventEmitter } from 'events';

const eventBus = new EventEmitter();

export async function emitEvent(event: string, data: any) {
    console.log(`Event emitted: ${event}`, data);
    eventBus.emit(event, data);
    
    // Store in database for other modules
    // This is a stub - implement based on your event storage strategy
}

export function onEvent(event: string, handler: (data: any) => void) {
    eventBus.on(event, handler);
}
