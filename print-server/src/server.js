/**
 * EtiquetaMO Print Server v1.0
 *
 * Micro-serviço HTTP que roda no PC da cozinha (onde a Elgin L42 Pro está conectada).
 * Recebe HTML de etiqueta via POST, gera PDF temporário, e imprime via driver Windows.
 *
 * Endpoints:
 *   GET  /status           → Verifica se o servidor está rodando e lista impressoras
 *   POST /print            → Recebe HTML da etiqueta e imprime
 *   GET  /printers         → Lista impressoras disponíveis no Windows
 *
 * Uso: O EtiquetaMO web app faz fetch("http://<ip-cozinha>:9100/print", { method: "POST", body: html })
 */

const http = require("http");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ========== CONFIGURAÇÃO ==========
const PORT = 9100;
const DEFAULT_PRINTER = ""; // vazio = usa impressora padrão do Windows
// ==================================

const TEMP_DIR = path.join(os.tmpdir(), "etiquetamo-print");

// Criar pasta temp se não existir
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Lista impressoras do Windows via PowerShell
 */
function listPrinters() {
  return new Promise((resolve, reject) => {
    exec(
      'powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"',
      { encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Erro ao listar impressoras: ${stderr || err.message}`));
          return;
        }
        try {
          const printers = JSON.parse(stdout);
          resolve(Array.isArray(printers) ? printers : [printers]);
        } catch (e) {
          resolve([]);
        }
      }
    );
  });
}

/**
 * Imprime um arquivo HTML usando o SumatraPDF (leve, sem instalação) ou via PowerShell
 * Fallback: salva como HTML e abre com o navegador padrão para impressão
 */
function printHTML(htmlContent, printerName) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const htmlFile = path.join(TEMP_DIR, `etiqueta_${timestamp}.html`);

    // Envolve o HTML da etiqueta com meta tags de impressão
    const fullHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>EtiquetaMO - Impressão</title>
<style>
  @page {
    margin: 0;
    size: 100mm 50mm;
  }
  body {
    margin: 0;
    padding: 0;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;

    fs.writeFileSync(htmlFile, fullHTML, "utf8");

    // Método 1: Impressão silenciosa via PowerShell + Edge/Chrome
    const printerArg = printerName ? `"${printerName}"` : "";

    // Tenta imprimir via PowerShell com o componente de impressão do Windows
    const psCommand = printerName
      ? `powershell -Command "Start-Process '${htmlFile}' -Verb PrintTo -ArgumentList '${printerName}'"`
      : `powershell -Command "Start-Process '${htmlFile}' -Verb Print"`;

    exec(psCommand, { encoding: "utf8" }, (err, stdout, stderr) => {
      if (err) {
        // Fallback: abre no navegador padrão (operador clica em imprimir)
        exec(`start "" "${htmlFile}"`, (err2) => {
          if (err2) {
            reject(new Error(`Falha ao imprimir: ${err2.message}`));
          } else {
            resolve({
              success: true,
              method: "browser-fallback",
              message: "Arquivo aberto no navegador. Clique Ctrl+P para imprimir.",
              file: htmlFile,
            });
          }
        });
      } else {
        resolve({
          success: true,
          method: "silent-print",
          message: `Enviado para impressora${printerName ? ": " + printerName : " padrão"}`,
          file: htmlFile,
        });
      }
    });
  });
}

/**
 * Lê o body de uma requisição POST
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/**
 * CORS headers — permite que o EtiquetaMO (qualquer origem) acesse este servidor
 */
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * Responde com JSON
 */
function jsonResponse(res, statusCode, data) {
  setCORS(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

// ========== SERVIDOR HTTP ==========
const server = http.createServer(async (req, res) => {
  setCORS(res);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    // GET /status — health check
    if (url.pathname === "/status" && req.method === "GET") {
      const printers = await listPrinters().catch(() => []);
      jsonResponse(res, 200, {
        status: "online",
        version: "1.0.0",
        app: "EtiquetaMO Print Server",
        hostname: os.hostname(),
        printers: printers.map((p) => p.Name || p),
        defaultPrinter: DEFAULT_PRINTER || "(padrão do Windows)",
        uptime: process.uptime(),
      });
      return;
    }

    // GET /printers — lista impressoras
    if (url.pathname === "/printers" && req.method === "GET") {
      const printers = await listPrinters();
      jsonResponse(res, 200, { printers });
      return;
    }

    // POST /print — imprime etiqueta
    if (url.pathname === "/print" && req.method === "POST") {
      const body = await readBody(req);

      if (!body || body.trim().length === 0) {
        jsonResponse(res, 400, { error: "Body vazio. Envie o HTML da etiqueta." });
        return;
      }

      let payload;
      let htmlContent;
      let printerName = DEFAULT_PRINTER;

      // Aceita JSON { html: "...", printer: "..." } ou HTML puro
      try {
        payload = JSON.parse(body);
        htmlContent = payload.html;
        printerName = payload.printer || DEFAULT_PRINTER;
      } catch {
        // Body é HTML direto
        htmlContent = body;
      }

      if (!htmlContent) {
        jsonResponse(res, 400, { error: "Campo 'html' é obrigatório." });
        return;
      }

      const result = await printHTML(htmlContent, printerName);
      jsonResponse(res, 200, result);
      return;
    }

    // 404
    jsonResponse(res, 404, { error: "Endpoint não encontrado. Use /status, /printers ou /print." });
  } catch (err) {
    jsonResponse(res, 500, { error: err.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       EtiquetaMO Print Server v1.0              ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Rodando em: http://0.0.0.0:${PORT}               ║`);
  console.log(`║  Hostname:   ${os.hostname().padEnd(36)}║`);
  console.log("║                                                  ║");
  console.log("║  Endpoints:                                      ║");
  console.log("║    GET  /status    → Health check                 ║");
  console.log("║    GET  /printers  → Lista impressoras            ║");
  console.log("║    POST /print     → Imprime etiqueta             ║");
  console.log("║                                                  ║");
  console.log("║  Ctrl+C para parar                               ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");

  // Listar impressoras ao iniciar
  listPrinters()
    .then((printers) => {
      console.log("Impressoras detectadas:");
      printers.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.Name || p} (${p.DriverName || "driver desconhecido"})`);
      });
      console.log("");
    })
    .catch(() => {
      console.log("Aviso: não foi possível listar impressoras.\n");
    });
});
