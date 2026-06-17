// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type {
  DataViewGraph,
  DataViewGraphNode,
} from '../../../../src/renderer/views/dataview-graph/types'

// ─── Inline copy of computeBipartiteOrder from DataViewGraph.tsx ────

interface Link {
  source: string
  target: string
}

/**
 * Compute a bipartite ordering (rank) for each node using the barycenter heuristic.
 * Returns a Map<nodeId, rank> where rank is 0..N-1 representing optimal vertical position
 * to minimize edge crossings in a bipartite layout.
 *
 * Left side = groups 0 & 1 (consumers), Right side = group 2 (dependencies).
 */
function computeBipartiteOrder(
  graphData: DataViewGraph,
  _width: number,
  height: number,
): Map<string, number> {
  const leftNodes: { id: string; y: number }[] = []
  const rightNodes: { id: string; y: number }[] = []

  graphData.nodes.forEach((node) => {
    if (node.group === 2) {
      rightNodes.push({ id: node.id, y: 0 })
    } else {
      leftNodes.push({ id: node.id, y: 0 })
    }
  })

  // Initial evenly-spaced vertical positions
  leftNodes.forEach((n, i) => {
    n.y = ((i + 1) * height) / (leftNodes.length + 1)
  })
  rightNodes.forEach((n, i) => {
    n.y = ((i + 1) * height) / (rightNodes.length + 1)
  })

  // Build adjacency
  const leftSet = new Set(leftNodes.map((n) => n.id))
  const rightSet = new Set(rightNodes.map((n) => n.id))
  const leftAdj = new Map<string, string[]>()
  const rightAdj = new Map<string, string[]>()

  for (const n of leftNodes) leftAdj.set(n.id, [])
  for (const n of rightNodes) rightAdj.set(n.id, [])

  graphData.links.forEach((link) => {
    const source =
      typeof link.source === 'string' ? link.source : (link.source as any).id
    const target =
      typeof link.target === 'string' ? link.target : (link.target as any).id

    if (leftSet.has(source) && rightSet.has(target)) {
      leftAdj.get(source)?.push(target)
      rightAdj.get(target)?.push(source)
    } else if (leftSet.has(target) && rightSet.has(source)) {
      leftAdj.get(target)?.push(source)
      rightAdj.get(source)?.push(target)
    }
  })

  // Barycenter heuristic (15 iterations)
  for (let iter = 0; iter < 15; iter++) {
    // Sort right nodes by avg y of connected left nodes
    for (const n of rightNodes) {
      const ids = rightAdj.get(n.id) || []
      if (ids.length > 0) {
        const connected = leftNodes.filter((l) => ids.includes(l.id))
        ;(n as any).__bary =
          connected.reduce((s, l) => s + l.y, 0) / connected.length
      } else {
        ;(n as any).__bary = n.y
      }
    }
    rightNodes.sort((a, b) => (a as any).__bary - (b as any).__bary)
    rightNodes.forEach((n, i) => {
      n.y = ((i + 1) * height) / (rightNodes.length + 1)
    })

    // Sort left nodes by avg y of connected right nodes
    for (const n of leftNodes) {
      const ids = leftAdj.get(n.id) || []
      if (ids.length > 0) {
        const connected = rightNodes.filter((r) => ids.includes(r.id))
        ;(n as any).__bary =
          connected.reduce((s, r) => s + r.y, 0) / connected.length
      } else {
        ;(n as any).__bary = n.y
      }
    }
    leftNodes.sort((a, b) => (a as any).__bary - (b as any).__bary)
    leftNodes.forEach((n, i) => {
      n.y = ((i + 1) * height) / (leftNodes.length + 1)
    })
  }

  // Build final ranking: left nodes first (rank 0..L-1), then right nodes (rank L..L+R-1)
  const rank = new Map<string, number>()
  for (let i = 0; i < leftNodes.length; i++) {
    rank.set(leftNodes[i].id, i)
  }
  for (let i = 0; i < rightNodes.length; i++) {
    rank.set(rightNodes[i].id, leftNodes.length + i)
  }

  return rank
}

// ─── Helpers ─────────────────────────────────────────────────────────

function makeNode(
  id: string,
  group: number,
  overrides: Partial<DataViewGraphNode> = {},
): DataViewGraphNode {
  return { id, label: id, group, val: 10, ...overrides }
}

function makeLink(source: string, target: string): Link {
  return { source, target }
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('computeBipartiteOrder', () => {
  it('assigns all nodes a rank', () => {
    const graph: DataViewGraph = {
      nodes: [makeNode('a', 0), makeNode('b', 2)],
      links: [makeLink('a', 'b')],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    expect(ranks.size).toBe(2)
    expect(ranks.has('a')).toBe(true)
    expect(ranks.has('b')).toBe(true)
  })

  it('puts left nodes (group 0/1) before right nodes (group 2)', () => {
    const graph: DataViewGraph = {
      nodes: [
        makeNode('left1', 0),
        makeNode('left2', 1),
        makeNode('right1', 2),
      ],
      links: [],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    expect(ranks.get('left1')).toBeLessThan(ranks.get('right1')!)
    expect(ranks.get('left2')).toBeLessThan(ranks.get('right1')!)
  })

  it('connects nodes on group 0/1 to group 2 via links', () => {
    // a1 and a2 are left (consumers), b1 and b2 are right (dependencies)
    // a1→b1, a2→b2 (crossing-free)
    const graph: DataViewGraph = {
      nodes: [
        makeNode('a1', 0),
        makeNode('a2', 1),
        makeNode('b1', 2),
        makeNode('b2', 2),
      ],
      links: [makeLink('a1', 'b1'), makeLink('a2', 'b2')],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    // a1 and a2 get ranks 0,1; b1 and b2 get ranks 2,3
    expect(ranks.get('a1')).toBeLessThan(ranks.get('a2')!)
    // Both left nodes have lower rank than right nodes
    expect(ranks.get('a1')!).toBeLessThan(ranks.get('b1')!)
    expect(ranks.get('a2')!).toBeLessThan(ranks.get('b1')!)
  })

  it('handles all nodes on left side (no group 2)', () => {
    const graph: DataViewGraph = {
      nodes: [makeNode('a', 0), makeNode('b', 1), makeNode('c', 0)],
      links: [],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    expect(ranks.size).toBe(3)
    // All should be consecutive ranks
    const values = [...ranks.values()].sort((a, b) => a - b)
    expect(values).toEqual([0, 1, 2])
  })

  it('handles all nodes on right side (all group 2)', () => {
    const graph: DataViewGraph = {
      nodes: [makeNode('x', 2), makeNode('y', 2), makeNode('z', 2)],
      links: [],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    expect(ranks.size).toBe(3)
    const values = [...ranks.values()].sort((a, b) => a - b)
    expect(values).toEqual([0, 1, 2])
  })

  it('handles single node', () => {
    const graph: DataViewGraph = {
      nodes: [makeNode('only', 0)],
      links: [],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    expect(ranks.get('only')).toBe(0)
  })

  it('handles empty nodes', () => {
    const graph: DataViewGraph = {
      nodes: [],
      links: [],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    expect(ranks.size).toBe(0)
  })

  it('handles links referencing non-existent nodes', () => {
    const graph: DataViewGraph = {
      nodes: [makeNode('a', 0), makeNode('b', 2)],
      links: [makeLink('a', 'nonexistent')], // target doesn't exist
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    expect(ranks.size).toBe(2) // only a and b
    expect(ranks.get('a')).toBe(0)
    expect(ranks.get('b')).toBe(1)
  })

  it('places connected nodes closer together (barycenter effect)', () => {
    // Left: a1, a2, a3. Right: b1, b2, b3
    // a1 connects to b1, a2 connects to b2, a3 connects to b3
    // This is crossing-free, so the order should match: a1-a2-a3 then b1-b2-b3
    const graph: DataViewGraph = {
      nodes: [
        makeNode('a1', 0),
        makeNode('a2', 1),
        makeNode('a3', 0),
        makeNode('b1', 2),
        makeNode('b2', 2),
        makeNode('b3', 2),
      ],
      links: [makeLink('a1', 'b1'), makeLink('a2', 'b2'), makeLink('a3', 'b3')],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)

    // After barycenter iterations, connected pairs should maintain relative order
    expect(ranks.get('a1')).toBeLessThan(ranks.get('a2')!)
    expect(ranks.get('a2')).toBeLessThan(ranks.get('a3')!)
    expect(ranks.get('b1')).toBeLessThan(ranks.get('b2')!)
    expect(ranks.get('b2')).toBeLessThan(ranks.get('b3')!)
  })

  it('produces consistent ranks (deterministic output)', () => {
    const graph: DataViewGraph = {
      nodes: [
        makeNode('n1', 0),
        makeNode('n2', 2),
        makeNode('n3', 1),
        makeNode('n4', 2),
      ],
      links: [makeLink('n1', 'n2'), makeLink('n3', 'n4')],
    }
    const firstRun = computeBipartiteOrder(graph, 800, 600)
    const secondRun = computeBipartiteOrder(graph, 800, 600)

    // Two runs should produce the same ranking
    for (const [key, value] of firstRun) {
      expect(secondRun.get(key)).toBe(value)
    }
  })

  it('handles nodes with group numbers other than 0/1/2 (treats as left)', () => {
    const graph: DataViewGraph = {
      nodes: [makeNode('custom', 5), makeNode('right', 2)],
      links: [makeLink('custom', 'right')],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)
    // Group 5 should be treated as left (not group 2)
    expect(ranks.get('custom')).toBe(0)
    expect(ranks.get('right')).toBe(1)
  })

  it('minimizes edge crossings for crossing graph', () => {
    // Classic crossing scenario:
    // Left: a, b   Right: c, d
    // a→d, b→c (crossing edges in default order)
    // After barycenter, order should swap to minimize crossings
    const graph: DataViewGraph = {
      nodes: [
        makeNode('a', 0),
        makeNode('b', 0),
        makeNode('c', 2),
        makeNode('d', 2),
      ],
      links: [makeLink('a', 'd'), makeLink('b', 'c')],
    }
    const ranks = computeBipartiteOrder(graph, 800, 600)

    // a connects to d, b connects to c
    // a should be closer to d, b closer to c
    // Since a connects to d (right) and b connects to c (right):
    // On the right side, d (connected to a) should be closer to a
    // Since both a and b are left, and a→d, b→c:
    // d's barycenter is a's y, c's barycenter is b's y
    // So after sorting: a before b, and d before c (or c before d depending on initial positions)
    // The key test: no assertion on exact order (depends on initial positions),
    // just that the function doesn't crash and produces correct rank counts
    expect(ranks.size).toBe(4)

    // Verify the crossing minimization: edges a→d and b→c
    // If ranks are a=0,b=1 on left and d=2,c=3 on right, edges don't cross
    // If ranks are a=0,b=1 on left and c=2,d=3 on right, edges DO cross
    // The algorithm should ideally produce non-crossing layout
    const rankA = ranks.get('a')!
    const rankB = ranks.get('b')!
    const rankC = ranks.get('c')!
    const rankD = ranks.get('d')!

    // Left side: a and b (0 and 1, a is first)
    expect(rankA).toBeLessThan(rankB)

    // For non-crossing: if a is before b on left, d should be before c on right
    // (because a→d, b→c)
    const edgesCross = rankA < rankB !== rankD < rankC
    // The algorithm should produce non-crossing layout
    expect(edgesCross).toBe(false)
  })
})
