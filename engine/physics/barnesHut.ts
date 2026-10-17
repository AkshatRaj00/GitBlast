export interface QuadNode {
  x: number;
  y: number;
  mass: number;
  cx: number;
  cy: number;
  size: number;
  children: QuadNode[] | null;
  point: { x: number; y: number; id: string } | null;
}

export function buildQuadtree(
  points: Array<{ x: number; y: number; id: string }>,
  minX: number,
  minY: number,
  size: number
): QuadNode {
  const root: QuadNode = { x: minX, y: minY, mass: 0, cx: 0, cy: 0, size, children: null, point: null };

  for (const p of points) {
    insertPoint(root, p);
  }
  return root;
}

function insertPoint(node: QuadNode, p: { x: number; y: number; id: string }) {
  if (node.mass === 0) {
    node.point = p;
    node.cx = p.x;
    node.cy = p.y;
    node.mass = 1;
    return;
  }

  if (node.children === null) {
    node.children = [];
    const half = node.size / 2;
    node.children.push(
      { x: node.x, y: node.y, mass: 0, cx: 0, cy: 0, size: half, children: null, point: null },
      { x: node.x + half, y: node.y, mass: 0, cx: 0, cy: 0, size: half, children: null, point: null },
      { x: node.x, y: node.y + half, mass: 0, cx: 0, cy: 0, size: half, children: null, point: null },
      { x: node.x + half, y: node.y + half, mass: 0, cx: 0, cy: 0, size: half, children: null, point: null }
    );
    if (node.point) {
      const oldP = node.point;
      node.point = null;
      insertPoint(node, oldP);
    }
  }

  // Update center of mass
  node.cx = (node.cx * node.mass + p.x) / (node.mass + 1);
  node.cy = (node.cy * node.mass + p.y) / (node.mass + 1);
  node.mass++;

  const half = node.size / 2;
  const idx = (p.x >= node.x + half ? 1 : 0) + (p.y >= node.y + half ? 2 : 0);
  insertPoint(node.children[idx], p);
}

export function calculateBarnesHutRepulsion(
  point: { x: number; y: number },
  node: QuadNode,
  theta: number = 0.8,
  G: number = 850
): { fx: number; fy: number } {
  if (node.mass === 0) return { fx: 0, fy: 0 };

  const dx = node.cx - point.x;
  const dy = node.cy - point.y;
  const dist = Math.hypot(dx, dy) + 1e-4;

  if (node.children === null || node.size / dist < theta) {
    const force = (-G * node.mass) / (dist * dist);
    return { fx: (dx / dist) * force, fy: (dy / dist) * force };
  }

  let totalFx = 0;
  let totalFy = 0;
  for (const child of node.children) {
    const f = calculateBarnesHutRepulsion(point, child, theta, G);
    totalFx += f.fx;
    totalFy += f.fy;
  }
  return { fx: totalFx, fy: totalFy };
}
