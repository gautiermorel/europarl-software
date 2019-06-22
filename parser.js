'use strict';

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');

let pdfParser = new PDFParser();

module.exports = class Parser {
	constructor() {
		this.DOCUMENT_NAME = null;
		this.DOCUMENT = null;
		this.CSV_NAME = 'export.csv';
	}

	getFileName() {
		return `${this.DIR_NAME}/${this.DOCUMENT_NAME}`;
	}

	createCSV(csvName) {
		this.CSV_NAME = `${csvName}.csv`;
		return new Promise((resolve, reject) => {
			fs.open(this.CSV_NAME, 'w', err => {
				if (err) return reject(err);
				return resolve('SAVED');
			});
		})
	}

	readFile(file) {
		let extension = path.extname(file);
		this.DOCUMENT_NAME = path.basename(file, extension);
		this.DIR_NAME = path.dirname(file);

		console.log('DOCUMENT_NAME', this.DOCUMENT_NAME);

		return new Promise((resolve, reject) => {
			fs.readFile(file, (err, pdfBuffer) => {
				if (err) return reject(err);
				pdfParser.parseBuffer(pdfBuffer);
				pdfParser.on('pdfParser_dataError', errData => reject(errData));
				pdfParser.on('pdfParser_dataReady', pdfData => resolve(pdfData && pdfData.formImage && pdfData.formImage.Pages));
			})
		})
	}

	getAmendments(pages) {
		return new Promise((resolve, reject) => {
			if (!pages || !Array.isArray(pages)) return reject('NO_PAGES');
			this.DOCUMENT = pages;
			let amendments = [];

			for (let i = 0; i < 5; i++) {
				let page = pages[i]
				let { Texts: texts = [] } = page || {};

				for (let j = 0; j < texts.length; j++) {
					let text = decodeURIComponent(texts[j] && texts[j].R && texts[j].R[0] && texts[j].R[0].T).trim();
					if (text.indexOf('....') > -1) {
						let parts = text.split('....');
						let n = parts.length - 1;
						let { 0: amendment, [`${n}`]: pageStart } = parts;
						pageStart = pageStart.split('.').join('');
						amendments.push({ name: amendment, pageStart: pageStart })
					}
				}
			}
			return resolve({ amendments: amendments, totalPages: this.DOCUMENT.length });
		})
	}

	getVotes(amendmentName, pageStart, pageEnd) {
		return new Promise(resolve => {
			let total = pageEnd - pageStart + 1;

			let texts = [];

			for (let i = 0; i < total; i++) {
				let currentPage = this.DOCUMENT[pageStart + i];
				let { Texts: documents = [] } = currentPage || {};
				texts = texts.concat(documents);
			}

			let proDeputies = [];
			let againstDeputies = [];
			let abstentionDeputies = [];

			let state = null;
			let lastElement = null;
			let breakLoop = false;
			let bypass = false;
			let count = 0;

			let ob = { plus: '', minus: '', zero: '' };

			for (let j = 0; j < texts.length; j++) {
				let text = decodeURIComponent(texts[j] && texts[j].R && texts[j].R[0] && texts[j].R[0].T).trim();
				if (!breakLoop) {
					if (text === 'ПОПРАВКИ') breakLoop = true;

					if (text.indexOf('.docx') > -1) bypass = true; // End of page.
					if (bypass) count++;
					if (count === 3 || (bypass && (text === ':' || text === '+' || text === '-' || text === '0'))) {
						bypass = false;
						count = 0;
					}

					if (!bypass) {
						if (state && text !== ':' && text !== '+' && text !== '-' && text !== '0' && text !== 'ПОПРАВКИ') ob[state] += text;
						else ob[state] += ',';

						if (state && (text === ':' || text === '+' || text === '-' || text === '0')) ob[state] = ob[state].replace(new RegExp(lastElement, 'g'), '');

						if (text === '+') state = 'plus';
						if (text === '-') state = 'minus';
						if (text === '0') state = 'zero';
					}

					lastElement = text;
				}
			}

			proDeputies = ob.plus.split(',').filter(d => d !== '').map(d => d.trim());
			againstDeputies = ob.minus.split(',').filter(d => d !== '').map(d => d.trim());
			abstentionDeputies = ob.zero.split(',').filter(d => d !== '').map(d => d.trim());

			return resolve({ proDeputies, againstDeputies, abstentionDeputies });
		})
	}

	exportCSV(votes) {
		return new Promise((resolve, reject) => {
			let content = '';
			let i = 0;

			do {
				let deputy = votes.proDeputies[i];
				deputy = deputy.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
				content += `${deputy};+;\n`
				i++;
			} while (votes.proDeputies[i]);

			i = 0;
			do {
				let deputy = votes.againstDeputies[i];
				deputy = deputy.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
				content += `${deputy};-;\n`
				i++;
			} while (votes.againstDeputies[i]);

			i = 0;
			do {
				let deputy = votes.abstentionDeputies[i];
				deputy = deputy.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
				content += `${deputy};0;\n`
				i++;
			} while (votes.abstentionDeputies[i]);

			fs.appendFile(this.CSV_NAME, content, 'utf8', err => {
				if (err) return reject(err);
				return resolve('SAVED');
			});
		})
	}
}