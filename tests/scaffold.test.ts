import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = process.cwd();

describe("项目骨架验收", () => {
  // 前端配置
  it("package.json 存在且包含正确依赖", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
    expect(pkg.dependencies.react).toBeDefined();
    expect(pkg.dependencies["react-dom"]).toBeDefined();
    expect(pkg.dependencies.zustand).toBeDefined();
    expect(pkg.dependencies["@tauri-apps/api"]).toBeDefined();
    expect(pkg.devDependencies.vite).toBeDefined();
    expect(pkg.devDependencies.typescript).toBeDefined();
    expect(pkg.devDependencies.tailwindcss).toBeDefined();
  });

  it("vite.config.ts 存在", () => {
    expect(fs.existsSync(path.join(root, "vite.config.ts"))).toBe(true);
  });

  it("tsconfig.json 存在且 strict 模式", () => {
    const tsconfig = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.json"), "utf-8"));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("index.html 存在", () => {
    expect(fs.existsSync(path.join(root, "index.html"))).toBe(true);
  });

  // 源码目录
  it("src/ 目录结构完整", () => {
    expect(fs.existsSync(path.join(root, "src/main.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/App.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/index.css"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/components/ui"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/features/gallery"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/features/import"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/features/search"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/lib/api"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/stores"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/i18n"))).toBe(true);
  });

  // Tauri 后端
  it("src-tauri/ 目录存在", () => {
    expect(fs.existsSync(path.join(root, "src-tauri/Cargo.toml"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src-tauri/tauri.conf.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src-tauri/src/lib.rs"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src-tauri/src/main.rs"))).toBe(true);
  });

  // 设计令牌
  it("index.css 包含古卷·灯火设计令牌", () => {
    const css = fs.readFileSync(path.join(root, "src/index.css"), "utf-8");
    expect(css).toContain("#f2ede4");
    expect(css).toContain("#2a2118");
    expect(css).toContain("#7a5c12");
    expect(css).toContain("Noto Serif SC");
    expect(css).toContain("DM Sans");
  });
});
