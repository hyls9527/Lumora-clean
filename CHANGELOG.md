# Changelog

All notable changes to Lumora are documented here.

## v0.13.2 (2026-09-19)

这一版修一个让应用**完全不可用**的缺陷。

### Fixed
- **CSP 阻断了 Tauri IPC，导致整个前端与后端失联**：`connect-src` 里只写了 `ipc:`，但 Tauri v2 的 IPC 实际走 `http://ipc.localhost/<command>`（fetch），该 origin 不在白名单里 → 每一次 invoke 都被 CSP 拦下。表现为图库永远空、任务条不出现，窗口底部一行 `Tauri bridge unavailable: @tauri-apps/api/core failed to load (command: job_list)`（`job_list` 只是启动时第一个被调用的命令，并非它本身有问题）。
  - **实机证据**（WebView 控制台）：`Connecting to 'http://ipc.localhost/refresh_update_proxy' violates the following Content Security Policy directive ... The action has been blocked`；Tauri 随后尝试回退到 `window.ipc.postMessage` 并抛出 `TypeError: Failed to fetch`，我们的 `invoke` 包装把这一次失败当成「桥接不可用」并缓存下来，于是**整个会话所有命令永久失败**。
  - **修复后实测**：`ipc.localhost` 请求 16 次全部放行、网络失败 0 次；`get_app_version` 返回 `0.13.1`、`refresh_update_proxy`、`get_dashboard_stats` 均成功。
- **内联样式被 CSP 全部拦掉**：Tauri 会自动为 `style-src` 注入 nonce，而 CSP 规范规定 nonce 一旦存在就**忽略** `'unsafe-inline'`，于是页面每处内联样式都产生一条违规。已移除 `'unsafe-inline'`（保留 nonce 机制），并为动效所需的 `WebAssembly` 显式加上 `'wasm-unsafe-eval'`。

### Tests
- Rust 330 / 前端 988 全部通过；`cargo fmt --check`、`cargo clippy -- -D warnings`、`tsc --noEmit` 均 exit 0。

### Notes
- **这类缺陷不会出现在测试里**：单元测试一律 mock 了 `@tauri-apps/api/core`，而 CSP 只写在 `tauri.conf.json`（不参与前端构建），所以测试、类型检查、CI 可以全绿而应用不可用。本次是靠**实际启动打包后的应用并读取 WebView 控制台**才发现的。
- **未解决（如实记录）**：在本机「直连 github.com 被阻断、必须走本地代理」的网络下，应用内的更新检查仍会失败（`error sending request for url (https://github.com/.../latest.json)`）。已确认代理本身可用（经代理请求同一 URL 2.1s 返回 200）、系统代理已被读取并写入 `HTTPS_PROXY`，且**在应用进程内**用 native-tls 与 rustls 分别直连同一 URL 也都能返回 200 —— 唯独 `tauri-plugin-updater` 的请求发不出去，根因未定位。因此**请勿认为自动更新在代理网络下已可用**。
## v0.13.1 (2026-09-18)

### Fixed
- **代理后「检查更新」必然失败**：更新检查只在**进程启动那一刻**读一次 Windows 系统代理，而代理（Clash 等）是随用随开的。若 Lumora 先启动、代理后打开，整个进程生命周期内 `HTTPS_PROXY` 都是空的 —— 之后用户再点「检查更新」也不会重新读取，于是直连 github.com 被防火墙静默丢弃。日志实证：`failed to check for updates: error sending request for url (https://github.com/.../latest.json)` 每次耗时 21s 后以 `os error 10060` 结束；同一台机器上经代理请求同一 URL 只需 2.1s 返回 200。现在每次检查前重新读取系统代理（新增 `refresh_update_proxy` 命令），代理开或关都能如实生效。
- **无 scheme 的代理值会被 reqwest 直接拒绝**：注册表里常见 `127.0.0.1:7897`，而 reqwest 要求代理 URL 带 scheme。现统一规范化为 `http://…`，并同时设置 `HTTPS_PROXY` 与 `HTTP_PROXY`；系统代理关闭时主动清除这两个变量，避免残留值把请求引向一个已经关掉的代理。
- **代理状态在日志里不可见**：原 `log::info!` 在启动时触发，那时文件日志尚未接管（实测该行从未落盘），排障时无从判断代理是否生效。现改为 warn 级并在每次检查时落盘，`no system proxy configured` 与 `update checks use system proxy …` 都可直接对账。

### Tests
- Rust：305 → **330 通过 / 0 失败**（新增 4 个代理解析测试 + 1 个命令测试；本机端到端实测解析结果为 `http://127.0.0.1:7897`）。
- 前端：**988 通过**（`refresh_update_proxy` 在浏览器 mock 模式下为空操作，不改变既有行为）。
- Rust 覆盖率：行 80.33% / 区域 81.02% / 函数 70.86%（门禁 79 / 79 / 69，全部通过，较修改前略升）。
## v0.13.0 (2026-09-18)

长任务不再「点下去就停不下来」。这一版把后台任务做成了一等公民：可看进度、可随时取消、切页或重载都不中断。

### Added
- **后台任务（job）基础设施**：新增 `src-tauri/src/jobs.rs` —— 进程内任务注册表，提供启动 / 查询 / 取消与终态自动回收。语义要点：
  - **一种任务同时只跑一个**：重复点击返回正在跑的那个（`isNew=false`）而不是再起一个，避免两份工作互相踩。
  - **取消是协作式的**：worker 在逐项检查点检查取消标志，停在下一次边界并保留已完成的部分，绝不半途丢弃用户成果。
  - **终态自动让位并回收**：任务结束后立刻释放其类型，60 秒宽限期后从注册表清除，长时间运行不会累积。
  - **panic 不会留下卡死的任务**：worker 崩溃被转成 `failed` 并记录原因，而不是永远停在「进行中」。
- **六种任务全部接入**：补齐文本索引、补齐视觉索引、审美评审、导出、格式转换、导入。每种都在 `job_commands.rs` 中有明确的取消语义说明。
- **非模态任务条**：底部任务条显示每种任务的进度、已处理数量与状态，并提供「取消」。它不是弹窗 —— 用户可以一边等一边继续浏览、看大图、做别的事。没有任务时它完全不渲染，不占用注意力。
- **重载后自动接管**：任务跑在 Rust 侧，刷新页面或切页不会中断；界面会在挂载时重新发现正在进行的任务，不会让用户误以为任务已经死了。
- **AI 控制面跟进**：「补齐全库评分」现在启动任务并如实回答是「已开始」还是「已有一个在进行中」，不再假装立刻完成。

### Changed
- **前端不再自持长循环**：`embeddingStore.fillMissing` / `fillClipMissing` 与 `aesthetic.scoreBackfill` 原先在浏览器里跑 `for(;;)` 批处理循环 —— 无法取消、进度不真实、关掉页面就前功尽弃。现在它们只负责「请求一个任务」。
- **导入刻意不可中途取消**：导入是一个全有或全无的事务，copy 模式还会把文件写入库目录。中断在两者之间会留下「行与文件不一致」的库，这是唯一不可接受的结局。因此导入只在进入事务前可取消，事务内不设检查点 —— 宁可少一次取消，不可损坏数据。
- **格式转换只在项与项之间取消**：写新文件与更新数据库的收尾阶段不可中断，否则库会指向已被改名的文件。

### Fixed
- **已完成的任务会永久占住自己的类型**：原实现只在 worker 返回时释放，直接调用终态方法（失败/取消）的路径不释放，导致「导出失败 → 重试」会静默复用一个已经结束的任务，用户看到「又在跑」其实是假的。现在所有终态路径统一释放，并补齐了回归测试。
- **取消让位于用户的意图**：worker 因取消而中止时通常会伴随一个错误，若按失败上报，用户会以为自己的取消没生效。现在取消优先，状态如实显示为「已取消」。

### Tests
- Rust：285 → **305 通过 / 0 失败**（新增 20 个任务注册表测试：生命周期、并发复用、取消可见性、终态回收、panic 兜底、类型字符串稳定性）。
- 前端：972 → **988 通过**（新增 17 个：任务轮询与停止、取消语义、失败可见、任务条渲染与可访问性）。
- 覆盖率：语句·行 **87.76%**（门禁 80%）。

### Notes
- 二进制 16.4MB / 30MB 预算；前端包 0.5MB / 0.54MB 预算 —— 均在限内。
- 一处预算调整：Zustand store 上限 14 → 16（`jobStore` 拥有「任务」这一独立关注点，塞进既有 store 只是为了让计数器好看）。
## v0.12.1 (2026-09-18)

修复 v0.12.0 的 CI 红灯（v0.12.0 未产出任何发布产物，tag 保留作记录）。

### Fixed
- **挂起的 sidecar 在 Linux/macOS 上会拖住调用方**（CI 实测 `hanging_sidecar_is_killed_and_reported` 耗时 31.5s，正好等于子命令的 sleep 时长）：Unix 上 sidecar 是 `sh -c "python ..."`，`kill_tree` 只杀直接子进程，真正的 worker 逃过一劫并继续持有 stdout 管道，读取线程因此阻塞到它自然退出 —— 超时形同虚设，线程被长期占用。现让子进程经 `setsid()` 进入独立进程组，超时按组发 `SIGKILL`；输出读取再套一层有界等待（5s），任何逃逸进程都无法再把调用方拖死。测试断言同步收紧到 5s，堵住「回归了也看不出来」。
- **`rustls` 存在漏洞 RUSTSEC-2026-0285**（`cargo audit` 报 1 个 vulnerability）：`0.23.41` → **`0.23.45`**（连带 `rustls-webpki 0.103.15`）。本机 `cargo audit` 现为 **exit 0**，仅剩 8 条 unmaintained/unsound 警告。
- **Linux release 二进制 38.3MB 超 30MB 预算**：`Cargo.toml` 此前**没有任何 `[profile.release]`**，release 构建用的是默认配置（无跨 crate 内联、符号表完整）。现启用 `lto = true` + `codegen-units = 1` + `strip = true` + `opt-level = "s"` —— 标准体积调优，不是改预算。

### Notes
- 本机全量回归：Rust 285 通过 / 0 失败、`cargo fmt --check` 通过、`cargo clippy -D warnings` 0 警告、`cargo audit` exit 0；API 最差 p95 71.85ms（预算 300ms）、RTO 演练 5.8ms。
- 教训：v0.12.0 只在本机 Windows 工具链验证过就打了 tag，而 sidecar 进程树问题与二进制体积问题**都只在 Linux 构建上暴露** —— 与 AGENTS.md 记录的「本地 Windows 全绿 ≠ CI 绿」是同一条。

## v0.12.0 (2026-09-18)

商业级交付验收轮：把「可观测、可恢复、可复现」三件事补齐，并让每一条验收指标都有自动门禁兜住；同时落地设计语言 v3「灯箱」的界面改版。

### Added
- **崩溃可观测**：Rust 侧 panic hook 将每次 panic 以 JSON 行写入 `crash.log`（超 1 MiB 保留最新一半），前端按会话统计首次异常（同一会话多次异常只计一个坏会话），ErrorBoundary 捕获的渲染错误同样上报 —— 「崩溃率 < 0.1%」从此有分子分母可算，而不是靠估。设置页「稳定性」面板直接读数。
- **自动快照（RPO）**：每 10 分钟落一份数据库快照、保留最新 6 份并自动清理旧件；走 SQLite Online Backup API，因此 WAL 中「已提交未 checkpoint」的数据不会丢（有专门用例断言该场景）。设置页「自动快照」面板可查看还原点数量与最新快照，并支持立即备份。
- **页面加载性能门禁（TC-PERF-001）**：新增 E2E 用例，跑**生产构建**（`build:perf` + `vite preview`）测量导航 → 应用外壳可交互的时延，超 2s 即失败；用例内含「品牌动画时长 + 外壳预算 < 2s」的常量断言，防止动画被悄悄加长。
- **API 延迟基准**：新增 `perf_bench` 用例，在 10k 图片库上测量 9 条用户可感知读路径的 p50/p95/p99（深分页、FTS 命中/稀有词/纯操作符、收藏+评分筛选、按模型筛选、仪表盘聚合、批量按 ID 取记录、标签列表），任一 p95 ≥ 300ms 即失败。
- **灾难恢复演练**：新增 `rto_drill` 用例（快照 → 抹掉库文件 → 恢复 → `PRAGMA integrity_check`）与 `scripts/restore-drill.mjs`（终端演练与报告）。
- **覆盖率与安全门禁**：前端阈值 70% → **80%**；Rust 加 `cargo llvm-cov` 门禁（行/区域 80%、函数 70%）；安全审计改为 high/critical 计数非零即失败（原 `npm audit --omit=dev` 看不到工具链里的高危且不阻断）。
- **验收依据文档**：`docs/05-qa/14-商业级交付验收矩阵.md` —— 九项指标逐条给出实测值、可复现命令与已知环境限制。

### Changed
- **界面改版：设计语言 v3「灯箱」**（`DESIGN.md` 已同步为 v3 规范）—— 界面像展墙一样消失，图片是唯一主角：
  - **默认极简**：画廊卡片默认只呈现图片，模型 / 评分 / 操作按钮在 hover 或键盘聚焦时才浮现，浏览时不再被元数据切碎。
  - **元数据进「边注」**：详情灯箱的侧栏按「边注」排版，而不是 SaaS 式属性面板。
  - **灯只在确认时亮**：收藏、评分、启动三个时刻才有光效，其余状态保持安静。
  - **动效收敛为三套**：启动「灯火初燃」、确认「灯影」、详情「灯箱升起」，不再有零散过渡。
  - **调色板精修**：亮/暗两套色阶重新取样（纸感更暖、墨色更深、古铜强调色更沉），`src/index.css` 与 `src/lib/tokens.ts` 作为单一来源同步；新增 `transitionFast`（160ms）用于即时反馈。
  - 覆盖侧边栏、命令面板、详情灯箱、筛选面板、首启弹窗、加载态、移动端导航、评分/标签控件，以及仪表盘、导出、收藏、图库、搜索、标签、回收站等页面。
- **侧车调用全部加看护**：CLIP / 审美评分的 Python sidecar 统一走 `run_with_timeout`（默认 600s），超时杀掉**整棵进程树**（Windows `taskkill /T /F`）并返回可见错误 —— 此前 `Command::output()` 无超时无 kill，挂起会永久占用线程并留下僵尸进程。
- **CPU 密集任务移出 async 执行器**：`score_image_cmd` / `score_missing_cmd` / `embed_clip_missing_cmd` 改走 `spawn_blocking`，模型加载不再冻结其他命令。
- **审美评分批处理**：sidecar 新增 `score-batch`，一次加载模型批量评分（此前每张图 spawn 一个进程、ViT-L/14 + HPS v2 每张重载一次，千张库要数小时）。
- **构建产物精简**：`vite build` 默认只出应用本体；测量用的 `perf-harness.html` 仅在 `LUMORA_PERF_BUILD=1`（`npm run build:perf`）时构建，不再计入发布体积。
- **CI 与验收指标对齐**：Playwright 拆分 `core`（dev server，2 workers）与 `perf`（生产构建，1 worker 串行）；性能用例不再与其他重型任务并行。
- `rust-version` 1.77.2 → **1.81**（panic hook 使用 `std::panic::PanicHookInfo`，该类型 1.81 起提供）。

### Fixed
- **AI 命令「清空回收站」回复 `已清空回收站（undefined 张）`**：`trashStore.emptyTrash()` 声明为 `Promise<void>`，把后端返回的删除条数吃掉了；现返回真实计数，失败返回 0。
- **百分位取值口径**：`perf_bench` 原用 `round((n-1)·p)`，在 n=99、p=0.50 时会取到第 51 个样本，虚高一个位次；改为 nearest-rank `ceil(n·p)-1`，不再插值到低于实测样本的值（否则会悄悄放松门禁）。
- **安全依赖定版**：`overrides` 固定 `browserslist` / `nanoid` / `undici` 至已修复版本，npm 高危 3 → 0（原报告仅覆盖生产依赖，工具链里的高危看不见）。
- 文档校准：测试数量、Schema 版本等过期数字更新为实测值；移除 20 份与当前状态矛盾或无引用的历史文档（v0.8.0 时代迭代记录、过期任务计划、未跟踪的设计草稿），并重写 `docs/05-qa/README.md` 索引。

### Tests
- 前端 775 → **972 通过**（113 文件；语句·行 87.79%、分支 81.43%）。
- Rust 272 → **285 通过 / 5 ignored**（ignored 需本机 Ollama）；行覆盖 80.21%。
- E2E：`core` 5 例 + `perf` 3 例（页面加载预算、首屏交互延迟、10k 图库滚动帧率基线）。

### Notes
- 本机实测（Windows 11 / MSVC）：页面加载外壳 108.5ms、API 最差 p95 53.95ms、RTO 全损恢复 5.32ms。可用性与崩溃率需真实使用累积样本，装置已就位但尚未声称达标。
- 安装 VS Build Tools 时若遇 WinINet `12057`：证书吊销服务器在当前网络不可达，需设置 **HKCU**（不是 HKLM）`Internet Settings\CertificateRevocation = 0`；`VCTools` 工作负载不含 Windows SDK，须另加 `Microsoft.VisualStudio.Component.Windows11SDK.26100`。
## v0.11.0 (2026-09-02)

### Added
- **高级筛选支持生成参数**：在画廊筛选面板新增 Seed、Steps、CFG Scale（范围）、Sampler 四个筛选条件，可按生成参数精确检索（`metadata_json` 的 `seed` / `steps` / `cfg_scale` / `sampler`）。
- **智能收藏支持生成参数规则**：智能收藏的筛选规则新增 Seed / Steps / CFG Scale（范围）/ Sampler 字段，可基于生成参数自动策展。
- **文档校准**：`ARCHITECTURE.md` 的 SQLite schema 由滞后的 v6 补到 v9（智能收藏 / 审美评分列 / CLIP 512 维索引），并明确「文本语义 768 维 / CLIP 512 维」两个独立向量空间。

### Changed
- `README.md` / `ARCHITECTURE.md` 测试数量校准为实测值：前端 765、Rust 262（259 passed + 3 ignored，需本地 Ollama）。（2026-09-04 再校准：前端 775、Rust 272=269 passed + 3 ignored。）

### Fixed
- **审计修复批次（2026-09-04 QA 门禁驱动）**：
  - E2E 首启弹窗在浏览 mock 下每次启动弹出并拦截点击 → mock `get_setting` 增加持久化语义（`store_mode` 跨刷新存活），E2E 显式关闭弹窗并新增「首启弹窗出现一次、选择后不再出现」回归用例。
  - 备份导入不再对活动连接覆盖主文件并删除 WAL（损坏风险）→ 改为 SQLite Online Backup API 在活动连接内导入，校验 Lumora schema/版本并自动升级旧 schema。
  - 永久删除已 CLIP 嵌入图片因 FK 约束失败、回收站清不空 → 级联删除 `clip_embeddings`/`vec_embeddings_clip`。
  - MCP/LAN 文件读取统一路径校验（仅托管目录或已注册引用路径）+ 20 MiB 原始回退上限；MCP 导入只接受可解码图片。
  - 畸形 PNG iTXt 越界 panic → 边界守卫。
  - 语义搜索/以图搜图结果不渲染或按当前页查找大量丢失 → 后端 `get_images_by_ids` 批量取全量记录渲染结果卡片（含缩略图）。
  - 嵌入补齐 `processed=0` 时无限循环 → 停滞挡塞并显示可见错误。
  - Tauri 桥接加载失败时静默回退 mock（数据"看上去全没了"）→ fail-visible 抛错。
  - 另含迁移幂等性（v8 拆列）、Ollama 120s 超时、导入去重前缀碰撞字节级确认、AI 分析 ID 改 UUID、评分越界拒绝、标签幂等、多 store 请求序守卫、Host 白名单防 DNS rebinding、perf-budget 假绿修复、CI 增加 Playwright job 等（详见 `docs/05-qa/12-深度审计缺陷清单.md` 与 `docs/05-qa/13-修复交付记录.md`）。

### Tests
- 前端 765 → 775 通过；Rust 262 → 272（269 passed + 3 ignored，需本地 Ollama）。

## v0.10.8 (2026-08-30)

### Fixed
- **安装超时后重复点击可能并发启动两个安装器**：客户端 15 秒超时不会取消 Rust 侧安装，改为加入底层安装 Promise（重按是等待而非重发）；`installing` 状态保持到底层结算，且超时后正确清理定时器
- **重复检查更新泄漏资源且状态脱钩**：同版本重复 `check()` 会泄漏 Rust 端 `Update` 资源、并使"已下载完成"状态与旧 handle 脱钩（可能对未下载的新 handle 点安装）；现同版本复用 handle 并释放重复资源，新版本重置下载状态
- **macOS/Linux 生产环境更新错误被静默吞掉**：dev 判定由 hostname 改为 `import.meta.env.DEV`（生产 webview 的 origin 是 `tauri.localhost`/`tauri://localhost`，hostname 判定误吞全部更新错误且每次挂载重试）；检查失败也标记已检查，收敛为手动重试
- **系统休眠/断网后下载永久卡死**：60 秒无进展看门狗放弃僵尸下载并重新允许重试，迟到的过期事件被忽略；下载失败后重试前不再显示上次的残留百分比
- **下载期间高频重渲染**：进度事件按百分比变化才更新（此前每个下载分块触发一次全局 setState，设置页整页重渲染数千次）
- **回收站竞态**：分页/刷新的过期响应不再覆盖新结果（请求序列令牌，清空回收站使在飞请求失效）；恢复/彻底删除失败时仅回滚本条记录，不再整体替换列表覆盖并发操作的结果
- **卸载清理脚本边界加固**：安装目录含 `!` 时延迟展开导致删不掉（移除 `enabledelayedexpansion`）；其它软件恰好有 `uninstall.exe` 运行时永久等待（上限 60 秒）；组策略禁用 WSH 的机器上清理静默失效（注册重启后删除兜底）

### Tests
- 前端 763 → 765 通过（新增同版本重查复用 handle、下载失败重试清残留进度回归测试）

## v0.10.7 (2026-08-30)

### Fixed
- **卸载时弹出多个空白命令行窗口**：卸载钩子此前用 `ExecWait` 运行 `taskkill`（每次调用创建可见控制台，闪 2 个弹窗），收尾清理批处理又用 `Exec cmd.exe` 直接启动（可见窗口长驻约 25 秒等待卸载进程退出）。现改用 `nsExec` 隐藏运行 taskkill，清理批处理改由 wscript（GUI 子系统）以零窗口方式隐藏启动，卸载过程不再出现任何命令行弹窗；清理完成后临时 VBS 包装脚本一并删除

## v0.10.6 (2026-08-30)

### Fixed
- **自动更新重复下载**：侧边栏更新横幅与设置页"关于"区域此前各自持有独立的更新状态，同时挂载时会各自调用一次检查与下载——安装包被并行下载两次，两处进度互不相同（如 5% vs 3%）。更新状态改为全局单例（Zustand store）：整个会话仅一次检查、一次下载，所有界面共享同一实时进度，并加入防重入守卫（下载中/安装中/已完成时再次调用直接忽略；失败后重试不受影响）
- 打开设置页不再触发重复的自动检查（会话内首次挂载检查一次即可，手动"检查更新"按钮不受影响）

### Tests
- 前端 761 → 763 通过（新增双组件同时挂载仅一次检查/下载、下载完成后不重复下载两个回归测试）

## v0.10.5 (2026-08-29)

### Fixed
- **引用模式导入的图片无法加载**：base64 读取命令的路径校验由"仅限应用数据目录"放宽为"管理目录内或数据库已登记路径"（引用模式语义：只读用户显式导入过的文件）；同时启用 asset protocol 作为兜底，CSP `img-src` 补 `http://asset.localhost`（Windows 资产协议 scheme）
- **批量格式转换在真实环境必然失败**：前端调用缺少 Rust 端必填参数 `dryRun`，补齐后功能恢复
- **搜索健壮性**：空/纯空白查询不再触发 FTS5 语法错误；含引号、`%`、`_` 等特殊字符的查询转义修复（LIKE 通配符补 `ESCAPE` 子句，查询 `%` 不再匹配全表）
- **备份导出丢数据**：WAL 模式下导出前未 checkpoint，未落盘事务随主文件拷贝丢失；备份导入替换主库后残留旧 `-wal`/`-shm`，重启时旧 WAL 重放到新库造成数据损坏，替换成功后清除 sidecar
- **导入一致性**：复制入库模式重复导入按内容哈希去重（不再堆叠副本）；记录被跳过或事务失败时清理孤儿拷贝文件；目录扫描中单个文件元数据读取失败仅跳过该文件，不再中断整批
- **批量重命名**：冲突解决纳入数据库已注册路径；数据库更新失败时回滚磁盘重命名，不再留下文件与记录不一致
- **前端竞态**：图片列表分页/搜索旧响应覆盖新结果（请求序列令牌）；收藏/评分乐观更新在操作其他图片后失败永不回滚（全局序列号改为按图片隔离）；base64 命令"成功但返回空"时全尺寸图不再卡在空白占位
- **写命令误重试**：批量重命名、导出、设置写入等 9 个命令加入写命令集合（不再自动重试）；嵌入补齐完成后语义缓存正确失效（此前命中最长 30 分钟的过期缓存）
- 浏览器 mock 模式下以图搜图崩溃（mock 返回结构与真实接口对齐）

### Changed
- **网格卡片改用 640px 服务端缩略图**：此前每张卡片加载全尺寸原图，大图库滚动内存与 IPC 开销显著下降；详情弹窗仍加载全尺寸
- **局域网 token 强度**：8 字符（≈47.6 bit）→ 16 字符（≈95.3 bit）；存量用户已持久化的 token 不受影响，仅新安装生效
- MCP `get_image_file`：竖图/长图统一按 1024px 内缩重编码；不可解码文件超过 20 MiB 拒绝返回（内存膨胀防护）
- LAN/MCP 分页计算改饱和乘法，传入超大页码不再触发算术溢出 panic
- 安装钩子移除对通用进程名 `app.exe` 的强杀（Tauri 脚手架遗留，可能误伤用户机器上的无关进程）

### Security
- sidecar 权重加载启用 `torch.load(weights_only=True)`：网络下载的 `.pth` 为 pickle 格式，此前可被篡改权重触发任意代码执行（CWE-502）

### Tests
- Rust 234 → 257 通过（新增图片访问校验、导入/备份一致性、搜索转义、溢出回归）
- 前端 761 通过（新增缩略图加载契约、分页竞态、跨图片回滚、写命令不重试）
- sidecar pytest 12 通过

## v0.10.4 (2026-08-16)

### Fixed
- 自动更新走系统代理：启动时读取 Windows 系统代理（Internet Settings）注入更新请求——此前应用直连 GitHub，在需要代理的网络（如浏览器正常但应用更新失败）无法下载更新包
- 单实例锁：防止多个 Lumora 进程并存互相干扰更新安装（第二实例启动时聚焦已有窗口）
- 发布版文件日志：此前日志插件仅 debug 模式启用，发布版无任何日志；现始终写入 `%APPDATA%\com.lumora.app\logs`
- 安装超时提示：「重启并安装」15 秒无响应时提示安装器可能被拦截或需手动安装，不再无限卡死

## v0.10.3 (2026-08-16)

### Fixed
- 首次启动导入方式弹窗重复出现：冷启动时设置读取未从磁盘水合导致误判"首次使用"（设置已保存仍弹窗）；`get_setting` 读取前强制重载磁盘 + 前端复查一次
- 启动动画移除字标扫光（sheen）——浅色背景下呈现为划过的暗带

## v0.10.2 (2026-08-16)

### Added
- 复制入库导入模式：「设置 → 导入方式」可选**登记引用**（只记录路径，默认）或**复制入库**（图片复制进应用数据目录统一管理）；首次启动弹出选择向导，并明确提示复制入库的图片随卸载删除
- 启动动画重制：以品牌灯笼图标替代十字准线（纯 transform/opacity 动画，≤2s 揭幕；reduced-motion 下静态可见）
- 使用指南与快速上手教程（`docs/06-user-guide/`，README 已加链接）

### Fixed
- `.gitignore` 的 `assets/` 规则未锚定根目录，导致 `src/assets/`（启动图标）无法入库、CI 构建失败风险

### Tests
- 新增导入路径冲突、导入方式设置、首次启动弹窗测试；前端 748、Rust 231

## v0.10.1 (2026-08-15)

### Added
- 多 AI 后端：语义搜索嵌入与视觉分析可在本地 Ollama 与 OpenAI 兼容 API 间切换（设置页「AI 后端」配置 Base URL / Key / 模型；环境变量兜底；分析输出解析兼容 markdown 代码块与夹带文本）
- 视觉分析后端独立于嵌入后端：`ai.vision_provider` 可将图片分析单独路由到 OpenAI 兼容端点（如本地 llama.cpp）；本地回环端点免 API Key，视觉请求超时放宽至 300s
- 启动动画品牌化重设计：十字准线 + 衬线字标逐字落定，揭幕压缩至 ≤2s（纯 transform/opacity 动画，去除逐帧模糊）

### Fixed
- MCP `list_tags` 的用量计数把已删除图片计入（改为 `COUNT(i.id)` 且按 `deleted = 0` 关联）

### Tests
- 为 MCP 全部工具、provider 的 OpenAI 兼容请求/解析、Ollama 视觉分析 mock、sidecar 路径解析补 23 个单元测试，Rust llvm-cov 恢复并超过 77/70/77 门槛

## v0.10.0 (2026-08-14)

### Added
- MCP（Model Context Protocol）接入：内嵌 Streamable HTTP 服务端，位于 `/mcp`，复用局域网 token 鉴权；AI 客户端（Claude、Cursor 等）可浏览、搜索、读取图片，并可管理标签 / 收藏 / 回收站（移入与恢复）；评分保持人工，不向 AI 开放
- 局域网 token 持久化（`settings.json` 中的 `lan_token`），AI 客户端配置跨重启保持有效
- 以图搜图独立 CLIP 视觉索引（迁移 V9）：512 维 CLIP 向量库与 768 维语义索引分离，新增视觉索引缺失统计与一键补齐；CLIP sidecar 支持批量嵌入（单进程一次加载模型）
- 真实环境端到端测试与 10K 性能预算：语义搜索 / 以图搜图真实链路断言 + 10K 语义搜索延迟预算（实测 68ms / 1.5s）

### Fixed
- Windows 下 CLIP / 审美评分 sidecar 无法启动（`os error 193`），统一经 Python 解释器启动（`LUMORA_PYTHON` 可覆盖）
- 以图搜图真实环境维度不匹配（512 维 CLIP 向量查询 768 维索引）
- 跨 prompt 的 HPS 展示误导：仅在同 prompt 变体内展示 HPS，并标注「组内」「仅同 prompt 变体内可比」

### Tests
- 前端 738 → 739 测试；Rust 198 → 201 测试（另 3 个真实环境 E2E 为 `#[ignore]`，本地手动跑）；Python sidecar 12

## v0.9.0 (2026-08-08)

### Added
- 智能收藏（规则自动分组）：模型 / 评分 / 格式 / Prompt / 标签 5 类筛选规则，可组合（AND）实时匹配；列表卡片显示规则摘要与命中数，详情页展示图片网格并支持分页；侧边栏新增"智能收藏"入口
- 数据库迁移 v7：`smart_collections` 表（名称 + 规则 JSON），CRUD 与规则查询命令
- 复刻 Harness 式桌面更新体验：版本说明摘要 + 后台静默下载进度条 + "重启并安装 / 稍后"
- 导入后语义索引补齐提示、以图搜图与语义搜索失败友好提示
- 语义索引完备性：缺失统计 + 一键补齐缺失向量（仪表盘 / 搜索页入口）

### Tests
- 前端 692 → 700 测试；Rust 129 → 137 测试

### AI 原生评分体系（夯 → 拉）
- 三档判断层：improved-aesthetic-predictor 0-10 分档（夯 ≥8.5 / 稳 ≥6.0 / 拉 <6.0），HPS v2 直连官方检查点提供同 prompt 偏好分（Apache-2.0，无 AGPL 依赖）
- 数据库 v8 评分字段（hps_score / hps_style / aesthetic_score / scoring_model / scored_at / score_label）与智能收藏 score 规则
- AI 原生控制：建相册夯/稳/拉、哪些拉了、把拉的移到回收站、补评分（全库回填）、回收建议、这批最夯、同 prompt 变体组最夯、为什么这张图是夯/拉（同类百分位解释）
- 导入后自动评分（上限 50）+ 后台全库回填；模型不可用时优雅降级「未评分」

### 工程化
- CI 新增 Python sidecar 单元测试门禁（12 测试）
- Rust llvm-cov 覆盖率门槛：行 ≥77 / 函数 ≥70 / 区域 ≥77；前端覆盖率门槛保持（70/70/55/70）
- 修复测试副本假覆盖：export/batch_convert 改为真实命令测试；补齐 trash / rename / dashboard / backup / settings / ollama / lan handler / clip 解析 / JPEG/WebP 探测测试

### Tests
- 前端 738 测试；Rust 197 测试；Python sidecar 12 测试；tsc / fmt / clippy 全净

## v0.8.1 (2026-08-02)

### Added
- 品牌启动动画：Logo 丝滑入场（圆环描边 / 高光扫过 / 字标落定 / 淡出揭幕），纯 CSS 实现，尊重系统“减少动态效果”设置
- 无缝加载：路由懒加载块在启动时后台预载，页面切换无“加载中”闪烁；加载占位品牌化

### Fixed
- DashboardPage 测试 teardown 竞态（CI 发布失败根因，mock 改为永不 resolve）
- 版本号统一：tauri.conf.json 0.7.1 → 0.8.1，设置页动态读取后端版本

### Tests
- 前端 672 → 676 测试

## v0.8.0 (2026-08-02)

### Added
- 高级筛选面板：模型 / 评分区间 / 仅收藏 / 格式 / 日期范围组合筛选（后端 `list_images_filtered`）
- 变体对比视图：同 prompt 不同 seed 的图片 2-N 张并排对比（VariantCompareModal）
- 图片信息增强：DetailModal 展示完整 SD 参数（Steps / CFG / Sampler / Seed / Negative Prompt）
- 键盘快捷键帮助面板（ShortcutsPanel）与 ⌘R 画廊刷新命令
- 离线提示（OfflineBanner）与错误恢复：图片加载指数退避重试、网络状态监听
- 批量重命名（模板 + 实时预览 + 冲突解析）与批量格式转换（7 种目标格式）
- 路由统一（`routes.ts` + `useRouter`）、LoadingPage、store 依赖注入重构
- CI 质量门禁：vitest 覆盖率（语句/分支/行 ≥70%、函数 ≥55%）、`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`perf-budget.mjs`

### Fixed
- **P1**：生产数据库打开路径未执行迁移（仅测试路径执行），全新安装会缺少数据表
- Esc 弹窗栈：多弹窗叠加时按一次 Esc 只关闭最上层；弹窗焦点陷阱与关闭后焦点还原
- ⌘R 刷新在已处于画廊页时失效（同值导航不触发重载）
- 拖拽文件夹到窗口无法导入（扩展名过滤丢弃文件夹路径）；根路径文件不再误扫整个磁盘
- ConvertDialog / RenameDialog 执行失败静默无提示；硬编码英文文案迁移至 i18n
- `favorite=false` 前后端语义不一致；评分/日期范围颠倒时静默返回空结果（改为显式报错）
- 日期筛选结束日不包含当天（`date(created_at)` 整天含入）
- 重命名/导出文件名未过滤 Windows 非法字符与路径穿越
- 图片 base64 加载 MIME 兜底（jpg/jpeg/tiff 归一、无扩展名安全回退）
- migrations 测试对全局 sqlite-vec 注册的顺序依赖
- **高级筛选面板实际接线**（此前 FilterPanel 未挂载、筛选条件不生效；现接入 imageStore → `list_images_filtered`）
- 文件夹导入不再跟随符号链接（防止链接循环导致无限递归）
- 导入文件哈希改为内容哈希（路径+大小指纹 → 前 64KB 内容），去重语义与文档一致
- 导入时间戳元数据读取失败不再 panic（回退当前时间）
- LAN 服务器：端口绑定竞态消除（一次绑定复用）、token 恒定时间比较、后台线程错误日志化而非静默 panic

### Tests
- 前端 605 → **669** 测试；Rust 107 → **128** 测试；`tsc --noEmit` 0 错误
- 新增：弹窗栈/焦点、路由刷新、拖拽路径、MIME、i18n 键对齐、离线长操作、筛选范围校验、迁移执行、ErrorBoundary 懒加载失败、useMediaQuery

## v0.7.1 (2026-07-15)

### Fixed
- Image display: Tauri asset protocol not registered — added base64 fallback command
- useImageSrc now tries `get_image_base64_cmd` first, falls back to `convertFileSrc`

### Added
- VariantGroup component: display image variants in DetailModal
- i18n strings for variants section (en/zh)

## v0.7.0

### Added
- Mobile navigation: MobileNav component for mobile devices
- Search suggestions: SearchSuggestions component with keyboard navigation
- Search history: useSearchHistory hook with localStorage persistence
- Touch gesture support: useTouchGesture hook (swipe, long press, double tap)
- Toast notifications: global notification system (success/error/warning/info)
- Error retry: withRetry utility with exponential backoff
- Performance monitoring: usePerformanceMonitor hook
- AI analysis: AiAnalysisSection integrated into DetailModal

### Improved
- Mobile responsiveness: conditional rendering of Sidebar/MobileNav
- Search UX: integrated search history and suggestions
- Code splitting: GalleryPage lazy loading
- Performance monitoring: GalleryPage and SearchPage render tracking
- Test coverage: 350 → 445 tests

### Fixed
- Sidebar search button onClick handler
- Cascade delete documentation
- Mutex usage documentation

### Removed
- 16 redundant documentation files
- Over-engineered documents (market analysis, strategy, etc.)
- VirtualGrid: not compatible with masonry layout (kept as utility)

## v0.6.0 (2026-07-10)

### Added
- LAN web server for mobile browsing (axum, port 8079)
- Batch embedding generation UI
- Export template variables: {model} {prompt} {seed} {width} {height} {format}
- Bidirectional LazyLoad for 10K+ image performance
- Sidebar keyboard navigation (ArrowUp/Down/Home/End)
- Release workflow: version sync check, test gate, signature download

### Fixed
- UI centering caused by #root flex centering
- Sidebar width: explicit 220px when expanded
- LAN server crash: Tokio runtime in synchronous setup
- Page transition animation removed (too much movement)

### Removed
- smartCollectionStore stub (no CRUD, no UI)
- 5 unused i18n keys, smartCollections section
- Dead Rust code: probe_metadata, read_text_chunks, MAX_READ
- app_dir field from ServerState (never read)
- images.rs split: 1195 lines → import(590) + search(260) + ops(370)

## v0.5.1 (2026-07-07)

### Added
- Dark theme: "暗夜" palette with warm candlelight accents
- `tokens.ts` unified to CSS variables (theme-responsive)
- DESIGN.md documents both light and dark color palettes

### Fixed
- Drag-and-drop import now actually imports files
- Manual import supports selecting individual files, not just folders
- Settings/Export/Import/Search pages no longer center content vertically
- Settings page layout aligned to top
- 18 hardcoded Chinese strings replaced with i18n calls
- Missing i18n keys for backup/export/import buttons
- Database import writes to staging file first (avoids corrupting active WAL)
- TypeScript errors in imageStore tests
- Sidebar navigation labels now use i18n

### Added
- File import button alongside folder import
- Database backup/restore in Settings (export/import SQLite)
- Image loading retry (up to 2 attempts with exponential backoff)
- 29 new tests: ImportPage integration, write commands lifecycle, store coverage
- Rust tests for single-file import (57 total)

### Performance
- LazyLoad placeholder uses actual image height from metadata

## v0.5.0 (2026-07-06)

### Added
- Search by image: pick a reference image to find visually similar results
- Batch AI tag: select multiple images and auto-tag in one action
- Performance budget script (`scripts/perf-budget.mjs`)
- Security audit CI workflow (npm audit + cargo audit weekly scan)
- GitHub Issue template for user feedback

### Fixed
- Circular dependency: `tauri.ts` ↔ `semanticCache.ts` resolved with `onWriteCommand` callback
- Layout shift on page switch (overflow: hidden on main container)
- 3 audit defects repaired

### Changed
- Style tokenization: 258/286 hardcoded values replaced with `tokens.ts`
- i18n completion: 25+ hardcoded Chinese strings replaced with `t()` calls
- Page splitting: SearchPage 611→429 lines, ImportPage 564→393 lines
- Test coverage: 267→311 tests (+44, +16%)
- Knowledge graph auto-update configured

## v0.4.0 (2026-07-05)

### Added
- Responsive layout with `useMediaQuery` hook

### Fixed
- 7 code quality issues from audit
- CLAUDE.md condensed from 3938→1650 bytes

### Changed
- TDD refactor: shared modules extracted, duplication eliminated
- Ponytail audit + UI optimizations

## v0.3.4 (2026-07-04)

Version bump only.

## v0.3.3 (2026-07-04)

### Fixed
- Image preview display
- Ollama detection reliability
- Batch delete confirmation
- Import feedback (loading states)
- Splash screen and app icon
- Updater signing pubkey in tauri.conf.json

## v0.3.2 (2026-07-03)

### Added
- PNG metadata extraction: SD/ComfyUI parameters auto-parsed on import
- Variant tracing (v6 schema): images with same prompt grouped as variants
- Smart collections: auto-grouped images by model, prompt pattern
- Auto-tagging: AI analysis results auto-create and associate tags
- `search_images_advanced`: field-scoped search (seed, prompt, model)

### Fixed
- Silent error swallowing in catch blocks
- FavoritesPage rewritten
- Shared format utility extracted
- OLLAMA_HOST config unified (frontend reads from Rust backend)
- CLIP commands registered in invoke_handler
- Audit corrections: docs accuracy, error handling, transaction safety

### Changed
- ARCHITECTURE.md updated with schema v6, variant groups, new commands

## v0.3.1 (2026-07-02)

### Added
- Semantic search cache with LRU eviction and TTL
- Ollama availability detection in sidebar
- Favorites page with favorite image filtering
- Auto-update via GitHub Releases
- CSP security policy
- Updater signing
- Custom app icons (古卷·灯火 lantern design)

### Fixed
- Cascade delete in `empty_trash`/`batch_permanent_delete`
- Cache race condition
- 8 audit defects
- Vec embeddings dimension mismatch (512→768)
- CSP: added github.com + fonts.googleapis.com
- White screen crash: `useTranslation` infinite loop + Tauri API fallback

### Changed
- Unified error handling with `AppError` enum
- Release workflow with minisign signing (later simplified to unsigned)

## v0.3.0 (2026-07-01)

### Added
- SQLite persistent storage with rusqlite
- Ollama integration (nomic-embed-text embedding + llava vision)
- sqlite-vec vector search
- Tauri commands for all CRUD operations
- Drag-and-drop file import
- Export functionality with format conversion and rename templates
- Embedding status tracking
- Batch embedding generation
- Performance benchmarks (bulk insert 1000 images)
- Windows .msi installer

### Changed
- Frontend API stubs replaced with real Tauri IPC calls
- Mock data removed

## v0.2 (2026-06-28)

### Added
- Embedding status badges on ImageCards
- Embedding detail card in image panel
- Batch embedding generation bar
- Embedding stats row in Dashboard
- Semantic search bar with autocomplete
- Similarity score badges (3 color tiers)
- AI analysis panel with tag suggestions
- Analysis history list
- Color palette extraction display
- i18n for embedding, semantic search, and AI analysis sections

## v0.1-mvp (2026-06-25)

### Added
- Tauri 2 + React 19 + TypeScript foundation
- SQLite database with FTS5 full-text search
- Gallery view with grid/list toggle and column controls
- Image import (folder selection)
- Image detail modal with metadata display
- Rating system (plum-blossom stamps, 0–5)
- Favorites (book collector's seal ◆)
- Tag system with color customization
- Trash with soft delete and restore
- Settings page (language, theme)
- Command palette (⌘K)
- Keyboard navigation (arrow keys, shortcuts)
- Dashboard with statistics overview
- Export with format selection
- Internationalization (Chinese/English)
- Design language: 古卷·灯火 (Ancient Scroll · Lamplight)
