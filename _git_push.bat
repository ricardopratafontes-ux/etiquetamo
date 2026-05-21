@echo off
cd /d "C:\App da Moderna\EtiquetaMO\EtiquetaMO"
"C:\Program Files\Git\cmd\git.exe" add -A 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: remover bloco Status do Sistema da home + versao v0.7.0" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main 2>&1
echo EXITCODE=%ERRORLEVEL%
