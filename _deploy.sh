#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "fix: UI edição - inputs escuros, centralizados, título corrigido" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
