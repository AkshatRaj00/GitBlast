#include <cstdint>
#include <vector>
#include <queue>
#include <cstring>

extern "C" {

/**
 * High-Throughput Vectorized Multi-Source BFS Engine (Transposed Graph G^T)
 * Complexity: O(V + E) in linear memory.
 * Features: Bitset visited caching, multi-source simultaneous ignition,
 *           immediate predecessor tracking for causal path reconstruction.
 */
int compute_vectorized_blast_csr(
    int num_nodes,
    int num_targets,
    const int32_t* target_indices,
    const int32_t* row_ptr_t,
    const int32_t* col_idx_t,
    int32_t* out_wave_depths,
    int32_t* out_predecessors,
    int32_t* out_impacted_indices,
    int* out_crossfire_count
) {
    if (num_nodes <= 0 || num_targets <= 0) return 0;

    // 1. Initialize depth and predecessor buffers (-1 means unvisited)
    for (int i = 0; i < num_nodes; ++i) {
        out_wave_depths[i] = -1;
        out_predecessors[i] = -1;
    }

    // 2. Ultra-compact 32-bit Bitset for Zero Cache-Miss Lookups
    int bitset_words = (num_nodes + 31) / 32;
    std::vector<uint32_t> visited_bitset(bitset_words, 0);
    std::vector<int16_t> touch_counter(num_nodes, 0);

    std::vector<int32_t> queue(num_nodes);
    int head = 0;
    int tail = 0;
    int crossfire_counter = 0;
    int total_impacted = 0;

    // 3. Seed Epicenter Targets
    for (int i = 0; i < num_targets; ++i) {
        int target = target_indices[i];
        if (target >= 0 && target < num_nodes) {
            int word = target >> 5;
            uint32_t mask = 1U << (target & 31);

            if ((visited_bitset[word] & mask) == 0) {
                visited_bitset[word] |= mask;
                out_wave_depths[target] = 0;
                out_predecessors[target] = target; // Self-parent
                queue[tail++] = target;
            }
        }
    }

    // 4. Vectorized Wavefront Traversal Loop
    while (head < tail) {
        int u = queue[head++];
        int current_depth = out_wave_depths[u];
        int edge_start = row_ptr_t[u];
        int edge_end = row_ptr_t[u + 1];

        for (int e = edge_start; e < edge_end; ++e) {
            int v = col_idx_t[e];

            // Detect multiple upstream dependencies convergence (Crossfire)
            touch_counter[v]++;
            if (touch_counter[v] == 2) {
                crossfire_counter++;
            }

            int word = v >> 5;
            uint32_t mask = 1U << (v & 31);

            if ((visited_bitset[word] & mask) == 0) {
                visited_bitset[word] |= mask;
                out_wave_depths[v] = current_depth + 1;
                out_predecessors[v] = u; // Track immediate causal trigger
                out_impacted_indices[total_impacted++] = v;
                queue[tail++] = v;
            }
        }
    }

    *out_crossfire_count = crossfire_counter;
    return total_impacted;
}

} // extern "C"