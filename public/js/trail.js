// The Trail: ISS positions seen since the page opened, as line pieces that never span the ±180° line.
export const MAX_POINTS = 2000;

/**
 * Creates an empty Trail.
 * add({latitude, longitude, timestamp}) -> true if added, false if it has the same timestamp as the last point.
 * segments() -> Array<Array<[lat, lng]>>; where two consecutive points cross ±180° the line is cut into two
 * pieces, each ending/starting on the ±180 line at the interpolated latitude.
 */
export function createTrail(maxPoints = MAX_POINTS) {
  const points = []; // [lat, lng, timestamp]

  return {
    add({ latitude, longitude, timestamp }) {
      const last = points[points.length - 1];
      if (last && last[2] === timestamp) return false;
      points.push([latitude, longitude, timestamp]);
      if (points.length > maxPoints) points.splice(0, points.length - maxPoints);
      return true;
    },
    segments() {
      const result = [];
      let current = [];
      let prev = null;
      for (const [lat, lng] of points) {
        if (prev && Math.abs(lng - prev[1]) > 180) {
          // Unwrap the new longitude so it is on the same side as the old one, and find where the edge is crossed.
          const edge = prev[1] > 0 ? 180 : -180;
          const unwrapped = lng + (prev[1] > 0 ? 360 : -360);
          const t = (edge - prev[1]) / (unwrapped - prev[1]);
          const edgeLat = prev[0] + t * (lat - prev[0]);
          current.push([edgeLat, edge]);
          result.push(current);
          current = [[edgeLat, -edge]];
        }
        current.push([lat, lng]);
        prev = [lat, lng];
      }
      if (current.length) result.push(current);
      return result;
    },
  };
}
