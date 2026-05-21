# EtiquetaMO Print Server — Guia de Instalação

## O que é isso?

Um pequeno programa que roda no PC da cozinha (onde a Elgin L42 Pro está conectada via USB). Ele recebe comandos do EtiquetaMO pela rede e imprime as etiquetas automaticamente.

## Pré-requisitos

- Windows 10 ou 11
- Impressora Elgin L42 Pro instalada e funcionando no Windows
- Conexão de rede (o PC da cozinha e o PC/celular que acessa o EtiquetaMO devem estar na mesma rede)

## Instalação (sem instalar nada no PC)

1. Copie a pasta `print-server` inteira para o PC da cozinha (pode ser via pen drive, pasta compartilhada, ou AnyDesk)
2. No PC da cozinha, dê dois cliques em `iniciar-sem-instalacao.bat`
3. Na primeira execução, ele vai baixar o Node.js portátil (~30MB, apenas uma vez)
4. Depois aparece a mensagem "EtiquetaMO Print Server v1.0" com a lista de impressoras

## Instalação (com Node.js já instalado)

1. Copie a pasta `print-server` para o PC da cozinha
2. Dê dois cliques em `iniciar-print-server.bat`

## Como usar

1. No PC da cozinha, rode o print server (passo acima)
2. Anote o IP do PC da cozinha (aparece no terminal, ou rode `ipconfig` no cmd)
3. No EtiquetaMO (qualquer navegador), vá em "Teste de Impressão"
4. Selecione "Impressão Remota"
5. Digite o IP do PC da cozinha e clique "Testar"
6. Se aparecer "Print Server conectado" com bolinha verde, está funcionando
7. Selecione a Elgin L42 Pro na lista de impressoras
8. Clique em "IMPRIMIR (REMOTO)"

## Porta utilizada

O print server usa a porta **9100**. Se o firewall do Windows perguntar, permita o acesso.

## Problemas comuns

**"Print Server offline"**
- Verifique se o .bat está rodando no PC da cozinha
- Verifique se os PCs estão na mesma rede
- Verifique se a porta 9100 não está bloqueada pelo firewall

**"Nenhuma impressora encontrada"**
- Verifique se a Elgin L42 Pro aparece em Configurações > Impressoras do Windows
- Tente imprimir uma página de teste pelo Windows primeiro

**O .bat fecha sozinho**
- Clique com botão direito > "Executar como administrador"
- Ou abra o cmd manualmente e rode: `node src\server.js`

## Iniciar automaticamente com o Windows

Para que o print server inicie sozinho quando o PC ligar:
1. Pressione Win+R, digite `shell:startup` e pressione Enter
2. Copie um atalho do `iniciar-sem-instalacao.bat` para essa pasta
