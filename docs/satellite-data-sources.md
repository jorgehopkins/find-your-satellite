# Satellite data sources

This note is for the Operator and for developers who pick up the Live ISS map portal later. It explains what the portal uses today, which other sources could be added, and why the first version is deliberately small.

## What the portal uses today

**The ISS position: wheretheiss.at.** This free service reports where the International Space Station is right now. It needs no account and no key. Its limit is about one request per second. Our server fetches the position and keeps it for 3 seconds, so many visitors share one call to the service and we stay well under the limit. The page asks our server, never wheretheiss.at directly.

**The map pictures: OpenStreetMap tiles, drawn with Leaflet.** The map is split into small square pictures called tiles. They come from the free OpenStreetMap tile server. Leaflet is the open-source library that arranges them and handles dragging and zooming. Leaflet itself is served by our own server.

**Why only the ISS?** One satellite, one free source with no key, and one upstream call shared by all visitors keeps the first version simple, cheap and safe to run with nothing new to configure. The other sources below all add something: a key, an account, more maths, or more rules to follow.

## Other sources

| Source | Key or account needed? | Limits | Best for |
| --- | --- | --- | --- |
| CelesTrak | No | Asks that the same data is not downloaded more often than it changes; check the provider's current terms | Many satellites at once (Starlink, weather and more), with positions worked out in the browser; also predicted paths |
| N2YO | Yes, a free API key | Per-hour request limits that differ by endpoint; check the provider's current terms | Ready-made positions and "when will it pass over me" times |
| Space-Track.org | Yes, a free account with terms of use | Strict request limits; check the provider's current terms | The authoritative US government catalogue of objects in orbit |

### CelesTrak (orbital data)

[CelesTrak](https://celestrak.org) publishes orbital data: for each satellite, a short set of numbers (a "GP" or "TLE" element set) that describes its orbit. With a library such as satellite.js, which implements a standard method called SGP4, the visitor's browser can work out where the satellite is at any moment. It covers Starlink, weather satellites and thousands of others.

#### Access requirements

None. The data is free and needs no account or key.

#### Rate limits

CelesTrak asks users not to download the same data more often than it changes. Element sets change only every few hours, so our server should download them rarely and keep a copy, and visitors should fetch that copy from us. Check the provider's current terms for the exact guidance.

#### Trade-offs

- There is no live call to an outside service for each position, so many visitors cost us nothing extra, and the same data also gives predicted paths.
- The cost is orbital maths in the browser, which is more code to write and test.
- Positions are only as accurate as the latest element set, and they drift as it ages. Our server needs to refresh the set regularly.

### N2YO

[N2YO](https://www.n2yo.com) offers an API that returns satellite positions and upcoming passes over a given place.

#### Access requirements

A free API key, which means creating an account. The key must be kept on our server and never sent to the browser.

#### Rate limits

Requests are limited per hour, with different limits for different kinds of request. Check the provider's current terms for the figures.

#### Trade-offs

- Easy to use: positions and passes come ready-made, with no orbital maths.
- Every position is a call to a third party, so our server must cache and share results, and the hourly limits cap how many satellites we can follow.
- A key means a new secret to store and a new thing that can fail or be revoked.

### Space-Track.org

[Space-Track.org](https://www.space-track.org) is the US government's catalogue of objects in orbit, and the original source of much of the element-set data other sites republish.

#### Access requirements

A free account, which comes with terms of use that must be accepted and followed. Every request needs a login, so our server would hold the credential. It cannot be used directly from a browser.

#### Rate limits

Strict, and enforced. Check the provider's current terms for the figures.

#### Trade-offs

- Authoritative and complete.
- A credential to store and protect, a login to manage, and strict limits that mean our server must cache heavily.
- Much of what we would want is also available through CelesTrak without an account.

### Weather satellites and Starlink

These are examples of what would come through the CelesTrak route rather than needing a source of their own. CelesTrak's catalogue lists satellites by name or by NORAD number (a satellite's catalogue ID), including weather satellites such as those from NOAA and Meteosat, and the Starlink group. Verify names and numbers against the current catalogue before relying on them, because satellites are launched and retired all the time.

### Which to try first

**CelesTrak, with positions computed in the browser.** It needs no key, makes no upstream call per visitor, and one data download serves everyone. It also leads naturally to predicted paths. N2YO is the fallback if we would rather not do the maths ourselves. Space-Track is only worth the account and credential if we need something CelesTrak does not have.

## Later ideas

- **A horizon circle.** A circle on the map showing where on Earth the ISS is above the horizon, so visitors can see how close they are to being able to see it. It needs the ISS's altitude (already in the position data) and some geometry, and no new data source.
- **Predicted future paths.** A line showing where the ISS will go next. It needs orbital element sets (see CelesTrak above) and the browser-side maths, since wheretheiss.at gives only the current position. The trail today shows only where the ISS has been.
- **A 3D globe.** A rotating globe instead of a flat map. It needs a 3D mapping or graphics library served by our own server, and its own set of earth textures or tiles. It is a larger piece of work than the other two.

## Map tiles

The OpenStreetMap tile server is free, but it comes with tile usage rules: an acceptable-use policy that requires credit to be shown (the portal does this in a corner of the map) and does not allow heavy use. If traffic grows beyond what those rules allow, a hosted tile provider would be needed. That means choosing a provider, and usually creating an account and a key, and paying beyond a free allowance. Check the OpenStreetMap Foundation's current tile usage policy before launching widely. The project home page is [openstreetmap.org](https://www.openstreetmap.org).
