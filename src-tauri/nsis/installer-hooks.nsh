!macro NSIS_HOOK_PREUNINSTALL
  ; 卸载开始前结束 Lumora 主进程及 WebView2 相关进程，释放文件占用
  ExecWait '"taskkill" /f /im "Lumora.exe"' $0
  ExecWait '"taskkill" /f /im "Lumora.exe"' $0
  ExecWait '"taskkill" /f /im "app.exe"' $0

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

  ; 安装目录本身：uninstall.exe 正在运行，启动独立 cmd 脚本等待卸载进程结束后彻底清理
  FileOpen $0 "$TEMP\lumora_uninst_cleanup.bat" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 'setlocal enabledelayedexpansion$\r$\n'
  FileWrite $0 ':wait_uninstall$\r$\n'
  FileWrite $0 'timeout /t 1 /nobreak >nul$\r$\n'
  FileWrite $0 'tasklist /fi "imagename eq uninstall.exe" 2>nul | find /i "uninstall.exe" >nul$\r$\n'
  FileWrite $0 'if %errorlevel%==0 goto wait_uninstall$\r$\n'

  ; 强制结束可能残留的 Lumora / WebView2 进程
  FileWrite $0 'taskkill /f /im "Lumora.exe" 2>nul$\r$\n'
  FileWrite $0 'taskkill /f /im "Lumora.exe" 2>nul$\r$\n'
  FileWrite $0 'taskkill /f /im "app.exe" 2>nul$\r$\n'
  FileWrite $0 'timeout /t 2 /nobreak >nul$\r$\n'

  ; 多次重试删除安装目录及应用数据目录
  FileWrite $0 'set "tries=0"$\r$\n'
  FileWrite $0 ':retry_instdir$\r$\n'
  FileWrite $0 'rmdir /s /q "$INSTDIR" 2>nul$\r$\n'
  FileWrite $0 'if not exist "$INSTDIR" goto done_instdir$\r$\n'
  FileWrite $0 'timeout /t 1 /nobreak >nul$\r$\n'
  FileWrite $0 'set /a tries+=1$\r$\n'
  FileWrite $0 'if !tries! lss 10 goto retry_instdir$\r$\n'
  FileWrite $0 ':done_instdir$\r$\n'

  FileWrite $0 'set "tries=0"$\r$\n'
  FileWrite $0 ':retry_appdata$\r$\n'
  FileWrite $0 'rmdir /s /q "$LOCALAPPDATA\com.lumora.app" 2>nul$\r$\n'
  FileWrite $0 'rmdir /s /q "$LOCALAPPDATA\Lumora" 2>nul$\r$\n'
  FileWrite $0 'rmdir /s /q "$APPDATA\com.lumora.app" 2>nul$\r$\n'
  FileWrite $0 'rmdir /s /q "$APPDATA\Lumora" 2>nul$\r$\n'
  FileWrite $0 'if not exist "$LOCALAPPDATA\com.lumora.app" if not exist "$LOCALAPPDATA\Lumora" goto done_appdata$\r$\n'
  FileWrite $0 'timeout /t 1 /nobreak >nul$\r$\n'
  FileWrite $0 'set /a tries+=1$\r$\n'
  FileWrite $0 'if !tries! lss 10 goto retry_appdata$\r$\n'
  FileWrite $0 ':done_appdata$\r$\n'

  FileWrite $0 'del "%~f0"$\r$\n'
  FileClose $0
  Exec '"$SYSDIR\cmd.exe" /c "$TEMP\lumora_uninst_cleanup.bat"'
!macroend
