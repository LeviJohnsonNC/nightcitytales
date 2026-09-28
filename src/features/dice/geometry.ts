/**
 * The dice, as solids: real d10 and d6 meshes, and the rotation that lands a
 * chosen face toward the player.
 *
 * The engine decides every roll before a die moves. All this module knows is
 * which way a solid has to face for its number to read as the one the engine
 * rolled, so an animation can tumble freely and still arrive exactly there.
 *
 * World axes: x right, y up, z toward the viewer. A face is "showing" when its
 * outward normal points along +z.
 *
 * Pure: numbers in, numbers out.
 */

export type Vec3 = [number, number, number];
/** A unit quaternion, [w, x, y, z]. */
export type Quat = [number, number, number, number];

export type Face = {
  /** The number printed on it. */
  value: number;
  /** Indices into the mesh's vertices, in order around the face. */
  corners: number[];
  normal: Vec3;
  centroid: Vec3;
  /** Along the face, toward the top of its number when read upright. */
  up: Vec3;
};

export type Mesh = { sides: 6 | 10; vertices: Vec3[]; faces: Face[] };

// ── vectors ──────────────────────────────────────────────────────────────

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function centroidOf(points: Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((acc, p) => add(acc, p), [0, 0, 0]);
  return scale(sum, 1 / points.length);
}

/** The outward normal of a convex face, whichever way its corners wind. */
function outwardNormal(points: Vec3[]): Vec3 {
  const c = centroidOf(points);
  const n = normalize(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!)));
  return dot(n, c) < 0 ? scale(n, -1) : n;
}

/** `v` with its component along the unit vector `n` removed, normalised. */
function alongPlane(v: Vec3, n: Vec3): Vec3 {
  return normalize(sub(v, scale(n, dot(v, n))));
}

// ── quaternions ──────────────────────────────────────────────────────────

export const IDENTITY: Quat = [1, 0, 0, 0];

export function axisAngle(axis: Vec3, angle: number): Quat {
  const [x, y, z] = normalize(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), x * s, y * s, z * s];
}

export function multiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  const [w, x, y, z] = q;
  // v' = q v q*, expanded.
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

/** The rotation whose columns are the given orthonormal basis mapped from x, y, z. */
function fromBasis(x: Vec3, y: Vec3, z: Vec3): Quat {
  // Rotation matrix with rows = where world axes come FROM; standard conversion.
  const m00 = x[0],
    m01 = y[0],
    m02 = z[0];
  const m10 = x[1],
    m11 = y[1],
    m12 = z[1];
  const m20 = x[2],
    m21 = y[2],
    m22 = z[2];
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = [0.25 * s, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [(m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s];
  }
  const l = Math.hypot(...q) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

function conjugate(q: Quat): Quat {
  return [q[0], -q[1], -q[2], -q[3]];
}

// ── the solids ───────────────────────────────────────────────────────────

/**
 * A pentagonal trapezohedron, the d10: two apexes and two staggered rings of
 * five. For the ten kites to be flat, the rings sit at ±h(1 − cos36°)/(1 + cos36°):
 * in the vertical slice through a kite's middle, the apex, the midpoint of its
 * upper edge and its lower corner have to be on one line.
 */
function buildD10(): Mesh {
  const h = 1.05;
  const cos36 = Math.cos(Math.PI / 5);
  const ring = (h * (1 - cos36)) / (1 + cos36);
  const top: Vec3 = [0, h, 0];
  const bottom: Vec3 = [0, -h, 0];
  const upper: Vec3[] = [];
  const lower: Vec3[] = [];
  for (let k = 0; k < 5; k += 1) {
    const a = (k * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    upper.push([Math.cos(a), ring, Math.sin(a)]);
    lower.push([Math.cos(b), -ring, Math.sin(b)]);
  }
  // 0 top, 1 bottom, 2–6 upper ring, 7–11 lower ring.
  const vertices: Vec3[] = [top, bottom, ...upper, ...lower];
  const U = (k: number) => 2 + ((k + 5) % 5);
  const L = (k: number) => 7 + ((k + 5) % 5);
  const UPPER_VALUES = [1, 3, 5, 7, 9];
  const faces: Face[] = [];
  for (let k = 0; k < 5; k += 1) {
    faces.push(face(vertices, UPPER_VALUES[k]!, [0, U(k), L(k), U(k + 1)], top));
  }
  for (let k = 0; k < 5; k += 1) {
    // The face opposite upper kite k is lower kite k + 2; opposite faces sum to 11.
    const opposite = UPPER_VALUES[(k + 3) % 5]!;
    faces.push(face(vertices, 11 - opposite, [1, L(k), U(k + 1), L(k + 1)], bottom));
  }
  return { sides: 10, vertices, faces };
}

/** A cube, the d6. Opposite faces sum to seven. */
function buildD6(): Mesh {
  const s = 0.78;
  const vertices: Vec3[] = [];
  for (const x of [-s, s])
    for (const y of [-s, s]) for (const z of [-s, s]) vertices.push([x, y, z]);
  const idx = (x: number, y: number, z: number) =>
    vertices.findIndex((v) => v[0] === x * s && v[1] === y * s && v[2] === z * s);
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3) =>
    [a, b, c, d].map((p) => idx(p[0], p[1], p[2]));
  const faces: Face[] = [
    // value, corners, which way is "up" on it
    face(vertices, 1, quad([-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]), [0, 5, 0]),
    face(vertices, 6, quad([-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]), [0, 5, 0]),
    face(vertices, 2, quad([1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]), [0, 5, 0]),
    face(vertices, 5, quad([-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]), [0, 5, 0]),
    face(vertices, 3, quad([-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]), [0, 0, -5]),
    face(vertices, 4, quad([-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]), [0, 0, 5]),
  ];
  return { sides: 6, vertices, faces };
}

/** A face, with its normal, centroid, and the direction its number reads up toward. */
function face(vertices: Vec3[], value: number, corners: number[], upToward: Vec3): Face {
  const points = corners.map((i) => vertices[i]!);
  const normal = outwardNormal(points);
  const centroid = centroidOf(points);
  return { value, corners, normal, centroid, up: alongPlane(sub(upToward, centroid), normal) };
}

export const D10 = buildD10();
export const D6 = buildD6();

/** The mesh for a die with this many sides; anything but a d6 is drawn as a d10. */
export function meshFor(sides: number): Mesh {
  return sides === 6 ? D6 : D10;
}

/** The face a die shows for a rolled value (a d10's "10" is the face marked 10). */
export function faceFor(mesh: Mesh, value: number): Face {
  const wanted = mesh.sides === 10 ? ((value - 1) % 10) + 1 : ((value - 1) % 6) + 1;
  return mesh.faces.find((f) => f.value === wanted) ?? mesh.faces[0]!;
}

/** How far a resting die leans back, so the faces around the front one show too. */
export const REST_TILT = (-12 * Math.PI) / 180;

/**
 * The orientation at rest showing `value`: that face turned to the viewer,
 * its number upright, then the whole die leaned back a little so it reads as
 * a solid on a table rather than a flat badge.
 */
export function restingOrientation(mesh: Mesh, value: number, tilt = REST_TILT): Quat {
  const f = faceFor(mesh, value);
  const right = cross(f.up, f.normal);
  // Maps the face's (right, up, normal) onto the world's (x, y, z).
  const align = conjugate(fromBasis(right, f.up, f.normal));
  return multiply(axisAngle([1, 0, 0], tilt), align);
}

/** Which face is nearest to facing the viewer under an orientation. */
export function frontFace(mesh: Mesh, q: Quat): Face {
  let best = mesh.faces[0]!;
  let bestZ = -Infinity;
  for (const f of mesh.faces) {
    const z = rotate(q, f.normal)[2];
    if (z > bestZ) {
      bestZ = z;
      best = f;
    }
  }
  return best;
}
