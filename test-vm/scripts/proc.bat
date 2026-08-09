@echo off
tasklist | findstr /i "lumora setup" > C:\proc.txt 2>&1
dir "C:\Users\tester\AppData\Local\Programs\Lumora" >> C:\proc.txt 2>&1
exit /b 0
