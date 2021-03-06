/**
 * Copyright (c) Konstantin Tarkus (@koistya). All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var errorLog = require('debug')('error');
var debug = require('debug')('git-service');
var trace = require('debug')('trace-git-service');

var api_host = 'https://api.github.com';

function GitService( config ) {
  trace('GitService constructor: '+JSON.stringify(config));
  this.sourceDir = config.sourceDir || './tmp/engine_db';


  if (!path.isAbsolute(this.sourceDir) && process) {
    this.sourceDir = path.join(process.cwd(), this.sourceDir);
  }

  var remote = config.remote;

  if (typeof remote === 'string') {
    remote = {name: 'origin', url: remote, branch: 'master'};
  }

  remote.branch = remote.branch || 'master';
  remote.name = remote.name || 'origin';


  this.remote = remote,
  this.api_host = config.api_host || 'https://api.github.com';
  this.tenant_id = config.tenant_host || 'acme.opencommerce.io';

  var url = this.remote.url;

  var index = url.indexOf('//');
  var protocol = url.substring(0, index+2);
  var rest = url.substring(index+2);

  console.log('protocol: '+protocol);
  console.log('rest: '+rest);

  var parts = rest.split('/');

  this.remote_host = parts[0];
  this.organization = parts[1];
  this.repository = parts[2];

  this.provisioned = false;
}

GitService.prototype.isProvisioned = function(){
  // we should store this on the tenant context object ...
  return this.provisioned;
},

// Does the provisioning, the first time

GitService.prototype.init = function(access_token){
  var self = this, shouldClone = false;

  if( this.provisioned ) return Promise.resolve();

  return new Promise(function(resolve, reject){
    // check if remote repo exists
    // if not then create it
    existsRemoteRepo(self.organization, self.repository)
    .then(function(exists){
      if( !exists ) {
        shouldClone = true;
        return createRemoteRepo(self.organization, self.repository, access_token);
      } else {
        return Promise.resolve();
      }
    })
    .then(function(){
    // check if local working directory exists
    // if not then create it
      return ensureWorkingFolderExists(self.sourceDir);
    })
    .then(function(created){
      if( created || shouldClone ) {
        return cloneFromRemoteRepo(self.sourceDir, self.remote);
      } else {
        self.provisioned = true;
        return pullLatestFromRemoteRepo(self.sourceDir, self.remote);
      }
    })
    .then(function(){
      resolve();

      // we should store this on the tenant context object (domain/org/app)
      self.provisioned = true;
    })
    .catch(function(err){
      reject(err);
    });
  });
};

GitService.prototype.sync = function(){
  var self = this;

  return new Promise(function(resolve, reject){
    // pull in any changes and/or clone from remote repo
    syncFromRemote(self.sourceDir, self.remote)
    .then(function(){
      debug('sync from remote succeeded!');

      // stage files, commit to local git and push to remote repo
      return syncToRemote(self.sourceDir, self.remote);
    })
    .then(function(){
      debug('sync to remote succeeded!');
      resolve();
    })
    .catch(function(err){
      error('error: '+err);
      reject(err);
    });
  });
};

  // clone latest from remote (git clone <remote> <branch> <repo>)
 
  // 0. create directories (if necessary) 
  // 1. git clone <remote> <branch> <sourceDir>
GitService.prototype.clone = function(){
  var self = this;
  return new Promise(function(resolve, reject){
    clone( self.sourceDir, self.remote, function(){
      resolve();
    })
  });
};

  // pull the latest from remote (git pull <remote> <branch> <repo>)

  // 0. if directories don't exist, then clone instead
  // 1. otherwise, git pull <remote> <branch>
GitService.prototype.pull = function(){
  return new Promise(function(resolve, reject){
    reject(new Error('unimplemented!'));
  });
};

  // push new files to repo

  // 0. create directories (if necessary) 
  // 1. git init (unless already a git repo)
  // 2. set up remote (unless already exists)
  // 3. set up branch (unless already exists)
  // 4. call git push <remote> <branch> (if new)
  // 5. fetch remote repo
  // 6. ... write bootstrap files for tenant type ... (if new)
  // 7. add all new files
  // 8. commit -m 'Initial import'
  // 9. git push <remote> <branch>
GitService.prototype.push = function(){
  var self = this;
  return new Promise(function(resolve, reject){
    push( self.sourceDir, self.remote, function(){
      resolve();
    })
  });
};


function syncToRemote(workDir, remote){
  var self = this;

  return new Promise(function(resolve, reject){
    exec('git status', {cwd:self.sourceDir,stdio:'inherit'}, function(err, stdio, stderr){
      if( err ) {
        error('error!'+err+': needs git init call');
        reject(err);
      } else if( stdio.indexOf('nothing to commit, working directory clean')>-1 ) {
        if( stdio.indexOf('Your branch is ahead of ')>-1 ) {
          console.log('clean, but needs push!');
          spawn('git', ['push',remote.name,remote.branch], {cwd:workDir,stdio:'inherit'})
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
                spawn('git', ['push',remote.name,remote.branch], {cwd:workDir,stdio:'inherit'})
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
  });
}

// Internal API

// Returns a promise that indicates if the remote repo exists yet
/**
 *
 *  callback: (err, isNew (created))
 *
 **/
function existsRemoteRepo(organization_id, repo_name, cb) {
  trace('existsRemoteRepo: '+organization_id+'/'+repo_name);
  cb = cb || function() {};

  if(!organization_id || !repo_name ) {
    throw new Error('need org id & repo name to test for existence');
  }

  // Start with an empty promise
  return new Promise(function(resolve, reject) {
    var options = {};
    var response = '';

    exec('curl -X GET '+api_host+'/repos/'+organization_id+'/'+repo_name, function(error, stdout, stderr){
      if( error ) {
        reject( error );
        cb( error );
      } else {
        var responseObj = JSON.parse(stdout);
        var found = (responseObj.message !== 'Not Found');

        resolve(null, found);
        cb(null, found);
      }
    });

  });
}

// Returns a promise for deleting a remote repository
/**
 *
 *  callback: (err)
 *
 **/
function deleteRemoteRepo(organization_id, repo_name, access_token, cb) {
  trace('deleteRemoteRepo');
  cb = cb || function() {};

  if(!organization_id || !repo_name || !access_token ) {
    throw new Error('need org id, repo name and access token to delete a repo');
  }

  // Start with an empty promise
  return new Promise(function(resolve, reject) {
    var options = {stdio: 'inherit'};

    spawn('curl', ['-X', 'DELETE', 
      api_host+'/repos/'+organization_id+'/'+repo_name,
      '--header', 'Authorization: token '+ access_token], options)
    .on('exit', function(code){
      if(code === 0) {
        resolve();
        cb();
      } else {
        var err = new Error('could not delete repo: '+organization_id+'/'+repo_name);
        reject(err);
        cb(err);
      }
    })

  });
}

// Returns a promise for creating a remote repository
function createRemoteRepo(organization_id, repo_name, access_token, cb) {
  trace('createRemoteRepo');
  cb = cb || function() {};

  if(!organization_id || !repo_name || !access_token ) {
    throw new Error();
  }

  var options = {stdio: 'inherit'};
  var message = 'Created ' + new Date().toISOString();

  // Start with an empty promise
  return new Promise(function(resolve, reject) {

    spawn('curl', ['-X', 'POST', 
      '--data', '{"name": "'+repo_name+'","description": "'+message+'","homepage": "https://github.com/OpenCommerce","private": false,"has_issues": true,"has_wiki": true,"has_downloads": true}', 
      api_host+'/orgs/'+organization_id+'/repos', 
      '--header', 'Content-Type: application/json', 
      '--header', 'Authorization: token '+ access_token], options)
    .on('exit', function(code){
      if(code === 0) {
        resolve();
        cb();
      } else {
        var err = new Error('Failed to create git repo: '+organization_id+'/'+repo_name);
        reject(err);
        cb(err);
      }
    })

  });
}

// Returns a promise to verify or create a local working directory
function ensureWorkingFolderExists(sourceDir, cb){
  trace('ensureWorkingFolderExists: '+sourceDir);
  cb = cb || function() {};

  return new Promise(function(resolve, reject) {

    fs.exists(sourceDir, function(err, exists){
      if( err ) {
        reject( err );
      } else {
        if( !exists ) {
          debug('creating working folder: '+sourceDir);
          fs.mkdir(sourceDir, function(err){
            if( err ) {
              debug('mkdir error! '+err);
              reject( err );
              cb(err);
            } else {
              debug('mkdir success!')
              resolve(true);
              cb(null, true);
            }
          });
        } else {
          debug('mkdir success!')
          resolve(false);
          cb(null, false);
        }
      }
    });

  });
}

// Returns a promise to clone a remote repo to a local working directory
function cloneFromRemoteRepo(targetDir, remote, cb) {
  trace('cloneFromRemoteRepo');
  cb = cb || function() {};

  return new Promise(function(resolve, reject){
    var options = {cwd:targetDir, stdio:'inherit'};

    console.log('cloning latest into '+targetDir);
    spawn('git', ['clone', remote.url, '.'], options)
    .on('exit', function(code) {
      if (code === 0) {
        resolve();
        cb();
      } else {
        var err = new Error('Failed to clone '+remote.url+' into '+targetDir);
        reject(err);
        cb(err);
      }
    });

  });
}

function fetchFromRemoteRepo(targetDir, remote, cb) {
  trace('fetchFromRemoteRepo');
  cb = cb || function(){};

  return new Promise(function(resolve, reject) {
    var options = {cwd:targetDir, stdio:'inherit'};

    debug('Fetching remote repository...');
    spawn('git', ['fetch', remote.name], options)
    .on('exit', function(code) {
      if (code === 0) {
        debug('Fetch ');
        resolve();
        cb();
      } else {
        var err = new Error('Failed to fetch the remote repository ' + remote.url);
        debug('Failed to fetch from remote repository: '+remote.url);
        reject(err);
        cb(err);
      }
    });

  });
}

// Returns a promise to pull latest from remote repo to a local working directory
function pullLatestFromRemoteRepo( targetDir, remote, cb ) {
  trace('pullLatestFromRemoteRepo');
  cb = cb || function(){};

  return new Promise(function(resolve, reject){
    var options = {cwd:targetDir, stdio:'inherit'};

    debug('pulling latest from '+remote.name+'/'+remote.branch+' into '+targetDir);
    spawn('git', ['pull', remote.name, remote.branch], options)
    .on('exit', function(code) {
      if (code === 0) {
        resolve();
        cb();
      } else {
        var err = new Error('Failed to pull the latest from '+remote.name+'/'+remote.branch+' into '+targetDir);
        reject(err);
        cb(err);
      }
    });

  });
}

// Returns a promise to verify or add a remote to the remote repo
function ensureRepoRemoteExists( targetDir, remote, cb ) {
  trace('ensureRepoRemoteExists');
  cb = cb || function(){};

  return new Promise(function(resolve, reject){
    var options = {cwd:targetDir, stdio:'inherit'};

    exec('git config --get remote.' + remote.name + '.url', options, function(err, stdout) {
      if (stdout.trim() === '') {
        spawn('git', ['remote', 'add', remote.name, remote.url], options)
          .on('exit', function() {
            console.log('Add a new remote ' + remote.url + '(' + remote.name + ')');
            resolve();
            cb();
          });
      } else if (stdout.trim() !== remote.url) {
        spawn('git', ['remote', 'set-url', remote.name, remote.url], options)
          .on('exit', function() {
            console.log('Set \'' + remote.name + '\' remote to ' + remote.url);
            resolve();
            cb();
          });
      } else {
        resolve();
        cb();
      }
    });

  });
}

function ensureRepoBranchExists( targetDir, remote, cb ) {
  trace('ensureRepoBranchExists');
  cb = cb || function(){};

  return new Promise(function(resolve) {
    var options = {cwd:targetDir, stdio:'inherit'};

    exec('git ls-remote ' + remote.name + ' ' + remote.branch, options, function(err, stdout) {
      if(err){
        reject(err);
        cb(err);
      } else if (stdout.trim() === '') {
        spawn('git', ['add', '.'], options)
          .on('exit', function() {
            spawn('git', ['commit', '-m', message], options)
              .on('exit', function() {
                spawn('git', ['push', remote.name, remote.branch], options)
                  .on('exit', function() {
                    resolve();
                    cb();
                  });
              });
          });
      } else {
        resolve();
      }
    });
  });
}

// Calls git init on a local working directory
/**
 *
 *  callback: (err, isNew)
 *
 **/
function initializeWorkingFolder( sourceDir, cb ) {
  trace('initializeWorkingFolder');

  return new Promise(function(resolve, reject) {

    if (!fs.existsSync(path.join(sourceDir, '.git'))) {
      debug(sourceDir+'/.git does not exist.  Calling \'git init\' on it.');

      spawn('git', ['init'], {cwd:sourceDir})
      .on('exit', function(code) {
        if (code === 0) {
          debug('git init success');
          resolve(true);
          cb(null, true);
        } else {
          debug('git init failed');
          var err = new Error('Failed to initialize a new Git repository at '+sourceDir);
          reject(err);
          cb(err);
        }
      });
    } else {
      debug(sourceDir+'/.git already exists.');
      resolve(false);
      cb(null, false);
    }

  });
}

function push(sourceDir, remote, cb) {

  if (!path.isAbsolute(sourceDir) && process) {
    sourceDir = path.join(process.cwd(), sourceDir);
  }

  if (typeof remote === 'string') {
    remote = {name: 'origin', url: remote, branch: 'master'};
  }

  remote.branch = remote.branch || 'master';
  remote.name = remote.name || 'origin';

  cb = cb || function() {};

  var options = {cwd: sourceDir, stdio: 'inherit'};
  var message = 'Update ' + new Date().toISOString();

  // Start with an empty promise
  initializeWorkingFolder( sourceDir )

    //
    // Set a remote repository URL
    // -------------------------------------------------------------------------
    .then(function() {
      return ensureRepoRemoteExists(sourceDir, remote);
    })

    //
    // Check if target branch exists
    // -------------------------------------------------------------------------
    .then(function() {
      return ensureRepoBranchExists(sourceDir, remote);
    })

    //
    // Fetch the content of the remote repository
    // -------------------------------------------------------------------------
    .then(function() {
      return new Promise(function(resolve, reject) {
        console.log('Fetching remote repository...');
        spawn('git', ['fetch', remote.name], options)
          .on('exit', function(code) {
            if (code === 0) {
              resolve();
            } else {
              reject('Failed to fetch the remote repository ' + remote.url);
            }
          });
      });
    })

    //
    // Reset the local branch to the remote one
    // -------------------------------------------------------------------------
    .then(function() {
      return new Promise(function(resolve, reject) {
        var commit = remote.name + '/' + remote.branch;
        spawn('git', ['reset', '--soft', commit], options)
          .on('exit', function(code) {
            if (code === 0) {
              resolve();
            } else {
              reject('Failed to reset the local branch to ' + commit + '.');
            }
          });
      });
    })

    //
    // Add new/modified/deleted files to staging area
    // -------------------------------------------------------------------------
    .then(function() {
      return new Promise(function(resolve, reject) {
        console.log('Adding files to staging area...');
        spawn('git', ['add', '--all', '.'], options)
          .on('exit', function(code) {
            if (code === 0) {
              resolve();
            } else {
              reject();
            }
          });
      });
    })

    //
    // Create a new commit
    // -------------------------------------------------------------------------
    .then(function() {
      return new Promise(function(resolve, reject) {
        console.log('Creating a new commit...');
        spawn('git', ['commit', '-m', message], options)
          .on('exit', function(code) {
            if (code === 0) {
              resolve();
            } else {
              reject();
            }
          });
      });
    })

    //
    // Push to remote
    // -------------------------------------------------------------------------
    .then(function() {
      return new Promise(function(resolve, reject) {
        console.log('Pushing to ' + remote.url);
        spawn('git', ['push', remote.name, remote.branch], options)
          .on('exit', function(code) {
            if (code === 0) {
              cb();
            } else {
              reject();
            }
          });
      });
    })

    //
    // Catch errors
    // -------------------------------------------------------------------------
    .catch(function(err) {
      cb(err || 'Failed to push the contents.');
    });
}

function syncFromRemote(sourceDir, remote, cb) {
  return new Promise(function(resolve, reject){

    if (!path.isAbsolute(sourceDir) && process) {
      sourceDir = path.join(process.cwd(), sourceDir);
    }

    if (typeof remote === 'string') {
      remote = {name: 'origin', url: remote, branch: 'master'};
    }

    remote.branch = remote.branch || 'master';
    remote.name = remote.name || 'origin';

    cb = cb || function() {};

    var options = {cwd: sourceDir, stdio: 'inherit'};
    var message = 'Update ' + new Date().toISOString();

    //
    // Initialize a new place to work if it doesn't exist
    // -------------------------------------------------------------------------
    pullLatestFromRemoteRepo( self.sourceDir, remote )
    .then(function(){
      console.log('sucessfully synced local repo from remote');
      resolve();
      cb();
    })
    //
    // Catch errors
    // -------------------------------------------------------------------------
    .catch(function(err) {
      reject(err);
      cb(err);
    });

  });
}

module.exports = GitService;
