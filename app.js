const fs = require("fs");
const express = require('express');
const querystring = require('querystring');
const path = require('path');
const https = require('https');
const cors = require('cors');
const axios = require('axios');
const myapp = express();

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
const staticPath = path.join(__dirname, "/adminconsole");

app.get(`${basePath}/health/liveness`, (req, res) => {
  res.sendStatus(200);
});
