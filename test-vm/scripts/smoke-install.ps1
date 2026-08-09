# Lumora VM 安装/升级冒烟测试
# 复用 test-vm 现有资产：Windows11-Test.vmx、vmrun 远程控制、已构建安装包。
# 用法：
#   powershell -ExecutionPolicy Bypass -File test-vm/scripts/smoke-install.ps1
#   powershell -ExecutionPolicy Bypass -File test-vm/scripts/smoke-install.ps1 -Portable
param(
    [string]$Vmrun = 'C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe',
    [string]$Vmx = 'D:\win-test-vm\vm\Windows11-Test.vmx',
    [string]$GuestUser = 'tester',
    [string]$GuestPass = 'Test@12345',
    [switch]$Portable
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$resultDir = Join-Path $repoRoot 'test-vm\results'
New-Item -ItemType Directory -Force -Path $resultDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$report = Join-Path $resultDir "smoke-$stamp.txt"
$log = @()

function Write-Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
    $script:log += $line
    Write-Host $line
}

function Invoke-Vmrun([string[]]$Args) {
    & $script:Vmrun -T ws @Args
    if ($LASTEXITCODE -ne 0) { throw "vmrun 失败: $Args" }
}

function Copy-HostToGuest([string]$Src, [string]$Dst, [int]$Retries = 5) {
    for ($i = 1; $i -le $Retries; $i++) {
        $out = & $script:Vmrun -T ws -gu $script:GuestUser -gp $script:GuestPass copyFileFromHostToGuest $script:Vmx $Src $Dst 2>&1
        if ($LASTEXITCODE -eq 0 -and ($out -join ' ') -notmatch 'Error:') { return }
        Write-Log ("拷贝重试 {0}/{1}: {2} -> {3} ({4})" -f $i, $Retries, $Src, $Dst, ($out -join ' '))
        Start-Sleep -Seconds 8
    }
    throw "拷贝失败: $Src -> $Dst"
}

function Copy-GuestToHost([string]$Src, [string]$Dst, [int]$Retries = 5) {
    for ($i = 1; $i -le $Retries; $i++) {
        $out = & $script:Vmrun -T ws -gu $script:GuestUser -gp $script:GuestPass copyFileFromGuestToHost $script:Vmx $Src $Dst 2>&1
        if ($LASTEXITCODE -eq 0 -and ($out -join ' ') -notmatch 'Error:') { return }
        Write-Log ("取回重试 {0}/{1}: {2} -> {3} ({4})" -f $i, $Retries, $Src, $Dst, ($out -join ' '))
        Start-Sleep -Seconds 8
    }
    throw "取回失败: $Src -> $Dst"
}

function Invoke-GuestBatch([string]$Content, [string]$GuestBat, [string]$GuestProof, [string]$LocalProof) {
    $localBat = Join-Path $env:TEMP ([IO.Path]::GetFileName($GuestBat))
    Set-Content -LiteralPath $localBat -Value $Content -Encoding ASCII
    Copy-HostToGuest $localBat $GuestBat
    $out = & $script:Vmrun -T ws -gu $script:GuestUser -gp $script:GuestPass runProgramInGuest $script:Vmx cmd.exe /c $GuestBat 2>&1
    if ($LASTEXITCODE -ne 0) { throw "客户机批处理失败: $GuestBat ($($out -join ' '))" }
    Start-Sleep -Seconds 2
    Copy-GuestToHost $GuestProof $LocalProof
    return Get-Content -LiteralPath $LocalProof -Raw
}

function Test-GuestFile([string]$Path) {
    $bat = "@echo off`r`nif exist `"$Path`" (echo YES > C:\lumora-fileproof.txt) else (echo NO > C:\lumora-fileproof.txt)"
    $localProof = Join-Path $env:TEMP 'lumora-fileproof.txt'
    if (Test-Path -LiteralPath $localProof) { Remove-Item -LiteralPath $localProof -Force }
    try {
        $res = Invoke-GuestBatch $bat 'C:\lumora-filecheck.bat' 'C:\lumora-fileproof.txt' $localProof
        return ($res -match 'YES')
    } catch {
        return $false
    }
}

function Wait-GuestDesktop([int]$TimeoutSec = 300) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $procs = & $script:Vmrun -T ws -gu $script:GuestUser -gp $script:GuestPass listProcessesInGuest $script:Vmx 2>&1
        if (($procs -join "`n") -match 'explorer\.exe') {
            Write-Log '客户机已进入桌面'
            return
        }
        Start-Sleep -Seconds 10
    }
    throw "等待客户机桌面超时（${TimeoutSec}s）"
}

# 1. 定位构建产物
if ($Portable) {
    $payload = Join-Path $repoRoot 'src-tauri\target\release\Lumora.exe'
    $guestPath = 'C:\lumora-portable.exe'
} else {
    $payload = Get-ChildItem (Join-Path $repoRoot 'src-tauri\target\release\bundle\nsis') -Filter 'Lumora_*_x64-setup.exe' |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    $guestPath = 'C:\lumora-setup.exe'
}
if (-not $payload) { throw '未找到构建产物，请先执行 npm run tauri build' }
Write-Log "产物: $payload"

# 2. 确保虚拟机运行
if (-not (Test-Path -LiteralPath $Vmrun)) { throw "vmrun 不存在: $Vmrun" }
if (-not (Test-Path -LiteralPath $Vmx)) { throw "VMX 不存在: $Vmx" }
$runningText = ((& $Vmrun -T ws list) -join "`n")
if ($runningText -notmatch [regex]::Escape($Vmx)) {
    Write-Log '虚拟机未启动，正在启动…'
    & $Vmrun -T ws start $Vmx nogui
}
$ready = $false
for ($i = 0; $i -lt 24; $i++) {
    $state = (& $Vmrun -T ws checkToolsState $Vmx 2>&1 | Select-Object -First 1)
    if ($state -match 'running') { $ready = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $ready) { throw 'VMware Tools 未就绪（超时 120s）' }
Write-Log '虚拟机就绪'
Wait-GuestDesktop

# 3. 拷贝产物
Write-Log "拷贝到客户机: $guestPath"
Copy-HostToGuest $payload $guestPath
if (-not (Test-GuestFile $guestPath)) { throw "安装包未出现在客户机: $guestPath" }
Write-Log '安装包已在客户机确认'

# 4. 静默安装（NSIS /S；自动登录已开启，满足已知坑条件）
$installBatContent = "@echo off`r`n$guestPath /S"
$installBatLocal = Join-Path $env:TEMP 'lumora-install.bat'
Set-Content -LiteralPath $installBatLocal -Value $installBatContent -Encoding ASCII
Copy-HostToGuest $installBatLocal 'C:\lumora-install.bat'
$job = Start-Job -ScriptBlock {
    param($vmrun, $vmx, $u, $p, $cmd)
    & $vmrun -T ws -gu $u -gp $p runProgramInGuest $vmx -interactive cmd.exe /c $cmd
} -ArgumentList $Vmrun, $Vmx, $GuestUser, $GuestPass, 'C:\lumora-install.bat'
if (-not (Wait-Job $job -Timeout 180)) {
    Stop-Job $job
    throw '安装超时（180s）'
}
Receive-Job $job | Out-String | Write-Host
Remove-Job $job

# 5. 验证安装目录
$probe = @'
@echo off
> C:\lumora-probe.txt echo PROBE-START
if exist "%LOCALAPPDATA%\Programs\Lumora\Lumora.exe" echo FOUND_LOCALAPPS>> C:\lumora-probe.txt
if not exist "%LOCALAPPDATA%\Programs\Lumora\Lumora.exe" echo MISS_LOCALAPPS>> C:\lumora-probe.txt
if exist "%LOCALAPPDATA%\Lumora\Lumora.exe" echo FOUND_LOCALAPPDATA>> C:\lumora-probe.txt
if not exist "%LOCALAPPDATA%\Lumora\Lumora.exe" echo MISS_LOCALAPPDATA>> C:\lumora-probe.txt
if exist "C:\Program Files\Lumora\Lumora.exe" echo FOUND_PROGRAMFILES>> C:\lumora-probe.txt
if not exist "C:\Program Files\Lumora\Lumora.exe" echo MISS_PROGRAMFILES>> C:\lumora-probe.txt
'@
$probeResult = Invoke-GuestBatch $probe 'C:\lumora-probe.bat' 'C:\lumora-probe.txt' (Join-Path $env:TEMP 'lumora-probe-result.txt')
Write-Log "安装探测:`n$probeResult"
if ($probeResult -notmatch 'FOUND') { throw '未检测到 Lumora 安装目录' }

# 6. 启动应用并确认进程
if ($Portable) {
    $exePath = $guestPath
} elseif ($probeResult -match 'FOUND_LOCALAPPS') {
    $exePath = '%LOCALAPPDATA%\Programs\Lumora\Lumora.exe'
} elseif ($probeResult -match 'FOUND_LOCALAPPDATA') {
    $exePath = '%LOCALAPPDATA%\Lumora\Lumora.exe'
} else {
    $exePath = 'C:\Program Files\Lumora\Lumora.exe'
}
Write-Log "启动路径: $exePath"
$launchBat = "@echo off`r`nstart `"`" `"$exePath`""
$localLaunch = Join-Path $env:TEMP 'lumora-launch.bat'
Set-Content -LiteralPath $localLaunch -Value $launchBat -Encoding ASCII
Copy-HostToGuest $localLaunch 'C:\lumora-launch.bat'
$launchJob = Start-Job -ScriptBlock {
    param($vmrun, $vmx, $u, $p, $bat)
    & $vmrun -T ws -gu $u -gp $p runProgramInGuest $vmx -interactive cmd.exe /c $bat
} -ArgumentList $Vmrun, $Vmx, $GuestUser, $GuestPass, 'C:\lumora-launch.bat'
Start-Sleep -Seconds 10
$procBat = @'
@echo off
tasklist /FI "IMAGENAME eq Lumora.exe" > C:\lumora-proc.txt 2>&1
'@
$procResult = Invoke-GuestBatch $procBat 'C:\lumora-proc.bat' 'C:\lumora-proc.txt' (Join-Path $env:TEMP 'lumora-proc.txt')
Write-Log "进程检查:`n$procResult"
if ($procResult -notmatch 'Lumora\.exe') { throw 'Lumora 进程未运行' }
Stop-Job $launchJob -ErrorAction SilentlyContinue
Remove-Job $launchJob -Force -ErrorAction SilentlyContinue

# 7. 输出报告
$log | Set-Content -LiteralPath $report -Encoding UTF8
Write-Log "完成。报告: $report"
