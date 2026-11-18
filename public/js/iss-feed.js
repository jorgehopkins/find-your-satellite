// Polls our server for the ISS position and tells subscribers after every poll.
// Plain module: no Leaflet and no DOM, so it can be tested under Node with a fake fetch and fake timers.

const FIELDS = ["latitude", "longitude", "altitudeKm", "speedKmh", "timestamp"];

function parsePosition(body) {
  if (!body || typeof body !== "object" || FIELDS.some((f) => !Number.isFinite(body[f]))) throw new Error("Unexpected response");
  const position = {};
  for (const f of FIELDS) position[f] = body[f];
  return position;
}

export function createIssFeed({ fetchFn = (...args) => fetch(...args), intervalMs = 5000, now = () => Date.now() } = {}) {
  const subscribers = new Set();
  let timer = null;
  let running = false;
  let inFlight = false;
  // The last position received, when it was received, and how old the server said it was then.
  let last = null;

  function publish(state) {
    for (const fn of [...subscribers]) {
      try {
        fn({ ...state, position: state.position ? { ...state.position } : null });
      } catch (error) {
        console.error("ISS feed subscriber failed", error);
      }
    }
  }

  async function poll() {
    if (inFlight) return;
    inFlight = true;
    let state;
    try {
      const res = await fetchFn("/api/iss");
      if (!res.ok) throw new Error(`The server answered ${res.status}`);
      const body = await res.json();
      const position = parsePosition(body);
      const outOfDate = body.outOfDate === true;
      const ageSeconds = outOfDate && Number.isFinite(body.ageSeconds) ? body.ageSeconds : 0;
      last = { position, receivedAt: now(), ageSeconds };
      state = { position, outOfDate, ageSeconds, error: null };
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Request failed";
      if (last) {
        const age = last.ageSeconds + Math.max(0, now() - last.receivedAt) / 1000;
        state = { position: last.position, outOfDate: true, ageSeconds: age, error: message };
      } else {
        state = { position: null, outOfDate: true, ageSeconds: null, error: message };
      }
    } finally {
      inFlight = false;
    }
    if (running) publish(state);
  }

  return {
    start() {
      if (running) return;
      running = true;
      poll();
      timer = setInterval(poll, intervalMs);
    },
    stop() {
      running = false;
      clearInterval(timer);
      timer = null;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
