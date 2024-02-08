const db = require('./db.js')
const fs = require('fs')
var axios = require('axios')
var clc = require("cli-color")
const logdb = require('./logdb.js')
const ex = require('./export.js')
axios.defaults.timeout = 180000
var wn = null
class qr {
    constructor() {
        this.active_index = 0
        this.init()
    }
    async init() {
        await this.clearStatus()
        console.log(clc.green('DB Sıfırlandı.'));
        this.cron()
    }

    async sleep(ms) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(true)
            }, ms);
        })
    }
    loadConfig() {
        var config = fs.readFileSync(`${__dirname}/../config.json`, 'utf8')
        try {
            config = JSON.parse(config)
        } catch (err) {
            console.log(clc.red('Config dosyası okunamadı'))
        }
        return config
    }
  
    APIKey() {
        var config = this.loadConfig()
        var active_item = config.keys[this.active_index]
        if (!active_item) {
            this.active_index = 0
            active_item = config.keys[this.active_index]
        }
        this.active_index++
        return active_item
    }

    clearStatus = async () => {
        try {
            await db.update({ code: 201 }, { code: 200 })
        } catch (err) { }
        return true
    }

    getWaitItem = () => {
        return new Promise(async (resolve, reject) => {
            var item = await db.findOne({ code: 200 })
            while (item === false) {
                await this.sleep(3000)
                item = await db.findOne({ code: 200 })
            }

            resolve(item)
        })
    }

    loadTranslateItem = (path) => {
        return new Promise((resolve, reject) => {
            var item = fs.readFileSync(`${__dirname}/../${path}`, 'utf8')
            try {
                item = JSON.parse(item)
            } catch (err) {
                console.log(clc.red('Json parse hatası'));
            }
            this.gb_data = item
            resolve(item)
        })
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

    getAllStrings(json) {
        let result = [];

        function traverse(element) {
            if (typeof element === 'string') {
                result.push(element);
            } else if (Array.isArray(element)) {
                for (let item of element) {
                    traverse(item);
                }
            } else if (typeof element === 'object' && element !== null) {
                for (let key in element) {
                    traverse(element[key]);
                }
            }
        }

        traverse(json);

        return result;
    }

    findAndParseJSON(input) {
        const jsonStartIndex = input.indexOf('{');
        const jsonEndIndex = input.lastIndexOf('}');
        if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonStartIndex >= jsonEndIndex) {
            return null;
        }
        try {
            const jsonString = input.substring(jsonStartIndex, jsonEndIndex + 1);
            const jsonObject = JSON.parse(jsonString);
            return jsonObject;
        } catch (error) {
            return false;
        }
    }


    question({ language = 'English', text = 'null', model = 'gpt-3.5-turbo-16k-0613' }) {
        var ts = this
        return new Promise(async (resolve, reject) => {
            try {
                console.log(clc.green('Chatgpt sorgusu başladı...'));

                var history_check = await logdb.findOne({ text: text, language: language })

                if (history_check && history_check.translation && history_check.translation.length > 0) {
                    console.log(clc.green('+ Chatgpt sorgusu daha önce yapıldı.'));
                    resolve({
                        response: history_check.translation,
                        text: text,
                    })
                    return true
                }

                var config = this.loadConfig()
                var prompt = config.prompt
                prompt = prompt.replace('{{language}}', language)
                prompt = prompt.replace('{{text}}', text)
                var key = this.APIKey()

                var response = await axios.post(`https://api.openai.com/v1/chat/completions`, {
                    model: model,
                    messages: [
                        { role: 'system', content: prompt },
                    ],
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`,
                    },
                })
                    .then(response => {
                        var data = response.data
                        if (data && data.choices.length > 0 && String(data.choices[0].message.content).length > 0) {
                            return {
                                text: data.choices[0].message.content,
                                data: data
                            }
                        } else {
                            return false
                        }
                    })
                    .catch(error => {
                        console.log(clc.red('Chatgpt sorgusu hata aldı. | ' + error.message));
                        return false
                    })
                if (response === false) {
                    await ts.sleep(2000)
                    response = await this.question({ language: language, text: text, model: model })
                }
                console.log(clc.green('Chatgpt sorgusu tamamlandı.'));
                var parse = this.findAndParseJSON(response.text)
                if (!(parse && parse !== false && parse.status == true)) {
                    console.log(clc.red(`Response JSON a çevrilemedi.`));
                    await ts.sleep(2000)
                    parse = await this.question({ language: language, text: text, model: model })
                }
                parse = parse.data
                resolve({
                    response: parse,
                    text: text,
                })
            } catch (error) {
                console.log(error);
                await ts.sleep(2000)
                console.log(clc.red('Chatgpt sorgusu genel hata aldı. | ' + error.message));
                var response = await this.question({ language: language, text: text, model: model })
                resolve(response)
            }
        })
    }

    replaceStrings(json, array) {
        var copy = JSON.parse(JSON.stringify(json));

        function traverse(element) {
            if (typeof element === 'string') {
                for (let item of array) {
                    if (item.text === element) {
                        return item.translation;
                    }
                }
            } else if (Array.isArray(element)) {
                for (let i = 0; i < element.length; i++) {
                    element[i] = traverse(element[i]);
                }
            } else if (typeof element === 'object' && element !== null) {
                for (let key in element) {
                    element[key] = traverse(element[key]);
                }
            }
            return element;
        }

        return traverse(copy);
    }

    languageTranslate = ({ item, language, data, all_string }) => {
        return new Promise(async (resolve, reject) => {
            var while_count = 0
            var response = []
            var active_index = 0
            var config = this.loadConfig()
            var ts = this
            while (response.length < all_string.length) {
                while (while_count >= config.while_count) {
                    await ts.sleep(2000)
                }
                
                while_count++

                var active_item = all_string[active_index]
                if (!active_item || active_item.length < 1) {
                    while (response.length < all_string.length) {
                        await ts.sleep(2000)
                    }
               
                    resolve({
                        language: language,
                        response: ts.replaceStrings(data, response)
                    })
                    return true
                }
                active_index++
                this.question({ language: language.name, text: active_item, model: item.model })
                    .then(async resp => {
                        while_count--
                        var data = {
                            text: resp.text,
                            translation: resp.response,
                            language: language.name
                        }
                        var history_check = await logdb.findOne({ text: active_item, language: language.name })
                        if (history_check === false) {
                            await logdb.add(data)
                        }
                        response.push(data)
                    })
                    .catch(error => {
                        console.log(error);
                        while_count--
                        var data = {
                            text: active_item,
                            translation: 'null',
                            language: language.name
                        }
                        response.push(data)
                    })
            }
            
            resolve({
                language: language,
                response: ts.replaceStrings(data, response)
            })

        })
    }

    updateData({ data, language, arg }) {
        return new Promise(async (resolve, reject) => {
            var f_path = `dir/${arg.id}/response/${language.code}.json`
            fs.writeFileSync(`${__dirname}/../` + f_path, JSON.stringify(data))
            var item = await db.findOne({ _id: arg._id })
            var ch = item.languages.findIndex(x => x.code == language.code)
            item.languages[ch].status = true
            item.languages[ch].path = f_path
            await db.update({ _id: arg._id }, item)
            resolve(true)
        })
    }

    translate(item, data) {
        return new Promise(async (resolve, reject) => {
            console.log(clc.green('Çeviri işlemi başlatıldı.'));
            var languages_data = []
            this.all_string = this.getAllStrings(data)
            for (var language of item.languages) {
                console.log(clc.green(`${language.name} diline çeviri işlemi başlatıldı.`));
                var response = await this.languageTranslate({
                    item: item,
                    language: language,
                    data: data,
                    all_string: this.all_string
                })
                languages_data.push(response)
                console.log(clc.green(`${language.name} diline çeviri işlemi tamamlandı.`));

                await this.updateData({
                    data: response.response,
                    language: language,
                    arg: item
                })
                ex.send('zfc_data', '',wn)
            }

            await db.update({ _id: item._id }, { code: 202 })
            ex.send('zfc_data', '',wn)
            console.log(clc.green('Çeviri işlemi tamamlandı.'));
            resolve(true)
        })
    }

    async cron() {
        console.log(clc.green('cron başladı'));
        var item = await this.getWaitItem()
        console.log(clc.green(`${item._id} işlemi başlatıldı.`));
        var data = await this.loadTranslateItem(item.path)
        console.log(clc.green(`${this.countStringsInJson(data)} Öğeli Json verisi yüklendi.`));
        ex.send('zfc_data', '',wn,wn)
        await this.translate(item, data)
        this.cron()
    }



}

const zfc = (win)=>{
    wn = win
    new qr()
}
module.exports={
    zfc
}