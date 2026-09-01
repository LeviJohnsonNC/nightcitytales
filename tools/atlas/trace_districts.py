#!/usr/bin/env python3
"""
Trace Night City's district boundaries off the published atlas map.

The Night City Atlas prints its district boundaries as red dotted lines over the
two-page map (pages 4-5 of RTG-CPR-DLC-NightCityAtlasv1.01.pdf). Those dotted
lines are the only statement of where a district begins and ends that the
publisher makes, so they are what this script reads. Nothing here draws a
boundary by hand.

Output: src/data/atlas/night-city-map.json — a district raster over the same
percentage coordinate space the atlas JSON already uses. It also rewrites two
things in night-city.json: each district's own map point, to a spot the trace
proves is inside that district rather than the mean of its venue pins; and the
`landmarks` list, the city's named geography placed by the labels the map prints
for it.

Usage:
    pip install pillow numpy scipy
    python tools/atlas/trace_districts.py /path/to/RTG-CPR-DLC-NightCityAtlasv1.01.pdf

Requires poppler-utils (pdfimages) on PATH.

How it works
------------
1.  Pull the two full-page map images out of the PDF and stack them into one
    6600x10218 master, the same framing as public/images/map/night-city.jpg.
2.  Red pixels are either a boundary dash or a numbered location marker. Dilating
    by DASH_BRIDGE joins the dashes into one connected boundary network; the
    location markers stay small and isolated, so a size filter separates them.
3.  A district's edge is either a printed dotted line or the shoreline, so the
    barrier is the boundary network plus the water mask. What is left are the
    district interiors ("atoms").
4.  Each atom is claimed by the district whose venue pins fall inside it. Atoms
    with no pins join the nearest district if they are close enough to be a
    coastal fragment of it; anything further away (Morro Rock, the Laguna
    shoreline) is not part of any district and stays unassigned.
5.  The boundary strip itself is handed to the nearest district so the partition
    tiles the land with no gaps, then the result is downsampled to the grid.
"""

import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
ATLAS_JSON = os.path.join(REPO, "src", "data", "atlas", "night-city.json")
OUT_JSON = os.path.join(REPO, "src", "data", "atlas", "night-city-map.json")

MAP_PAGES = (4, 5)
# Dashes sit about 22px apart at full resolution; 9px of dilation bridges them
# without meaningfully thickening the line.
DASH_BRIDGE = 9
# The joined boundary network is one huge component. Location markers are a few
# hundred pixels each, so anything under this is a marker, not a boundary.
NETWORK_MIN_PX = 20_000
# An atom with no venue pins is treated as a coastal fragment of its nearest
# district only if a pin of that district is this close (fraction of map width)
# and the atom is too small to be a district in its own right. The smallest
# district the trace finds is around 85,000px, so this cannot swallow one.
FRAGMENT_MAX_DISTANCE = 0.02
FRAGMENT_MAX_PX = 60_000
ATOM_MIN_PX = 20_000
# One cell is 20 master pixels, about 0.3% of the map's width.
CELL = 20
# How far from open water a join may stand and still count as being over it. A
# bridge deck is drawn on top of the channel it crosses, so the deck itself is
# not water; what marks it out is the water immediately either side.
SPAN_WATER_REACH = 25
# Below this many pixels a join is two districts brushing at a corner, not a
# border anybody crosses.
BORDER_MIN_PX = 400

# The map prints the names of the city's geography — its bays, its canal, its
# bridges, the rock offshore — in large white capitals, unlike the small grey
# street names. Those labels are the atlas's own statement of where each feature
# is, so the label is where the feature goes. The names below are read off the
# map; the coordinates are not, they are measured. A label is matched to its
# name by being the closest one to the position recorded here, and the trace
# fails rather than guesses if a name has no label near it.
LABEL_MIN_PX = 8_000
LABEL_MIN_HEIGHT = 40
LABEL_MAX_HEIGHT = 200
# A feature label may be set over two lines; both are listed, and the feature
# sits at their midpoint.
LANDMARKS = [
    ("estero_bay", "Estero Bay", "bay", [(37.49, 16.19)]),
    ("del_coronado_bay", "Del Coronado Bay", "bay", [(34.97, 36.66)]),
    ("coronado_bay_bridge", "Coronado Bay Bridge", "bridge", [(43.07, 37.47), (43.06, 38.26)]),
    ("morro_rock", "Morro Rock", "island", [(20.98, 38.30)]),
    ("san_morro_bridge", "San Morro Bridge", "bridge", [(64.00, 50.70), (64.02, 51.49)]),
    ("morro_canal", "Morro Canal", "canal", [(54.17, 57.96), (54.17, 58.74)]),
    ("pacifica_bridge", "Pacifica Bridge", "bridge", [(44.83, 61.30), (44.83, 62.09)]),
    ("san_morro_bay", "San Morro Bay", "bay", [(32.44, 61.38)]),
    ("laguna_reservoir", "Laguna Reservoir", "reservoir", [(87.02, 63.18), (87.00, 63.97)]),
]
# How far a detected label may sit from the position recorded above and still be
# taken for the same label, as a percentage of the map's width.
LABEL_TOLERANCE = 0.5

# A district the atlas gives no locations at all cannot be seeded by a venue pin.
# There is exactly one — Exec Zone — and it turns out to be an enclave: a
# sizeable land atom completely surrounded by one other district. That is what
# identifies it, not a coordinate. (The coordinate the atlas JSON carried for
# Exec Zone, 74.5/36.5, is a hand-typed guess that lands inside Charter Hill, so
# it would not have worked as a seed either.)



def load_master(pdf_path):
    """The two map pages, stacked into a single image."""
    with tempfile.TemporaryDirectory() as tmp:
        prefix = os.path.join(tmp, "page")
        subprocess.run(
            ["pdfimages", "-f", str(MAP_PAGES[0]), "-l", str(MAP_PAGES[1]), "-j", pdf_path, prefix],
            check=True,
        )
        parts = sorted(f for f in os.listdir(tmp) if f.endswith(".jpg"))
        if len(parts) != 2:
            raise SystemExit(f"expected 2 map images on pages {MAP_PAGES}, got {len(parts)}")
        top, bottom = (Image.open(os.path.join(tmp, p)).convert("RGB") for p in parts)
        if top.size != bottom.size:
            raise SystemExit(f"map halves differ in size: {top.size} vs {bottom.size}")
        w, h = top.size
        master = Image.new("RGB", (w, h * 2))
        master.paste(top, (0, 0))
        master.paste(bottom, (0, h))
        return np.asarray(master).astype(np.int16)


def red_mask(rgb):
    """The atlas's red ink: boundary dashes and location markers."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    red = (r > 90) & (r > g + 35) & (r > b + 35)
    # The "NIGHT CITY" title is also red and sits above everything on the map.
    red[: int(0.1 * rgb.shape[0]), :] = False
    return red


def water_mask(rgb):
    """Sea, bays, canal and reservoir — every edge a district can end on."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    water = (b > 70) & (b > r + 25) & ((g + b) // 2 > r + 15)
    water = ndi.binary_closing(water, np.ones((9, 9)))
    water = ndi.binary_opening(water, np.ones((9, 9)))
    lab, n = ndi.label(water)
    sizes = ndi.sum(water, lab, range(1, n + 1))
    return (sizes > 50_000)[lab - 1] & (lab > 0)


def boundary_network(red):
    """The dotted lines, joined up, with the location markers dropped."""
    grown = ndi.binary_dilation(
        red, ndi.generate_binary_structure(2, 2), iterations=DASH_BRIDGE
    )
    lab, n = ndi.label(grown, np.ones((3, 3)))
    sizes = ndi.sum(grown, lab, range(1, n + 1))
    return (sizes >= NETWORK_MIN_PX)[lab - 1] & (lab > 0)


def label_positions(rgb):
    """Where the map prints a large white name, as percentages of the map."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    white = (r > 225) & (g > 225) & (b > 225)
    height, width = white.shape
    # Close along the line so the letters of a word read as one blob.
    lines = ndi.binary_closing(white, np.ones((5, 45)))
    lab, n = ndi.label(lines)
    sizes = ndi.sum(lines, lab, range(1, n + 1))
    out = []
    for index, box in enumerate(ndi.find_objects(lab)):
        if sizes[index] < LABEL_MIN_PX:
            continue
        tall = box[0].stop - box[0].start
        if tall < LABEL_MIN_HEIGHT or tall > LABEL_MAX_HEIGHT:
            continue
        out.append(
            (
                100 * (box[1].start + box[1].stop) / 2 / width,
                100 * (box[0].start + box[0].stop) / 2 / height,
            )
        )
    return out


def landmarks_from(rgb, grid, keys, cell_width, cell_height):
    """The city's named geography, placed by its own printed labels."""
    printed = label_positions(rgb)
    rows, columns = np.nonzero(grid)
    values = grid[rows, columns]
    # Both axes in the same unit — percent of the map's width — so a distance
    # means the same thing horizontally and vertically.
    aspect = cell_height / cell_width
    district_x = columns / cell_width * 100
    district_y = rows / cell_height * 100 * aspect

    out = []
    for key, name, kind, label_points in LANDMARKS:
        found = []
        for want_x, want_y in label_points:
            best = min(printed, key=lambda p: (p[0] - want_x) ** 2 + (p[1] - want_y) ** 2)
            gap = ((best[0] - want_x) ** 2 + (best[1] - want_y) ** 2) ** 0.5
            if gap > LABEL_TOLERANCE:
                raise SystemExit(
                    f"no printed label within {LABEL_TOLERANCE}% of where {name} was recorded "
                    f"({want_x}, {want_y}); nearest is {best} at {gap:.2f}%"
                )
            found.append(best)
        x = sum(p[0] for p in found) / len(found)
        y = sum(p[1] for p in found) / len(found)

        distance = np.hypot(district_x - x, district_y - (y * aspect))
        nearest = {}
        for index in np.argsort(distance)[:400]:
            near_key = keys[values[index] - 1]
            nearest.setdefault(near_key, float(distance[index]))
        ranked = sorted(nearest, key=nearest.get)
        entry = {
            "key": key,
            "name": name,
            "kind": kind,
            # Where you are standing when you are at this feature.
            "districtKey": ranked[0],
            "map": {"x": round(x, 3), "y": round(y, 3)},
        }
        if kind == "bridge":
            # A span has a district at each end, and they are the two closest.
            entry["connects"] = ranked[:2]
        out.append(entry)
    return out


def borders_between(labelled, water, keys):
    """Which districts touch on dry ground, and how big the join is.

    A join standing over water is not a border anybody walks across — a bridge
    deck is drawn on top of its channel and reads as ground to the raster, so
    the water mask is what tells them apart. Crossings come from the bridges the
    map names, added separately.
    """
    wet = ndi.binary_dilation(water, np.ones((3, 3)), iterations=SPAN_WATER_REACH)
    joins = {}
    # Compare each pixel with its neighbour to the east and to the south; every
    # boundary between two districts is caught by one or the other.
    for shift_y, shift_x in ((0, 1), (1, 0)):
        here = labelled[: labelled.shape[0] - shift_y, : labelled.shape[1] - shift_x]
        there = labelled[shift_y:, shift_x:]
        touching = (here > 0) & (there > 0) & (here != there)
        rows, columns = np.nonzero(touching)
        if not len(rows):
            continue
        low = np.minimum(here[touching], there[touching])
        high = np.maximum(here[touching], there[touching])
        over_water = wet[rows, columns]
        for a, b, y, x, damp in zip(low, high, rows, columns, over_water):
            pair = (int(a), int(b))
            entry = joins.setdefault(pair, {"dry": 0, "wet": 0, "at": None})
            entry["wet" if damp else "dry"] += 1
            if not damp and entry["at"] is None:
                entry["at"] = (int(x), int(y))
            elif entry["at"] is None:
                entry["at"] = (int(x), int(y))

    out = []
    for (a, b), entry in sorted(joins.items()):
        total = entry["dry"] + entry["wet"]
        if total < BORDER_MIN_PX or entry["dry"] < entry["wet"]:
            continue
        out.append({"districts": sorted([keys[a - 1], keys[b - 1]]), "kind": "land"})
    return out


def with_spans(borders, landmarks):
    """Add the crossings. A bridge is an edge the districts' own ground is not."""
    joined = {tuple(b["districts"]) for b in borders}
    for landmark in landmarks:
        ends = landmark.get("connects")
        if not ends or len(ends) != 2:
            continue
        pair = tuple(sorted(ends))
        if pair in joined:
            raise SystemExit(
                f"{landmark['name']} spans {pair}, but those two already share dry ground; "
                "one of the two readings of the map is wrong."
            )
        joined.add(pair)
        borders.append({"districts": list(pair), "kind": "span", "via": landmark["key"]})
    return borders


def measure_borders(borders, atlas):
    """How far apart the two ends of each join are, as a percentage of the map."""
    points = {d["key"]: d["map"] for d in atlas["districts"]}
    for border in borders:
        a, b = (points[k] for k in border["districts"])
        # y is a percentage of the height, so convert it before measuring.
        aspect = atlas["map"]["height"] / atlas["map"]["width"]
        border["lengthPercent"] = round(
            ((a["x"] - b["x"]) ** 2 + ((a["y"] - b["y"]) * aspect) ** 2) ** 0.5, 3
        )
    return borders


def pins_of(atlas, height, width):
    """Every canonical venue, in master pixels."""
    out = []
    for district in atlas["districts"]:
        for place in district["locations"]:
            point = place.get("map")
            if point:
                out.append(
                    (district["key"], point["x"] / 100 * width, point["y"] / 100 * height)
                )
    return out


def claim_atoms(atoms, n_atoms, pins, width, keys):
    """Which district owns each atom. Returns {atom_id: district_key}."""
    sizes = np.array(ndi.sum(atoms > 0, atoms, range(1, n_atoms + 1)))
    # Everything outside the city is one enormous atom. A marker that lands in it
    # is a marker placed in the water, and it must not be allowed to claim it.
    background = int(np.argmax(sizes)) + 1

    owner = {}
    votes = {}
    stray = []
    for key, x, y in pins:
        atom = int(atoms[int(y), int(x)])
        if atom == background:
            stray.append((key, round(100 * x / width, 1)))
        elif atom:
            votes.setdefault(atom, {}).setdefault(key, 0)
            votes[atom][key] += 1
    if stray:
        print(f"  note: {len(stray)} marker(s) sit outside every district: {stray}")
    for atom, tally in votes.items():
        if len(tally) > 1:
            raise SystemExit(
                f"atom {atom} holds venues from more than one district: {tally}. "
                "The traced boundaries and the atlas's own location list disagree."
            )
        owner[atom] = next(iter(tally))

    # A district whose every marker happens to be drawn over a dotted line has no
    # atom yet. The marker still sits on one side of that line, so snap it to the
    # nearest interior and let those pins vote. Only interiors big enough to be a
    # district count: the strip is full of slivers, and they are not answers.
    substantial = np.isin(atoms, np.flatnonzero(sizes >= ATOM_MIN_PX) + 1)
    _, (iy, ix) = ndi.distance_transform_edt(~substantial, return_indices=True)
    for key in keys:
        if key in owner.values():
            continue
        mine = [(x, y) for pin_key, x, y in pins if pin_key == key]
        if not mine:
            continue  # no markers at all — this one is found as an enclave below
        snapped = set()
        for x, y in mine:
            y, x = int(y), int(x)
            snapped.add(int(atoms[iy[y, x], ix[y, x]]))
        snapped.discard(0)
        if len(snapped) != 1:
            raise SystemExit(
                f"{key}'s markers all sit on a boundary and snap to {snapped or 'nothing'}; "
                "cannot tell which side of the line the district is on."
            )
        atom = snapped.pop()
        if atom in owner:
            raise SystemExit(f"{key} would take atom {atom}, already owned by {owner[atom]}")
        owner[atom] = key

    cutoff = FRAGMENT_MAX_DISTANCE * width
    unclaimed = []
    rng = np.random.default_rng(0)
    for atom in range(1, n_atoms + 1):
        if atom in owner or atom == background or sizes[atom - 1] < ATOM_MIN_PX:
            continue
        ys, xs = np.where(atoms == atom)
        if len(ys) > 4000:
            take = rng.choice(len(ys), size=4000, replace=False)
            ys, xs = ys[take], xs[take]
        best_key, best_distance = None, float("inf")
        for key, px, py in pins:
            distance = float(np.min((xs - px) ** 2 + (ys - py) ** 2) ** 0.5)
            if distance < best_distance:
                best_key, best_distance = key, distance
        if best_distance <= cutoff and sizes[atom - 1] < FRAGMENT_MAX_PX:
            owner[atom] = best_key
        else:
            unclaimed.append(atom)
    return owner, background, unclaimed


def adjoining_districts(atoms, owner, atom, water):
    """The districts an unclaimed atom shares a land border with.

    This is what separates a district the atlas forgot to give locations from a
    place that simply is not part of the city. Morro Rock and the Laguna
    shoreline have water on every side; a district has a dotted line and a
    neighbour on the other side of it.
    """
    collar = ndi.binary_dilation(
        atoms == atom, np.ones((3, 3)), iterations=DASH_BRIDGE * 3
    )
    collar &= (atoms != atom) & ~water
    neighbours = {owner.get(int(a)) for a in np.unique(atoms[collar])}
    neighbours.discard(None)
    return neighbours


def main():
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {sys.argv[0]} <night-city-atlas.pdf>")
    atlas = json.load(open(ATLAS_JSON))
    keys = [d["key"] for d in atlas["districts"]]

    print("reading the map out of the PDF ...")
    rgb = load_master(sys.argv[1])
    height, width = rgb.shape[:2]
    print(f"  master {width}x{height}")

    print("separating ink from water ...")
    network = boundary_network(red_mask(rgb))
    water = water_mask(rgb)
    print(f"  boundary network {100 * network.mean():.2f}% of the page, water {100 * water.mean():.2f}%")

    atoms, n_atoms = ndi.label(~(network | water))
    pins = pins_of(atlas, height, width)
    owner, background, unclaimed = claim_atoms(atoms, n_atoms, pins, width, keys)
    sizes = np.array(ndi.sum(atoms > 0, atoms, range(1, n_atoms + 1)))

    # Whatever is left is either a district the atlas never gave locations to, or
    # somewhere that is not part of the city at all. A district borders its
    # neighbours across a dotted line; Morro Rock and the Laguna shoreline have
    # only water around them.
    venueless = [d["key"] for d in atlas["districts"] if not d["locations"]]
    # ... and it has to be district-sized. A causeway between two shores borders
    # the city too, and is not a place anybody lives.
    claimed_area = {}
    for atom, key in owner.items():
        claimed_area[key] = claimed_area.get(key, 0) + int(sizes[atom - 1])
    floor = min(claimed_area.values()) / 2
    bordering = {}
    for atom in unclaimed:
        if sizes[atom - 1] < floor:
            continue
        neighbours = adjoining_districts(atoms, owner, atom, water)
        if neighbours:
            bordering[atom] = neighbours
    if len(bordering) != len(venueless):
        raise SystemExit(
            f"the atlas leaves {venueless} without locations, but {len(bordering)} unclaimed "
            f"region(s) border the city: {bordering}"
        )
    for atom, neighbours in bordering.items():
        owner[atom] = venueless.pop()
        print(f"  atom {atom} borders {sorted(neighbours)} -> {owner[atom]}")
    outside = len(unclaimed) - len(bordering)
    print(f"  claimed {len(owner)} atoms; {outside} region(s) are not part of any district")

    missing = [k for k in keys if k not in owner.values()]
    if missing:
        raise SystemExit(f"no traced region for: {missing}")

    print("painting the boundary strip onto its nearest district ...")
    index = {key: i + 1 for i, key in enumerate(keys)}
    labelled = np.zeros((height, width), np.uint8)
    for atom, key in owner.items():
        labelled[atoms == atom] = index[key]
    # Every land pixel belongs to somebody: hand the dotted lines themselves to
    # whichever district they run alongside.
    land = ~water
    holes = land & (labelled == 0)
    _, (iy, ix) = ndi.distance_transform_edt(labelled == 0, return_indices=True)
    filled = labelled.copy()
    filled[holes] = labelled[iy[holes], ix[holes]]
    # Only the strip between districts is filled in, never the open background.
    reach = ndi.binary_dilation(labelled > 0, np.ones((3, 3)), iterations=DASH_BRIDGE * 3)
    filled[~reach] = 0
    labelled = filled

    print(f"downsampling to a {width // CELL}x{height // CELL} grid ...")
    gh, gw = height // CELL, width // CELL
    trimmed = labelled[: gh * CELL, : gw * CELL].reshape(gh, CELL, gw, CELL)
    grid = np.zeros((gh, gw), np.uint8)
    counts = np.zeros((gh, gw, len(keys) + 1), np.int32)
    for value in range(len(keys) + 1):
        counts[..., value] = (trimmed == value).sum(axis=(1, 3))
    counts[..., 0] = counts[..., 0] // 2  # a cell half on land is land
    grid = counts.argmax(axis=2).astype(np.uint8)

    # A district's map point should be a spot inside it, as deep in as possible.
    # The mean of its venue pins is not that: districts here interlock, and a
    # mean can land in a neighbour. This writes the traced anchor back into the
    # atlas so there is one coordinate per district and one place it comes from.
    print("choosing an interior anchor for each district ...")
    for district in atlas["districts"]:
        mask = grid == index[district["key"]]
        distance = ndi.distance_transform_edt(mask)
        cy, cx = np.unravel_index(np.argmax(distance), distance.shape)
        district["map"] = {
            "x": round((cx + 0.5) / gw * 100, 3),
            "y": round((cy + 0.5) / gh * 100, 3),
        }

    print("placing the city's named geography off its printed labels ...")
    atlas["landmarks"] = landmarks_from(rgb, grid, keys, gw, gh)
    for landmark in atlas["landmarks"]:
        print(f"  {landmark['name']} ({landmark['kind']}) -> {landmark['districtKey']}")

    print("working out which districts touch ...")
    borders = with_spans(borders_between(labelled, water, keys), atlas["landmarks"])
    borders = measure_borders(borders, atlas)
    spans = [b for b in borders if b["kind"] == "span"]
    print(f"  {len(borders)} joins: {len(borders) - len(spans)} on dry ground, {len(spans)} spans")
    for border in spans:
        print(f"    {border['via']}: {border['districts'][0]} <-> {border['districts'][1]}")
    reachable = {keys[0]}
    frontier = [keys[0]]
    while frontier:
        here = frontier.pop()
        for border in borders:
            if here in border["districts"]:
                other = [k for k in border["districts"] if k != here][0]
                if other not in reachable:
                    reachable.add(other)
                    frontier.append(other)
    if len(reachable) != len(keys):
        raise SystemExit(
            f"the city does not hang together: {sorted(set(keys) - reachable)} cannot be "
            "reached from " + keys[0]
        )
    print(f"  every district reachable from {keys[0]}")

    runs = []
    flat = grid.reshape(-1)
    value, length = int(flat[0]), 0
    for cell in flat:
        if int(cell) == value:
            length += 1
        else:
            runs.append([value, length])
            value, length = int(cell), 1
    runs.append([value, length])

    out = {
        "source": {
            "note": (
                "District regions traced from the red dotted boundaries printed on the "
                "Night City Atlas map (v1.01, pages 4-5) by tools/atlas/trace_districts.py. "
                "Coordinates are percentages of the same map image the atlas JSON uses."
            ),
            "cellPixels": CELL,
            "masterWidth": width,
            "masterHeight": height,
        },
        "grid": {"width": gw, "height": gh},
        "districts": keys,
        "borders": borders,
        "runs": runs,
    }
    with open(OUT_JSON, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
        fh.write("\n")
    with open(ATLAS_JSON, "w") as fh:
        json.dump(atlas, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    covered = 100 * (grid > 0).mean()
    print(f"wrote {OUT_JSON}: {len(runs)} runs, {covered:.1f}% of the grid is city")


if __name__ == "__main__":
    main()
