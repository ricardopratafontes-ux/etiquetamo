#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "fix: home e navbar apontam para /imprimir, removido /producao, fluxo direto" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
