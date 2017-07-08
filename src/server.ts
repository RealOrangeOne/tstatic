import * as express from 'express';

import * as AccessControl from 'express-ip-access-control';
import * as compression from 'compression';
import * as helmet from 'helmet';
import * as opbeat from 'opbeat';
import * as expectCt from 'expect-ct';
import * as referrerPolicy from 'referrer-policy';


import logging from './middleware/logging';
import basicAuthHandler from './middleware/basic-auth';
import { serveIndexHandle, indexHandle, staticFileHandle } from './middleware/static-files';
import handle404 from './middleware/404';

import { Options } from './types';

const PKG = require('../package.json');

export default function createServer(opts : Options) : express.Application {
    const app = express();

    app.use(helmet());
    app.use(helmet.hidePoweredBy({setTo: `tstatic ${PKG.version}`}));
    app.use(helmet.ieNoOpen());
    app.use(helmet.noCache());
    app.use(referrerPolicy({ policy: 'same-origin' }));
    app.use(expectCt({
        enforce: false,
        maxAge: 1000
    }));
    app.use(helmet.hsts({
        maxAge: 5184000,
        setIf: (req, res) => req.secure,
    }));

    if (process.env.NODE_ENV !== 'test') {
        app.use(logging);
    }

    if (opts.allowed_ips.length) {
        app.set('trust proxy', true);
        app.use(AccessControl({
            mode: 'allow',
            allows: opts.allowed_ips,
            statusCode: 404
        }));
    }

    if (opts.basicAuth.length) {
        app.use(basicAuthHandler(opts.basicAuth[0], opts.basicAuth[1]));
    }

    if (opts.dirList) {
        app.use(serveIndexHandle(opts.serveDir));
    } else {
        app.use(indexHandle);
    }

    app.use(staticFileHandle(opts.serveDir));
    app.use(handle404(opts.serveDir));

    app.use(compression({ level: 9 }));
    if (opts.opbeat) {
        app.use(opbeat.start({
            active: opts.opbeat
        }).middleware.express());
    }

    return app;
}
