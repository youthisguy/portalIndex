// Error classification used by the ingester. These two rules decide whether a failure
// is retried (node connection trouble) or recorded as a gap (state the node no longer serves).
export const isTransient = (msg: string) => /disconnected|abnormal closure|econn|timeout|websocket|not connected/i.test(msg);
export const isPruned = (msg: string) => /discarded|unknown block|4003/i.test(msg);
