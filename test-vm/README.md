# Lumora Windows 测试虚拟机

用于在干净 Windows 11 环境里验证 Lumora 桌面版（Tauri v2 + React）。

## 虚拟机现状（2026-08-09）

- 系统：Windows 11 企业评估版 25H2（Build 26200，90 天授权，官方中文镜像）
- 配置：4 核 / 8GB / 100GB（SATA）/ NAT
- VMware Tools：已安装
- 自动登录：已开启（tester / Test@12345），重启直接进桌面
- 客户机 IP：`192.168.238.130`（DHCP，可能变化）
- 虚拟机文件：`D:\win-test-vm\vm\Windows11-Test.vmx`
- 免交互安装盘：`D:\win-test-vm\Windows11-noprompt.iso`（可重装系统用）

## Lumora 测试状态

- ✅ v0.9.0 便携版已运行，界面正常（创作者图库、数据库已连接、筛选/评分/导出 UI 齐全）
- ✅ v0.9.0 NSIS 静默安装 + 启动冒烟已自动化验证（2026-08-09，脚本见下）
- ✅ 远程命令接管可用（vmrun + tester）
- ⏳ Windows 防火墙弹窗待点（允许/取消均可，只影响联网功能）
- ⏳ Ollama 离线——语义搜索需在虚拟机里装 Ollama
- ⏳ MSI 安装流程待自动化（NSIS 已验证）

测试截图：`screenshots/lumora-run.png`

## 构建产物（宿主机）

```text
src-tauri/target/release/Lumora.exe                     # 便携版（22.5MB）
src-tauri/target/release/bundle/nsis/Lumora_0.9.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Lumora_0.9.0_x64_en-US.msi
```

重新构建：`npm run tauri build`

## 远程控制（宿主机 PowerShell）

```powershell
$vmrun = 'C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe'
$vm = 'D:\win-test-vm\vm\Windows11-Test.vmx'

# 启动 / 关机 / 硬重启
& $vmrun -T ws start $vm nogui
& $vmrun -T ws stop $vm
& $vmrun -T ws reset $vm

# 执行命令（退出型命令用；GUI 应用会一直等到它关闭，见已知坑）
& $vmrun -T ws -gu tester -gp 'Test@12345' runProgramInGuest $vm cmd.exe /c "echo hi > C:\t.txt"

# 文件双向拷贝
& $vmrun -T ws -gu tester -gp 'Test@12345' copyFileFromHostToGuest $vm .\app.exe C:\app.exe
& $vmrun -T ws -gu tester -gp 'Test@12345' copyFileFromGuestToHost $vm C:\out.txt .\out.txt

# 交互式启动 GUI（会阻塞到应用退出，建议放到后台 Job 里跑）
& $vmrun -T ws -gu tester -gp 'Test@12345' runProgramInGuest $vm -interactive C:\Lumora.exe
```

## 脚本说明（scripts/）

| 脚本 | 用途 |
| --- | --- |
| `autologon.bat` | 以 SYSTEM 身份写自动登录注册表（AutoAdminLogon=1） |
| `task-setup.bat` | 创建并运行 SYSTEM 计划任务执行 autologon.bat |
| `sess.bat` | 查询客户机当前登录会话（query user） |
| `probe.bat` | 检查安装包/安装目录/自动登录状态 |
| `proc.bat` | 检查 Lumora / setup 进程是否在跑 |
| `kill.bat` | 按 PID 强杀残留进程 |
| `boot-and-keys.ps1` | （实验）自动开机+发回车引导安装盘，已废弃 |
| `rfb.py` | （实验）VNC 控制脚本，Workstation 17.6 VNC 未生效，已废弃 |

## 一键安装冒烟（smoke-install.ps1）

复用已有虚拟机 + 已构建产物，自动完成：启动/等待桌面 → 拷贝安装包 → NSIS 静默安装
→ 探测安装目录 → 启动应用 → 确认进程 → 输出报告。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File test-vm/scripts/smoke-install.ps1
```

报告输出到 `test-vm/results/smoke-<时间戳>.txt`。

## 桌面真实交互 E2E（CDP 方案）

直接驱动 VM 桌面里真实运行的 Lumora（Tauri + WebView2），用 Playwright 的
`connectOverCDP` 连接 WebView2 的调试端口，完成与浏览器 E2E 相同的交互链路。

验证结果（2026-08-09）：5/5 通过 —— 启动进图库、侧边栏导航完整、
语义搜索 → 设置 → 返回图库、命令面板导航到导入页、深色主题切换。

启用步骤（测试专用，生产配置不带调试端口）：

1. 临时在 `src-tauri/tauri.conf.json` 的窗口配置加
   `"additionalBrowserArgs": "--remote-debugging-port=9222"`，`cargo build` 后拷入 VM。
2. VM 内启动 Vite dev server（debug 版走 devUrl）：`npm run dev`。
3. 在 VM 桌面会话启动 debug 版（vmrun 投递受限时用 psexec -i 1）。
4. VM 内运行 `node scripts/cdp-e2e.mjs`。

脚本：`scripts/cdp-e2e.mjs`（连接 http://127.0.0.1:9222）。

## 真实数据流 E2E（cdp-dataflow.mjs）

用真实图片（`D:\lumora-test-images`，3 张 PNG）走完整数据链路：
真实导入 → 图库展示 → 评分 4 星 → 收藏 → 详情 → 仅收藏筛选 →
删除到回收站 → 恢复 → 永久删除。每次运行前建议重置数据库
（`D:\Users\tester\AppData\Roaming\com.lumora.app\lumora.db`）。

验证结果（2026-08-09）：9/9 通过。

期间发现并修复两个真实 bug：
- GalleryPage：`useMemo` 写在 JSX 条件分支里，导入真实图片后 hooks 数量变化导致崩溃；
- AiAnalysisSection：store selector `?? []` 每次返回新空数组，useSyncExternalStore
  无限重渲染（打开详情崩溃）。

## 功能链路 E2E（cdp-features.mjs）

带真实元数据（A1111 parameters：prompt/model/sampler）的图片，验证：
按评分排序、标签创建→图片关联→删除、精确搜索（moonlight 命中）、批量选择并删除。

验证结果（2026-08-10）：5/5 通过。

期间修复：SearchPage 五处 i18n key 双重前缀（`tT("search.searchResults")` 之类），
导致 aria-label/title 变成字面 key。

已知产品缺口：`add_tag_to_image` 写入的 image_tags 关联在 UI 详情/卡片没有展示路径
（前端 ImageRecord.tags 只来自 metadata_json），标签管理页创建的标签无法在图片上看到。

自动应答：`answer/autounattend.xml` + `answer/vmwaretools-setup.bat`（首登静默装 Tools），
打包好的 `answer.iso` 也保留着。

## 已知坑（重要）

1. **CLI 拍快照会卡死**：`vmrun snapshot` 在这台机器上懒模式卡住（试过多次）。
   要新快照请在 VMware 界面点「虚拟机 → 快照 → 拍摄快照」。恢复快照用 CLI 没问题：
   `vmrun -T ws revertToSnapshot $vm clean-install`
2. **runProgramInGuest 启动 GUI 会阻塞**：等应用退出才返回，命令会看起来"卡住"。
   应用实际已启动；用后台 Job 或干脆不等它。
3. **NSIS 静默安装（/S）在无登录会话时挂起**：必须先保证 tester 已登录（自动登录已开），
   或用 MSI 走 SYSTEM 计划任务安装。
4. **本会话无法向 VMware 控制台注入鼠标/键盘**：VMware 只认真人输入；
   自动化只能靠 vmrun 客户机命令 + 文件拷贝。

## 恢复现场

```powershell
vmrun -T ws revertToSnapshot "D:\win-test-vm\vm\Windows11-Test.vmx" clean-install
vmrun -T ws start "D:\win-test-vm\vm\Windows11-Test.vmx" nogui
```

回到刚装完系统的干净状态（含 Tools 的 with-tools 快照因 CLI bug 未保留，可 GUI 补拍）。
