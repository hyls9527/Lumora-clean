!macro NSIS_HOOK_PREUNINSTALL
  ; 卸载开始前结束 Lumora 主进程，释放文件占用
  ; nsExec 隐藏控制台运行——Exec/ExecWait 每次调用都会弹出空白命令行窗口
  nsExec::Exec 'taskkill /f /im "Lumora.exe"'
  Pop $0
  nsExec::Exec 'taskkill /f /im "Lumora.exe"'
  Pop $0

  ; 等待进程退出并释放 WebView2 数据目录句柄
  Sleep 3000
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; 卸载完成后清理用户数据，保证零残留
  ; 先尝试立即删除常见路径
  RMDir /r "$APPDATA\lumora"
  RMDir /r "$APPDATA\Lumora"
  RMDir /r "$APPDATA\com.lumora.app"
  RMDir /r "$LOCALAPPDATA\lumora"
  RMDir /r "$LOCALAPPDATA\Lumora"
  RMDir /r "$LOCALAPPDATA\com.lumora.app"

  ; 安装目录本身：uninstall.exe 正在运行，启动独立清理脚本等待卸载进程结束后彻底清理。
  ; 不用 enabledelayedexpansion——延迟展开会吞掉路径中的 "!" 字符；
  ; goto 回跳时 %变量% 逐次重新解析，无需延迟展开。
  ; 计数上限防呆：若其它软件恰好也有 uninstall.exe 在运行，最多等 60 秒。
  FileOpen $0 "$TEMP\lumora_uninst_cleanup.bat" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 'set "waited=0"$\r$\n'
  FileWrite $0 ':wait_uninstall$\r$\n'
  FileWrite $0 'tasklist /fi "imagename eq uninstall.exe" 2>nul | find /i "uninstall.exe" >nul$\r$\n'
  FileWrite $0 'if not %errorlevel%==0 goto process_gone$\r$\n'
  FileWrite $0 'if %waited% geq 60 goto process_gone$\r$\n'
  FileWrite $0 'ping -n 2 127.0.0.1 >nul$\r$\n'
  FileWrite $0 'set /a waited+=1$\r$\n'
  FileWrite $0 'goto wait_uninstall$\r$\n'
  FileWrite $0 ':process_gone$\r$\n'

  ; 强制结束可能残留的 Lumora 进程
  FileWrite $0 'taskkill /f /im "Lumora.exe" 2>nul$\r$\n'
  FileWrite $0 'taskkill /f /im "Lumora.exe" 2>nul$\r$\n'
  FileWrite $0 'ping -n 3 127.0.0.1 >nul$\r$\n'

  ; 多次重试删除安装目录及应用数据目录
  FileWrite $0 'set "tries=0"$\r$\n'
  FileWrite $0 ':retry_instdir$\r$\n'
  FileWrite $0 'rmdir /s /q "$INSTDIR" 2>nul$\r$\n'
  FileWrite $0 'if not exist "$INSTDIR" goto done_instdir$\r$\n'
  FileWrite $0 'if %tries% geq 10 goto done_instdir$\r$\n'
  FileWrite $0 'ping -n 2 127.0.0.1 >nul$\r$\n'
  FileWrite $0 'set /a tries+=1$\r$\n'
  FileWrite $0 'goto retry_instdir$\r$\n'
  FileWrite $0 ':done_instdir$\r$\n'

  FileWrite $0 'set "tries=0"$\r$\n'
  FileWrite $0 ':retry_appdata$\r$\n'
  FileWrite $0 'rmdir /s /q "$LOCALAPPDATA\com.lumora.app" 2>nul$\r$\n'
  FileWrite $0 'rmdir /s /q "$LOCALAPPDATA\Lumora" 2>nul$\r$\n'
  FileWrite $0 'rmdir /s /q "$APPDATA\com.lumora.app" 2>nul$\r$\n'
  FileWrite $0 'rmdir /s /q "$APPDATA\Lumora" 2>nul$\r$\n'
  FileWrite $0 'if not exist "$LOCALAPPDATA\com.lumora.app" if not exist "$LOCALAPPDATA\Lumora" goto done_appdata$\r$\n'
  FileWrite $0 'if %tries% geq 10 goto done_appdata$\r$\n'
  FileWrite $0 'ping -n 2 127.0.0.1 >nul$\r$\n'
  FileWrite $0 'set /a tries+=1$\r$\n'
  FileWrite $0 'goto retry_appdata$\r$\n'
  FileWrite $0 ':done_appdata$\r$\n'

  FileWrite $0 'del "%TEMP%\lumora_uninst_cleanup.vbs" 2>nul$\r$\n'
  FileWrite $0 'del "%~f0"$\r$\n'
  FileClose $0
  ; 由 wscript（GUI 子系统）隐藏启动清理脚本——直接 Exec cmd.exe 会弹出
  ; 可见的空白命令行窗口，且批处理需等待卸载进程退出
  FileOpen $0 "$TEMP\lumora_uninst_cleanup.vbs" w
  FileWrite $0 'CreateObject("WScript.Shell").Run "cmd /c ""$TEMP\lumora_uninst_cleanup.bat""", 0, False$\r$\n'
  FileClose $0
  Exec '"$SYSDIR\wscript.exe" //B "$TEMP\lumora_uninst_cleanup.vbs"'

  ; 兜底：企业环境可能通过组策略禁用 WSH（wscript 启动即失败且不执行清理），
  ; 注册重启后删除，保证 uninstall.exe 自锁导致的安装目录残留最终被清除。
  Delete /REBOOTOK "$INSTDIR\uninstall.exe"
  RMDir /REBOOTOK "$INSTDIR"
!macroend
