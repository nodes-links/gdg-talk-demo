#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { GdgTalkDemoStack } from '../lib/gdg-talk-demo-stack';

const app = new cdk.App();
new GdgTalkDemoStack(app, 'GdgTalkDemoStack');
