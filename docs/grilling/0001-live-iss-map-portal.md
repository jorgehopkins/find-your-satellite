# Grilling Transcript 0001: Live ISS map portal

- **Spec**: [0001-live-iss-map-portal.md](../specs/0001-live-iss-map-portal.md)
- **Where it ran**: the Software Factory's Grilling screen, with an AI agent asking and the Operator answering.

## The Operator (2026-11-18)

I want to build a simple web portal that shows a map and the live (or as close to live as possible) location of satellites moving on top of your location, with possibility to look around with a mouse and zoom in and out, etc. To start with an MVP, find the easiest satellite with public data to find and use that, the rest should just be documented. It should have a single page to avoid complexity for now.

## The Factory (2026-11-18)

Thanks, that's a clear starting point. I checked the repo first: it's a bare Node web app (one "Hello" page and a health check, no map or satellite code yet), so this is a fresh start. My recommended answers are below; reply "yes" to any you accept.

One note on the data: the easiest public source I know of is the **International Space Station (ISS)**, via the free *Where the ISS at* service (wheretheiss.at). It needs no account or key, answers over HTTPS, and returns latitude, longitude, altitude and speed. It asks for no more than about one request per second. I couldn't test it from my sandbox (no internet), so the first build will confirm it.

❓ **Q1** - **Which satellite, and which data source?**: The MVP follows one satellite, the ISS, using wheretheiss.at. Other satellites (e.g. Starlink, weather satellites) and other sources (CelesTrak orbital data computed in the browser, N2YO, Space-Track, which need accounts or keys) are only written up in a document, not built. Is that right?

➡️ Yes: ISS only, from wheretheiss.at.

---

❓ **Q2** - **Who calls the data service: the browser or our server?**: If every visitor's browser calls wheretheiss.at directly, many visitors could exceed its rate limit and we'd have nothing to log. If our server fetches the position and keeps it for a few seconds, all visitors share one upstream call, and we can log and trace it as our standards require. The cost is that the portal needs our server running (it does anyway).

➡️ Our server fetches and briefly caches the position; the page asks our server.

---

❓ **Q3** - **What kind of map?**: Options: (a) a flat 2D world map, in the style of Google Maps, that you drag to pan and scroll to zoom, using free OpenStreetMap tiles; or (b) a 3D globe you spin with the mouse. You said "map" and "look around and zoom", so I read that as (a). It's the simplest, and a 3D globe can come later.

➡️ (a) Flat 2D map, drag to pan, scroll or +/- buttons to zoom, pinch on touch screens.

---

❓ **Q4** - **What does "on top of your location" mean on screen?**: I read it as: the page asks your browser for your location (you're prompted for permission), puts a marker where you are, and centres the first view on you. Alongside the ISS marker it shows a small readout: latitude, longitude, altitude, speed, and whether the ISS is currently above your horizon (so you could actually look up and spot it). If you refuse location access, the map just shows the whole world with no "you" marker and no horizon line, and says why. Is that what you want? The alternative is to skip location entirely for the MVP.

➡️ Yes: ask for location, mark it, centre on it, show the readout including "above your horizon: yes/no", and degrade gracefully if refused.

---

❓ **Q5** - **How "live" should it be, and what trail do we show?**: The page refreshes the ISS position every 5 seconds, moving the marker smoothly between updates. It also draws a short trail of where the ISS has been since the page was opened (not a prediction of the future path). A prediction would need orbital maths, which belongs with the other data sources in the document.

➡️ Refresh every 5 seconds, smooth movement, trail of positions seen since page load, no future path.

---

❓ **Q6** - **What if the data service is down?**: The page keeps showing the last known ISS position, marked clearly as out of date with the age of that data (e.g. "last updated 2 min ago"), and keeps trying. If we have never received a position, it says so instead of showing an empty map silently. The server answers with a clear error rather than a crash, and logs the cause without exposing it to visitors.

➡️ Yes.

---

❓ **Q7** - **Single page, no accounts, nothing stored; where does the "other satellites" document live?**: I'll treat these as fixed, tell me if any is wrong: one page at `/` (replacing the current "Hello" page); no sign-in, anyone with the link can use it; nothing about visitors is stored (your location stays in your browser and is never sent to our server); works on current desktop and phone browsers. The documentation of other satellites and sources goes in `docs/satellite-data-sources.md`, covering each source's access requirements, rate limits and trade-offs.

➡️ Yes to all of that.

## The Operator (2026-11-18)

I agree with all but one more thing i would like to add is a button to track the selected satellite, so it would go to where the ISS is at the moment and follow it

## The Factory (2026-11-18)

Got it: all seven earlier answers are settled and written into the draft Spec, and the **Track** button is added. I've called the line of past ISS positions the **Trail**, so "track" only ever means the button. A few details on the button, plus two things I left open earlier, remain. Reply "yes" to any you accept.

❓ **Q1** - **What does the Track button do?**: It's labelled "Track ISS" (there is only one satellite, so no picker). Clicking it moves the map to the ISS and then keeps the ISS in the middle of the view with every update, panning smoothly. The button shows it's on ("Tracking ISS"). If you drag the map yourself, tracking switches off and the button goes back to "Track ISS", because otherwise the map would fight your mouse. Zooming with the wheel, the +/- buttons or pinch keeps tracking on. Clicking the button again also switches it off.

➡️ Yes.

---

❓ **Q2** - **How far in does it zoom when you click Track?**: If you're zoomed out to the whole world, centring on the ISS would show little change. I'd keep your current zoom level, except that if you're zoomed out further than about continent level, it zooms in to about that level once, so you can see the ISS move against the land beneath it.

➡️ Yes: keep your zoom, but zoom in to roughly continent level if you were further out.

---

❓ **Q3** - **Is tracking on when the page opens?**: Or does the page start as agreed before (centred on you, or the whole world if you refuse location), and tracking only starts when you click?

➡️ Tracking is off on load; only the button turns it on.

---

❓ **Q4** - **What does Track do when the ISS data is unavailable?**: Before the first position arrives, the button is disabled. If tracking is on and the data goes out of date, the map stays on the last known position, the "out of date" notice shows as agreed, and tracking carries on automatically once fresh positions return.

➡️ Yes.

---

❓ **Q5** - **Do we draw the area of Earth that can see the ISS?**: Earlier I mentioned "no horizon line" if you refuse location, which could be read as a circle on the map showing where on Earth the ISS is currently above the horizon. The simpler version has no circle: only the "above your horizon: yes/no" line in the readout. The circle is a nice extra, but more to build and test.

➡️ No circle for the MVP, just the yes/no line. I'll note the circle in the documentation as a later idea.

---

❓ **Q6** - **Where do the map software and tiles come from?**: The map is drawn with the open-source Leaflet library, which our server would serve itself (no third-party scripts loaded from the internet). The map pictures come from the free OpenStreetMap tile server, with the required credit shown in a corner of the map. That server's usage rules suit a small portal but not heavy traffic, so I'd note in the documentation that a hosted tile provider would be needed if it grows.

➡️ Yes.

---

❓ **Q7** - **How will this ship?**: I'd write it as one change that merges to `main` and replaces the "Hello" page. There's no feature flag, no data to migrate, and nothing new to configure (no keys). Rolling back means reverting the change.

➡️ Yes.

## The Operator (2026-11-18)

agree with everything

## The Factory (2026-11-18)

Thanks, that settles everything. The Spec is complete and written into the draft:

- **Scope**: ISS only (wheretheiss.at, fetched and briefly cached by our server), a flat Leaflet map with OpenStreetMap tiles, your location marker, the readout, the Trail, and the "Track ISS" button. Other satellites and sources, the horizon circle and the tile-provider note go in `docs/satellite-data-sources.md`.
- **Behaviour**: 5-second refresh, graceful handling of refused location and of a down data service, and the Track button's rules (off on load, drag switches it off, zoom keeps it on, resumes after an outage).
- **How it ships**: one change merged to `main`, no flag, no config, rollback by reverting.
- **Acceptance Criteria**: AC-1 to AC-21, each testable.

I also drafted the glossary (Position, Location, Trail, Above your horizon, Out of date). I didn't write any ADRs: nothing here is hard enough to reverse to need one.

Nothing is left open. The Spec is ready for the Spec Gate.
