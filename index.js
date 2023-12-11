
const {exec, execSync} = require('node:child_process');
const dotenv = require('dotenv');
dotenv.config({ path: 'env.env' });

const download = require('github-directory-downloader');
const { mkdirSync }=require('node:fs');
const path = require('node:path');
const process = require('node:process');

let backendProcess=null;

Reset = "\x1b[0m"
Bright = "\x1b[1m"
Dim = "\x1b[2m"
Underscore = "\x1b[4m"
Blink = "\x1b[5m"
Reverse = "\x1b[7m"
Hidden = "\x1b[8m"

FgBlack = "\x1b[30m"
FgRed = "\x1b[31m"
FgGreen = "\x1b[32m"
FgYellow = "\x1b[33m"
FgBlue = "\x1b[34m"
FgMagenta = "\x1b[35m"
FgCyan = "\x1b[36m"
FgWhite = "\x1b[37m"
FgGray = "\x1b[90m"

BgBlack = "\x1b[40m"
BgRed = "\x1b[41m"
BgGreen = "\x1b[42m"
BgYellow = "\x1b[43m"
BgBlue = "\x1b[44m"
BgMagenta = "\x1b[45m"
BgCyan = "\x1b[46m"
BgWhite = "\x1b[47m"
BgGray = "\x1b[100m"

doFrontend();
doBackend();


//Get front end
function doFrontend(){
    try {
        mkdirSync('./front');
    }catch (e){
        if (e.code!=='EEXIST'){
            console.log(e);
        }
    }
    download('https://github.com/danielteel/hsec/tree/main/build', './front', {requests: 1, muteLog: true}).then( (stats) => {
        console.log(FgMagenta,'FRONTEND FETCHED =', stats.success);
    }).catch(e=>{
        console.log(e);
        process.exit(-1);
    })
}


//Get back end
function doBackend(){
    if (backendProcess){
        backendProcess.kill();
    }
    try {
        mkdirSync('./back');
    }catch (e){
        if (e.code!=='EEXIST'){
            console.log(e);
            process.exit(-1);
        }
    }
    try{
        execSync('git clone https://github.com/danielteel/hsec-api', {stdio: 'inherit', cwd: path.join(__dirname, 'back') });
    }catch{}
    try{
        execSync('git pull', {stdio: 'inherit', cwd: path.join(__dirname, 'back', 'hsec-api') });
    }catch{}
    try {
        execSync('npm install', {stdio: 'inherit', cwd: path.join(__dirname, 'back', 'hsec-api') });
    }catch{}

    backendProcess = exec('node index', {cwd: path.join(__dirname, 'back', 'hsec-api'), env: {...process.env}});
    console.log(FgMagenta, 'API PROCESS STARTED');
    backendProcess.on('exit', (code)=>{
        backendProcess=null;
        console.log(FgMagenta, 'API PROCESS EXIT');
    });
    backendProcess.stderr.on('data', (d)=>{
        console.log(FgRed, 'API STDERR', Reset , d);
    });
    backendProcess.stdout.on('data', (d)=>{
        console.log(FgGreen, 'API STDOUT:', Reset , d);
    });
}