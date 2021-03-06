var path = require('path');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

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

var workDir = './tmp/acme.opencommerce.io';

var exec = require('child_process').exec;
var firstPromise;

if(!fs.existsSync(workDir) ) {
	fs.mkdirSync(workDir);

	if(!existsRemoteRepo()){
		firstPromise = createRemoteRepo()
	} else {
		firstPromise = Promise.resolve();
	}

	firstPromise.then(function(){
		spawn('git',['clone','https://','.'],{cwd:workDir,stdio:'inherit'})
		.on('exit',function(code){
			if(code === 0){
				console.log('successfully clone repo!');
			} else {
				console.log('clone repo failed!!');
			}
		});
	})
	.catch(function(err){
		console.error('Error:\n'+err);
	})
}

exec('git status', {cwd:workDir,stdio:'inherit'}, function(err, stdio, stderr){
	if( err ) {
		console.error('error!'+err+': needs git init call');
	} else if( stdio.indexOf('nothing to commit, working directory clean')>-1 ) {
		if( stdio.indexOf('Your branch is ahead of ')>-1 ) {
			console.log('clean, but needs push!');
			spawn('git', ['push','origin','master'], {cwd:workDir,stdio:'inherit'})
			.on('exit', function(code){
				if( code === 0 ) {
					console.log('push complete!');
				}
			});
		} else {
			console.log('clean, no changes.');
		}
	} else {
		console.log('dirty! needs commit and push');
		spawn('git', ['add','--all','.'], {cwd:workDir,stdio:'inherit'})
		.on('exit', function(code){
			if( code === 0 ) {
				console.log('add complete!');
				spawn('git', ['commit','-m','service commit'], {cwd:workDir,stdio:'inherit'})
				.on('exit', function(code){
					if( code === 0 ) {
						console.log('commit complete!');
						spawn('git', ['push','origin','master'], {cwd:workDir,stdio:'inherit'})
						.on('exit', function(code){
							if( code === 0 ) {
								console.log('push complete!');
							}
						});
					}
				});
			}
		});
	}
});


// var statusProc = spawn('git', ['status'], {cwd:'.', stdio:'inherit'});

// statusProc.on('exit', function(code){
// 	console.log(code);
// });


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