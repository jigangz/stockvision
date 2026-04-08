@echo off
REM Build the Python backend sidecar for Tauri packaging.
REM
REM Usage: scripts\build_sidecar.bat
REM
REM Pre-requisites:
REM   pip install pyinstaller fastapi uvicorn pandas numpy pyarrow lark-parser akshare tushare
REM
REM Output:
REM   src-tauri\binaries\python-backend-x86_64-pc-windows-msvc.exe

setlocal enabledelayedexpansion

echo [build-sidecar] Detecting Rust target triple...
for /f "tokens=*" %%i in ('rustc -Vv 2^>nul ^| findstr /i "host:"') do (
    set RUST_LINE=%%i
)
set TRIPLE=!RUST_LINE:host: =!
echo [build-sidecar] Target triple: !TRIPLE!

set DIST_DIR=%~dp0..\src-tauri\binaries
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"

echo [build-sidecar] Running PyInstaller...
cd /d "%~dp0.."
pyinstaller python\stockvision_backend.spec --distpath "%DIST_DIR%\tmp_dist" --workpath build\pyinstaller --noconfirm

if errorlevel 1 (
    echo [build-sidecar] PyInstaller failed!
    exit /b 1
)

REM PyInstaller outputs "python-backend.exe"; rename with target triple suffix
set SRC=%DIST_DIR%\tmp_dist\python-backend.exe
set DST=%DIST_DIR%\python-backend-!TRIPLE!.exe

echo [build-sidecar] Renaming %SRC% -> %DST%
move /y "%SRC%" "%DST%"
rmdir /s /q "%DIST_DIR%\tmp_dist" 2>nul

echo [build-sidecar] Done: %DST%
endlocal
