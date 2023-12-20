
const { execSync, spawn, exec } = require('node:child_process');
const process = require('node:process');
const download = require('github-directory-downloader');
const { mkdirSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');
const app = require('express')();
const port = 4002;
require('dotenv').config({ path: 'env.env' });

let backendProcess = null;
let ffmpegProcess=null;

let status = {
    webhook: {
        active: false,
        messages: [],
        maxMessages: 3
    },
    front: {
        dir: false,
        downloaded: false
    },
    ffmpeg:{
        dir: false,
        downloaded: false,
        installed: false,
        messages: [],
        running: false,
        maxMessages: 6
    },
    back: {
        dir: false,
        downloaded: false,
        installed: false,
        messages: [],
        running: false,
        maxMessages: 6
    }
};


doFrontend();
doFFMPEG();
doBackend();


app.post('/controller/:secret', (req, res) => {
    if (req.params.secret && req.params.secret === process.env.GITPUSH_SECRET) {
        updateScreen('webhook', 'messages', chalk.green('CONTROLLER PUSH VALID'));
        execSync('git pull');//Nodemon should restart this program after the pull
    }else{
        updateScreen('webhook', 'messages', chalk.red('CONTROLLER PUSH INVALID'));
    }
    res.sendStatus(200);
})
app.post('/backend/:secret', (req, res) => {
    if (req.params.secret && req.params.secret === process.env.GITPUSH_SECRET) {
        updateScreen('webhook', 'messages', chalk.green('BACKEND PUSH VALID'));
        doBackend();
    }else{
        updateScreen('webhook', 'messages', chalk.red('BACKEND PUSH INVALID'));
    }
    res.sendStatus(200);
})
app.post('/ffmpeg/:secret', (req, res) => {
    if (req.params.secret && req.params.secret === process.env.GITPUSH_SECRET) {
        updateScreen('webhook', 'messages', chalk.green('FFMPEG PUSH VALID'));
        doFFMPEG();
    }else{
        updateScreen('webhook', 'messages', chalk.red('FFMPEG PUSH INVALID'));
    }
    res.sendStatus(200);
})
app.post('/frontend/:secret', (req, res) => {
    if (req.params.secret && req.params.secret === process.env.GITPUSH_SECRET) {
        updateScreen('webhook', 'messages', chalk.green('FRONTEND PUSH PASSED'));
        doFrontend();
    }else{
        updateScreen('webhook', 'messages', chalk.red('FRONTEND PUSH INVALID'));
    }
    res.sendStatus(200);
})
app.listen(port, () => {
    updateScreen('webhook', 'active', true);
})

function updateScreen(which, key, val) {
    if (key === 'messages') {
        status[which].messages.push(val);
        if (status[which].messages.length > status[which].maxMessages) {
            status[which].messages.shift();
        }
    } else {
        status[which][key] = val;
    }
    console.clear();
    console.log(chalk.yellow('HSEC-CONTROLLER'));
    console.log();
    console.log(chalk.cyan('WEBHOOK'));
    console.log('\t', status.webhook.active ? chalk.green('X') : chalk.yellow('.'), chalk.white('ACTIVE'));
    console.log('\t', chalk.yellow('MESSAGES'));
    for (let m of status.webhook.messages) {
        console.log('\t\t', String(m).trim());
    }
    console.log();
    console.log(chalk.cyan('FRONT'));
    console.log('\t', status.front.dir ? chalk.green('X') : chalk.yellow('.'), chalk.white('DIRECTORY'));
    console.log('\t', status.front.downloaded ? chalk.green('X') : chalk.yellow('.'), chalk.white('DOWNLOADED'));
    console.log();

    console.log(chalk.cyan('FFMPEG'));
    console.log('\t',status.ffmpeg.dir ? chalk.green('X') : chalk.yellow('.'), chalk.white('DIRECTORY'));
    console.log('\t',status.ffmpeg.downloaded ? chalk.green('X') : chalk.yellow('.'), chalk.white('DOWNLOADED'));
    console.log('\t',status.ffmpeg.installed ? chalk.green('X') : chalk.yellow('.'), chalk.white('INSTALLED'));
    console.log('\t',status.ffmpeg.running ? chalk.green('X') : chalk.yellow('.'), chalk.white('RUNNING'));
    console.log('\t',chalk.yellow('MESSAGES'));
    for (let m of status.ffmpeg.messages) {
        console.log('\t\t', String(m).trim());
    }

    console.log(chalk.cyan('BACK'));
    console.log('\t', status.back.dir ? chalk.green('X') : chalk.yellow('.'), chalk.white('DIRECTORY'));
    console.log('\t', status.back.downloaded ? chalk.green('X') : chalk.yellow('.'), chalk.white('DOWNLOADED'));
    console.log('\t', status.back.installed ? chalk.green('X') : chalk.yellow('.'), chalk.white('INSTALLED'));
    console.log('\t', status.back.running ? chalk.green('X') : chalk.yellow('.'), chalk.white('RUNNING'));
    console.log('\t', chalk.yellow('MESSAGES'));
    for (let m of status.back.messages) {
        console.log('\t\t', String(m).trim());
    }
}

//Get front end
function doFrontend() {
    updateScreen('front', 'downloaded', false);

    try {
        rmSync('/mnt/ramdisk/static', { recursive: true, force: true });
    } catch (e) {
        console.log(e);
        process.exit(-1);
    }

    try {
        mkdirSync('/mnt/ramdisk/static');
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.log(e);
            process.exit(-1);
        }
    }

    updateScreen('front', 'dir', true);

    download('https://github.com/danielteel/hsec/tree/main/build', '/mnt/ramdisk/static', { requests: 1, muteLog: true }).then((stats) => {
        updateScreen('front', 'downloaded', true);
    }).catch(e => {
        console.log(e);
        process.exit(-1);
    })
}


//Get ffmpeg
function doFFMPEG() {
    status.ffmpeg.installed = false;
    updateScreen('ffmpeg', 'downloaded', false);

    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGTERM');//should i use a different signal?
    }
    try {
        mkdirSync('./ffmpeg');
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.log(e);
            process.exit(-1);
        }
    }

    updateScreen('ffmpeg', 'dir', true);
    try {
        execSync('git clone https://github.com/danielteel/hsec-ffmpeg', { cwd: path.join(__dirname, 'ffmpeg') });
    } catch { }
    try {
        execSync('git pull', { cwd: path.join(__dirname, 'ffmpeg', 'hsec-ffmpeg') });
    } catch { }

    updateScreen('ffmpeg', 'downloaded', true);
    try {
        execSync('npm install', { cwd: path.join(__dirname, 'ffmpeg', 'hsec-ffmpeg') });
    } catch { }
    updateScreen('ffmpeg', 'installed', true);

    ffmpegProcess = spawn('node', ['index'], { cwd: path.join(__dirname, 'ffmpeg', 'hsec-ffmpeg'), env: { ...process.env } });
    ffmpegProcess.on('exit', (code) => {
        updateScreen('ffmpeg', 'running', --status.ffmpeg.running);
    });
    ffmpegProcess.stderr.on('data', (d) => {
        updateScreen('ffmpeg', 'messages', d);
    });
    ffmpegProcess.stdout.on('data', (d) => {
        updateScreen('ffmpeg', 'messages', d);
    });
    
    setTimeout(()=>{
        updateScreen('ffmpeg', 'running', ++status.ffmpeg.running);
    },250);
}


//Get back end
function doBackend() {
    status.back.installed = false;
    updateScreen('back', 'downloaded', false);

    if (backendProcess) {
        backendProcess.kill('SIGTERM');//should i use a different signal?
    }
    try {
        mkdirSync('./back');
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.log(e);
            process.exit(-1);
        }
    }

    updateScreen('back', 'dir', true);
    try {
        execSync('git clone https://github.com/danielteel/hsec-api', { cwd: path.join(__dirname, 'back') });
    } catch { }
    try {
        execSync('git pull', { cwd: path.join(__dirname, 'back', 'hsec-api') });
    } catch { }

    updateScreen('back', 'downloaded', true);
    try {
        execSync('npm install', { cwd: path.join(__dirname, 'back', 'hsec-api') });
    } catch { }
    updateScreen('back', 'installed', true);

    backendProcess = spawn('node', ['index'], { cwd: path.join(__dirname, 'back', 'hsec-api'), env: { ...process.env } });

    backendProcess.on('exit', (code) => {
        updateScreen('back', 'running', --status.back.running);
    });
    backendProcess.stderr.on('data', (d) => {
        updateScreen('back', 'messages', d);
    });
    backendProcess.stdout.on('data', (d) => {
        updateScreen('back', 'messages', d);
    });
    
    setTimeout(()=>{
        updateScreen('back', 'running', ++status.back.running);
    },250);
}