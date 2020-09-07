const fs = require("fs");
const express = require('express');
const querystring = require('querystring');
const path = require('path');
const https = require('https');
const cors = require('cors');
const axios = require('axios');
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
const clientID = process.env.CLIENT_ID || "5f0ac4dd-9f6e-4d6a-bd89-6a4075070e1a";
const clientSecret = process.env.CLIENT_SECRET || "299d9c4c-23d2-4f00-bbb1-34920900b832";
const allowedOrigin = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.trim() : '';

let properEnvSet = true;

function checkEnvironmentVariable(variableName, variableValue) {
  if (!variableValue) {
    console.log(`ERROR: Missing environment variable ${variableName}`);
    properEnvSet = false;
  }
}

checkEnvironmentVariable("SSP_HOST", sspHost);
if (!isDevelopment) {
  checkEnvironmentVariable("AZ_SVC", azSvc);
}
checkEnvironmentVariable("CLIENT_ID", clientID);
checkEnvironmentVariable("CLIENT_SECRET", clientSecret);

if (!properEnvSet) {
  console.log('\nPlease refer the project\'s README.md file for instructions on setting the required Environment Variables.');
  process.exit(1);
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

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const basePath = "/adminconsole";
const staticPath = path.join(__dirname, "/server/adminconsole");

app.get(`${basePath}/health/liveness`, (req, res) => {
  res.sendStatus(200);
});

app.get(`${basePath}/health/readiness`, (req, res) => {
  res.sendStatus(200);
});

function getUrls(req, res) {
  let respData = {};
  respData["debugging_mode"] = "true";
  respData["apiUrl"] = "https://" + sspHost.trim() + "/default/";
  respData["authorizeUrl"] = "https://" + sspHost.trim() + "/default/oauth2/v1/authorize?scope=openid%20urn:iam:myscopes%20profile&client_id=" + clientID + "&response_type=code&X-CLIENT-TENANT-NAME=system";
  res.status(200);
  res.json(respData);
}
app.get(`${basePath}/urls`, getUrls);
app.get(`/default/ui/v1${basePath}/urls`, getUrls);

function getToken(req, res) {
  let referrer = req.header("referer") || "";
  if (!isDevelopment && !referrer.startsWith(`https://${sspHost.trim()}`)) {
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
      "scope": "urn:iam:myscopes",
      "code": req.body.code,
      "code_verifier": req.body.code_verifier
    };
  }

  let port = sspPort ? ":" + sspPort : "";
  let url;
  if (isDevelopment) {
    url = `https://${sspHost.trim()}${port.trim()}/default/`;
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

  requestConfig.headers["X-Tenant-name"] = "default";
  requestConfig.headers["x-client-tenant-name"] = "system";

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
/* tag:99t8s98wfj3op8tye93okj3o883hf */
