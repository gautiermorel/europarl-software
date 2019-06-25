'use strict';

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const xml2js = require('xml2js');
const XLSX = require('xlsx');

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

	getDocumentName() {
		return this.DOCUMENT_NAME;
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

			return resolve({ amendmentName, proDeputies, againstDeputies, abstentionDeputies });
		})
	}

	getDeputiesNames() {
		return new Promise((resolve, reject) => {
			let parser = new xml2js.Parser();
			fs.readFile(`${__dirname}/deputies.xml`, function (err, data) {
				parser.parseString(data, function (err, res) {
					let { mep: deputies = [] } = (res && res.meps) || {}

					// for (let i = 0; i < deputies.length; i++) {
					// 	let deputy = deputies[i];
					// }
					deputies = deputies.map(d => d && d.fullname)
					return resolve(deputies);
				});
			});
		})
	}

	exportCSV(votes) {
		return new Promise((resolve, reject) => {
			this.getDeputiesNames()
				.then(deputies => {
					let myExport = [];

					for (let i = 0; i < deputies.length; i++) {
						if (i === 0) myExport.push(['Députés'])
						let deputyFullName = deputies[i]
						myExport.push([deputyFullName]);
					}

					for (let i = 0; i < votes.length; i++) {
						let { amendmentName = '', proDeputies, againstDeputies, abstentionDeputies } = votes[i];

						myExport[0].push(`,${amendmentName}`);

						for (let j = 0; j < deputies.length; j++) {
							let [deputyFullName] = deputies[j];
							if (proDeputies.find(p => deputyFullName.match(new RegExp(p, 'i')))) myExport[j + 1].push(',+');
							else if (againstDeputies.find(p => deputyFullName.match(new RegExp(p, 'i')))) myExport[j + 1].push(',-');
							else if (abstentionDeputies.find(p => deputyFullName.match(new RegExp(p, 'i')))) myExport[j + 1].push(',0');
							else myExport[j + 1].push(',ABS');
						}
					}

					let content = '';

					for (let i = 0; i < myExport.length; i++) {
						let cells = myExport[i];

						for (let j = 0; j < cells.length; j++) {
							let cell = cells[j];
							content += cell;
							if (j === cells.length - 1) content += '\n';
						}
					}

					fs.appendFile(this.CSV_NAME, content, 'utf8', err => {
						if (err) return reject(err);
						this.convertToXLSX()
							.then(() => resolve('SAVED'))
							.catch(err => reject(err))
					});
				})
				.catch(err => {
					console.log('ERORR:', err);
				})
		})
	}

	exportXLSX(votes) {
		return new Promise((resolve, reject) => {
			let fileName = this.getFileName();
			let documentName = this.getDocumentName();
			this.getDeputiesNames()
				.then(deputies => {
					let data = [];

					for (let j = 0; j < deputies.length; j++) {
						let [deputyFullName] = deputies[j];
						let row = {};

						for (let i = 0; i < votes.length; i++) {
							let { amendmentName = '', proDeputies, againstDeputies, abstentionDeputies } = votes[i];

							row['Députés'] = deputyFullName;
							if (proDeputies.find(p => deputyFullName.match(new RegExp(p, 'i')))) row[amendmentName] = '+';
							else if (againstDeputies.find(p => deputyFullName.match(new RegExp(p, 'i')))) row[amendmentName] = '-';
							else if (abstentionDeputies.find(p => deputyFullName.match(new RegExp(p, 'i')))) row[amendmentName] = '0';
							else row[amendmentName] = 'ABS';
						}

						data.push(row);
					}

					let ws = XLSX.utils.json_to_sheet(data);
					let wb = XLSX.utils.book_new();

					XLSX.utils.book_append_sheet(wb, ws, documentName);
					XLSX.writeFile(wb, `${fileName}.xlsx`);
					return resolve(true);
				})
		})
	}

	convertToXLSX(data) {
		return new Promise((resolve, reject) => {
			let fileName = this.getFileName();
			// const workBook = XLSX.readFile(`${fileName}.csv`);
			// XLSX.writeFile(workBook, `${fileName}.xlsx`, { bookType: 'csv' });

			let data = [
				{ name: 'John', city: 'Seattle' },
				{ name: 'Mike', city: 'Los Angeles' },
				{ name: 'Zach', city: 'New York' }
			];

			let ws = XLSX.utils.json_to_sheet(data);
			let wb = XLSX.utils.book_new();

			XLSX.utils.book_append_sheet(wb, ws, 'People');
			XLSX.writeFile(wb, `${fileName}.xlsx`);
			return resolve(true);
		})
	}

	normalize(str) {
		return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	}
}