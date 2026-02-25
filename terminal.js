// JS
const outputDiv = document.getElementById('output');
const inputElement = document.getElementById('command-input');
const terminalDiv = document.getElementById('terminal');
const promptDisplay = document.getElementById('prompt-display');

let currentPath = '/home/user';
let history = []; 
let historyIndex = -1; 

// **************** FILE SYSTEM ****************
const fileSystem = {
    '/home/user': {'README.txt': 'Hello! This is simulated wsl terminal.', 'projects': {}, 'documents': {}, 'old_name.txt': 'This file move with mv.'},
    '/home/user/projects': {'web_terminal.js': '// This is just simulated file.', 'old_project': {}},
    '/home/user/projects/old_project': { 'carljung.txt': 'No tree, it is said, can grow to heaven unless its roots reach down to hell.'},
    '/home/user/documents': {'notes.txt': 'Important! Drink water'},
    '/': { 'home': {} }
};
const availableCommands = [
    'help', 'echo', 'pwd', 'ls', 'cd', 'cat', 'touch', 'mkdir', 'rm', 'mv', 'cp', 
    'whoami', 'date', 'creator', 'sudo', 'apt-get', 'clear'
];
// ****************************************************

// **************** APT SIMULATION DATAS ****************
const aptSimData = {
    update: ["Hit:1 http://archive.ubuntu.com/ubuntu focal InRelease", "Get:2 http://archive.ubuntu.com/ubuntu focal-updates InRelease [114 kB]", "Reading package lists... Done", "All packages up to date."],
    upgrade: ["Reading package lists... Done", "Building dependency tree", "2 upgraded, 0 newly installed.", "Do you want to continue? [Y/n] Y", "Fetched 1,234 kB in 1s", "Successfully upgraded 2 packages."]
};
// ******************************************************

// ----------------------------------------------------
// 1. FUNCTIONS
// ----------------------------------------------------

// Çıktı ve Prompt Fonksiyonları
const print = (text, isPrompt = false) => {
    outputDiv.innerHTML += `<div>${text.replace(/\n/g, '<br>')}</div>`;
    terminalDiv.scrollTop = terminalDiv.scrollHeight;
};
const updatePrompt = () => { promptDisplay.textContent = `user@web-sim:${currentPath}$ `; };
const getCurrentDirContent = () => fileSystem[currentPath] || fileSystem['/'];

/** Path çözümlemesini basitleştirir ve tek bir yere toplar */
const resolvePath = (target) => {
    if (target.startsWith('/')) target = target.substring(1);
    
    let pathParts = currentPath.split('/').filter(p => p.length > 0);
    let targetParts = target.split('/').filter(p => p.length > 0);

    for (const part of targetParts) {
        if (part === '..') {
            if (pathParts.length > 0) pathParts.pop();
        } else if (part !== '.') {
            pathParts.push(part);
        }
    }
    return '/' + pathParts.join('/');
};

/** mv/cp mantığını tek bir fonksiyon altında toplar */
const copyItem = (source, target, isMove) => {
    const currentContent = getCurrentDirContent();
    const sourceItem = currentContent[source];
    
    if (!sourceItem) return `<span class="error-message">${isMove ? 'mv' : 'cp'}: cannot stat '${source}': No such file or directory</span>`;

    let targetDirContent = currentContent;
    let newName = target;
    
    const targetIsDir = (currentContent[target] && typeof currentContent[target] === 'object') || 
                        (fileSystem[resolvePath(target)] && typeof fileSystem[resolvePath(target)] === 'object');
    
    if (targetIsDir) {
        // Hedef dizinse, içeri taşı/kopyala
        const resolvedPath = resolvePath(target);
        targetDirContent = fileSystem[resolvedPath];
        newName = source;
    } else {
        // Hedef dosya adı/yeni dizin adı ise
        newName = target;
    }

    if (typeof sourceItem === 'string') {
        targetDirContent[newName] = sourceItem;
    } else if (typeof sourceItem === 'object') {
        if (!isMove) return `<span class="error-message">cp: -r not supported for directory copy simulation: ${source}</span>`;
        
        // Dizin taşıma (Referans taşıma)
        const oldPath = resolvePath(source);
        const newPath = resolvePath(target);
        targetDirContent[newName] = sourceItem;
        fileSystem[newPath] = fileSystem[oldPath];

        // Taşıma işleminden sonra eski referansı sil
        if (isMove) delete currentContent[source];
    }

    if (isMove && source !== target) {
        delete currentContent[source];
    }
    return '';
};


/** APT komutlarının çıktısını satır satır simüle eder (Asenkron) */
const simulateAptOutput = (action) => {
    const lines = aptSimData[action];
    let lineIndex = 0;

    const displayNextLine = () => {
        if (lineIndex < lines.length) {
            print(lines[lineIndex++], true); 
            setTimeout(displayNextLine, 50); 
        } else {
            updatePrompt();
            inputElement.focus();
        }
    };
    print(""); // Başlangıçta boş satır
    displayNextLine();
};


// ----------------------------------------------------
// 2. TAB BUTTON
// ----------------------------------------------------

const getCompletions = (partialCommand) => {
    const parts = partialCommand.split(/\s+/);
    const partial = parts[parts.length - 1];
    
    if (parts.length <= 1) {
        return availableCommands.filter(cmd => cmd.startsWith(partial));
    } else {
        return Object.keys(getCurrentDirContent()).filter(name => name.startsWith(partial));
    }
};

// ----------------------------------------------------
// 3. COMMAND HANDLER
// ----------------------------------------------------
function handleCommand(command) {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
        print(`<span style="color:var(--color-prompt);">user@web-sim:${currentPath}$</span>`, true);
        updatePrompt();
        return;
    }
    
    history.push(trimmedCommand);
    historyIndex = history.length;

    if (trimmedCommand === 'clear') {
        outputDiv.innerHTML = '';
        updatePrompt();
        return;
    }

    print(`<span style="color:var(--color-prompt);">user@web-sim:${currentPath}$</span> ${trimmedCommand}`, true);

    const parts = trimmedCommand.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    let result = '';
    let aptHandled = false;

    // Özel Komutlar: sudo/apt-get
    if (cmd === 'sudo' || cmd === 'apt-get') {
        const fullCommand = cmd === 'sudo' ? args.join(' ') : trimmedCommand;
        const aptParts = fullCommand.split(/\s+/);
        const aptCmd = aptParts[0];
        const aptAction = aptParts[1];
        
        if (aptCmd === 'apt-get') {
            if (aptAction === 'update' || aptAction === 'upgrade') {
                simulateAptOutput(aptAction);
                aptHandled = true;
            } else if (!aptAction) {
                result = `<span class="error-message">apt-get: Try 'apt-get update/upgrade' for more information.</span>`;
            } else {
                result = `<span class="error-error">apt-get: unrecognized command '${aptAction}'</span>`;
            }
        } else {
            result = `<span class="error-message">sudo: ${aptParts[0]}: command not found</span>`;
        }
    }
    
    if (aptHandled) return;

    // Diğer Standart Komutlar
    switch (cmd) {
        case 'help':
            result = `UPDATED COMMAND LIST\n\n\thelp - Shows this list.\n\techo [text] - Return text.\n\tpwd - Shows current directory.\n\tls - List contents.\n\tcd [dir] - Directory change simulation.\n\tcat [file] - Shows file content.\n\ttouch [file] - Create file.\n\tmkdir [dir] - Create directory.\n\trm [item] - Remove file or empty directory.\n\tmv [src] [tgt] - Rename/move.\n\tcp [src] [tgt] - Copy file's content.\n\twhoami - Shows username.\n\tdate - Shows current clock and date.\n\tcreator - Shows the creator.\n\tsudo/apt-get - Simulated package manager.\n\tclear - Clears the screen.`;
            break;
        case 'pwd': result = currentPath; break;
        case 'echo': result = args.join(' '); break;
        case 'ls':
            const content = getCurrentDirContent();
            result = Object.keys(content).map(name => {
                const isDir = typeof content[name] === 'object';
                return `<span class="${isDir ? 'ls-dir' : 'ls-file'}">${name}</span>`;
            }).join('    ');
            break;
        case 'cd':
            const target = args[0] || '/home/user';
            const resolved = resolvePath(target);
            if (fileSystem[resolved] !== undefined && typeof fileSystem[resolved] === 'object') {
                currentPath = resolved;
            } else {
                result = `<span class="error-message">bash: cd: ${target}: No such file or directory in simulation.</span>`;
            }
            break;
        case 'cat':
            const catFile = args[0];
            const contentCat = getCurrentDirContent()[catFile];
            if (!catFile) result = `<span class="error-message">cat: missing file operand</span>`;
            else if (typeof contentCat === 'string') result = contentCat;
            else result = `<span class="error-message">cat: ${catFile}: No such file or file is a directory in simulation.</span>`;
            break;
        case 'touch':
            const fileName = args[0];
            if (!fileName) result = `<span class="error-message">touch: missing file operand</span>`;
            else { getCurrentDirContent()[fileName] = ''; result = `File '${fileName}' created (simulated).`; }
            break;
        case 'mkdir':
            const dirName = args[0];
            if (!dirName) result = `<span class="error-message">mkdir: missing operand</span>`;
            else if (getCurrentDirContent()[dirName]) result = `<span class="error-message">mkdir: cannot create directory '${dirName}': File exists</span>`;
            else { const newDirPath = resolvePath(dirName); getCurrentDirContent()[dirName] = {}; fileSystem[newDirPath] = getCurrentDirContent()[dirName]; result = `Directory '${dirName}' created (simulated).`; }
            break;
        case 'rm':
            const targetToRemove = args[0];
            const currentContent = getCurrentDirContent();
            if (!targetToRemove) result = `<span class="error-message">rm: missing operand</span>`;
            else if (!currentContent[targetToRemove]) result = `<span class="error-message">rm: cannot remove '${targetToRemove}': No such file or directory</span>`;
            else if (typeof currentContent[targetToRemove] === 'object' && Object.keys(currentContent[targetToRemove]).length > 0) result = `<span class="error-message">rm: cannot remove '${targetToRemove}': Directory not empty (use -r for simulation)</span>`;
            else { delete currentContent[targetToRemove]; delete fileSystem[resolvePath(targetToRemove)]; result = `Removed '${targetToRemove}' (simulated).`; }
            break;
        case 'mv':
        case 'cp':
            if (args.length !== 2) result = `<span class="error-message">${cmd}: missing file operand. Usage: ${cmd} [source] [target]</span>`;
            else {
                result = copyItem(args[0], args[1], (cmd === 'mv'));
                if (result === '') result = `${(cmd === 'mv') ? 'Moved' : 'Copied'} '${args[0]}' to '${args[1]}'.`;
            }
            break;
        case 'whoami': result = 'web-sim-user'; break;
        case 'date': result = new Date().toLocaleString(); break;
        case 'creator': result = "Arda Aktan"; break;
        default: result = `<span class="error-message">bash: ${cmd}: command not found</span>`; break;
    }

    if (result) print(result);
    updatePrompt();
}


// ----------------------------------------------------
// 4. EVENTLISTENERS
// ----------------------------------------------------
inputElement.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        handleCommand(inputElement.value);
        inputElement.value = '';
        inputElement.focus();
    } else if (e.key === 'Tab') {
        e.preventDefault();
        const partialCommand = inputElement.value;
        const completions = getCompletions(partialCommand);
        
        if (completions.length === 1) {
            const parts = partialCommand.split(/\s+/);
            parts[parts.length - 1] = completions[0];
            let finalValue = parts.join(' ');
            
            const targetPath = resolvePath(completions[0]);
            if (fileSystem[targetPath] && typeof fileSystem[targetPath] === 'object' && !finalValue.endsWith('/')) {
                finalValue += '/';
            } else {
                finalValue += ' ';
            }
            inputElement.value = finalValue;
            
        } else if (completions.length > 1) {
            print(`<span style="color:var(--color-prompt);">user@web-sim:${currentPath}$</span> ${partialCommand}`, true);
            print(completions.join('    '));
            updatePrompt();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) inputElement.value = history[--historyIndex];
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < history.length - 1) inputElement.value = history[++historyIndex];
        else if (historyIndex === history.length - 1) { historyIndex = history.length; inputElement.value = ''; }
    }
});

// Sayfa yüklendiğinde başlatma
window.onload = () => {
    print("<span style='color:#ffffff; font-weight:bold;'>WEB TERMINAL WSL</span>", true);
    print("------------------------------------------------------------------", true);
    print("Write 'help' to get started!", true);
    print("------------------------------------------------------------------", true);
    updatePrompt();
    inputElement.focus();

};

