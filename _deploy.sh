#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "feat: regras de produtor por familia, escolha tipo etiqueta na modal, info produto, DEC-026/027" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
