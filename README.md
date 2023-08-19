# create-midway

npm init midway

# 扩展

如果你希望扩展，可以传递参数。

```js
'use strict';
const { AddPlugin } = require('create-midway');

new AddPlugin().run({
  npm: 'tnpm',
  templateList: {
    // 模版列表
  }
}).catch(e => {console.error(e)});
```