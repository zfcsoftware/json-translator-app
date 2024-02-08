const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const msg = require('./module/export')
const ejse = require('ejs-electron')
const db = require('./module/db.js')
const dblog = require('./module/logdb.js')
const fs = require('fs')
const bg = require('./module/background.js')









function makeid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}




function createWindow() {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  bg.zfc(win)



  async function pathCreator(dirPath) {
    dirPath.split(path.sep).reduce((prevPath, folder) => {
      const currentPath = path.join(prevPath, folder, path.sep);
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath);
      }
      return currentPath;
    }, '');
  }

  win.maximize();
  win.show();

  ipcMain.on('create', (event, arg) => {
    console.log(arg);
  })

  ipcMain.on('zfc_get', async (event, arg) => {
    var response = await db.find({})
    response.sort((a, b) => {
      return new Date(b.created) - new Date(a.created);
    });
    msg.send('zfc_data_c', response, win)
  })

  ipcMain.on('ram_btn_db', async (event, arg) => {
    await db.remove({})
    msg.send('zfc_data', ``, win)
    msg.send('notification', `The entire order database has been cleared.`, win)
  })
  ipcMain.on('ram_btn_log', async (event, arg) => {
    await dblog.remove({})
    msg.send('zfc_data', ``, win)
    msg.send('notification', 'The entire translation history database has been cleaned.', win)
  })


  ipcMain.on('saveconfig', (event, arg) => {
    fs.writeFileSync(__dirname + '/config.json', JSON.stringify(arg))
  })

  ipcMain.on('download', (event, arg) => {
    msg.send('downloadjs', {
      href: `file://` + __dirname + '/' + arg.path,
      name: arg.data + '.json'
    }, win)
  })

  ipcMain.on('config', (event, arg) => {
    var all = fs.readFileSync(__dirname + '/config.json', 'utf-8')
    all = JSON.parse(all)
    msg.send('configdata', all, win)
  })

  ipcMain.on('addcron', async (event, arg) => {
    var id = makeid(25) + Date.now()
    console.log(id);
    pathCreator(__dirname + '/dir/' + id + '/' + 'response')

    var path = '/dir/' + id + '/' + 'default' + '.json'
    try {
      fs.writeFileSync(__dirname + path, JSON.stringify(arg.data))
    } catch (err) {
      fs.writeFileSync(__dirname + path, arg.data)
    }
    await db.add({
      id: id,
      path: path,
      created: Date.now(),
      status: 'Pending',
      code: 200,
      model: arg.model,
      order_name: arg.order_name,
      languages: arg.languages.map(el => {
        return {
          name: el.name,
          code: el.code,
          status: false,
          path: '/'
        }
      }),
    })
    msg.send('startcron', '', win)
    msg.send('notification', `The translation process was successfully started. You can view the progress and download the prepared JSON data from the History tab.`, win)
  })












  msg.send('zfc_data', '', win)
  msg.send('zfc', '', win)
  win.loadFile(__dirname + '/views/index.ejs')
}



















app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
