@echo off
cd /d "C:\App da Moderna\EtiquetaMO\EtiquetaMO"
"C:\Program Files\Git\cmd\git.exe" add -A 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "feat: etiqueta complementar acionavel + peso editavel com toggle" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main 2>&1
echo EXITCODE=%ERRORLEVEL%
