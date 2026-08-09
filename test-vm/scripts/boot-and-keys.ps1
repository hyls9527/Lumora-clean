param()
$ErrorActionPreference = 'Continue'
$vmrun = 'C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe'
$vmware = 'C:\Program Files (x86)\VMware\VMware Workstation\vmware.exe'
$vm = 'D:\win-test-vm\vm\Windows11-Test.vmx'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class BootKeys {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public struct RECT { public int Left, Top, Right, Bottom; }
}
'@
[BootKeys]::SetProcessDPIAware() | Out-Null

# 1. 关闭旧界面，干净重启虚拟机
Get-Process vmware -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
& $vmrun -T ws stop $vm 2>&1 | Out-Null
Start-Sleep -Seconds 3
& $vmrun -T ws start $vm nogui 2>&1 | Out-Null
Write-Output 'VM started (t0)'

# 2. 打开界面并确保窗口还原、置前
Start-Process -FilePath $vmware -ArgumentList @($vm)
$p = $null
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 2
  $p = Get-Process vmware -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p) { break }
}
if (-not $p) { Write-Output 'NO_VMWARE_WINDOW'; exit 1 }

$rect = New-Object BootKeys+RECT
for ($i = 0; $i -lt 10; $i++) {
  [BootKeys]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  [BootKeys]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 700
  [BootKeys]::GetWindowRect($p.MainWindowHandle, [ref]$rect) | Out-Null
  $w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
  Write-Output ("window: ${w}x${h} at $($rect.Left),$($rect.Top)")
  if ($w -gt 400 -and $h -gt 300) { break }
}

# 3. 点击控制台中央，确保键盘焦点进入虚拟机
$cx = [int]($rect.Left + ($rect.Right - $rect.Left) * 0.5)
$cy = [int]($rect.Top + ($rect.Bottom - $rect.Top) * 0.55)
[BootKeys]::SetCursorPos($cx, $cy) | Out-Null
Start-Sleep -Milliseconds 300
[BootKeys]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
[BootKeys]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Write-Output ("clicked console at $cx,$cy")

# 4. 从 t≈20s 开始，持续发回车到 t≈75s，覆盖光驱引导提示
$ws = New-Object -ComObject WScript.Shell
$deadline = (Get-Date).AddSeconds(55)
$n = 0
while ((Get-Date) -lt $deadline) {
  [BootKeys]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  [BootKeys]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  $ws.SendKeys('{ENTER}')
  $n++
  Start-Sleep -Milliseconds 1400
}
Write-Output ("sent ENTER x$n")
