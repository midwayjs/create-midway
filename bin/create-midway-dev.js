#!/usr/bin/env node
'use strict';
const { AddPlugin } = require('../lib/index');
new AddPlugin().run().catch(e => {console.error(e)});