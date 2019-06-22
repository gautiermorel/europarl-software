'use strict';

const { ipcRenderer, remote, shell } = require('electron');
const setApplicationMenu = require('./menu');

const { dialog } = remote;

const form = document.querySelector('form.form1');
const formGenerator = document.querySelector('form.form2');

const inputs = {
	source: form.querySelector('input[name="source"]'),
	destination: form.querySelector('input[name="destination"]'),
	name: form.querySelector('input[name="name"]'),
	fps: form.querySelector('input[name="fps"]')
};

const buttons = {
	source: document.getElementById('chooseSource'),
	destination: document.getElementById('chooseDestination'),
	submit: form.querySelector('button[type="submit"]')
};

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

ipcRenderer.on('processing-did-succeed', (event, amendments) => {
	// variables.results.innerHTML = html;

	// console.log('checkboxes=', checkboxes);

	// checkboxes.amendments = html;
	variables.amendments = amendments;
	let amendmentsNames = amendments.map(a => a.name);
	let count = 0;
	for (let i = 0; i < amendmentsNames.length; i++) {
		count++;
		let amendment = amendmentsNames[i]
		let newCheckBox = document.createElement('input');

		form.setAttribute('class', 'hide');

		formGenerator.removeAttribute('class', 'hide');

		newCheckBox.type = 'checkbox';
		newCheckBox.id = `amendment_${count}`; // need unique Ids!
		newCheckBox.value = `amendment_${count}`;

		let newCheckBoxLabel = document.createElement('LABEL');
		let newCheckBoxLabelText = document.createTextNode(amendment);
		newCheckBoxLabel.setAttribute('for', `amendment_${count}`);
		newCheckBoxLabel.appendChild(newCheckBoxLabelText);

		let newDiv = document.createElement('div');
		newDiv.className = 'checkbox-amendment';


		checkboxes.parent.appendChild(newDiv);
		newDiv.appendChild(newCheckBox);
		newDiv.appendChild(newCheckBoxLabel);

		checkboxes.amendments.push(newCheckBox);
	}
});

ipcRenderer.on('generator-did-succeed', (event, votes) => {
	variables.results.innerHTML = `
	<p>PRO: ${votes.proDeputies.length}</p>
	<p>AGAINST: ${votes.againstDeputies.length}</p>
	<p>ABS: ${votes.abstentionDeputies.length}</p>`;
});

ipcRenderer.on('csv-did-succeed', (event, file) => {
	shell.showItemInFolder(`file://${file}`)
});

ipcRenderer.on('processing-did-fail', (event, error) => {
	console.error(error);
	alert('Failed :\'(');
});

buttons.source.addEventListener('click', () => {
	const file = dialog.showOpenDialog({
		properties: ['openFile']
	});
	if (file) {
		inputs.source.value = file;
	}
});

form.addEventListener('submit', (event) => {
	event.preventDefault();
	ipcRenderer.send('did-submit-form', {
		source: inputs.source.value
	});
});

formGenerator.addEventListener('submit', (event) => {
	event.preventDefault();

	let amendments = [];

	for (let i = 0; i < variables.amendments.length; i++) {
		let current = variables.amendments[i];
		let checkbox = document.getElementById(`amendment_${i + 1}`)
		if (checkbox.checked) amendments.push(current);
	}

	ipcRenderer.send('did-submit-form2', {
		name: amendments[0].name,
		pageStart: amendments[0].pageStart,
		pageEnd: amendments[0].pageEnd
	});
});
