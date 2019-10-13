const { createWindowsInstaller } = require('electron-winstaller');
const path = require('path')

function getInstallerConfig() {
	console.log('INFO: windows-installer.js#getInstallerConfig');
	const rootPath = path.join('./')
	const outPath = path.join(rootPath, 'release-builds')

	return Promise.resolve({
		appDirectory: path.join(outPath, 'europarl-win32-ia32/'),
		authors: 'Gautier Morel',
		noMsi: false,
		outputDirectory: path.join(outPath, 'windows-installer'),
		exe: 'Europarl.exe',
		setupExe: 'EuroparlAppInstaller.exe',
		setupIcon: path.join(rootPath, 'assets', 'ico', 'europarl.ico')
	})
}

getInstallerConfig()
	.then(createWindowsInstaller)
	.catch((error) => {
		console.error(error.message || error)
		process.exit(1)
	})