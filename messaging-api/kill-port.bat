@echo off
REM Batch script to kill process on port 3001 (Windows)
REM Usage: kill-port.bat [port]
REM Example: kill-port.bat 3001

setlocal
set PORT=%1
if "%PORT%"=="" set PORT=3001

echo Looking for processes using port %PORT%...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT%') do (
    set PID=%%a
    goto :found
)

:found
if defined PID (
    echo Found process with PID %PID%
    echo Killing process...
    taskkill /F /PID %PID% >nul 2>&1
    if errorlevel 1 (
        echo Failed to kill process %PID%
    ) else (
        echo Successfully killed process %PID%
        echo Port %PORT% is now free!
    )
) else (
    echo No process found using port %PORT%
)

endlocal

