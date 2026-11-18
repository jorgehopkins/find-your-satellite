// Structured logging shared by the server and the modules it serves.

/** Writes one JSON line to stdout. */
export const stdoutLog = (fields) => process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...fields })}\n`);
