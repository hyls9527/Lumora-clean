@echo off
dir C:\Lumora-setup.exe > C:\probe.txt 2>&1
dir "C:\Users\tester\AppData\Local\Programs\Lumora" >> C:\probe.txt 2>&1
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoAdminLogon >> C:\probe.txt 2>&1
exit /b 0
