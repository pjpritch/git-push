var path = require('path');
var spawn = require('child_process').spawn;

// var GitSvc = require('./index.js');
// var gitSvc1 = new GitSvc({
//   name: 'origin',
//   url: 'https://github.com/OpenCommerce/test-domain-db3.git',
//   branch: 'master',
//   sourceDir: './tmp/test-domain-db'
// });

// var gitSvc2 = new GitSvc({
//   name: 'origin',
//   url: 'https://github.com/OpenCommerce/test-domain-db.git',
//   branch: 'master',
//   sourceDir: './tmp/test-domain-db2'
//});

//gitSvc1.push()
// .then(function(){
// 	console.log('finished push to test-domain-db');

// 	return gitSvc2.clone();
// })
// .then(function(){
// 	console.log('finished clone to test-domain-db');
// })
// .catch(function(err){
// 	console.error('failed to complete test');
// 	console.error(err);
// });


// var createProc = spawn('curl', ['-X', 'DELETE', 
// 	'https://api.github.com/repos/OpenCommerce/test-domain-db5', 
// 	'--header', 'Authorization: token <insert token here>'],
// 	{cwd:'.',stdout:'inherit'});
// curl 
// -X 
// DELETE 
// https://api.github.com/repos/OpenCommerce/test-domain-db6 
// -H
// "Authorization: token <insert token here>"

// var createProc = spawn('curl', ['-X', 'POST', 
// 	'--data', '{"name": "test-domain-db5","description": "This is a test repository","homepage": "https://github.com/OpenCommerce","private": false,"has_issues": true,"has_wiki": true,"has_downloads": true}', 
// 	'https://api.github.com/orgs/OpenCommerce/repos', 
// 	'--header', 'Content-Type: application/json', 
// 	'--header', 'Authorization: token <insert token here>'],
// 	{cwd:'.',stdout:'inherit'});

// createProc.on('exit', function(code) {
//   console.log(code);
// });

// createProc.stdout.on('data', function (data) {
//   console.log('stdout: ' + data);
// });

// createProc.stderr.on('data', function (data) {
//   console.log('stderr: ' + data);
// });

// createProc.on('close', function (code) {
//   console.log('child process exited with code ' + code);
// });


var exec = require('child_process').exec;
exec('git status', {cwd:'.',stdio:'inherit'}, function(err, stdio){
	if( err ) {
		console.error('error!'+err);
	} else if( stdio.indexOf('nothing to commit, working directory clean')>-1 ) {
		console.log('clean!');
	} else {
		console.log('dirty!');
	}
});


// spawn('git', ['clone', 'https://github.com/OpenCommerce/test-domain-db.git', './tmp/test-domain-db3'], {cwd:'.',stdout:'inherit'})
//   .on('exit', function(code) {
//     console.log(code);
//   });

// curl 
// -X POST 
// -d '{"name": "test-domain-db6",
// "description": "This is a test repository",
// "homepage": "https://github.com/OpenCommerce",
// "private": false,
// "has_issues": true,
// "has_wiki": true,
// "has_downloads": true
// }' 
// https://api.github.com/orgs/OpenCommerce/repos 
// -H "Content-Type: application/json"
//-H "Authorization: token <insert token here>"
// curl -X POST -d '{"name": "test-domain-db5","description": "This is a test repository","homepage": "https://github.com/OpenCommerce","private": false,"has_issues": true,"has_wiki": true,"has_downloads": true}' https://api.github.com/orgs/OpenCommerce/repos -H "Content-Type: application/json" -H "Authorization: token <insert token here>"