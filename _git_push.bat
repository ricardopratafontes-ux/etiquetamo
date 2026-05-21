@echo off
cd /d "C:\App da Moderna\EtiquetaMO\EtiquetaMO"
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "feat: Step4 grid 4col + campo busca produto"
"C:\Program Files\Git\cmd\git.exe" push origin main
echo DONE
