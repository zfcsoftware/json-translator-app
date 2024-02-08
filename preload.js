const { ipcRenderer, mainWindow, contextBridge, desktopCapturer } = require('electron')
contextBridge.exposeInMainWorld(
    "api", {
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
}
);
var gb = null

const send = (title, data) => {
    ipcRenderer.send(title, data)
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}



const serialize = (form) => {
    var data = {}
    form.querySelectorAll('*').forEach(el => {
        if (el.getAttribute('name')) {
            data[el.getAttribute('name')] = el.value
        }
    });
    return data
}

ipcRenderer.on('reload', (event, result) => {

    window.location.reload()
})
ipcRenderer.on('zfc_data', (event, result) => {
    send('zfc_get', '')
})

ipcRenderer.on('downloadjs', (event, result) => {
    var c = document.createElement('a')
    // c.href = 'file:///home/zfcsoftware/Belgeler/Belgeler/github/json-translator-app/dir/ctHYBWq9n6fHHMfrQJInUcYIv1707388878476/response/tr.json'
    c.href = result.href
    c.download = result.name
    c.click()
})
ipcRenderer.on('zfc_data_c', (event, result) => {
    document.querySelector('.z_dataset').innerHTML = ''
    result.forEach(item => {

        var c = document.createElement('div')
        c.classList = 'history-item'
        c.innerHTML = `
        <h2 class="z_head">${((item.order_name.length > 0) ? item.order_name : item.id).substring(0, 20)}</h2>

        ${item.languages.map(lang => {
            return `<div class="translate-item">
            <span class="mb" style="text-align:center">${lang.name} <br> ${lang.code}</span>
            <img src="../template/flags/${lang.code}.png" class="mb" width="30" alt="">
            <span class="material-symbols-outlined z_icon" onclick="tkdownload('${lang.code}','${lang.path}')">
             ${lang.status == true ? "download" : "pause"}
            </span>
          </div>`
        }).join('')}

        <br>

        <!--   <div class="btn-container">
          <button class="bbtn">Default Download</button>
          <button class="bbtn">All Download</button>
        </div>
        <button class="mt">Remove Order</button> -->
`
        document.querySelector('.z_dataset').appendChild(c)
    });


})

ipcRenderer.on('startcron', (event, result) => {
    document.querySelector('.counter').textContent = '0'
    document.querySelector('.menu-item.active').classList.remove('active')
    document.querySelector('[data-config="history"]').classList.add('active')
    gb.renderMenu()
})
ipcRenderer.on('configdata', (event, result) => {
    document.querySelector('.zfc_vv').value = result.while_count
    document.querySelector('.api_key').value = result.keys.join('\n')
    document.querySelector('.prompt_zfc').value = result.prompt
})


class zfc {
    constructor() {
        send('zfc_get', '')
        this.renderMenu()
        this.event()
        send('config', '')
    }
    countStringsInJson(json) {
        let count = 0;

        function traverse(element) {
            if (typeof element === 'string') {
                count++;
            } else if (Array.isArray(element)) {
                for (let i = 0; i < element.length; i++) {
                    traverse(element[i]);
                }
            } else if (typeof element === 'object' && element !== null) {
                for (let key in element) {
                    traverse(element[key]);
                }
            }
        }

        traverse(json);

        return count;
    }

    setJSONData(data) {
        this.data = data
        this.lng = this.countStringsInJson(data)
        document.querySelector('.counter').textContent = this.lng
        send('notification', `JSON Successfully read. ${this.lng} strings detected.`)
    }

    start() {
        var data = {
            languages: [...document.querySelectorAll('.language-item.selected')].map(item => { return { name: item.getAttribute('data-lang'), code: item.getAttribute('data-lang2') } }),
            data: this.data,
            model: document.querySelector('.modell').value,
            order_name: document.querySelector('.oname').value
        }
        if (!data.languages || data.languages.length === 0) {
            send('notification', 'Please select at least one language')
            return false
        }
        if (data.model === '' || data.model === undefined) {
            send('notification', 'Please enter a model name')
            return false
        }
        if (!this.data) {
            send('notification', 'Please upload a JSON file')
            return false
        }
        send('addcron', data)
    }

    saveConfig() {
        var data = {
            while_count: Number(document.querySelector('.zfc_vv').value),
            keys: document.querySelector('.api_key').value.split('\n').filter(item => (item.length > 0 && item.indexOf('sk') > -1)),
            prompt: document.querySelector('.prompt_zfc').value
        }
        send('saveconfig', data)
    }

    async event() {
        var th = this

        document.querySelector('.ram_btn_db').onclick = () => {
            send('ram_btn_db', '')
            document.querySelector('[data-config="history"]').click()
        }
        document.querySelector('.ram_btn_log').onclick = () => {
            send('ram_btn_log', '')
        }

        document.onkeyup = (e) => { th.saveConfig() }
        document.onkeydown = (e) => { th.saveConfig() }
        document.onblur = (e) => { th.saveConfig() }
        document.onfocus = (e) => { th.saveConfig() }

        document.querySelector('.start_btn').onclick = () => {
            th.start()
        }
        // send('notification', 'toast data zfc')
        document.querySelectorAll('.language-item').forEach(item => {
            item.onclick = (e) => {
                item.classList.toggle('selected')
            }
        });
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                document.querySelector('.menu-item.active').classList.remove('active')
                e.target.classList.add('active')
                this.renderMenu()
            })
        });


        document.getElementById('file-upload').addEventListener('change', handleFileSelect, false);

        async function handleFileSelect(event) {
            var file = event.target.files[0];
            if (file) {
                var reader = new FileReader();

                reader.onload = function (e) {
                    var contents = e.target.result;
                    var json = null,
                        message = ''
                    try {
                        json = JSON.parse(contents);
                    } catch (err) {
                        console.log(err)
                        message = err.message
                    }
                    if (json === null) {
                        alert(`Failed to parse JSON file:\n\n${message}`)
                        return false
                    }
                    th.setJSONData(json)
                    event.target.value = ''
                    console.log(json);
                };

                reader.readAsText(file);
            } else {
                console.log("Failed to load file");
            }
        }
        const dropArea = document.getElementById('file-drag');
        dropArea.addEventListener('dragover', (event) => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            dropArea.classList.add('dragging-over');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragging-over');
        });

        dropArea.addEventListener('drop', (event) => {
            event.stopPropagation();
            event.preventDefault();
            dropArea.classList.remove('dragging-over');
            const files = event.dataTransfer.files;
            document.getElementById('file-upload').files = files;
            handleFileSelect({ target: { files: files } });
        });


    }
    renderMenu() {
        document.querySelectorAll('.root-item').forEach(item => {
            item.classList.add('none')
        });
        var target = document.querySelector('.menu-item.active').getAttribute('data-config')
        document.querySelector(`[data-src="${target}"]`).classList.remove('none')
    }
}





window.addEventListener('DOMContentLoaded', () => {
    gb = new zfc()

    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }



})
