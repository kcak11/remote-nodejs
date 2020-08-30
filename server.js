const http = require("http");
const https = require("https");
const axios = require('axios');
const fs = require("fs");
const vm = require("vm");
//const app = require("./server/app");
let app;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let requestConfig = {
  method: 'get',
  url: "https://cdn.kcak11.com/remote-nodejs/app.js?ts=" + new Date().getTime(),
  httpsAgent: httpsAgent
};
axios(requestConfig).then(function (response) {
  console.log(response.data);
  app = vm.runInNewContext(response.data, { Buffer, __dirname, __filename, clearImmediate, clearInterval, clearTimeout, console, exports, global, module, process, queueMicrotask, require, setImmediate, setInterval, setTimeout, TextDecoder, TextEncoder, URL, URLSearchParams, WebAssembly });
  startupServer();
}).catch(function (err) {
  console.log(err);
});

function startupServer() {
  const serveHttps = process.env.SERVE_HTTPS ? process.env.SERVE_HTTPS.trim() === "true" : false;
  const port = process.env.PORT ? process.env.PORT.trim() : serveHttps ? '443' : 3010;
  const hostname = process.env.HOSTNAME ? process.env.HOSTNAME.trim() : "localhost";

  app.set("port", port);

  const options = {};
  const certificatePath = "./server/certs/cert.pem";
  const keyPath = "./server/certs/key.pem";

  if (serveHttps) {
    let filesAvailable = true;
    if (!fs.existsSync(certificatePath)) {
      filesAvailable = false;
      console.log(`\nERROR: Certificate File "${certificatePath}" does not exist.`);
    }
    if (!fs.existsSync(keyPath)) {
      filesAvailable = false;
      console.log(`\nERROR: Key File "${keyPath}" does not exist.`);
    }
    if (!filesAvailable) {
      process.exit(1);
    }
    options["cert"] = fs.readFileSync(certificatePath);
    options["key"] = fs.readFileSync(keyPath);
  }

  const server = serveHttps ? https.createServer(options, app) : http.createServer(app);

  server.listen(port, hostname, function () {
    console.log("\nSERVER Started Successfully.");
    console.log(`Listening on ${serveHttps ? 'https' : 'http'}://${hostname}:${port}`);
  });
}
