export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'cpp' | 'go' | 'other';

export interface RawRepoFile {
  path: string;
  content: string;
  size: number;
}

export interface FileNode {
  id: string;
  name: string;
  directory: string;
  extension: string;
  language: SupportedLanguage;
  content: string;
  loc: number;
  cyclomaticComplexity: number;
  imports: string[];
  importedBy: string[];
  rawImports: string[];
  inDegree: number;
  outDegree: number;
  pageRank: number;
  isDeadCode: boolean;
  isEntryPoint: boolean;
  circularGroupId: number | null;
  x?: number;
  y?: number;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  isCircular: boolean;
}

export interface BlastWave {
  waveIndex: number;
  fileIds: string[];
}

export interface BlastRadiusReport {
  targetFileId: string;
  totalImpactedCount: number;
  blastPercentage: number;
  waves: BlastWave[];
  impactedFileMap: Record<string, number>;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

export interface RepositoryGraph {
  repoName: string;
  scannedAt: number;
  totalFiles: number;
  totalEdges: number;
  totalLoc: number;
  nodes: Record<string, FileNode>;
  edges: DependencyEdge[];
  circularGroups: string[][];
  deadFiles: string[];
  godFiles: string[];
}
