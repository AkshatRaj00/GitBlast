export interface RawRepoFile {
  path: string;
  content: string;
  size: number;
}

export type SupportedLanguage = 
  | 'typescript' 
  | 'javascript' 
  | 'python' 
  | 'cpp' 
  | 'c' 
  | 'go' 
  | 'rust' 
  | 'java' 
  | 'kotlin'
  | 'csharp' 
  | 'unknown';

export interface FileNode {
  id: string;
  name: string;
  directory: string;
  loc: number;
  imports: string[];
  importedBy: string[];
  pageRank: number;
  inDegree: number;
  outDegree: number;
  isDeadCode: boolean;
  isEntryPoint?: boolean;
  cyclomaticComplexity?: number;
  circularGroupId?: string | number | null;
  content?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  isCircular?: boolean;
}

export interface RepositoryGraph {
  repoName: string;
  totalFiles: number;
  totalEdges: number;
  totalLoc: number;
  nodes: Record<string, FileNode>;
  edges: GraphEdge[];
  godFiles: string[];
  deadFiles: string[];
  circularGroups: Array<string[]>;
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
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
}

export interface BlastWaveLevel {
  waveIndex: number;
  fileIds: string[];
}

export interface QualityGateAudit {
  lowTopologyRisk: boolean;
  manyImpactedFiles: boolean;
  highCentralityRisk: boolean;
  circularDependencyImpact: boolean;
  testFileNameHeuristicRatio: number;
}
