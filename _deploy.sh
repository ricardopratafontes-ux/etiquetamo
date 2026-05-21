#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "feat: popup validade pacote na impressao (DEC-021), lote do fabricante" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
