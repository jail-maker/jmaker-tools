#!/usr/bin/env node

'use strict';

const http = require('http');
const Router = require('koa-better-router')();
const Koa = require('koa');

const router = Router.loadMethods();
const app = new Koa;

router.post('/containers/builder', async ctx => {

    let body = {
        tty: false,
        force: false,
        contextPath: '',
        manifestPath: '',
    }

    ctx.body = body;
    ctx.type = 'application/json';

});

router.post('/containers/started', async ctx => {

    let body = {
        tty: false,
        rm: false,
        nat: false,
        rules: {},
        from: '',
        name: '',
        env: {},
        mounts: [
            {src: '', dest: ''},
        ],
        volumes: [
            {name: '', dest: ''},
        ],
        entry: '',
        command: '',
    }

    ctx.body = body;
    ctx.type = 'application/json';

});

router.delete('/containers/started/:container', async ctx => {

    ctx.body = body;
    ctx.type = 'application/json';

});

router.delete('/containers/list/:container', async ctx => {

    let body = {
        force: false,
    };

    ctx.body = body;
    ctx.type = 'application/json';

});


app.use(router.middleware());

http.createServer(app.callback()).listen(3346, '127.0.0.1');
