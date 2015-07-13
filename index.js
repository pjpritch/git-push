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

function GitService( config ) {
  this.sourceDir = config.sourceDir || './tmp/engine_db';
  this.remote = {
    name: config.name || 'origin',
    url: config.url,
    branch: config.branch || 'master'
  };
}

GitService.prototype.init = function(){
  var self = this;
  return new Promise(function(resolve, reject){
    push( self.sourceDir, self.remote, function(){
      resolve();
    })
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
},

  // pull the latest from remote (git pull <remote> <branch> <repo>)

  // 0. if directories don't exist, then clone instead
  // 1. otherwise, git pull <remote> <branch>
GitService.prototype.pull = function(){
  return new Promise(function(resolve, reject){
    reject(new Error('unimplemented!'));
  });
},

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

// Internal API
function exists(organization_id, repo_name, cb) {
  cb = cb || function() {};

  if(!organization_id || !repo_name ) {
    throw new Error('need org id & repo name to test for existence');
  }

  var options = {cwd: sourceDir, stdio: 'inherit'};
  var message = 'Created ' + new Date().toISOString();

  // Start with an empty promise
  return new Promise(function(resolve, reject) {

    spawn('curl', ['-X', 'GET', 
      'https://api.github.com/repos/'+organization_id+'/'+repo_name],
      {cwd:'.',stdout:'inherit'})
    .on('data', function(data){
      console.log(data);
    })
    .on('exit', function(code){
      if(code === 0) {
        resolve(true);
        cb(null, true);
      } else {
        reject(false);
        cb(null, false);
      }
    })

  });

}

function deleteRemoteRepo(organization_id, repo_name, access_token, cb) {
  cb = cb || function() {};

  if(!organization_id || !repo_name || !access_token ) {
    throw new Error('need org id, repo name and access token to delete a repo');
  }

  var options = {cwd: '.', stdio: 'inherit'};
  var message = 'Deleted ' + new Date().toISOString();

  // Start with an empty promise
  return new Promise(function(resolve, reject) {

    spawn('curl', ['-X', 'DELETE', 
      'https://api.github.com/repos/'+organization_id+'/'+repo_name,
      '--header', 'Authorization: token '+ access_token],
      {cwd:'.',stdout:'inherit'})
    .on('exit', function(code){
      if(code === 0) {
        resolve();
        cb();
      } else {
        reject(new Error('could not delete repo: '+organization_id+'/'+repo_name));
      }
    })

  });

}

function createRemoteRepo(organization_id, repo_name, access_token, cb) {
  cb = cb || function() {};

  if(!organization_id || !repo_name || !access_token ) {
    throw new Error();
  }

  var options = {cwd: '.', stdio: 'inherit'};
  var message = 'Created ' + new Date().toISOString();

  // Start with an empty promise
  return new Promise(function(resolve, reject) {

    spawn('curl', ['-X', 'POST', 
      '--data', '{"name": "'+repo_name+'","description": "This is a test repository","homepage": "https://github.com/OpenCommerce","private": false,"has_issues": true,"has_wiki": true,"has_downloads": true}', 
      'https://api.github.com/orgs/'+organization_id+'/repos', 
      '--header', 'Content-Type: application/json', 
      '--header', 'Authorization: token '+ access_token],
      {cwd:'.',stdout:'inherit'})
    .on('exit', function(code){
      if(code === 0) {
        resolve();
        cb();
      } else {
        reject('Failed to create git repo: '+organization_id+'/'+repo_name);
      }
    })

  });
}

function ensureWorkingFolderExists(sourceDir){
  return new Promise(function(resolve, reject) {

    fs.exists(sourceDir, function(err, exists){
      if( err ) {
        reject( err );
      } else {
        if( !exists ) {
          console.log('creating working folder');
          fs.mkdir(sourceDir, function(err){
            if( err ) {
              reject( err );
            } else {
              resolve( true );
            }
          });
        } else {
          resolve(false);
        }
        resolve( exists );
      }
    });

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
  return new Promise(function(resolve, reject) {
        if (!fs.existsSync(path.join(options.cwd, '.git'))) {
          spawn('git', ['init'], options)
            .on('exit', function(code) {
              if (code === 0) {
                resolve();
              } else {
                reject('Failed to initialize a new Git repository.');
              }
            });
        } else {
          resolve();
        }
      });
    })

    //
    // Set a remote repository URL
    // -------------------------------------------------------------------------
    .then(function() {
      return new Promise(function(resolve) {
        exec('git config --get remote.' + remote.name + '.url', options,
          function(err, stdout) {
            if (stdout.trim() === '') {
              spawn('git', ['remote', 'add', remote.name, remote.url], options)
                .on('exit', function() {
                  console.log('Add a new remote ' + remote.url + '(' + remote.name + ')');
                  resolve();
                });
            } else if (stdout.trim() !== remote.url) {
              spawn('git', ['remote', 'set-url', remote.name, remote.url], options)
                .on('exit', function() {
                  console.log('Set \'' + remote.name + '\' remote to ' + remote.url);
                  resolve();
                });
            } else {
              resolve();
            }
          }
        );
      });
    })

    //
    // Check if target branch exists
    // -------------------------------------------------------------------------
    .then(function() {
      return new Promise(function(resolve) {
        exec('git ls-remote ' + remote.name + ' ' + remote.branch, options,
          function(err, stdout) {
            if (stdout.trim() === '') {
              spawn('git', ['add', '.'], options)
                .on('exit', function() {
                  spawn('git', ['commit', '-m', message], options)
                    .on('exit', function() {
                      spawn('git', ['push', remote.name, remote.branch], options)
                        .on('exit', function() {
                          cb();
                        });
                    });
                });
            } else {
              resolve();
            }
          }
        );
      });
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

function clone(sourceDir, remote, cb) {

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
  Promise.resolve()

    //
    // Initialize a new place to work if it doesn't exist
    // -------------------------------------------------------------------------
    .then(function(){
      return createWorkingFolder( sourceDir );
    })
   //
    // Initialize a new Git repository if it doesn't exist
    // -------------------------------------------------------------------------
    .then(function(created) {
      return new Promise(function(resolve, reject) {
        if (created) {
          console.log('cloning latest into '+options.cwd);
          spawn('git', ['clone', remote.url, '.'], options)
            .on('exit', function(code) {
              if (code === 0) {
                resolve();
              } else {
                reject('Failed to clone an existing Git repository.');
              }
            });
        } else {
          console.log('pulling latest into '+options.cwd);
          spawn('git', ['pull', remote.name, remote.branch], options)
            .on('exit', function(code) {
              if (code === 0) {
                resolve();
              } else {
                reject('Failed to pull the latest existing Git repository.');
              }
            });
        }
      });
    })

    //
    // Catch errors
    // -------------------------------------------------------------------------
    .catch(function(err) {
      cb(err || 'Failed to clone/pull the latest contents.');
    });
}

module.exports = GitService;
