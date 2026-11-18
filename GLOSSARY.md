# ISS map portal

A single-page web portal showing the live position of the International Space Station on a map, relative to where the visitor is.

## Language

**Position**:
The ISS's latitude, longitude, altitude and speed at one moment, as reported by the data source.
_Avoid_: Location (reserved for the visitor), coordinates

**Location**:
Where the visitor is, as given by their browser. It never leaves their browser.
_Avoid_: Position (reserved for the ISS)

**Trail**:
The line of ISS positions seen since the page was opened. It is not a prediction.
_Avoid_: Track, path, orbit

**Above your horizon**:
Whether the ISS is currently high enough to be seen from the visitor's location.
_Avoid_: Visible, overhead

**Out of date**:
Describes a position that could not be refreshed on schedule, shown with how old it is.
_Avoid_: Stale, offline
