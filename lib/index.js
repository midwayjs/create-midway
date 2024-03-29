const enquirer = require('enquirer');
const { join, relative, isAbsolute } = require('path');
const { existsSync, remove } = require('fs-extra');
const chalk = require('chalk');
const { CategorySelect } = require('./categorySelect');
const { LightGenerator } = require('light-generator');
const Spin = require('light-spinner').default;
const boilerplateList = require('@midwayjs/boilerplate-list');

function commandLineUsage(options) {
  const currentPrefix = '';
  const result = ['\nOptions:\n'];
  const optionsList = [];
  let length = 0;
  if (options) {
    for (const key of Object.keys(options)) {
      const info = options[key];
      const option = `  ${info.shortcut ? `--${info.shortcut}, ` : ''}--${key}`;
      if (option.length > length) {
        length = option.length + 4;
      }
      optionsList.push({
        option,
        info: info.usage || '',
      });
    }
  }
  optionsList.forEach(options => {
    result.push(
      currentPrefix + options.option.padEnd(length, ' ') + options.info
    );
  });

  return result.join('\n');
};

function formatArgv(argv) {
  // parse argv to key/value
  const result = {};
  const leftArgv = [];
  for (const arg of argv) {
    if (/=/.test(arg)) {
      const [key, value] = arg.split('=');
      if (/^-+/.test(key)) {
        result[key.replace(/^-+/, '')] = value;
      } else {
        leftArgv.push(arg);
      }
    } else {
      if (/^-+/.test(arg)) {
        result[arg.replace(/^-+/, '')] = true;
      } else {
        leftArgv.push(arg);
      }
    }
  }
  return [result, leftArgv];
}

// 将 t_template=dd 转换成 { template: 'dd' }
function formatUserArgv(argv) {
  const result = {};
  for (const key in argv) {
    if (key.startsWith('t_')) {
      result[key.replace(/^t_/, '')] = argv[key];
    } else {
      result[key] = argv[key];
    }
  }
  return result;
}

class AddPlugin {
  constructor() {
    this.cwd = process.cwd();
    [this.argv, this.leftArgv] = formatArgv(process.argv.slice(2));
    this.projectName = '';
    this.projectDirPath = '';
    this.template = '';
    this.checkDepInstallTimeout;
    this.templateList;
    this.options = {};
    this.commands = {
      options: {
        target: {
          usage: 'new project target directory',
          type: 'string',
        },
        type: {
          usage: 'new project type',
          type: 'string',
        },
        template: {
          usage: 'new template',
          shortcut: 't',
          type: 'string',
        },
        npm: {
          usage: 'npm client',
          type: 'string',
        },
        registry: {
          usage: 'npm registry',
          type: 'string',
        },
        all: {
          usage: 'show all built-in template',
          shortcut: 'a',
          type: 'boolean',
        },
      },
    };
  }

  async run(options = {}) {
    options = Object.assign({}, this.argv, options);
    // 填充创建目录
    if (this.leftArgv.length) {
      options.target = this.leftArgv[0];
    }
    
    if (options.h || options.help) {
      console.log(commandLineUsage(this.commands.options));
      return;
    }

    await this.newFormatCommand(options);
    await this.generator();
    await this.printUsage();
  }

  async newFormatCommand(argv) {
    for (const key of Object.keys(this.commands.options)) {
      const cmdOptions = this.commands.options[key];
      if (argv[key] && typeof argv[key] === cmdOptions.type) {
        this.options[key] = argv[key];
      }
      // shortcut
      if (this.commands.options[key].shortcut && argv[this.commands.options[key].shortcut] && typeof argv[this.commands.options[key].shortcut] === cmdOptions.type) {
        this.options[key] = argv[this.commands.options[key].shortcut];
      }
    }

    this.templateList = this.options.templateList || boilerplateList;

    this.template = this.options.template;
    if (this.options.type && this.templateList[this.options.type]) {
      this.template = this.templateList[this.options.type].package;
    }
    if (!this.template) {
      this.template = await this.userSelectTemplate();
    }

    this.options.npm = this.options.npm || 'npm';

    let projectPath = this.options.target;
    if (!projectPath) {
      projectPath = await new (enquirer).Input({
        message: 'What name would you like to use for the new project?',
        initial: 'midway-project',
      }).run();
    }
    this.projectName = projectPath;


    // 处理绝对路径
    if (isAbsolute(projectPath)) {
      this.projectDirPath = projectPath;
    } else {
      this.projectDirPath = join(this.cwd, projectPath);
    }
    // 检查是否存在
    if (existsSync(this.projectDirPath)) {
      const isOverwritten = await new (enquirer).Confirm({
        name: 'question',
        message: `The name '${projectPath}' already exists, can it be overwritten?`,
        initial: true,
      }).run();
      if (!isOverwritten) {
        process.exit();
      }
      await remove(this.projectDirPath);
    }
  }

  async generator() {
    let { projectDirPath, template } = this;
    if (!template) {
      return;
    }
    let type = 'npm';
    if (template[0] === '.' || template[0] === '/') {
      type = 'local';
      if (!isAbsolute(template)) {
        template = join(this.cwd, template);
      }
    }
    const spin = new Spin({
      text: 'Downloading Boilerplate...',
    });
    spin.start();
    try {
      const lightGenerator = new LightGenerator();
      let generator;
      if (type === 'npm') {
        // 利用 npm 包
        generator = lightGenerator.defineNpmPackage({
          npmClient: this.options.npm || 'npm',
          npmPackage: template,
          registryUrl: this.options.registry,
          targetPath: projectDirPath,
        });
      } else {
        // 利用本地路径
        generator = lightGenerator.defineLocalPath({
          templatePath: template,
          targetPath: projectDirPath,
        });
      }
      await generator.run(formatUserArgv(this.argv));
      spin.stop();
    } catch (e) {
      spin.stop();
      throw e;
    }
  }

  // 用户选择模板
  async userSelectTemplate() {
    if (!this.options.all) {
      for (const key of Object.keys(this.templateList)) {
        if (this.templateList[key]['hidden'] === true) {
          delete this.templateList[key];
        }
      }
    }
    const prompt = new CategorySelect({
      name: 'templateName',
      message: 'Hello, traveller.\n  Which template do you like?',
      groupChoices: this.templateList,
      result: value => {
        return value.split(' - ')[0];
      },
      show: true,
    });
    const type = await prompt.run();
    return this.templateList[type].package;
  }

  printUsage() {
    console.log(
      'Successfully created project',
      chalk.hex('#3eab34')(this.projectName)
    );
    console.log('Get started with the following commands:');
    console.log('');
    console.log(
      chalk.hex('#777777')(
        `$ cd ${relative(this.cwd, this.projectDirPath)}`
      )
    );
    console.log(chalk.hex('#777777')('$ npm install'));
    console.log(chalk.hex('#777777')('$ npm run dev'));
    console.log('');
    console.log('');
    console.log(chalk.hex('#3eab34')('Thanks for using Midway'));
    console.log('');
    console.log(
      'Document ❤ Star:',
      chalk.hex('#1C95E2')('https://github.com/midwayjs/midway')
    );
    console.log('');
  }
}

exports.AddPlugin = AddPlugin;