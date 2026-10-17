export interface CSRGraphBuffer {
  numNodes: number;
  numEdges: number;
  rowPtr: Int32Array;   // Offsets in colIdx: length = numNodes + 1
  colIdx: Int32Array;   // Target indices: length = numEdges
  fileToIndex: Map<string, number>;
  indexToFile: string[];
}

export function buildCSRFromEdges(
  fileIds: string[],
  edges: Array<{ source: string; target: string }>
): CSRGraphBuffer {
  const numNodes = fileIds.length;
  const fileToIndex = new Map<string, number>();
  const indexToFile: string[] = new Array(numNodes);

  fileIds.forEach((fid, idx) => {
    fileToIndex.set(fid, idx);
    indexToFile[idx] = fid;
  });

  // Calculate Reverse Graph G^T Degrees (who depends on whom)
  const degrees = new Int32Array(numNodes);
  for (const edge of edges) {
    const targetIdx = fileToIndex.get(edge.target);
    if (targetIdx !== undefined) {
      degrees[targetIdx]++;
    }
  }

  // Prefix sum to compute rowPtr offsets
  const rowPtr = new Int32Array(numNodes + 1);
  rowPtr[0] = 0;
  for (let i = 0; i < numNodes; i++) {
    rowPtr[i + 1] = rowPtr[i] + degrees[i];
  }

  const numEdges = rowPtr[numNodes];
  const colIdx = new Int32Array(numEdges);
  const currentInsertPos = new Int32Array(rowPtr);

  // Fill contiguous colIdx array
  for (const edge of edges) {
    const srcIdx = fileToIndex.get(edge.source);
    const tgtIdx = fileToIndex.get(edge.target);
    if (srcIdx !== undefined && tgtIdx !== undefined) {
      const pos = currentInsertPos[tgtIdx]++;
      colIdx[pos] = srcIdx;
    }
  }

  return { numNodes, numEdges, rowPtr, colIdx, fileToIndex, indexToFile };
}

/**
 * Ultra-fast in-memory typed BFS kernel matching the C++ WASM signature.
 */
export function executeTypedBFS(
  csr: CSRGraphBuffer,
  startNodeIndex: number
): { impactedCount: number; waveDepths: Int32Array } {
  const waveDepths = new Int32Array(csr.numNodes);
  const visited = new Uint8Array(csr.numNodes);

  if (startNodeIndex < 0 || startNodeIndex >= csr.numNodes) {
    return { impactedCount: 0, waveDepths };
  }

  const queue = new Int32Array(csr.numNodes);
  let head = 0;
  let tail = 0;

  visited[startNodeIndex] = 1;
  queue[tail++] = startNodeIndex;
  let impactedCount = 0;

  while (head < tail) {
    const u = queue[head++];
    const currentDepth = waveDepths[u];
    const startEdge = csr.rowPtr[u];
    const endEdge = csr.rowPtr[u + 1];

    for (let e = startEdge; e < endEdge; e++) {
      const v = csr.colIdx[e];
      if (v >= 0 && v < csr.numNodes && visited[v] === 0) {
        visited[v] = 1;
        waveDepths[v] = currentDepth + 1;
        impactedCount++;
        queue[tail++] = v;
      }
    }
  }

  return { impactedCount, waveDepths };
}
