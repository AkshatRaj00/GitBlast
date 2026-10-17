import { get, set } from 'idb-keyval';
export interface CachedRepoSummary { repoName: string; scannedAt: number; totalFiles: number; totalEdges: number; }
export async function saveGraphToClientStorage(g: any) { await set(`repo_${g.repoName}`, g); }
export async function loadGraphFromClientStorage(name: string) { return await get(`repo_${name}`); }
export async function getRecentClientScans(): Promise<CachedRepoSummary[]> { return []; }
