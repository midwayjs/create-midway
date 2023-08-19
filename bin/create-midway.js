#!/usr/bin/env node
'use strict';
const { AddPlugin } = require('../dist/index');
new AddPlugin().run().catch(e => {console.error(e)});