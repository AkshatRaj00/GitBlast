import { FileNode, RepositoryGraph } from '@/types/graph.types';
import { MultiFileBlastReport } from '@/engine/math/multiBlastRadius';

export interface ThoughtStep {
  phase: 'OBSERVATION' | 'DELIBERATION' | 'DEDUCTION' | 'SURGICAL_ACTION';
  description: string;
  telemetry: string;
}

export interface ArchitecturalMetrics {
  afferentCoupling: number; // Ca: Callers depending on this file
  efferentCoupling: number; // Ce: Dependencies this file calls
  instability: number;      // I = Ce / (Ca + Ce) [0 = Max Stable, 1 = Max Unstable]
  topologicalTier: 'KERNEL_FOUNDATION' | 'CORE_LOGIC' | 'DOMAIN_SERVICE' | 'SURFACE_LEAF';
  blastTransitiveDepth: number;
}

export interface CognitiveAnalysisResult {
  targetNodeId: string;
  metrics: ArchitecturalMetrics;
  thoughtChain: ThoughtStep[];
  verdict: 'SAFE_TO_MODIFY' | 'REQUIRES_REFACTOR' | 'CRITICAL_BOTTLENECK';
  recommendation: string;
  containmentProtocol: {
    rule: string;
    preMergeChecks: string[];
  };
}

/**
 * Computes Martin's Architectural Instability Metric: I = Ce / (Ca + Ce)
 * Evaluates whether a component conforms to the Stable Dependencies Principle (SDP).
 */
function computeInstability(ca: number, ce: number): number {
  if (ca + ce === 0) return 0;
  return Number((ce / (ca + ce)).toFixed(3));
}

/**
 * Evaluates architectural tier based on PageRank, Afferent & Efferent Coupling.
 */
function classifyTopologicalTier(
  node: FileNode,
  pageRank: number,
  isGod: boolean
): ArchitecturalMetrics['topologicalTier'] {
  if (isGod || (node.inDegree > 15 && node.outDegree <= 5)) {
    return 'KERNEL_FOUNDATION';
  }
  if (node.inDegree > 5 && node.outDegree > 5) {
    return 'CORE_LOGIC';
  }
  if (node.inDegree <= 2 && node.outDegree > 0) {
    return 'SURFACE_LEAF';
  }
  return 'DOMAIN_SERVICE';
}

export function synthesizeArchitecturalThoughts(
  targetFileId: string,
  graph: RepositoryGraph,
  blastReport: MultiFileBlastReport | null
): CognitiveAnalysisResult {
  const node = graph.nodes[targetFileId];
  const thoughtChain: ThoughtStep[] = [];

  const defaultMetrics: ArchitecturalMetrics = {
    afferentCoupling: 0,
    efferentCoupling: 0,
    instability: 0,
    topologicalTier: 'SURFACE_LEAF',
    blastTransitiveDepth: 0,
  };

  if (!node) {
    return {
      targetNodeId: targetFileId,
      metrics: defaultMetrics,
      thoughtChain: [],
      verdict: 'SAFE_TO_MODIFY',
      recommendation: 'Target node unavailable in current Abstract Syntax Tree matrix.',
      containmentProtocol: {
        rule: 'REJECT_ACTION',
        preMergeChecks: ['Verify file existence in current repository index.'],
      },
    };
  }

  // 1. Calculate Rigorous Coupling & Topological Metrics
  const ca = node.inDegree || (node.importedBy ? node.importedBy.length : 0);
  const ce = node.outDegree || (node.imports ? node.imports.length : 0);
  const instability = computeInstability(ca, ce);
  const isGodFile = (graph.godFiles || []).includes(targetFileId);
  const topologicalTier = classifyTopologicalTier(node, node.pageRank || 0, isGodFile);

  const blastPct = blastReport ? blastReport.blastPercentage : 0;
  const impactedCount = blastReport ? blastReport.totalImpactedCount : 0;
  const transitiveDepth = blastReport && blastReport.waves ? blastReport.waves.length : 0;

  const metrics: ArchitecturalMetrics = {
    afferentCoupling: ca,
    efferentCoupling: ce,
    instability,
    topologicalTier,
    blastTransitiveDepth: transitiveDepth,
  };

  // =========================================================================
  // PHASE 1: OBSERVATION (Static Structural Topology)
  // =========================================================================
  thoughtChain.push({
    phase: 'OBSERVATION',
    description: `Tokenized AST structure for [${node.name}]. Afferent Coupling (Ca): ${ca}, Efferent Coupling (Ce): ${ce}.`,
    telemetry: `LOC: ${node.loc} | Instability Index (I): ${instability} | PageRank: ${((node.pageRank || 0) * 100).toFixed(1)}% | Tier: ${topologicalTier}`,
  });

  // =========================================================================
  // PHASE 2: DELIBERATION (Transitive Shockwave & Coupling Law Audit)
  // =========================================================================
  let deliberationDetail = `Downstream shockwave impacts ${impactedCount} files across ${transitiveDepth} wave stages (${blastPct}% codebase coverage).`;

  if (topologicalTier === 'KERNEL_FOUNDATION') {
    deliberationDetail += ` Stable Abstraction Violation: High inward gravity (Ca=${ca}). Any signature variance risks system-wide cascades.`;
  } else if (instability === 1.0) {
    deliberationDetail += ` Pure Consumer Leaf (I=1.0). High volatility permissible; zero downstream consumers to regress.`;
  } else if (instability < 0.25) {
    deliberationDetail += ` High-Stability Component (I=${instability}). Bound by Stable Dependencies Principle (SDP).`;
  } else {
    deliberationDetail += ` Balanced In-flight Service. Moderate bilateral coupling.`;
  }

  thoughtChain.push({
    phase: 'DELIBERATION',
    description: `Evaluated transitive blast radius on reverse dependency graph G^T with SDP compliance check.`,
    telemetry: deliberationDetail,
  });

  // =========================================================================
  // PHASE 3: DEDUCTION (Rigorous Decision Matrix)
  // =========================================================================
  const isCircular = graph.edges.some(
    (e) => (e.source === targetFileId || e.target === targetFileId) && e.isCircular
  );

  let deductionVerdict: CognitiveAnalysisResult['verdict'] = 'SAFE_TO_MODIFY';
  let deductionText = 'Low regression surface. Structural mutations contained within local compilation unit.';
  let preMergeChecks: string[] = ['Run targeted unit test suite.'];

  if (isGodFile || blastPct > 20 || (ca > 15 && instability < 0.2)) {
    deductionVerdict = 'CRITICAL_BOTTLENECK';
    deductionText = `Critical infrastructural failure risk. Blast radius (${blastPct}%) and inward coupling (Ca=${ca}) exceed strict architecture safety gates.`;
    preMergeChecks = [
      'Lock public exported function signatures and parameter types.',
      'Introduce adapter/facade layer before deprecating legacy methods.',
      'Execute full integration regression suite across all downstream waves.',
      'Mandate multi-owner architectural peer review before merge.',
    ];
  } else if (isCircular || blastPct > 5 || ca > 4) {
    deductionVerdict = 'REQUIRES_REFACTOR';
    deductionText = `Intermediate coupling risk detected. ${
      isCircular ? 'Circular import cycle detected in AST loop. ' : ''
    }Transitive blast propagates through ${impactedCount} dependencies.`;
    preMergeChecks = [
      'Extract shared interface/types into a neutral upstream module.',
      isCircular ? 'Decouple cyclic dependency loop using dependency inversion.' : 'Verify caller integration points.',
      'Validate mock contracts in consumer modules.',
    ];
  }

  thoughtChain.push({
    phase: 'DEDUCTION',
    description: `Synthesized failure probability matrix across topology, circularity, and instability.`,
    telemetry: deductionText,
  });

  // =========================================================================
  // PHASE 4: SURGICAL ACTION (Actionable Containment Protocol)
  // =========================================================================
  let actionAdvice = 'Module is topologically isolated. Direct commits safe; no structural refactor required.';

  if (deductionVerdict === 'CRITICAL_BOTTLENECK') {
    actionAdvice = `SURGICAL FREEZE: Apply Open-Closed Principle (OCP) on [${node.name}]. Extend through interface wrappers or forwarders; do not alter existing runtime signatures.`;
  } else if (deductionVerdict === 'REQUIRES_REFACTOR') {
    actionAdvice = isCircular
      ? `LOOP ISOLATION: Break cyclic edge on [${node.name}]. Inject dependency via constructor or parameter injection.`
      : `CONTAINMENT: Extract caller contracts into standalone type definitions to prevent ripple across downstream dependents.`;
  }

  thoughtChain.push({
    phase: 'SURGICAL_ACTION',
    description: `Formulated architectural containment strategy and pre-merge checklist.`,
    telemetry: actionAdvice,
  });

  return {
    targetNodeId: targetFileId,
    metrics,
    thoughtChain,
    verdict: deductionVerdict,
    recommendation: actionAdvice,
    containmentProtocol: {
      rule: deductionVerdict === 'CRITICAL_BOTTLENECK' ? 'ARCHITECTURAL_FREEZE' : deductionVerdict === 'REQUIRES_REFACTOR' ? 'CONDITIONAL_REVIEW' : 'FAST_TRACK',
      preMergeChecks,
    },
  };
}