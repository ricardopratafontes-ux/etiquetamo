#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "feat: UI compacta, PIN seguranca, Step 3 colorido, pattern strip global, headers vermelho DEC-030/031" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
