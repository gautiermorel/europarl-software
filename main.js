const { app, BrowserWindow, ipcMain } = require('electron');
const ProgressBar = require('electron-progressbar');
const Parser = require('./parser.js');

let mainWindow;
let parser = new Parser();

function createWindow() {
	mainWindow = new BrowserWindow({ width: 1000, height: 700 });
	mainWindow.loadURL(`file://${__dirname}/index.html`);
	mainWindow.on('closed', () => {
		mainWindow = null;
	});
	mainWindow.webContents.on('did-finish-load', () => {
		mainWindow.webContents.send('did-finish-load');
	});
}

function handleSubmission() {
	ipcMain.on('did-submit-form', (event, argument) => {
		const { source } = argument;

		let progressBar = new ProgressBar({ text: 'Preparing data...', detail: 'Wait...' });

		parser.readFile(source)
			.then(pages => parser.getAmendments(pages))
			.then(res => {
				let { amendments, totalPages } = res || {};
				let amendementLength = amendments.length;
				amendments.map((a, index) => {
					if (amendementLength === index + 1) return Object.assign(a, { pageStart: parseInt(a.pageStart, 10) - 1, pageEnd: parseInt(totalPages, 10) - 1 })
					let pageEnd = amendments[index + 1].pageStart;
					return Object.assign(a, { pageStart: parseInt(a.pageStart, 10) - 1, pageEnd: parseInt(pageEnd, 10) - 1 })
				})

				progressBar.setCompleted();
				event.sender.send('processing-did-succeed', amendments);
				return true;
			})
			.catch(err => {
				progressBar.setCompleted();
				event.sender.send('processing-did-fail', err);
			})


		progressBar
			.on('completed', function () {
				progressBar.detail = 'Task completed. Exiting...';
			})
			.on('aborted', function () {
				console.info('aborted...');
			});
	});

	ipcMain.on('did-submit-form2', (event, amendments) => {
		let progressBar = new ProgressBar({ text: 'Preparing data...', detail: 'Wait...' })

		let csvName = parser.getFileName();


		let promises = [];
		for (let i = 0; i < amendments.length; i++) {
			let { name, pageStart, pageEnd } = amendments[i];
			promises.push(parser.getVotes(name, pageStart, pageEnd))
		}

		parser.createCSV(csvName)
			.then(() => Promise.all(promises))
			.then(results => {
				event.sender.send('generator-did-succeed', results);
				return parser.exportXLSX(results);
			})
			.then(() => {
				progressBar.setCompleted();
				event.sender.send('csv-did-succeed', `${csvName}.csv`)
			})
			.catch(err => {
				progressBar.setCompleted();
				console.log('ERROR: main.js#did-submit-form2 - Error while exp:', err);
				event.sender.send('processing-did-fail', err);
			})

		progressBar
			.on('completed', function () {
				progressBar.detail = 'Task completed. Exiting...';
			})
			.on('aborted', function () {
				console.info('aborted...');
			});
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
