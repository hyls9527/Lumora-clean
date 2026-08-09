@echo off
schtasks /create /tn SetAutoLogon /tr C:\autologon.bat /sc once /st 23:59 /ru SYSTEM /rl highest /f > C:\task-out.txt 2>&1
schtasks /run /tn SetAutoLogon >> C:\task-out.txt 2>&1
exit /b 0
