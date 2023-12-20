
const { execSync, spawn } = require('node:child_process');
const process = require('node:process');
const download = require('github-directory-downloader');
const { mkdirSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');
const app = require('express')();
const port = 4002;
require('dotenv').config({ path: 'env.env' });

let backendProcess = null;

let status = {
    ffmpeg:{
        dir: false,
        active: false
    },
    webhook: {
        active: false,
        messages: [],
        maxMessages: 3
    },
    front: {
        dir: false,
        downloaded: false
    },
    back: {
        dir: false,
        downloaded: false,
        installed: false,
        messages: [],
        running: false,
        maxMessages: 10
    }
};


doCamProcess();
doFrontend();
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
    console.log(chalk.cyan('FFMPEG'));
    console.log(status.ffmpeg.dir ? chalk.green('X') : chalk.yellow('.'), chalk.white('DIRECTORY'));
    console.log(status.ffmpeg.active ? chalk.green('X') : chalk.yellow('.'), chalk.white('ACTIVE'));
    console.log();
    console.log(chalk.cyan('WEBHOOK'));
    console.log(status.webhook.active ? chalk.green('X') : chalk.yellow('.'), chalk.white('ACTIVE'));
    console.log(chalk.yellow('MESSAGES'));
    for (let m of status.webhook.messages) {
        console.log('\t', String(m).trim());
    }
    console.log();
    console.log(chalk.cyan('FRONT'));
    console.log(status.front.dir ? chalk.green('X') : chalk.yellow('.'), chalk.white('DIRECTORY'));
    console.log(status.front.downloaded ? chalk.green('X') : chalk.yellow('.'), chalk.white('DOWNLOADED'));
    console.log();

    console.log(chalk.cyan('BACK'));
    console.log(status.back.dir ? chalk.green('X') : chalk.yellow('.'), chalk.white('DIRECTORY'));
    console.log(status.back.downloaded ? chalk.green('X') : chalk.yellow('.'), chalk.white('DOWNLOADED'));
    console.log(status.back.installed ? chalk.green('X') : chalk.yellow('.'), chalk.white('INSTALLED'));
    console.log(status.back.running ? chalk.green('X') : chalk.yellow('.'), chalk.white('RUNNING'));
    console.log(chalk.yellow('MESSAGES'));
    for (let m of status.back.messages) {
        console.log('\t', String(m).trim());
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


//Get back end
function doBackend() {
    status.back.installed = false;
    updateScreen('back', 'downloaded', false);

    if (backendProcess) {
        backendProcess.kill('SIGKILL');//should i use a different signal?
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

function doCamProcess(){
    function buildArgs(w, h, qual, fps, blockSeconds, fileName){
        return [
            '-s', String(w)+'x'+String(h),
            '-vf', 'format=yuv420p',
            '-r', String(fps),
            '-g', String(fps*blockSeconds),
            '-c:v', 'libx264',
            '-crf', String(qual),
            '-preset', 'veryfast',
            '-tune', 'zerolatency',
            '-hls_time', String(blockSeconds),
            '-hls_list_size', '3',
            '-hls_flags', 'delete_segments',
            '/mnt/ramdisk/cam/'+fileName
        ]
    }
    try {
        mkdirSync('/mnt/ramdisk/cam');
    }catch (e){        
        if (e.code !== 'EEXIST') {
            console.log(e);
            process.exit(-1);
        }
    }
    updateScreen('ffmpeg','dir', true);
    
    const formats = [
        {file: 'pqll.m3u8', title:'Low',  w: 320,  h: 180, qual: 21, fps: 4, block: 2},//13 kbps
        {file: 'hqll.m3u8', title:'Med', w: 640, h: 360, qual: 23, fps: 4, block: 2},//37 kbps
        {file: 'best.m3u8', title:'High', w: 1280, h: 720, qual: 25, fps: 4, block: 2},//165 kbps
    ];
    writeFileSync('/mnt/ramdisk/cam/details.json', JSON.stringify(formats));

    let outputArgs=[];
    for (const format of formats){
        outputArgs=[...outputArgs, ...buildArgs(format.w, format.h, format.qual, format.fps, format.block, format.file)]
    }
    const args = [
        '-i', '/dev/video0',
        ...outputArgs
    ]
    const child = spawn('ffmpeg', args);

    updateScreen('ffmpeg','active', true);
    
    child.on('exit', (code) => {
        updateScreen('ffmpeg','active', false);
    });
    child.stderr.on('data', (data) => null);
    child.stdout.on('data', (data) => null);
}