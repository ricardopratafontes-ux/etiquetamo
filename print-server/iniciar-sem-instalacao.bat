@echo off
title EtiquetaMO Print Server (Portavel)
color 0A

set NODE_DIR=%~dp0node-portable
set NODE_EXE=%NODE_DIR%\node.exe

echo.
echo  ==========================================
echo   EtiquetaMO Print Server - Modo Portavel
echo  ==========================================
echo.

:: Verifica se o Node portátil já foi baixado
if exist "%NODE_EXE%" (
    echo [OK] Node.js portavel encontrado.
    goto :START
)

:: Baixa o Node.js portátil
echo [*] Baixando Node.js portavel (primeira vez apenas)...
echo.

mkdir "%NODE_DIR%" 2>nul

:: Baixa usando PowerShell (nativo no Windows 10+)
powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip'; $zip = '%TEMP%\node-portable.zip'; Write-Host 'Baixando Node.js v20.18.0...'; (New-Object Net.WebClient).DownloadFile($url, $zip); Write-Host 'Extraindo...'; Expand-Archive -Path $zip -DestinationPath '%TEMP%\node-extract' -Force; Copy-Item '%TEMP%\node-extract\node-v20.18.0-win-x64\node.exe' '%NODE_DIR%\node.exe'; Remove-Item $zip -Force; Remove-Item '%TEMP%\node-extract' -Recurse -Force; Write-Host 'Pronto!' }"

if not exist "%NODE_EXE%" (
    echo.
    echo [ERRO] Falha ao baixar o Node.js.
    echo Verifique sua conexao com a internet e tente novamente.
    echo.
    echo Alternativa: instale o Node.js manualmente em https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js portavel instalado com sucesso.

:START
echo.
echo Iniciando print server na porta 9100...
echo.
"%NODE_EXE%" "%~dp0src\server.js"

pause
