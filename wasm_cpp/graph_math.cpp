#include <vector>
#include <queue>
#include <cmath>
#include <cstdint>

extern "C" {

/**
 * Low-level CSR Breadth-First-Search Wavefront Engine.
 * Operates on linear contiguous memory buffers in O(V + E) time.
 */
int compute_blast_waves_csr(
    int num_nodes,
    int start_node,
    const int32_t* row_ptr,
    const int32_t* col_idx,
    int32_t* out_wave_depths
) {
    if (start_node < 0 || start_node >= num_nodes) return 0;

    for (int i = 0; i < num_nodes; ++i) {
        out_wave_depths[i] = 0;
    }

    std::vector<uint8_t> visited(num_nodes, 0);
    std::queue<int> frontier;

    visited[start_node] = 1;
    frontier.push(start_node);

    int impacted_count = 0;

    while (!frontier.empty()) {
        int u = frontier.front();
        frontier.pop();

        int current_depth = out_wave_depths[u];
        int start_edge = row_ptr[u];
        int end_edge = row_ptr[u + 1];

        for (int e = start_edge; e < end_edge; ++e) {
            int v = col_idx[e];
            if (v >= 0 && v < num_nodes && !visited[v]) {
                visited[v] = 1;
                out_wave_depths[v] = current_depth + 1;
                impacted_count++;
                frontier.push(v);
            }
        }
    }

    return impacted_count;
}

/**
 * High-performance PageRank Power Iteration Kernel on CSR sparse matrix.
 */
void pagerank_step_csr(
    int num_nodes,
    double damping,
    const int32_t* row_ptr,
    const int32_t* col_idx,
    const double* current_ranks,
    double* next_ranks
) {
    double base_rank = (1.0 - damping) / static_cast<double>(num_nodes);
    double dangling_mass = 0.0;

    for (int i = 0; i < num_nodes; ++i) {
        next_ranks[i] = base_rank;
        if (row_ptr[i + 1] - row_ptr[i] == 0) {
            dangling_mass += current_ranks[i];
        }
    }

    double dangling_share = (damping * dangling_mass) / static_cast<double>(num_nodes);

    for (int u = 0; u < num_nodes; ++u) {
        next_ranks[u] += dangling_share;
        int out_deg = row_ptr[u + 1] - row_ptr[u];
        if (out_deg > 0) {
            double share = (damping * current_ranks[u]) / static_cast<double>(out_deg);
            for (int e = row_ptr[u]; e < row_ptr[u + 1]; ++e) {
                int v = col_idx[e];
                if (v >= 0 && v < num_nodes) {
                    next_ranks[v] += share;
                }
            }
        }
    }
}

} // extern "C"
