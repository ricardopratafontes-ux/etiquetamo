#!/bin/bash
cd '/c/App da Moderna/EtiquetaMO/EtiquetaMO'
git add -A > _status.txt 2>&1
git commit -m "feat: CRUD colaboradores, DEC-022 a DEC-025, link Equipe na NavBar" >> _status.txt 2>&1
git push origin main >> _status.txt 2>&1
