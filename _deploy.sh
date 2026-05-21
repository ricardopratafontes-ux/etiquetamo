#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "fix: etiqueta com layout correto (logo mo, QR, fontes 14pt/18pt, dataCurta) + wizard com mais contraste" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
