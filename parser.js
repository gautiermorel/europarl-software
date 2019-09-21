'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pdfParser = require('pdf-parser');

module.exports = class Parser {
	readFile(file) {
		let extension = path.extname(file);
		this.DOCUMENT_NAME = path.basename(file, extension);
		this.DIR_NAME = path.dirname(file);

		return new Promise((resolve, reject) => {
			pdfParser.pdf2json(file, (error, pdf) => {
				if (error) return reject(error)
				return resolve(pdf)
			});
		})
	}

	exportXLSX(meps, documentFolder) {
		return new Promise(resolve => {
			let data = [];
			let filePath = `${documentFolder}/export.xlsx`;

			Object.values(meps).forEach((votes) => {
				let row = {};
				for (let i = 0; i < votes.length; i++) {
					let { name, amendmentName, vote } = votes[i] || {};
					if (i === 0) row.MEP = name;
					row[amendmentName] = vote;
				}
				data.push(row);
			})

			let ws = XLSX.utils.json_to_sheet(data);
			let wb = XLSX.utils.book_new();

			XLSX.utils.book_append_sheet(wb, ws, 'Results');
			XLSX.writeFile(wb, filePath);
			return resolve(filePath);
		})
	}
}