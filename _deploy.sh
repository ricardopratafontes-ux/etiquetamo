#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "feat: Etiquetas Avulsas (ex-Caixa) com campos dinamicos, modelos, historico, DEC-028/029" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
