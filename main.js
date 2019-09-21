const { app, BrowserWindow, ipcMain } = require('electron');
const ProgressBar = require('electron-progressbar');
const Parser = require('./parser.js');
const Scraper = require('./scraper.js');

let mainWindow;
let scraper = new Scraper();
let parser = new Parser();

function createWindow() {
	mainWindow = new BrowserWindow({ width: 1000, height: 700, webPreferences: { nodeIntegration: true } });
	mainWindow.loadURL(`file://${__dirname}/index.html`);
	mainWindow.on('closed', () => {
		mainWindow = null;
	});
	mainWindow.webContents.on('did-finish-load', () => {
		mainWindow.webContents.send('did-finish-load');
	});
}

function handleSubmission() {
	ipcMain.on('did-submit-form-get-amendments', (event, args) => {
		let progressBar = new ProgressBar({
			title: 'Récupération des données disponibles...',
			text: 'Récupération des données disponibles...',
			detail: 'En cours...'
		});

		progressBar.on('completed', () => { progressBar = null });

		scraper.getAmendments(args)
			.then(data => {
				event.sender.send('processing-did-succeed', data);
			})
			.catch(err => {
				console.log('ERROR: main.js#retrieveXMLVotes - Error while retrieving xml votes:', err);
				event.sender.send('processing-did-fail', err);
			})
			.finally(() => {
				progressBar.setCompleted();
			})
	});

	ipcMain.on('did-submit-form-get-votes', (event, amendments, args) => {
		let downloadsFolder = app.getPath('downloads');

		let progressBar = new ProgressBar({ title: "Génération du fichier d'export...", text: "Génération du fichier d'export...", detail: 'En cours...' });
		progressBar.on('completed', () => { progressBar = null });

		scraper.getVotes(Object.assign({ amendmentIds: amendments.map(a => a.id) }, args))
			.then(results => parser.exportXLSX(results, downloadsFolder))
			.then(xlsx => {
				event.sender.send('get-amendments-did-succeed', xlsx);
			})
			.catch(err => {
				console.log('ERROR: main.js#did-submit-form-get-votes - Error while exp:', err);
				event.sender.send('processing-did-fail', err);
			})
			.finally(() => {
				progressBar.setCompleted();
			})
	});
}

app.on('ready', () => {
	createWindow();
	handleSubmission();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (mainWindow === null) {
		createWindow();
	}
});
