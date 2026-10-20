#include <cstdint>
#include <vector>
#include <cmath>
#include <algorithm>

extern "C" {

/**
 * Enterprise PageRank Power-Iteration Kernel on Linear CSR Sparse Matrix
 * Implements Google's Original Formulation: R = (1 - d)/N + d * sum(R_u / OutDeg_u)
 * Runs with L1-norm convergence threshold (< 1e-6) or max iterations.
 */
int compute_pagerank_csr(
    int num_nodes,
    double damping,
    int max_iterations,
    double convergence_threshold,
    const int32_t* row_ptr_f,
    const int32_t* col_idx_f,
    const int32_t* row_ptr_t,
    const int32_t* col_idx_t,
    double* out_ranks
) {
    if (num_nodes <= 0) return 0;

    double initial_rank = 1.0 / static_cast<double>(num_nodes);
    std::vector<double> prev_ranks(num_nodes, initial_rank);
    std::vector<double> next_ranks(num_nodes, 0.0);

    // Compute out-degrees for dangling node mass compensation
    std::vector<int> out_degrees(num_nodes, 0);
    for (int i = 0; i < num_nodes; ++i) {
        out_degrees[i] = row_ptr_f[i + 1] - row_ptr_f[i];
    }

    int iter_count = 0;
    double base_val = (1.0 - damping) / static_cast<double>(num_nodes);

    for (int iter = 0; iter < max_iterations; ++iter) {
        iter_count++;
        double dangling_sum = 0.0;

        for (int i = 0; i < num_nodes; ++i) {
            if (out_degrees[i] == 0) {
                dangling_sum += prev_ranks[i];
            }
        }

        double dangling_share = (damping * dangling_sum) / static_cast<double>(num_nodes);

        // Power step using G^T inward callers
        for (int u = 0; u < num_nodes; ++u) {
            double incoming_sum = 0.0;
            int start_edge = row_ptr_t[u];
            int end_edge = row_ptr_t[u + 1];

            for (int e = start_edge; e < end_edge; ++e) {
                int caller = col_idx_t[e];
                if (out_degrees[caller] > 0) {
                    incoming_sum += prev_ranks[caller] / static_cast<double>(out_degrees[caller]);
                }
            }

            next_ranks[u] = base_val + dangling_share + (damping * incoming_sum);
        }

        // Check L1-norm convergence
        double error = 0.0;
        for (int i = 0; i < num_nodes; ++i) {
            error += std::fabs(next_ranks[i] - prev_ranks[i]);
            prev_ranks[i] = next_ranks[i];
        }

        if (error < convergence_threshold) {
            break;
        }
    }

    // Normalize max rank to 1.0 for UI telemetry display
    double max_val = 0.00001;
    for (int i = 0; i < num_nodes; ++i) {
        if (prev_ranks[i] > max_val) max_val = prev_ranks[i];
    }

    for (int i = 0; i < num_nodes; ++i) {
        out_ranks[i] = prev_ranks[i] / max_val;
    }

    return iter_count;
}

/**
 * High-Speed Cycle & Transitive Metric Resolver
 * Evaluates Martin Instability index I = Ce / (Ca + Ce)
 */
void compute_coupling_metrics_csr(
    int num_nodes,
    const int32_t* row_ptr_f,
    const int32_t* row_ptr_t,
    int32_t* out_ca,
    int32_t* out_ce,
    double* out_instability
) {
    for (int i = 0; i < num_nodes; ++i) {
        int ca = row_ptr_t[i + 1] - row_ptr_t[i]; // Incoming (Afferent)
        int ce = row_ptr_f[i + 1] - row_ptr_f[i]; // Outgoing (Efferent)
        out_ca[i] = ca;
        out_ce[i] = ce;

        if (ca + ce == 0) {
            out_instability[i] = 0.0;
        } else {
            out_instability[i] = static_cast<double>(ce) / static_cast<double>(ca + ce);
        }
    }
}

} // extern "C"