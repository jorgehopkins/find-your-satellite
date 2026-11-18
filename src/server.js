// Serves the app on $HOST and $PORT, as the Factory's Previews and Visual Evidence expect.
import { createApp, stdoutLog } from "./http.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
createApp().listen(port, host, () => stdoutLog({ level: "info", msg: "listening", host, port }));
