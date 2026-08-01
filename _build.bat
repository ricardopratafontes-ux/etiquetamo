@echo off
cd /d "C:\App da Moderna\etiquetamo\EtiquetaMO"
"C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next build > "_build_result.txt" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "_build_result.txt"
