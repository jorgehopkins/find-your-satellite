// The one ISS feed. Modules import `feed` from here and subscribe, without importing main.js.
import { createIssFeed } from "./iss-feed.js";

export const feed = createIssFeed({});
