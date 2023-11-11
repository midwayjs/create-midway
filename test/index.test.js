const { remove, existsSync, readFileSync } = require('fs-extra');
const { AddPlugin } = require('../lib/index');
const { join } = require('path');

const testProject = join(__dirname, 'test-project');
describe('test/index.test.js', () => {

  beforeAll(async () => {
    if (existsSync(testProject)) {
      await remove(testProject);
    }
  });

  beforeEach(async () => {
    // mock cwd
    const spy = jest.spyOn(process, 'cwd');
    spy.mockReturnValue(__dirname);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (existsSync(testProject)) {
      await remove(testProject);
    }
  })

  it('test create with target dir', async () => {
    jest.replaceProperty(process, 'argv', ['node', 'create-midway-dev', '--type=koa-v3', testProject]);
    await new AddPlugin().run();
    expect(existsSync(join(testProject, 'package.json'))).toBeTruthy();
    expect(existsSync(join(testProject, 'src'))).toBeTruthy();
  })

  it('test create with target dir and type', async () => {
    jest.replaceProperty(process, 'argv', ['node', 'create-midway-dev', '--template=./tpl', `--target=${testProject}`]);
    await new AddPlugin().run();
    expect(existsSync(join(testProject, 'package.json'))).toBeTruthy();
    expect(existsSync(join(testProject, 'test.js'))).toBeTruthy();
  })

  it('test create with target dir and absolute template', async () => {
    jest.replaceProperty(process, 'argv', ['node', 'create-midway-dev', `-t=${join(__dirname, './tpl')}`, '--bbb=cc', '--t_template=dd', testProject]);
    await new AddPlugin().run();
    expect(existsSync(join(testProject, 'package.json'))).toBeTruthy();
    expect(existsSync(join(testProject, 'test.js'))).toBeTruthy();
    expect(readFileSync(join(testProject, 'test.js'), 'utf8')).toMatch('cc');
    expect(readFileSync(join(testProject, 'test.js'), 'utf8')).toMatch('dd');
  })

});