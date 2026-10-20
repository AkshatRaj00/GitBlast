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
  verdict: 'LOW_GRAPH_RISK' | 'REQUIRES_REVIEW' | 'HIGH_GRAPH_RISK';
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
function classifyTopologicalTier(node: FileNode): ArchitecturalMetrics['topologicalTier'] {
  if (node.inDegree >= 15 && node.outDegree <= 5) {
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
      verdict: 'REQUIRES_REVIEW',
      recommendation: 'No graph evidence is available for this target. Rescan the repository before drawing a risk conclusion.',
      containmentProtocol: {
        rule: 'REJECT_ACTION',
        preMergeChecks: ['Verify file existence in current repository index.'],
      },
    };
  }

  // Calculate coupling and topology metrics from resolved import edges.
  const ca = node.inDegree || (node.importedBy ? node.importedBy.length : 0);
  const ce = node.outDegree || (node.imports ? node.imports.length : 0);
  const instability = computeInstability(ca, ce);
  const topologicalTier = classifyTopologicalTier(node);

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
    description: `Static import graph metrics for ${node.name}. Resolved direct importers: ${ca}; resolved dependencies: ${ce}.`,
    telemetry: `Physical lines: ${node.loc} | Instability estimate: ${instability} | PageRank share: ${((node.pageRank || 0) * 100).toFixed(2)}% | Structural tier: ${topologicalTier}`,
  });

  // Estimate reverse reach using the resolved dependency graph.
  let deliberationDetail = `Downstream shockwave impacts ${impactedCount} files across ${transitiveDepth} wave stages (${blastPct}% codebase coverage).`;

  if (topologicalTier === 'KERNEL_FOUNDATION') {
    deliberationDetail += ` High incoming dependency count (Ca=${ca}); check callers before changing this module's exports.`;
  } else if (instability === 1.0) {
    deliberationDetail += ` No resolved incoming imports. Dynamic or framework references may not appear in this graph.`;
  } else if (instability < 0.25) {
    deliberationDetail += ` Most resolved dependencies point inward (I=${instability}); inspect dependency direction when changing interfaces.`;
  } else {
    deliberationDetail += ` Incoming and outgoing dependency counts are both non-zero.`;
  }

  thoughtChain.push({
    phase: 'DELIBERATION',
    description: 'Calculated reverse reach and coupling from the resolved import graph.',
    telemetry: deliberationDetail,
  });

  // Assign a review level from explicit structural thresholds.
  const isCircular = (graph.circularGroups || []).some((group) => group.includes(targetFileId));

  let deductionVerdict: CognitiveAnalysisResult['verdict'] = 'LOW_GRAPH_RISK';
  let deductionText = 'The resolved static import graph shows limited incoming reach. This is not a safety or correctness guarantee.';
  let preMergeChecks: string[] = ['Run targeted unit test suite.'];

  if (blastPct >= 35 || ca >= 20) {
    deductionVerdict = 'HIGH_GRAPH_RISK';
    deductionText = `High graph exposure estimate: ${blastPct}% downstream reach and ${ca} resolved direct importers. Review before changing this module.`;
    preMergeChecks = [
      'Lock public exported function signatures and parameter types.',
      'Introduce adapter/facade layer before deprecating legacy methods.',
      'Execute full integration regression suite across all downstream waves.',
      'Mandate multi-owner architectural peer review before merge.',
    ];
  } else if (isCircular || blastPct >= 10 || ca >= 6 || blastReport?.qualityGate.highCentralityRisk) {
    deductionVerdict = 'REQUIRES_REVIEW';
    deductionText = `Review is recommended based on resolved graph structure. ${
      isCircular ? 'The target belongs to a detected cycle. ' : ''
    }The estimated reverse dependency traversal reaches ${impactedCount} files.`;
    preMergeChecks = [
      'Extract shared interface/types into a neutral upstream module.',
      isCircular ? 'Decouple cyclic dependency loop using dependency inversion.' : 'Verify caller integration points.',
      'Validate mock contracts in consumer modules.',
    ];
  }

  thoughtChain.push({
    phase: 'DEDUCTION',
    description: 'Risk level is derived from resolved imports, cycle membership, and reverse dependency reach. It is a structural estimate, not a failure probability.',
    telemetry: deductionText,
  });

  // Offer a review suggestion; this engine does not generate or apply patches.
  let actionAdvice = 'The resolved graph shows limited downstream reach. Review the code and run relevant checks; dynamic or framework-based references may be missing.';

  if (deductionVerdict === 'HIGH_GRAPH_RISK') {
    actionAdvice = `Before changing ${node.name}, inspect its ${ca} resolved importers and run relevant integration checks. Prefer a compatible change or staged migration.`;
  } else if (deductionVerdict === 'REQUIRES_REVIEW') {
    actionAdvice = isCircular
      ? `Review the detected cycle containing ${node.name} and verify initialization order before changing imports or exports.`
      : `Check the resolved callers of ${node.name}; preserve their used exports or update them alongside this change.`;
  }

  thoughtChain.push({
    phase: 'SURGICAL_ACTION',
    description: 'Suggested a review step based on the observed graph structure.',
    telemetry: actionAdvice,
  });

  return {
    targetNodeId: targetFileId,
    metrics,
    thoughtChain,
    verdict: deductionVerdict,
    recommendation: actionAdvice,
    containmentProtocol: {
      rule: deductionVerdict === 'HIGH_GRAPH_RISK' ? 'ARCHITECTURAL_REVIEW' : deductionVerdict === 'REQUIRES_REVIEW' ? 'CONDITIONAL_REVIEW' : 'REVIEW_AND_TEST',
      preMergeChecks,
    },
  };
}
