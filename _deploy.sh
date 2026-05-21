#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "docs: DEC-021 lote fabricante + validade pacote como teto" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
