#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A >> _status.txt 2>&1
git commit -m "feat: campo ITEM FRACIONA (is_portioned) + migration 005 + DEC-020" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
