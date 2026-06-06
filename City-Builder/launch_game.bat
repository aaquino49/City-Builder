@echo off
title Pixel Dominion
cd /d "C:\Users\alexa\OneDrive\Desktop\Claude Projects\City-Builder"
echo Starting Pixel Dominion...
echo Keep this window open while playing.
echo.
start "Pixel Dominion Server" /min python -m http.server 8765
timeout /t 2 /nobreak >nul
start "" "http://localhost:8765"
