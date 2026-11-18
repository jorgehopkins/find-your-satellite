# Live ISS map portal

## Summary

A single-page web portal that shows a flat world map with the live position of the International Space Station (ISS) on it. The visitor can drag to pan and zoom, sees their own location on the map, sees whether the ISS is currently above their horizon, and can press a button to follow the ISS as it moves. Other satellites and data sources are documented, not built.

## Scope

In:
- One page at `/`, replacing the current "Hello" page. No sign-in; anyone with the link can use it.
- One satellite: the ISS, with data from wheretheiss.at (no account or key needed).
- Our server fetches the ISS position and keeps it for a few seconds; the page asks our server, never the data service directly.
- A 2D map drawn with the open-source Leaflet library, served by our own server (no third-party scripts loaded from the internet). Map pictures come from the free OpenStreetMap tile server, with the required credit shown in a corner of the map. Drag to pan; scroll, +/- buttons or pinch to zoom.
- The visitor's own location, asked of their browser, shown as a marker.
- A readout: latitude, longitude, altitude, speed, and "above your horizon: yes/no".
- A trail of ISS positions seen since the page was opened.
- A "Track ISS" button that moves the map to the ISS and follows it.
- `docs/satellite-data-sources.md`: other satellites and sources (e.g. Starlink, weather satellites; CelesTrak orbital data computed in the browser, N2YO, Space-Track), with access requirements, rate limits and trade-offs. It also notes later ideas (a circle on the map showing where on Earth the ISS is above the horizon; predicted future paths; a 3D globe) and that a hosted tile provider would be needed if traffic grows beyond what OpenStreetMap's tile usage rules allow.

Out:
- Any satellite other than the ISS; a satellite picker.
- A 3D globe.
- Predicting the ISS's future path.
- A circle on the map showing the area that can see the ISS.
- Storing anything about visitors. The visitor's location stays in their browser and is never sent to our server.
- Accounts or sign-in.
- Feature flags, new configuration or keys.

## Behaviour

**Data**
- The page refreshes the ISS position every 5 seconds and moves the marker smoothly between updates.
- Our server keeps the latest position for a few seconds, so many visitors share one upstream call, and the data service's limit of about one request per second is never exceeded.
- If the data service is down, the page keeps the last known ISS position, marks it clearly as out of date with its age ("last updated 2 min ago"), and keeps trying. If no position has ever been received, it says so rather than showing an empty map silently.
- Our server answers with a clear error (not a crash) when the data service fails, logs the cause, and shows visitors no internal detail such as a stack trace.

**Map and trail**
- The trail is drawn from the positions seen since the page loaded. A pass over the ±180° longitude line does not draw a line across the whole map.
- On load the page asks the browser for the visitor's location. If granted, it marks it and centres the first view on it. If refused or unavailable, it shows the whole world with no "you" marker and says why; "above your horizon" is then not shown.

**Track ISS button**
- Tracking is off when the page opens; only the button turns it on.
- The button is labelled "Track ISS" when off and "Tracking ISS" when on. It is disabled until the first position has arrived.
- Clicking it moves the map to the ISS, then keeps the ISS at the centre of the view with each update, panning smoothly. Clicking again switches tracking off.
- Zoom is kept, except that if the map is zoomed out further than about continent level, it zooms in to about that level once, when tracking starts.
- Dragging the map switches tracking off (the button returns to "Track ISS"). Zooming by wheel, +/- buttons or pinch keeps tracking on.
- If tracking is on and the position goes out of date, the map stays on the last known position with the "out of date" notice shown, and tracking resumes automatically when fresh positions return.

**General**
- Works on current desktop and phone browsers.
- Observability as in `AGENTS.md`: every request logged with method, route, status and duration; traces on request handlers and on the outgoing call to the data service; the existing health endpoint keeps working.

## How will this ship?

As one change merged to `main`, replacing the "Hello" page. No feature flag, no data to migrate, and nothing new to configure (no keys). Rolling back means reverting the change.

## Acceptance Criteria

- AC-1: `GET /` returns one HTML page containing the map area, the readout and the "Track ISS" button; the old "Hello" page is gone.
- AC-2: The page loads the map library from our own server, with no script loaded from another origin.
- AC-3: The map shows the OpenStreetMap credit in a corner.
- AC-4: A request to our server for the ISS position returns its latitude, longitude, altitude and speed, taken from the data service.
- AC-5: Two requests for the position within the caching window cause only one call to the data service.
- AC-6: When the data service fails and a previously fetched position exists, our server still answers with that position, flagged as out of date with its age; the page shows the "out of date" notice and "last updated N ago".
- AC-7: When the data service fails and no position was ever fetched, our server answers with a clear error and no stack trace, and the page says no position has been received. The cause is logged.
- AC-8: The page requests a fresh position every 5 seconds and updates the readout (latitude, longitude, altitude, speed) each time.
- AC-9: The ISS marker moves between updates without jumping.
- AC-10: The trail grows by each new position seen, and a pair of consecutive positions that cross the ±180° line are not joined by a line across the map.
- AC-11: With location granted, the "you" marker appears at the visitor's location, the first view is centred on it, and the readout shows "above your horizon: yes" or "no" correctly for the ISS's position.
- AC-12: With location refused or unavailable, the page shows the whole world, no "you" marker and no "above your horizon" line, and displays a message saying why.
- AC-13: The visitor's location is never sent to our server (no request carries it).
- AC-14: Dragging pans the map; scroll wheel, +/- buttons and pinch zoom it.
- AC-15: Tracking is off on load, and the button is disabled until the first position arrives.
- AC-16: Clicking "Track ISS" centres the map on the ISS, the button reads "Tracking ISS", and each later update re-centres on the new position.
- AC-17: Clicking Track while zoomed out beyond about continent level zooms in to about that level once; at or closer than that level, the zoom is unchanged.
- AC-18: Dragging the map, or clicking the button again, switches tracking off and the button reads "Track ISS"; wheel, +/- or pinch zoom leave tracking on.
- AC-19: With tracking on and the data out of date, the map stays at the last position; when a fresh position arrives, tracking resumes without another click.
- AC-20: Each request is logged with method, route, status and duration, the position request and the outgoing call to the data service are traced, and the health endpoint still answers.
- AC-21: `docs/satellite-data-sources.md` exists and covers, for each other source, access requirements, rate limits and trade-offs, plus the later ideas and the tile-provider note listed in Scope.

## Acceptance note

Accepted on 2026-11-18 with these known gaps:

- **bug**: ISS marker jumps across the whole map when it crosses the ±180° line
- **bug**: Tracking leaves the ISS off-screen after it crosses the ±180° line
