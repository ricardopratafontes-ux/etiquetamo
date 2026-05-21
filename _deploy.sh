#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "fix: acentos corrigidos, ícones armazenagem, listagem compacta com botão imprimir" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
