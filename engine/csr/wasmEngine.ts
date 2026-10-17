import { CSRGraphBuffer, executeTypedBFS } from './csrBuffer';

export class WasmKernelBridge {
  private csr: CSRGraphBuffer | null = null;

  public initialize(csr: CSRGraphBuffer) {
    this.csr = csr;
  }

  public runFastBFS(targetId: string): { totalImpacted: number; waveMap: Record<string, number> } {
    if (!this.csr) return { totalImpacted: 0, waveMap: {} };

    const targetIndex = this.csr.fileToIndex.get(targetId);
    if (targetIndex === undefined) return { totalImpacted: 0, waveMap: {} };

    // Linear typed execution matching the C++ WASM memory signature
    const { impactedCount, waveDepths } = executeTypedBFS(this.csr, targetIndex);

    const waveMap: Record<string, number> = {};
    for (let i = 0; i < this.csr.numNodes; i++) {
      const depth = waveDepths[i];
      if (depth > 0) {
        waveMap[this.csr.indexToFile[i]] = depth;
      }
    }

    return { totalImpacted: impactedCount, waveMap };
  }
}

export const wasmBridgeInstance = new WasmKernelBridge();
