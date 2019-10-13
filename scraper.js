'use strict';

const request = require('request');
const xml2js = require('xml2js');

const fs = require('fs');

module.exports = class Scraper {
	constructor() {
		this.ENDPOINT = 'https://www.europarl.europa.eu';
	}

	getAmendments(query) {
		return new Promise((resolve, reject) => {
			let { year = '2019', month = '02', day = '14', pv = '8' } = query || {};
			console.log('UR:', `${this.ENDPOINT}/RegData/seance_pleniere/proces_verbal/${year}/${month}-${day}/liste_presence/P${pv}_PV(${year})${month}-${day}(RCV)_XC.xml`)
			this.doRequest({ method: 'GET', url: `${this.ENDPOINT}/RegData/seance_pleniere/proces_verbal/${year}/${month}-${day}/liste_presence/P${pv}_PV(${year})${month}-${day}(RCV)_XC.xml` })
				.then(xml => this.convertToJSON(xml))
				.then(la => {
					let listAmendments = la.map(a => a && a['RollCallVote.Description.Text'])

					let amendments = [];

					for (let i = 0; i < listAmendments.length; i++) {
						let { _: amendment, a: details } = (listAmendments[i] && Array.isArray(listAmendments[i]) && listAmendments[i][0]) || [];
						let { _: title } = (details && Array.isArray(details) && details[0]) || {};
						amendments.push({ id: i + 1, name: `${title}${amendment}` });
					}

					return resolve({ page: 1, pages: 1, data: amendments, total: amendments.length });
				})
				.catch(err => {
					console.log('ERROR: scraper.js#getAmendments - Error while requesting europarl:', err);
					return reject();
				})
		})
	}

	getVotes(query) {
		return new Promise((resolve, reject) => {
			let { amendmentIds = [], year = '2019', month = '02', day = '14', pv = '8' } = query || {};
			let listVotes = null;

			this.doRequest({ method: 'GET', url: `${this.ENDPOINT}/RegData/seance_pleniere/proces_verbal/${year}/${month}-${day}/liste_presence/P${pv}_PV(${year})${month}-${day}(RCV)_XC.xml` })
				.then(xml => this.convertToJSON(xml))
				.then(data => {
					listVotes = data;
					return this.getMepsList({ year: year, month: month })
				})
				.then(meps => {
					if (!listVotes || !meps) return reject();

					listVotes = listVotes.filter(v => v.$.Number === `${amendmentIds.find(id => `${id}.` === `${v.$.Number}`)}.`); // FOR DEV PURPOSE

					let votes = [];

					for (let i = 0; i < listVotes.length; i++) {
						let { 'RollCallVote.Description.Text': text = [], 'Result.For': resultsFor = [], 'Result.Against': resultAgainst = [], 'Result.Abstention': resultAbstention = [] } = listVotes[i] || {};

						let { _: amendment, a: details } = (text && Array.isArray(text) && text[0]) || [];
						let { _: title } = (details && Array.isArray(details) && details[0]) || {};

						let amendmentName = `${title}${amendment}`;
						let mepsFor = [];
						let mepsAgainst = [];
						let mepsAbstention = [];

						let { 'Result.PoliticalGroup.List': PoliticalGroupListFor = [] } = resultsFor.find(r => r['Result.PoliticalGroup.List']);
						let { 'Result.PoliticalGroup.List': PoliticalGroupListAgainst = [] } = resultAgainst.find(r => r['Result.PoliticalGroup.List']);
						let { 'Result.PoliticalGroup.List': PoliticalGroupListAbstention = [] } = resultAbstention.find(r => r['Result.PoliticalGroup.List']);

						for (let j = 0; j < PoliticalGroupListFor.length; j++) {
							let { 'Member.Name': mepsListFor = [] } = PoliticalGroupListFor[j]
							mepsFor = mepsFor.concat(mepsListFor.map(m => m._.toUpperCase()));
						}

						for (let j = 0; j < PoliticalGroupListAgainst.length; j++) {
							let { 'Member.Name': mepsListAgainst = [] } = PoliticalGroupListAgainst[j]
							mepsAgainst = mepsAgainst.concat(mepsListAgainst.map(m => m._.toUpperCase()));
						}

						for (let j = 0; j < PoliticalGroupListAbstention.length; j++) {
							let { 'Member.Name': mepsListAbstention = [] } = PoliticalGroupListAbstention[j]
							mepsAbstention = mepsAbstention.concat(mepsListAbstention.map(m => m._.toUpperCase()));
						}

						for (let j = 0; j < meps.length; j++) {
							let { userId, name, aliases } = meps[j] || {};

							aliases = aliases.map(a => a.toUpperCase());

							let vote = 'NC';
							if (mepsFor.find(d => d === aliases.find(a => a === d))) vote = '+';
							else if (mepsAgainst.find(d => d === aliases.find(a => a === d))) vote = '-';
							else if (mepsAbstention.find(d => d === aliases.find(a => a === d))) vote = 'ABS';

							if (votes[`mep_${userId}`] && Array.isArray(votes[`mep_${userId}`])) votes[`mep_${userId}`].push({ name: name, amendmentName: amendmentName, vote: vote })
							else votes[`mep_${userId}`] = [{ name: name, amendmentName: amendmentName, vote: vote }]
						}
					}

					return resolve(votes);
				})
				.catch(() => { })
		})
	}

	getMepsList(options) {
		let { year = '2014', month = '01' } = options || {};
		let kind = '2014';

		if ((parseInt(year, 10) === 2019 && parseInt(month, 10) >= 5) || parseInt(year, 10) > 2019) kind = '2019';

		return new Promise((resolve, reject) => {
			fs.readFile(`${__dirname}/datasets/mep_${kind}.json`, function (err, data) {
				let meps = JSON.parse(data);
				if (err) return reject(err);
				if (!meps || !Array.isArray(meps) || meps.length === 0) return reject();
				return resolve(meps);
			})
		})
	}

	convertToJSON(data) {
		return new Promise((resolve, reject) => {
			let parser = new xml2js.Parser();

			return parser.parseString(data, function (err, res) {
				if (err) return reject(err);
				let { 'RollCallVote.Result': results = [] } = (res && res['PV.RollCallVoteResults'] && res['PV.RollCallVoteResults']) || {};
				return resolve(results);
			});
		})
	}

	doRequest(options) {
		return new Promise((resolve, reject) => {
			request(options, (err, r, res) => {
				if (err) return reject(err);
				return resolve(res);
			})
		})
	}
}