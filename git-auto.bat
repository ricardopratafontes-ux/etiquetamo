@echo off
cd /d "C:\App da Moderna\EtiquetaMO\EtiquetaMO"
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "%~1"
"C:\Program Files\Git\cmd\git.exe" push
echo DONE
