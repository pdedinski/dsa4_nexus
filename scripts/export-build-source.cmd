@echo off
setlocal EnableExtensions
REM Zip tracked files at HEAD via git archive (no node_modules, .next, .env, etc.).
REM Default output: <parent of repo>\<foldername>-build-source.zip
REM Usage:
REM   scripts\export-build-source.cmd
REM   scripts\export-build-source.cmd D:\out\my-export.zip

pushd "%~dp0.." >nul

if not exist ".git\" (
  echo ERROR: No .git folder here; expected repo root "%cd%"
  popd >nul
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: git not found on PATH.
  popd >nul
  exit /b 1
)

for %%I in ("%cd%") do set "REPONAME=%%~nxI"

if "%~1"=="" (
  for %%F in ("%cd%\..") do set "OUTZIP=%%~fF\%REPONAME%-build-source.zip"
) else (
  set "OUTZIP=%~f1"
)

git archive --format=zip -o "%OUTZIP%" HEAD
set "ARCERR=%ERRORLEVEL%"
popd >nul

if not "%ARCERR%"=="0" (
  echo ERROR: git archive failed ^(code %ARCERR%^).
  exit /b 1
)

echo Wrote: %OUTZIP%
for %%A in ("%OUTZIP%") do echo Size: %%~zA bytes
exit /b 0
