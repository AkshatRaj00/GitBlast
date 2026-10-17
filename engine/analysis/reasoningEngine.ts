import { FileNode, RepositoryGraph } from '@/types/graph.types';
import { MultiFileBlastReport } from '@/engine/math/multiBlastRadius';

export interface ThoughtStep {
  phase: 'OBSERVATION' | 'DELIBERATION' | 'DEDUCTION' | 'SURGICAL_ACTION';
  description: string;
  telemetry: string;
}

export interface CognitiveAnalysisResult {
  targetNodeId: string;
  thoughtChain: ThoughtStep[];
  verdict: 'SAFE_TO_MODIFY' | 'REQUIRES_REFACTOR' | 'CRITICAL_BOTTLENECK';
  recommendation: string;
}

export function synthesizeArchitecturalThoughts(
  targetFileId: string,
  graph: RepositoryGraph,
  blastReport: MultiFileBlastReport | null
): CognitiveAnalysisResult {
  const node = graph.nodes[targetFileId];
  const thoughtChain: ThoughtStep[] = [];

  if (!node) {
    return {
      targetNodeId: targetFileId,
      thoughtChain: [],
      verdict: 'SAFE_TO_MODIFY',
      recommendation: 'Target node unavailable for AST deliberation.',
    };
  }

  // 1. Observation Phase
  thoughtChain.push({
    phase: 'OBSERVATION',
    description: `Inspecting AST structure for [${node.name}]. In-degree callers: ${node.inDegree}, Out-degree imports: ${node.outDegree}.`,
    telemetry: `LOC: ${node.loc} | Cyclomatic Complexity: ${node.cyclomaticComplexity} | PageRank: ${(node.pageRank * 100).toFixed(1)}%`,
  });

  // 2. Deliberation Phase
  const blastPct = blastReport ? blastReport.blastPercentage : 0;
  const impactedCount = blastReport ? blastReport.totalImpactedCount : 0;

  let deliberationDetail = `Downstream shockwave impacts ${impactedCount} files (${blastPct}% codebase coverage).`;
  if (node.inDegree > 25) {
    deliberationDetail += ` Core infrastructural gravity: excessive coupling detected.`;
  } else if (node.inDegree === 0) {
    deliberationDetail += ` Leaf/entrypoint characteristics: zero downstream callers.`;
  }

  thoughtChain.push({
    phase: 'DELIBERATION',
    description: `Evaluating regression impact radius across reverse dependency graph (G^T).`,
    telemetry: deliberationDetail,
  });

  // 3. Deduction Phase
  const isCircular = node.circularGroupId !== null;
  const isGodFile = graph.godFiles.includes(targetFileId);

  let deductionVerdict: CognitiveAnalysisResult['verdict'] = 'SAFE_TO_MODIFY';
  let deductionText = 'Low-risk modifications. Direct tests recommended.';

  if (isGodFile || blastPct > 20) {
    deductionVerdict = 'CRITICAL_BOTTLENECK';
    deductionText = 'High risk of cascading regression. Structural interface changes will break callers across multiple layers.';
  } else if (isCircular || blastPct > 5) {
    deductionVerdict = 'REQUIRES_REFACTOR';
    deductionText = 'Moderate coupling. Decoupling callers or extracting interface types advised before commit.';
  }

  thoughtChain.push({
    phase: 'DEDUCTION',
    description: `Synthesized risk probability based on centrality and circularity metrics.`,
    telemetry: deductionText,
  });

  // 4. Action Phase
  let actionAdvice = 'File can be safely modified and merged without architectural decoupling.';
  if (deductionVerdict === 'CRITICAL_BOTTLENECK') {
    actionAdvice = `Create an abstraction layer for ${node.name}. Do not alter existing function signatures directly.`;
  } else if (deductionVerdict === 'REQUIRES_REFACTOR') {
    actionAdvice = `Break circular imports or move shared types to a neutral module before pushing PR.`;
  }

  thoughtChain.push({
    phase: 'SURGICAL_ACTION',
    description: `Formulated architectural containment strategy.`,
    telemetry: actionAdvice,
  });

  return {
    targetNodeId: targetFileId,
    thoughtChain,
    verdict: deductionVerdict,
    recommendation: actionAdvice,
  };
}
