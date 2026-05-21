@echo off
cd /d "C:\App da Moderna\EtiquetaMO\EtiquetaMO"
"C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next build 2>&1
echo EXITCODE=%ERRORLEVEL%
