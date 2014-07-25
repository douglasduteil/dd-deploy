
var fs = require('fs');
var sh = require('shelljs');
var path = require('path');
var chalk = require('chalk');

var _ = {}; // minimal lodash
_.assign = require('lodash.assign');
_.template = require('lodash.template');


module.exports = function (opt, done) {

  if (arguments.length === 1) {
    done = opt;
    opt = {};
  }

  var options = _.assign({
    cloneLocation: path.resolve(path.join(process.cwd(), '.tmp', 'master')),
    dirSrc: 'dist',
    branch: 'master',
    remote: 'origin',
    message: 'Update ' + new Date().toISOString(),
    add: false,
    push: true,
    tag: false,
    verbose: false,
    log: console.log
  }, opt);

  options.dirSrc = path.resolve(path.join(process.cwd(), options.dirSrc));

  function e(cmd_tmpl, data) {
    var cmd = _.template(cmd_tmpl, _.assign(data || {}, options));
    if (options.verbose) options.log('$', chalk.cyan(cmd));
    return sh.exec(cmd);
  }

  var origin_cwd = process.cwd();
  var res;

  // Get the remote.origin.url
  res = e('git config --get remote.origin.url');
  if (res.code > 0) throw new Error('Can\'t get no remote.origin.url !');

  options.repoUrl = process.env.REPO || String(res.output).split(/[\n\r]/).shift();
  if (!options.repoUrl) throw new Error('No repo link !');

  // Remove tmp file
  if (fs.existsSync(options.cloneLocation)) {
    e('rm -rf <%= cloneLocation %>');
  }

  // Clone the repo branch to a special location (clonedRepoLocation)
  res = e('git clone --branch=<%= branch %> --single-branch <%= repoUrl %> <%= cloneLocation %>');
  if (res.code > 0) {
    // try again without banch options
    res = e('git clone <%= repoUrl %> <%= cloneLocation %>');
    if (res.code > 0) throw new Error('Can\'t clone !');
  }


  // Go to the cloneLocation
  sh.cd(options.cloneLocation);

  if (sh.pwd() !== options.cloneLocation) {
    throw new Error('Can\'t access to the clone location : ' + options.cloneLocation + ' from ' + sh.pwd());
  }

  e('git clean -f -d');
  e('git fetch <%= remote %>');

  // Checkout a branch (create an orphan if it doesn't exist on the remote).
  res = e('git ls-remote --exit-code . <%= remote %>/<%= branch %>');
  if (res.code > 0) {
    // branch doesn't exist, create an orphan
    res = e('git checkout --orphan <%= branch %>');
    if (res.code > 0) throw new Error('Can\'t clone !');
  } else {
    // branch exists on remote, hard reset
    e('git checkout <%= branch %>');
  }


  if (!options.add) {
    // Empty the clone
    e('git rm --ignore-unmatch -rfq \'\\.[^\\.]*\' *');
  }


  // Copie the targeted files
  res = e('cp -rf <%= dirSrc %>/* ./');
  if (res && res.code > 0) throw new Error(res.output);
  res = e('cp -rf "<%= dirSrc %>/.[a-zA-Z0-9]*" ./');

  // Add and commit all the files

  e('git add .');
  res = e('git commit -m \'<%= message %>\'');


  if (options.tag) {
    res = e('git tag <%= tag %>');
    if (res.code > 0) console.log('Can\'t tag failed, continuing !');
  }

  // Push :)
  if (options.push) {
    e('git push --tags <%= remote %> <%= branch %>');
  }

  // Restor path...
  sh.cd(origin_cwd);
  done();
};
