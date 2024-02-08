var mainWindow = false

const send = (title, data, mainWindow1) => {
 
    if (mainWindow1) {
        mainWindow = mainWindow1
    }
    mainWindow.webContents.send(title, data);
}

module.exports = {
    send
}