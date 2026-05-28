@echo off
cd /d "%~dp0"
"marine_news_crawler.exe" --web --db "..\report_generator\_internal\data\crawler.db"

pause
