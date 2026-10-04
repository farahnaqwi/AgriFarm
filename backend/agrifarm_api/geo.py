"""Small geometry helpers for GeoJSON polygons (lon, lat in degrees). No GIS dependencies."""
import math

EARTH_RADIUS_M = 6_371_008.8


def _ring(polygon: dict) -> list[list[float]]:
    ring = polygon["coordinates"][0]
    return ring[:-1] if ring[0] == ring[-1] else ring


def centroid(polygon: dict) -> tuple[float, float]:
    ring = _ring(polygon)
    return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)


def area_ha(polygon: dict) -> float:
    """Planar area on a local equirectangular projection; accurate enough for farm-sized plots."""
    ring = _ring(polygon)
    _, lat0 = centroid(polygon)
    kx = math.radians(1) * EARTH_RADIUS_M * math.cos(math.radians(lat0))
    ky = math.radians(1) * EARTH_RADIUS_M
    pts = [(lon * kx, lat * ky) for lon, lat in ring]
    s = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))
    return abs(s) / 2 / 10_000


def contains(polygon: dict, lon: float, lat: float) -> bool:
    """Ray-casting point-in-polygon test."""
    ring = _ring(polygon)
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def square(lon: float, lat: float, hectares: float) -> dict:
    """A square plot of the given size centred on (lon, lat). Used to make dummy plots."""
    half = math.sqrt(hectares * 10_000) / 2
    dlat = math.degrees(half / EARTH_RADIUS_M)
    dlon = math.degrees(half / (EARTH_RADIUS_M * math.cos(math.radians(lat))))
    ring = [[lon - dlon, lat - dlat], [lon + dlon, lat - dlat], [lon + dlon, lat + dlat],
            [lon - dlon, lat + dlat], [lon - dlon, lat - dlat]]
    return {"type": "Polygon", "coordinates": [[[round(x, 6), round(y, 6)] for x, y in ring]]}
