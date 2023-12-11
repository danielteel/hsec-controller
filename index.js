
const { exec, execSync } = require('node:child_process');
const process = require('node:process');
const download = require('github-directory-downloader');
const { mkdirSync, cpSync, rmSync } = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');
const app = require('express')();
const port = 4002;
require('dotenv').config({ path: 'env.env' });

let backendProcess = null;

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
    back: {
        dir: false,
        downloaded: false,
        installed: false,
        messages: [],
        running: false,
        maxMessages: 10
    }
};

app.post('/backend/:secret', (req, res) => {
    if (req.params.secret === process.env.GITPUSH_SECRET) {
        doBackend();
        updateScreen('webhook', 'messages', chalk.green('BACKEND PUSH PASSED'));
    }else{
        updateScreen('webhook', 'messages', chalk.red('BACKEND PUSH BADSECRET'));
    }
    res.sendStatus(200);
})
app.post('/frontend/:secret', (req, res) => {
    if (req.params.secret === process.env.GITPUSH_SECRET) {
        doFrontend();
        updateScreen('webhook', 'messages', chalk.green('FRONTEND PUSH PASSED'));
    }else{
        updateScreen('webhook', 'messages', chalk.red('FRONTEND PUSH BADSECRET'));
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
    console.log(status.webhook.active ? chalk.green('X') : chalk.yellow('.'), chalk.white('ACTIVE'));
    console.log(chalk.yellow('MESSAGES'));
    for (let m of status.webhook.messages) {
        console.log('\t', m.trim());
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
        console.log('\t', m.trim());
    }
}

doFrontend();
doBackend();


//Get front end
function doFrontend() {
    updateScreen('front', 'downloaded', false);

    try {
        mkdirSync('./front');
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.log(e);
            process.exit(-1);
        }
    }

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

    download('https://github.com/danielteel/hsec/tree/main/build', './front', { requests: 1, muteLog: true }).then((stats) => {
        try {
            cpSync('./front/', '/mnt/ramdisk/static/', { recursive: true });
        } catch (e) {
            console.log(e);
            process.exit(-1);
        }
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
        backendProcess.kill();

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

    backendProcess = exec('node index', { cwd: path.join(__dirname, 'back', 'hsec-api'), env: { ...process.env } });

    updateScreen('back', 'running', true);

    backendProcess.on('exit', (code) => {
        updateScreen('back', 'running', false);
        backendProcess = null;
    });
    backendProcess.stderr.on('data', (d) => {
        updateScreen('back', 'messages', d);
    });
    backendProcess.stdout.on('data', (d) => {
        updateScreen('back', 'messages', d);
    });
}