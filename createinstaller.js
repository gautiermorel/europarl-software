const { createWindowsInstaller } = require('electron-winstaller');
const path = require('path')

function getInstallerConfig() {
	console.log('creating windows installer')
	const rootPath = path.join('./')
	const outPath = path.join(rootPath, 'release-builds')

	return Promise.resolve({
		appDirectory: path.join(outPath, 'europarl-win32-x64/'),
		authors: 'Gautier Morel',
		noMsi: false,
		outputDirectory: path.join(outPath, 'windows-installer'),
		exe: 'europarl.exe',
		setupExe: 'EuroparlInstaller.exe'
		// setupIcon: path.join(rootPath, 'assets', 'icons', 'win', 'icon.ico')
	})
}

getInstallerConfig()
	.then(createWindowsInstaller)
	.catch((error) => {
		console.error(error.message || error)
		process.exit(1)
	})