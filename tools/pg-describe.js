#!/usr/bin/env node
// @ts-check

const async = require('async');
const ERR = require('async-stacktrace');
const chalk = require('chalk').default;
const fs = require('fs-extra');
const _ = require('lodash');
const path = require('path');

const databaseDescribe = require('../lib/databaseDescribe');

const yargs = require('yargs')
  .usage('Usage: $0 <database name> [options]')
  .demandCommand(1)
  .alias('o', 'output')
  .nargs('o', 1)
  .describe('o', 'Specify a directory to output files to')
  .describe('ignore-tables', 'a list of tables to ignore')
  .array('ignore-tables')
  .describe('ignore-enums', 'a list of enums to ignore')
  .array('ignore-enums')
  .describe('ignore-columns', 'a list of columns to ignore, formatted like [table].[column]')
  .array('ignore-columns')
  .help('h')
  .alias('h', 'help')
  .example('$0 postgres', 'Describe the "postgres" database')
  .example(
    '$0 userdb -o db_description --ignore-tables a b --ignore-columns a.col1 a.col2',
    'Describe the "userdb" database; ignore specific tables and columns'
  )
  .strict();

// TODO: remove cast once `@types/yargs` is fixed
// https://github.com/yargs/yargs/issues/2175
const argv = /** @type {Record<string, any>} */ (yargs.argv);

if (argv._.length !== 1) {
  yargs.showHelp();
  process.exit(1);
}

// Disable color if we're not attached to a tty
const coloredOutput = !argv.o && process.stdout.isTTY;

const options = {
  databaseName: argv._[0],
  outputFormat: 'string',
  coloredOutput: coloredOutput,
  ignoreTables: argv['ignore-tables'] || [],
  ignoreEnums: argv['ignore-enums'] || [],
  ignoreColumns: argv['ignore-columns'] || [],
};

function formatText(text, formatter) {
  if (!argv.o && coloredOutput) {
    return formatter(text);
  }
  return text;
}

databaseDescribe.describe(options, (err, description) => {
  if (ERR(err, (err) => console.log(err))) return process.exit(1);

  if (argv.o) {
    writeDescriptionToDisk(description, argv.o);
  } else {
    printDescription(description);
  }
});

function printDescription(description) {
  _.forEach(_.sortBy(_.keys(description.tables)), (tableName) => {
    process.stdout.write(formatText(`[table] ${tableName}\n`, chalk.bold));
    process.stdout.write(description.tables[tableName]);
    process.stdout.write('\n\n');
  });

  _.forEach(_.sortBy(_.keys(description.enums)), (enumName) => {
    process.stdout.write(formatText(`[enum] ${enumName}\n`, chalk.bold));
    process.stdout.write(description.enums[enumName]);
    process.stdout.write('\n\n');
  });

  process.exit(0);
}

function writeDescriptionToDisk(description, dir) {
  async.series(
    [
      (callback) => {
        fs.emptyDir(dir, (err) => {
          if (ERR(err, callback)) return;
          callback(null);
        });
      },
      (callback) => {
        fs.mkdir(path.join(dir, 'tables'), (err) => {
          if (ERR(err, callback)) return;
          callback(null);
        });
      },
      (callback) => {
        fs.mkdir(path.join(dir, 'enums'), (err) => {
          if (ERR(err, callback)) return;
          callback(null);
        });
      },
      (callback) => {
        async.eachOf(
          description.tables,
          (value, key, callback) => {
            fs.writeFile(path.join(dir, 'tables', `${key}.pg`), value, (err) => {
              if (ERR(err, callback)) return;
              callback(null);
            });
          },
          (err) => {
            if (ERR(err, callback)) return;
            callback(null);
          }
        );
      },
      (callback) => {
        async.eachOf(
          description.enums,
          (value, key, callback) => {
            fs.writeFile(path.join(dir, 'enums', `${key}.pg`), value, (err) => {
              if (ERR(err, callback)) return;
              callback(null);
            });
          },
          (err) => {
            if (ERR(err, callback)) return;
            callback(null);
          }
        );
      },
    ],
    (err) => {
      if (ERR(err, (err) => console.log(err))) return process.exit(1);
      process.exit(0);
    }
  );
}
