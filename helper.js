const fs = require('fs');
const xml2js = require('xml2js');

function getXML() {
	let parser = new xml2js.Parser();
	fs.readFile(`${__dirname}/deputies.xml`, function (err, data) {
		parser.parseString(data, function (err, res) {
			let { mep: deputies = [] } = (res && res.meps) || {}

			for (let i = 0; i < deputies.length; i++) {
				let deputy = deputies[i];
				console.log('deputy=', deputy && JSON.stringify(deputy));
			}
			console.log('Done');
		});
	});
}

getXML();