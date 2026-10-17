#!/usr/bin/env bash
# Compiles graph_math.cpp into a standalone, dependency-free WebAssembly binary
mkdir -p ../public/wasm
emcc graph_math.cpp \
  -O3 \
  -s WASM=1 \
  -s STANDALONE_WASM=1 \
  -s EXPORTED_FUNCTIONS='["_compute_blast_waves_csr","_pagerank_step_csr"]' \
  --no-entry \
  -o ../public/wasm/graph_math.wasm
echo "✅ Compiled C++ Graph Engine to public/wasm/graph_math.wasm"