const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')

getInstallerConfig()
	.then(createWindowsInstaller)
	.catch((error) => {
		console.error(error.message || error)
		process.exit(1)
	})

function getInstallerConfig() {
	console.log('creating windows installer')
	const rootPath = path.join('./')
	const outPath = path.join(rootPath, '')

	return Promise.resolve({
		appDirectory: path.join(outPath, 'Europarl-win32-x64/'),
		authors: 'Gautier Morel',
		noMsi: false,
		outputDirectory: path.join(outPath, 'windows-installer'),
		exe: 'Europarl.exe',
		setupExe: 'EuroparlAppInstaller.exe',
		// setupIcon: path.join(rootPath, 'assets', 'icons', 'win', 'icon.ico')
	})
}