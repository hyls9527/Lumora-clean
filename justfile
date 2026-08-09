# Lumora 本地一键质量门禁
# 复用现有 CI 命令（.github/workflows/ci.yml），不做重复实现。
# 用法：just check（快速门禁） / just test（完整验证）

set shell := ["powershell.exe", "-NoLogo", "-Command"]

default: check

# 快速门禁：格式、类型检查、单测、静态检查
check: fmt typecheck frontend-test rust-test clippy sidecar-test

# 完整验证：门禁 + 覆盖率 + 构建 + 性能预算
test: check coverage build perf

# Rust 格式
fmt:
    cargo fmt --check --manifest-path src-tauri/Cargo.toml

# 前端类型检查
typecheck:
    npx tsc --noEmit

# 前端单测（738）
frontend-test:
    npx vitest run

# Rust 单测（197）
rust-test:
    cargo test --lib --manifest-path src-tauri/Cargo.toml

# Rust 静态检查
clippy:
    cargo clippy --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings

# Python sidecar 单测（12）
sidecar-test:
    python -m pytest src-tauri/sidecar -q

# 覆盖率（前端 70/70/55/70）
coverage-frontend:
    npx vitest run --coverage

# 覆盖率（Rust 77/70/77）
coverage-rust:
    cargo llvm-cov --lib --manifest-path src-tauri/Cargo.toml --fail-under-lines 77 --fail-under-functions 70 --fail-under-regions 77

# 全部覆盖率
coverage: coverage-frontend coverage-rust

# 前端生产构建
build:
    npm run build

# 性能预算
perf:
    node scripts/perf-budget.mjs

# VM 安装冒烟（复用 test-vm：现成虚拟机 + 已构建安装包）
vm-smoke:
    powershell -NoProfile -ExecutionPolicy Bypass -File test-vm/scripts/smoke-install.ps1

# VM 便携版冒烟
vm-portable:
    powershell -NoProfile -ExecutionPolicy Bypass -File test-vm/scripts/smoke-install.ps1 -Portable
