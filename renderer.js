'use strict';

const { ipcRenderer, remote, shell } = require('electron');
const setApplicationMenu = require('./menu');

const { dialog } = remote;

const formQuerying = document.querySelector('form.form-querying');
const formGenerator = document.querySelector('form.form-generator');
const selectYear = document.getElementById('year-select');
const selectMonth = document.getElementById('month-select');
const selectDay = document.getElementById('day-select');
const selectPv = document.getElementById('pv-select');

const YEARS = [
	{ name: '2020', value: '2020' },
	{ name: '2019', value: '2019' },
	{ name: '2018', value: '2018' }
]

const MONTHS = [
	{ name: 'Décembre', value: '12' },
	{ name: 'Novembre', value: '11' },
	{ name: 'Octobre', value: '10' },
	{ name: 'Septembre', value: '09' },
	{ name: 'Aout', value: '08' },
	{ name: 'Juillet', value: '07' },
	{ name: 'Juin', value: '06' },
	{ name: 'Mai', value: '05' },
	{ name: 'Avril', value: '04' },
	{ name: 'Mars', value: '03' },
	{ name: 'Février', value: '02' },
	{ name: 'Janvier', value: '01' }
]

const DAYS = [
	{ name: '31', value: '31' },
	{ name: '30', value: '30' },
	{ name: '29', value: '29' },
	{ name: '28', value: '28' },
	{ name: '27', value: '27' },
	{ name: '26', value: '26' },
	{ name: '25', value: '25' },
	{ name: '24', value: '24' },
	{ name: '23', value: '23' },
	{ name: '22', value: '22' },
	{ name: '21', value: '21' },
	{ name: '20', value: '20' },
	{ name: '19', value: '19' },
	{ name: '18', value: '18' },
	{ name: '17', value: '17' },
	{ name: '16', value: '16' },
	{ name: '15', value: '15' },
	{ name: '14', value: '14' },
	{ name: '13', value: '13' },
	{ name: '12', value: '12' },
	{ name: '11', value: '11' },
	{ name: '10', value: '10' },
	{ name: '9', value: '09' },
	{ name: '8', value: '08' },
	{ name: '7', value: '07' },
	{ name: '6', value: '06' },
	{ name: '5', value: '05' },
	{ name: '4', value: '04' },
	{ name: '3', value: '03' },
	{ name: '2', value: '02' },
	{ name: '1', value: '01' }
]

const PVS = [
	{ name: 'Proposition #1', value: '1' },
	{ name: 'Proposition #2', value: '2' },
	{ name: 'Proposition #3', value: '3' },
	{ name: 'Proposition #4', value: '4' },
	{ name: 'Proposition #5', value: '5' },
	{ name: 'Proposition #6', value: '6' },
	{ name: 'Proposition #7', value: '7' },
	{ name: 'Proposition #8', value: '8' },
	{ name: 'Proposition #9', value: '9' },
	{ name: 'Proposition #10', value: '10' },
	{ name: 'Proposition #11', value: '11' },
	{ name: 'Proposition #12', value: '12' }
]

for (let i = 0; i < YEARS.length; i++) {
	let { name, value } = YEARS[i]
	selectYear.options[selectYear.options.length] = new Option(name, value);
}

for (let i = 0; i < MONTHS.length; i++) {
	let { name, value } = MONTHS[i]
	selectMonth.options[selectMonth.options.length] = new Option(name, value);
}

for (let i = 0; i < DAYS.length; i++) {
	let { name, value } = DAYS[i]
	selectDay.options[selectDay.options.length] = new Option(name, value);
}

for (let i = 0; i < PVS.length; i++) {
	let { name, value } = PVS[i]
	selectPv.options[selectPv.options.length] = new Option(name, value);
}

const checkboxes = {
	parent: document.getElementById('amendments-checkboxes'),
	amendments: []
}

const variables = {
	results: document.getElementById('results'),
	amendments: []
}

ipcRenderer.on('did-finish-load', () => {
	setApplicationMenu();
});

ipcRenderer.on('processing-did-succeed', (e, data) => {
	let { data: amendments } = data || {};
	variables.amendments = amendments;
	for (let i = 0; i < amendments.length; i++) {
		let { name: amendmentName, id: amendmentId } = amendments[i] || {};
		let newCheckBox = document.createElement('input');

		formQuerying.setAttribute('class', 'hide');
		formGenerator.removeAttribute('class', 'hide');

		newCheckBox.type = 'checkbox';
		newCheckBox.id = `amendment_${amendmentId}`; // need unique Ids!
		newCheckBox.value = amendmentId;

		let newCheckBoxLabel = document.createElement('LABEL');
		let newCheckBoxLabelText = document.createTextNode(amendmentName);
		newCheckBoxLabel.setAttribute('for', `amendment_${amendmentId}`);
		newCheckBoxLabel.appendChild(newCheckBoxLabelText);

		let newDiv = document.createElement('div');
		newDiv.className = 'checkbox-amendment';


		checkboxes.parent.appendChild(newDiv);
		newDiv.appendChild(newCheckBox);
		newDiv.appendChild(newCheckBoxLabel);

		checkboxes.amendments.push(newCheckBox);
	}
});

ipcRenderer.on('get-amendments-did-succeed', (e, xlsx) => {
	formGenerator.setAttribute('class', 'hide');
	variables.results.innerHTML = '<p>You can find the exported file <a href="" id="open-source">Downloads</a></p>\n';

	let link = document.getElementById('open-source');
	link.addEventListener('click', () => {
		shell.showItemInFolder(xlsx);
	});
	shell.openItem(xlsx);
});

ipcRenderer.on('processing-did-fail', (e, err) => {
	console.log('ERROR: renderer.js#processing-did-fail - Error while processing:', err);

	let options = {
		type: 'error',
		defaultId: 2,
		title: 'Erreur',
		message: 'Désolé, impossible de trouver une proposition correspondante à cette date.',
		detail: 'Verifier la date indiquée ainsi que la connexion internet.'
	};

	dialog.showMessageBox(null, options, () => {
	});
});

formQuerying.addEventListener('submit', (event) => {
	event.preventDefault();
	let day = (selectDay.options && selectDay.options[selectDay.selectedIndex].value) || null;
	let month = (selectMonth.options && selectMonth.options[selectMonth.selectedIndex].value) || null;
	let year = (selectYear.options && selectYear.options[selectYear.selectedIndex].value) || null;
	let pv = (selectPv.options && selectPv.options[selectPv.selectedIndex].value) || null;

	ipcRenderer.send('did-submit-form-get-amendments', { day: day, month: month, year: year, pv: pv });
});

formGenerator.addEventListener('submit', (event) => {
	event.preventDefault();

	let amendments = [];

	for (let i = 0; i < variables.amendments.length; i++) {
		let current = variables.amendments[i];
		let checkbox = document.getElementById(`amendment_${i + 1}`)
		if (checkbox.checked) amendments.push(current);
	}

	let day = (selectDay.options && selectDay.options[selectDay.selectedIndex].value) || null;
	let month = (selectMonth.options && selectMonth.options[selectMonth.selectedIndex].value) || null;
	let year = (selectYear.options && selectYear.options[selectYear.selectedIndex].value) || null;
	let pv = (selectPv.options && selectPv.options[selectPv.selectedIndex].value) || null;

	ipcRenderer.send('did-submit-form-get-votes', amendments, { day: day, month: month, year: year, pv: pv });
});
