const fs = require("fs");
const express = require('express');
const querystring = require('querystring');
const path = require('path');
const https = require('https');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const app = express();

const bodyparser = require('body-parser');

/*
    Determine if we are in Development mode i.e. check presence of angular.json file.
    Note: The angular.json file will not be available in the Production build.
*/
const isDevelopment = fs.existsSync('./angular.json');

const azSvc = process.env.AZ_SVC;
const sspHost = process.env.SSP_HOST;
const sspPort = process.env.SSP_PORT || "";
let clientID = process.env.CLIENT_ID;
let clientSecret = process.env.CLIENT_SECRET;
const allowedOrigin = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.trim() : '';

let properEnvSet = true;

function checkEnvironmentVariable(variableName, variableValue) {
  if (!variableValue) {
    console.log(`ERROR: Missing environment variable ${variableName}`);
    properEnvSet = false;
  }
}

if (isDevelopment) {
  checkEnvironmentVariable("SSP_HOST", sspHost);
  checkEnvironmentVariable("CLIENT_ID", clientID);
  checkEnvironmentVariable("CLIENT_SECRET", clientSecret);
}
if (!isDevelopment) {
  checkEnvironmentVariable("AZ_SVC", azSvc);
}

if (!properEnvSet) {
  console.log('\nPlease refer the project\'s README.md file for instructions on setting the required Environment Variables.');
  process.exit(1);
}

if (!isDevelopment) {
  fs.readFile("/ui-pod-data/adminconsoleclient.json", function (err, data) {
    if (err) {
      process.exit(1);
    }
    const clientDetails = JSON.parse(data);
    clientID = clientDetails.client_id;
    clientSecret = clientDetails.client_secret;
  });
}

let portValue = sspPort ? ":" + sspPort : "";
var whitelist = [
  allowedOrigin,
  `https://${sspHost.trim()}${portValue.trim()}`,
  'http://localhost:3000',
  'http://localhost:3010',
  'http://localhost:3020',
  'http://localhost:3030',
  'http://authui.broadcom.net:4200 | https://authui.broadcom.net:4200',
  'http://authui.broadcom.net:4210 | https://authui.broadcom.net:4210',
  'http://authui.broadcom.net:4220 | https://authui.broadcom.net:4220',
  'http://authui.broadcom.net:4230 | https://authui.broadcom.net:4230'
];

if (!isDevelopment) {
  whitelist.push(`http://${azSvc.trim()}${portValue.trim()}`);
}

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.join(",").indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  allowedHeaders: "*",
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use(bodyparser.raw());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());

app.use(compression());

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const basePath = "/adminconsole";
const staticPath = path.join(__dirname, "server/adminconsole");

app.get(`${basePath}/health/liveness`, (req, res) => {
  res.sendStatus(200);
});

app.get(`${basePath}/health/readiness`, (req, res) => {
  res.sendStatus(200);
});

function getUrls(req, res) {
  let host = req.header("Host");
  if (isDevelopment) {
    host = req.header("X-SSP-HOST") || sspHost.trim();
  }
  let tenantName = req.header("X-TENANT-NAME") || "default";
  if (isDevelopment && !tenantName) {
    tenantName = "default";
  }

  let respData = {};
  respData["apiUrl"] = "https://" + host.trim() + "/" + tenantName + "/";
  respData["authorizeUrl"] = "https://" + host.trim() + "/" + tenantName + "/oauth2/v1/authorize?scope=openid%20urn:iam:myscopes%20profile&client_id=" + clientID + "&response_type=code&X-CLIENT-TENANT-NAME=system";
  res.status(200);
  res.json(respData);
}
app.get(`${basePath}/urls`, getUrls);
app.get(`/default/ui/v1${basePath}/urls`, getUrls);

function getToken(req, res) {
  let host = req.header("Host");
  if (isDevelopment) {
    host = req.header("X-SSP-HOST") || sspHost.trim();
  }
  let tenantName = req.header("X-TENANT-NAME") || "default";
  if (isDevelopment && !tenantName) {
    tenantName = "default";
  }

  let referrer = req.header("referer") || "";
  if (!isDevelopment && !referrer.startsWith(`https://${host.trim()}`)) {
    res.status(400);
    res.json({ "error": "Unauthorized Client" });
    return;
  }

  let data = {
    "grant_type": "client_credentials",
    "scope": "urn:iam:myscopes"
  }

  if (req.body.type === "code" && req.body.code) {
    data = {
      "grant_type": "authorization_code",
      "code": req.body.code,
      "code_verifier": req.body.code_verifier
    };
  }

  let port = sspPort ? ":" + sspPort : "";
  let url;
  if (isDevelopment) {
    url = `https://${host.trim()}/${tenantName}/`;
  } else {
    url = `${azSvc.trim()}/`;
  }
  let requestUrl = `${url}oauth2/v1/token`;

  const post_data = querystring.stringify(data);
  const authKey = Buffer.from(`${clientID.trim()}:${clientSecret.trim()}`).toString('base64');

  let requestConfig = {
    method: 'post',
    url: requestUrl,
    data: post_data,
    headers: {
      "Authorization": "Basic " + authKey,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    httpsAgent: httpsAgent
  };

  if (req.body && req.body.type === "code") {
    /**
     * This header is needed only when we use the AdminConsole clientID & clientSecret for addressing the cross-tenancy issues.
     * It is not needed when using the SystemConsole clientID & clientSecret
     */
    requestConfig.headers["x-client-tenant-name"] = "system";
  }

  requestConfig.headers["X-TENANT-NAME"] = tenantName;
  requestConfig.headers["x-client-tenant-name"] = "system";
  requestConfig.headers["X-Forwarded-Proto"] = "https";
  requestConfig.headers["X-Forwarded-Port"] = "443";
  requestConfig.headers["Host"] = host;

  axios(requestConfig).then(function (response) {
    res.status(response.status || 200);
    res.json(response.data);
  }).catch(function (err) {
    res.status(err.status || 500);
    res.end("An error occured");
    console.log(err);
  });
}

app.get(`${basePath}/token`, getToken);
app.post(`${basePath}/token`, getToken);

app.get(`/default/ui/v1${basePath}/token`, getToken);
app.post(`/default/ui/v1${basePath}/token`, getToken);

app.use(`${basePath}`, express.static(staticPath, { index: "index.html" }));
app.use(`${basePath}/*`, express.static(staticPath, { index: "index.html" }));

module.exports = app;

/* Tag:rBdVfLl0hrGJscxeR5XDCQ3Koj725DaD0sALTeA8hNnSVFJ81UGl6Em3M2akTXYHOybHQPjivSZqW4ioU9tFIpWMYwwtKdqu9EZIgmzb6zkNP4n1OfcMh7uvlLgyK2R1BCRtTwxyp7DwLnc4PQdjZNiVYJPeegsaHOJqyCWz0noajWqUkNrXpmARFg0A86VQBr1bU3hBusG6uSvKkxOpI3mzG2fdSTZ5cHY99otv7EfI4liExbFCX5M8 */
