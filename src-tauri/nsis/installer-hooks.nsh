!macro NSIS_HOOK_PREUNINSTALL
  ; 卸载开始前结束 Lumora 主进程，释放文件占用
  ; nsExec 隐藏控制台运行——Exec/ExecWait 每次调用都会弹出空白命令行窗口
  nsExec::Exec 'taskkill /f /im "Lumora.exe"'
  Pop $0
  nsExec::Exec 'taskkill /f /im "Lumora.exe"'
  Pop $0

  ; WebView2Loader.dll 仍以已加载模块的形式留在内存里（taskkill 已结束宿主进程，
  ; 但模块引用尚未释放），此时删除安装目录会失败并留下残缺目录。先注销它。
  ; 走 32 位 SysWOW64 与 64 位 System32 两条路径，覆盖不同 WebView2 发行版；
  ; pop 掉卸载失败的回显，避免用户看到无关报错。
  UnRegDLL "$SYSDIR\WebView2Loader.dll"
  Pop $0
  ${If} ${RunningX64}
    ${DisableX64FSRedirection}
    UnRegDLL "$SYSDIR\WebView2Loader.dll"
    Pop $0
    ${EnableX64FSRedirection}
  ${EndIf}

  ; 等待进程退出并释放 WebView2 数据目录句柄
  Sleep 3000
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; 自愈：无论正常卸载还是被安装器调用做升版卸载，这里都清一次卸载注册项。
  ; 正常路径下它指向的 uninstall.exe 即将被删、留着也是死链；异常路径下它本身
  ; 就是让安装器卡在「无法卸载」的孤儿项。新版本的安装会重新写回该键，无副作用。
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumora"
  ; 注意：应用数据（%APPDATA%\com.lumora.app）里放着图库数据库 lumora.db、
  ; backups 与 settings.json。**这里一律不删**：Tauri 的 currentUser 安装模式下
  ; 「升版」就是「先卸载旧版再装新版」，删数据等于用户每升一次版就被清空一次图库。
  ; 只清可以重新生成的缓存与日志。
  RMDir /r "$LOCALAPPDATA\com.lumora.app"
  RMDir /r "$LOCALAPPDATA\lumora"
  RMDir /r "$LOCALAPPDATA\Lumora"

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

  ; 同样只清缓存/日志，绝不触碰 %APPDATA% 下的图库数据
  FileWrite $0 'set "tries=0"$\r$\n'
  FileWrite $0 ':retry_appdata$\r$\n'
  FileWrite $0 'rmdir /s /q "$LOCALAPPDATA\com.lumora.app" 2>nul$\r$\n'
  FileWrite $0 'rmdir /s /q "$LOCALAPPDATA\Lumora" 2>nul$\r$\n'
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
