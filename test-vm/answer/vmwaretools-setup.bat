@echo off
setlocal EnableExtensions
for %%x in (D E F G H) do (
  for /f "tokens=4" %%d in ('vol %%x: 2^>nul ^| find /i "VMware Tools"') do (
    if /i "%%x"=="%%d" (
      pushd %%d:\
      setup.exe /S /v"/qn REBOOT=ReallySuppress"
      popd
      goto :end
    )
  )
)
:end
exit /b 0
