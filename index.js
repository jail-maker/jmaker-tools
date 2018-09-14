#!/usr/bin/env node

'use strict';

const http = require('http');
const Router = require('koa-better-router');
const body = require('koa-body');
const Koa = require('koa');

const createContainer = require('./actions/create-container');
const runContainer = require('./actions/run-container');

const TTYServer = require('./libs/tty-server');
const TTYFake = require('./libs/tty-fake');

const router = new Router();
const api = new Router({ prefix: '/api/v0.0.1' });
const app = new Koa;

router.loadMethods();
api.loadMethods();

router.post('/containers/builder', [

]);

router.post('/containers/started', [
    async (ctx, next) => { next(); },
    async ctx => {

        let body = ctx.request.body;
        let { tty = null } = body;

        if (tty) body.tty = await TTYServer.factory(tty);
        else body.tty = new TTYFake;

        tty = body.tty;

        try {

            await runContainer(body);

        } catch (error) {

            tty.write(error);

        } finally {

            tty.destructor();

        }

    }
]);

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
