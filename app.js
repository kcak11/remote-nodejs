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
