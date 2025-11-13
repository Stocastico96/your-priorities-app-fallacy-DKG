"use strict";
const Bull = require('bull');
const fs = require('fs/promises');
const path = require('path');
const models = require('../../models/index.cjs');
const log = require('../../utils/logger.cjs');
// Note: We use the shared queue manager; this worker exposes a process() method
// that main.cjs registers on the main Bull queue with the job name 'delibai-analysis'.
async function handleDelibAiAnalysis(data, done) {
    try {
        const { analysisId, jsonld } = data || {};
        if (!analysisId || !jsonld) {
            throw new Error('Missing analysisId or jsonld in delibai-analysis job');
        }
        const baseDir = process.cwd();
        const filePath = path.join(baseDir, 'storage', 'delib-annotations', `${analysisId}.jsonld`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(jsonld, null, 2));
        await models.ModerationEvents.create({
            event_name: 'DelibAI Analysis Completed',
            properties: { analysisId, storage: filePath },
        });
        done();
    }
    catch (error) {
        log.error('delibai-analysis worker failed', { error });
        done(error);
    }
}
module.exports = {
    process: (data, done) => handleDelibAiAnalysis(data, done),
};
