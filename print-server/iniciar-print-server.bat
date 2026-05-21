@echo off
title EtiquetaMO Print Server
color 0A

echo.
echo  ======================================
echo   EtiquetaMO Print Server - Iniciando
echo  ======================================
echo.

:: Verifica se Node.js está disponível
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js encontrado.
    echo.
    node "%~dp0src\server.js"
) else (
    echo [!] Node.js nao encontrado no sistema.
    echo.
    echo Para instalar o Node.js:
    echo   1. Acesse https://nodejs.org
    echo   2. Baixe a versao LTS (recomendada)
    echo   3. Instale com as opcoes padrao
    echo   4. Reinicie este script
    echo.
    echo Ou instale via winget:
    echo   winget install OpenJS.NodeJS.LTS
    echo.
    pause
)
