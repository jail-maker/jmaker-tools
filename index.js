#!/usr/bin/env node

'use strict';

const http = require('http');
const Router = require('koa-better-router');
const body = require('koa-body');
const Koa = require('koa');

const router = new Router();
const api = new Router({ prefix: '/api/v0.0.1' });
const app = new Koa;

router.loadMethods();
api.loadMethods();

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

    console.log(ctx.request.body);

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


});

router.delete('/containers/list/:container', async ctx => {

    let body = {
        force: false,
    };

    ctx.body = body;
    ctx.type = 'application/json';

});


api.extend(router);
app.use(body());
app.use(router.middleware());
app.use(api.middleware());

http.createServer(app.callback()).listen(3346, '127.0.0.1');
