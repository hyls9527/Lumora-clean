#!/usr/bin/env python3
"""Convert extract-output-*.json to batch-*.json with GraphNode/GraphEdge format."""

import json
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = os.path.expanduser("~/Desktop/Vibe coding/Lumora-clean")
INTER = os.path.join(PROJECT_ROOT, ".understand-anything", "intermediate")


def complexity_from_metrics(metrics: dict) -> str:
    fc = metrics.get("functionCount", 0)
    if fc <= 3:
        return "simple"
    elif fc <= 8:
        return "moderate"
    else:
        return "complex"


def make_file_id(path: str, file_category: str) -> str:
    prefix_map = {
        "code": "file",
        "config": "config",
        "docs": "document",
        "infra": "service",
        "script": "file",
        "data": "file",
        "markup": "file",
    }
    prefix = prefix_map.get(file_category, "file")
    return f"{prefix}:{path}"


def make_func_id(file_path: str, func_name: str) -> str:
    return f"function:{file_path}:{func_name}"


def make_class_id(file_path: str, class_name: str) -> str:
    return f"class:{file_path}:{class_name}"


def infer_tags(path: str, language: str, file_category: str, sections: list, functions: list) -> list:
    tags = []
    if file_category:
        tags.append(file_category)
    if language:
        tags.append(language)

    path_lower = path.lower()
    if "test" in path_lower or "spec" in path_lower:
        tags.append("test")
    if "command" in path_lower:
        tags.append("tauri-command")
    if "store" in path_lower:
        tags.append("state-management")
    if "migration" in path_lower:
        tags.append("database")
    if "schema" in path_lower:
        tags.append("schema")
    if "hook" in path_lower:
        tags.append("hook")
    if "component" in path_lower or "/ui/" in path_lower:
        tags.append("ui-component")
    if "feature" in path_lower:
        tags.append("feature-module")
    if "api" in path_lower or "/lib/api/" in path_lower:
        tags.append("api-layer")
    if "util" in path_lower or "helper" in path_lower:
        tags.append("utility")
    if "/db/" in path_lower:
        tags.append("database")
    if "workflow" in path_lower or ".yml" in path_lower:
        tags.append("ci-cd")
    if "embed" in path_lower:
        tags.append("embedding")
    if "ai" in path_lower:
        tags.append("ai")
    if "clip" in path_lower:
        tags.append("clip")
    if "search" in path_lower:
        tags.append("search")
    if "dashboard" in path_lower:
        tags.append("dashboard")
    if "export" in path_lower:
        tags.append("export")
    if "import" in path_lower:
        tags.append("import")
    if "trash" in path_lower:
        tags.append("trash")
    if "tag" in path_lower:
        tags.append("tags")
    if "setting" in path_lower:
        tags.append("settings")

    return list(set(tags))[:6]


def generate_summary(path: str, language: str, file_category: str, total_lines: int, 
                     functions: list, sections: list, exports: list) -> str:
    basename = os.path.basename(path)
    dirname = os.path.dirname(path)
    
    if file_category == "docs":
        return f"Documentation file ({total_lines} lines) providing project guidance."
    
    if file_category == "config":
        if ".github" in path:
            return f"GitHub configuration ({total_lines} lines)."
        return f"Configuration file ({total_lines} lines)."
    
    if file_category == "infra":
        if "ci.yml" in path:
            return f"CI pipeline ({total_lines} lines) for automated testing and builds."
        if "release.yml" in path:
            return f"Release pipeline ({total_lines} lines) for automated deployment."
        return f"Infrastructure definition ({total_lines} lines)."
    
    # Code files
    func_names = [f.get("name", "?") for f in (functions or [])[:5]]
    
    if language == "rust":
        if "/commands/" in path:
            module = basename.replace(".rs", "")
            return f"Tauri command module for {module} operations. Exposes {len(functions or [])} commands to the frontend."
        if "/db/" in path:
            return f"Database layer ({basename}) with {len(functions or [])} functions for data persistence."
        if "/schema/" in path:
            return f"Schema definitions ({basename}) for Rust type system."
        if "main.rs" in path:
            return "Application entry point. Initializes Tauri runtime and registers all command handlers."
        if "lib.rs" in path:
            return "Library root. Exports public modules and types."
        if "build.rs" in path:
            return "Build script for Tauri code generation."
    
    if language == "typescript" or language == "tsx":
        if "/components/ui/" in path:
            return f"UI component ({basename}) for the application interface."
        if "/features/" in path:
            feature = dirname.split("/")[-1] if "/" in dirname else "unknown"
            return f"Feature page component for {feature} functionality."
        if "/stores/" in path:
            store = basename.replace(".ts", "")
            return f"Zustand store managing {store} state."
        if "/lib/api/" in path:
            api = basename.replace(".ts", "")
            return f"API client module for {api} operations."
        if "/hooks/" in path:
            return f"Custom React hook ({basename})."
        if "App.tsx" in path:
            return "Root React component. Sets up routing and global providers."
        if "main.tsx" in path:
            return "Application entry point. Mounts React app to DOM."
    
    if language == "python":
        if "clip_server" in path:
            return "Sidecar server for CLIP embedding inference. Handles image and text embedding requests."
    
    if language == "css":
        return "Global stylesheet with Tailwind CSS imports and design token definitions."
    
    if language == "html":
        return "HTML entry point for the Vite dev server and Tauri webview."
    
    func_summary = f" Contains {len(functions or [])} functions." if functions else ""
    return f"{language.capitalize()} source file ({total_lines} lines){func_summary}"


def convert_batch(batch_idx: int, extract_data: dict, batch_meta: dict) -> dict:
    nodes = []
    edges = []
    
    for result in extract_data.get("results", []):
        path = result["path"]
        language = result.get("language", "unknown")
        file_category = result.get("fileCategory", "code")
        total_lines = result.get("totalLines", 0)
        functions = result.get("functions", [])
        sections = result.get("sections", [])
        exports = result.get("exports", [])
        metrics = result.get("metrics", {})
        call_graph = result.get("callGraph", [])
        
        # File-level node
        file_id = make_file_id(path, file_category)
        summary = generate_summary(path, language, file_category, total_lines, functions, sections, exports)
        tags = infer_tags(path, language, file_category, sections, functions)
        complexity = complexity_from_metrics(metrics)
        
        file_node = {
            "id": file_id,
            "type": file_id.split(":")[0],
            "name": os.path.basename(path),
            "filePath": path,
            "summary": summary,
            "tags": tags,
            "complexity": complexity,
        }
        nodes.append(file_node)
        
        # Function-level nodes (code files only)
        if functions:
            for func in functions:
                func_name = func.get("name", "unknown")
                func_id = make_func_id(path, func_name)
                func_params = func.get("params", func.get("parameters", []))
                param_str = ", ".join(func_params[:4]) if func_params else ""
                
                func_node = {
                    "id": func_id,
                    "type": "function",
                    "name": func_name,
                    "filePath": path,
                    "summary": f"Function {func_name}({param_str}) in {os.path.basename(path)}.",
                    "tags": tags[:3],
                    "complexity": "simple",
                }
                nodes.append(func_node)
                
                # contains edge: file -> function
                edges.append({
                    "source": file_id,
                    "target": func_id,
                    "type": "contains",
                    "weight": 1.0,
                })
        
        # Export edges from batchImportData
        batch_imports = batch_meta.get("batchImportData", {})
        file_imports = batch_imports.get(path, [])
        for imp_path in file_imports:
            edges.append({
                "source": file_id,
                "target": f"file:{imp_path}",
                "type": "imports",
                "weight": 0.7,
            })
        
        # Call graph edges
        if call_graph:
            for cg in call_graph[:50]:  # Limit to avoid explosion
                caller = cg.get("caller", "")
                callee = cg.get("callee", "")
                if caller and callee:
                    caller_id = make_func_id(path, caller)
                    # Try same-file first
                    callee_id = make_func_id(path, callee)
                    edges.append({
                        "source": caller_id,
                        "target": callee_id,
                        "type": "calls",
                        "weight": 0.8,
                    })
    
    return {"nodes": nodes, "edges": edges}


def main():
    # Load batches metadata
    with open(os.path.join(INTER, "batches.json")) as f:
        batches_meta = json.load(f)
    
    total_nodes = 0
    total_edges = 0
    
    for batch in batches_meta["batches"]:
        batch_idx = batch["batchIndex"]
        extract_path = os.path.join(INTER, f"extract-output-{batch_idx}.json")
        
        if not os.path.exists(extract_path):
            print(f"Warning: extract-output-{batch_idx}.json not found, skipping")
            continue
        
        with open(extract_path) as f:
            extract_data = json.load(f)
        
        batch_data = convert_batch(batch_idx, extract_data, batch)
        
        output_path = os.path.join(INTER, f"batch-{batch_idx}.json")
        with open(output_path, "w") as f:
            json.dump(batch_data, f, indent=2)
        
        n = len(batch_data["nodes"])
        e = len(batch_data["edges"])
        total_nodes += n
        total_edges += e
        print(f"Batch {batch_idx}: {n} nodes, {e} edges -> batch-{batch_idx}.json")
    
    print(f"\nTotal: {total_nodes} nodes, {total_edges} edges across {len(batches_meta['batches'])} batches")


if __name__ == "__main__":
    main()
