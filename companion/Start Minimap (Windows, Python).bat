@echo off
rem Start the TF3 Minimap companion with an installed Python 3 (the .exe from the Windows download needs no Python).
cd /d "%~dp0"
set TF3MAP_PAUSE=1
where py >nul 2>nul
if %errorlevel%==0 (py -3 tf3map_server.py %*) else (python tf3map_server.py %*)
if errorlevel 1 pause
